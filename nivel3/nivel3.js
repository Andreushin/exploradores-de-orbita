// OWNER: Andreushin — Nivel 3 · Travesía e inserción orbital (docs/niveles/nivel-3.md).
// Lee el satélite de `eo-mision` (docs/contrato-niveles.md), simula el viaje con combustible
// finito en kg (depende de la masa, ecuación del cohete) y escribe `journey`.
import { G0, deltaV, propellantFor, resolvePieces, dryMass, systemIsp, insertionOutcome } from '../js/physics.js';
import { loadMission, saveMission, levelHref } from '../js/mision-store.js';
import { TEXTOS } from './textos.js';

// --- Reglas del nivel ---------------------------------------------------------
const TCM_FRACTION = 0.04;   // Δv de la corrección temprana = 4 % del Δv de inserción
const TCM_LATE_FACTOR = 3;   // corregir tarde cuesta 3× (el error crece con la distancia)
const SKIP_PENALTY = 1.15;   // no corregir: la inserción exige +15 %
const RISK_DV = 120;         // m/s que se pierden si un riesgo de evento se cumple
const BURN_RATE = 0.35;      // fracción del Δv requerido por segundo al mantener el frenado
const CRUISE_SECONDS = 9;    // duración visual del crucero
const TCM_AT = 0.25;         // fracción del viaje donde aparece la corrección
const EVENT_AT = 0.6;        // fracción del viaje donde aparece el evento
const FAIL_AT = 0.8;         // fracción del viaje donde se sortean las fallas por TRL (satellite.risk, Nivel 2)
const FAIL_SCIENCE = { instrument: -10, power: -5, obc: -5 }; // ciencia que se pierde si falla una pieza de esa categoría
const IONIC_ISP = 1500;      // para la sugerencia educativa
// Diseño de referencia (docs/fuentes.md) para el modo demo
const DEMO = {
  missionId: 'moon', rocketId: 'pico',
  satellite: { formFactor: 'struct-6u', pieces: ['battery', 'prop-green', 'comm-uhf', 'obc', 'inst-camera'], propellantKg: 2.5 },
};

// --- Idioma -------------------------------------------------------------------
const LANG_KEY = 'srl-lang';
let lang = (() => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es'; } catch { return 'es'; } })();
function t(key, vars = {}) {
  const v = key.split('.').reduce((o, k) => o?.[k], TEXTOS[lang]) ?? key.split('.').reduce((o, k) => o?.[k], TEXTOS.es) ?? key;
  return String(v).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}
const tx = (o) => (o && typeof o === 'object' ? o[lang] ?? o.es : o ?? '');
const fmt = (n, d = 1) => Number(n).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// --- Datos y estado -----------------------------------------------------------
let data;          // { missions, pieces, events }
let mission;       // destino
let sat;           // { dry, isp, prop0, maxProp, hasEngine, demo }
let run;           // estado de una travesía (se reinicia en cada intento)
let attempts = 0;

/** Propelente (kg) que consume un Δv con la masa actual: m · (1 − e^(−Δv / (Isp·g0))). */
export function propellantUsed(massKg, dv, isp) {
  if (!(isp > 0)) return Infinity;
  return massKg * (1 - Math.exp(-dv / (isp * G0)));
}

function newRun() {
  return {
    phase: 'brief', progress: 0, prop: sat.prop0, dvUsed: 0, log: [], events: [],
    tcm: null, insertionNeed: mission.dvRequired, burnApplied: 0, burning: false,
    outcome: null, science: 0, eventDone: false, failDone: false, currentFailure: null, lastFrame: 0, maneuvers: 0,
  };
}
const mass = () => sat.dry + run.prop;
const dvLeft = () => deltaV(sat.isp, mass(), sat.dry);

/**
 * Ejecuta una maniobra de `dv` m/s. Gasta propelente según la masa del momento.
 * Si no alcanza, gasta todo y devuelve el Δv logrado. → { dv, kg, out }
 */
function burn(dv) {
  const need = propellantUsed(mass(), dv, sat.isp);
  if (need <= run.prop) {
    run.prop -= need; run.dvUsed += dv;
    return { dv, kg: need, out: false };
  }
  const got = dvLeft();
  const kg = run.prop;
  run.prop = 0; run.dvUsed += got;
  return { dv: got, kg, out: true };
}

function log(msg, cls = '') {
  run.log.push({ msg, cls });
  const li = document.createElement('li');
  li.textContent = msg;
  if (cls) li.className = cls;
  $('n3-log').append(li);
}

// --- Persistencia (contrato) ---------------------------------------------------
function persist() {
  saveMission({
    journey: {
      dvAvailable: Math.round(deltaV(sat.isp, sat.dry + sat.prop0, sat.dry)),
      dvUsed: Math.round(run.dvUsed),
      propellantStartKg: +sat.prop0.toFixed(3),
      propellantUsedKg: +(sat.prop0 - run.prop).toFixed(3),
      tcm: run.tcm,
      events: run.events,
      insertionRatio: run.outcome ? +(run.burnApplied / run.insertionNeed).toFixed(3) : null,
      outcome: run.outcome,
      science: run.science,
      attempts,
    },
  });
}

/** Navega a otro nivel: su carpeta si ya existe, o su pantalla en la app principal. */
const goLevel = (n) => { location.href = levelHref(n); };

// --- Canvas (estilo NASA Mission Viz) -------------------------------------------
const canvas = $('n3-canvas');
const g = canvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let W = 0; let H = 0; let stars = [];

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  W = r.width; H = r.height;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  stars = Array.from({ length: 120 }, () => [rnd() * W, rnd() * H, rnd() * 1.2 + 0.2]);
}

/** Geometría de la transferencia tipo Hohmann (heliocéntrica o, para la Luna, geocéntrica). */
function geometry() {
  const moon = mission.id === 'moon';
  const cx = W / 2; const cy = H * 0.52;
  const R = Math.min(W * 0.44, H * 0.44);
  const r1 = moon ? R * 0.22 : R * Math.pow(1 / mission.distanceAU, 0.6);
  const r2 = R;
  const a = (r1 + r2) / 2; const b = Math.sqrt(r1 * r2); const ecx = cx + (r2 - r1) / 2;
  // Ángulo que recorre el destino durante la transferencia (3.ª ley de Kepler)
  const aAU = (1 + mission.distanceAU) / 2;
  const sweep = moon ? Math.PI * 0.35 : Math.PI * Math.pow(aAU / mission.distanceAU, 1.5);
  const earthSweep = moon ? 0 : Math.PI * Math.pow(aAU, 1.5);
  return { moon, cx, cy, r1, r2, a, b, ecx, sweep, earthSweep };
}
const ship = (G, p) => { const E = Math.PI * (1 - p); return [G.ecx + G.a * Math.cos(E), G.cy - G.b * Math.sin(E)]; };

function draw() {
  const G = geometry();
  g.fillStyle = '#070b1a'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(238,242,255,0.6)';
  for (const [x, y, r] of stars) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  // Cuerpo central: Sol o Tierra
  g.fillStyle = G.moon ? '#3b82f6' : '#fbbf24';
  g.shadowColor = g.fillStyle; g.shadowBlur = 24;
  g.beginPath(); g.arc(G.cx, G.cy, G.moon ? 12 : 10, 0, 7); g.fill(); g.shadowBlur = 0;
  // Órbitas
  g.strokeStyle = 'rgba(154,166,207,0.35)'; g.lineWidth = 1; g.setLineDash([3, 5]);
  if (!G.moon) { g.beginPath(); g.arc(G.cx, G.cy, G.r1, 0, 7); g.stroke(); }
  g.beginPath(); g.arc(G.cx, G.cy, G.r2, 0, 7); g.stroke(); g.setLineDash([]);
  // Transferencia: planeada (tenue) y recorrida (azul)
  g.strokeStyle = 'rgba(79,195,247,0.3)'; g.beginPath();
  g.ellipse(G.ecx, G.cy, G.a, G.b, 0, Math.PI, 2 * Math.PI); g.stroke();
  g.strokeStyle = '#4fc3f7'; g.lineWidth = 2; g.beginPath();
  g.ellipse(G.ecx, G.cy, G.a, G.b, 0, Math.PI, Math.PI + Math.PI * run.progress); g.stroke(); g.lineWidth = 1;
  // Tierra (en vista heliocéntrica) y destino
  const p = run.progress;
  if (!G.moon) {
    const ae = Math.PI + G.earthSweep * p;
    body(G.cx + G.r1 * Math.cos(ae), G.cy - G.r1 * Math.sin(ae), 6, '#3b82f6');
  }
  const ad = G.sweep * (1 - p);
  const dx = G.cx + G.r2 * Math.cos(ad); const dy = G.cy - G.r2 * Math.sin(ad);
  body(dx, dy, G.moon ? 8 : 9, mission.color, tx(mission.name));
  // Nave o resultado
  if (run.outcome === 'orbit' || run.outcome === 'eccentric') {
    const e = run.outcome === 'orbit' ? 0.15 : 0.7; const rr = run.outcome === 'orbit' ? 20 : 30;
    g.strokeStyle = run.outcome === 'orbit' ? '#4ade80' : '#fbbf24'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(dx + rr * e * 0.5, dy, rr, rr * Math.sqrt(1 - e * e), 0, 0, 7); g.stroke(); g.lineWidth = 1;
  } else if (run.outcome === 'flyby' || run.outcome === 'no-fuel') {
    dot(dx + 40, dy - 34, false);
  } else if (run.outcome === 'crash') {
    g.fillStyle = 'rgba(255,122,122,0.8)'; g.beginPath(); g.arc(dx, dy, 14, 0, 7); g.fill();
  } else {
    const [sx, sy] = ship(G, p);
    dot(sx, sy, run.burning);
  }
}
function body(x, y, r, color, label) {
  g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  if (label) { g.fillStyle = '#9aa6cf'; g.font = '12px "Space Grotesk", system-ui'; g.textAlign = 'center'; g.fillText(label, x, y + r + 15); }
}
function dot(x, y, burning) {
  if (burning) { g.fillStyle = '#ff6b35'; g.beginPath(); g.arc(x, y, 7 + Math.random() * 3, 0, 7); g.fill(); }
  g.fillStyle = '#eef2ff'; g.fillRect(x - 3, y - 3, 6, 6);
}

// --- HUD ----------------------------------------------------------------------
function renderHud() {
  const pct = sat.prop0 > 0 ? (run.prop / sat.prop0) * 100 : 0;
  const lvl = pct > 40 ? 'ok' : pct > 15 ? 'warn' : 'danger';
  $('n3-hud').innerHTML = `
    <div class="n3-fuel n3-${lvl}" role="meter" aria-label="${t('hudFuel')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}">
      <span>${t('hudFuel')}</span><b>${fmt(run.prop, 2)} kg · ${fmt(pct, 0)} %</b>
      <i class="n3-fuel-track"><i class="n3-fuel-fill" style="width:${pct}%"></i></i>
    </div>
    <div><span>${t('hudMass')}</span><b>${fmt(mass(), 2)} kg</b></div>
    <div><span>${t('hudDv')}</span><b>${fmt(dvLeft(), 0)} m/s</b></div>
    <div><span>${t('hudDay')}</span><b>${fmt(run.progress * mission.travelDays, 0)} / ${fmt(mission.travelDays, 0)}</b></div>`;
}

// --- Fases --------------------------------------------------------------------
const panel = () => $('n3-panel');
const btn = (label, cls, on) => { const b = document.createElement('button'); b.type = 'button'; b.className = `n3-btn ${cls}`; b.innerHTML = label; b.addEventListener('click', on); return b; };

function renderBrief() {
  const tcmDv = Math.round(mission.dvRequired * TCM_FRACTION);
  // Estimación en orden: TCM con la masa llena, luego MOI con la masa restante
  const m0 = sat.dry + sat.prop0;
  const kgTcm = propellantUsed(m0, tcmDv, sat.isp);
  const kgMoi = propellantUsed(m0 - kgTcm, mission.dvRequired, sat.isp);
  const total = kgTcm + kgMoi; const margin = sat.prop0 - total;
  const p = panel();
  p.innerHTML = `
    <h2>${t('briefTitle')}</h2>
    <p class="n3-muted">${t('briefHelp')}</p>
    <dl class="n3-specs">
      <div><dt>${t('dryMass')}</dt><dd>${fmt(sat.dry, 2)} kg</dd></div>
      <div><dt>${t('propellant')}</dt><dd>${fmt(sat.prop0, 2)} kg</dd></div>
      <div><dt>${t('isp')}</dt><dd>${fmt(sat.isp, 0)} s</dd></div>
      <div><dt>${t('dvAvailable')}</dt><dd>${fmt(dvLeft(), 0)} m/s</dd></div>
    </dl>
    <table class="n3-table">
      <thead><tr><th>${t('maneuver')}</th><th>${t('dv')}</th><th>${t('kgEstimate')}</th></tr></thead>
      <tbody>
        <tr><td>${t('tcmRow')}</td><td>${tcmDv} m/s</td><td>${fmt(kgTcm, 2)} kg</td></tr>
        <tr><td>${t('moiRow', { dest: esc(tx(mission.name)) })}</td><td>${mission.dvRequired} m/s</td><td>${fmt(kgMoi, 2)} kg</td></tr>
        <tr class="n3-total"><td>${t('totalRow')}</td><td>${tcmDv + mission.dvRequired} m/s</td><td>${fmt(total, 2)} kg</td></tr>
      </tbody>
    </table>
    <p class="${margin >= 0 ? 'n3-ok' : 'n3-bad'}">${t('margin')}: ${margin >= 0 ? t('marginOk', { kg: fmt(margin, 2) }) : t('marginBad', { kg: fmt(-margin, 2) })}</p>`;
  if (!sat.hasEngine) { p.insertAdjacentHTML('beforeend', `<p class="n3-bad">${t('noEngine')}</p>`); }
  if (sat.riskTotal > 0) p.insertAdjacentHTML('beforeend', `<p class="n3-warn">${t('briefRisk', { pct: fmt(sat.riskTotal * 100, 0) })}</p>`);
  p.append(btn(t('start'), 'n3-btn-primary', startCruise));
}

function startCruise() {
  attempts += 1;
  run.phase = 'cruise';
  log(t('logLaunch'));
  panel().innerHTML = '';
  run.lastFrame = performance.now();
}

function renderTcm() {
  const base = Math.round(mission.dvRequired * TCM_FRACTION);
  const late = base * TCM_LATE_FACTOR;
  const p = panel();
  p.innerHTML = `<h2>${t('tcmTitle')}</h2><p>${t('tcmText')}</p>`;
  const row = document.createElement('div'); row.className = 'n3-choices';
  row.append(
    btn(t('tcmEarly', { dv: base, kg: fmt(propellantUsed(mass(), base, sat.isp), 2) }), 'n3-btn-primary', () => chooseTcm('early', base)),
    btn(t('tcmLate', { dv: late, kg: fmt(propellantUsed(mass(), late, sat.isp), 2) }), '', () => chooseTcm('late', late)),
    btn(t('tcmSkip'), 'n3-btn-ghost', () => chooseTcm('skip', 0)),
  );
  p.append(row);
}

function chooseTcm(kind, dv) {
  run.tcm = kind;
  if (kind === 'skip') {
    run.insertionNeed = Math.round(mission.dvRequired * SKIP_PENALTY);
    log(t('logSkip'), 'n3-warn');
  } else {
    const r = burn(dv); run.maneuvers += 1;
    log(t('logBurn', { name: t(kind === 'early' ? 'tcmEarlyName' : 'tcmLateName'), dv: fmt(r.dv, 0), kg: fmt(r.kg, 2) }));
    if (r.out) return noFuel();
  }
  resume();
}

// El evento "tcm" de data/events.json repite la decisión de corrección del nivel: se excluye.
const routeEvents = () => data.events.filter((e) => e.id !== 'tcm');
function renderEvent(ev = routeEvents()[Math.floor(Math.random() * routeEvents().length)]) {
  run.currentEvent = ev;
  const p = panel();
  p.innerHTML = `<span class="n3-tag">${t('eventTag')}</span><h2>${esc(tx(ev.title))}</h2><p>${esc(tx(ev.text))}</p>`;
  const row = document.createElement('div'); row.className = 'n3-choices';
  ev.choices.forEach((c, i) => row.append(btn(esc(tx(c.label)), i === 0 ? 'n3-btn-primary' : '', () => chooseEvent(ev, c, i))));
  p.append(row);
}

function chooseEvent(ev, c, i) {
  const name = tx(ev.title);
  const rec = { id: ev.id, choice: i, hit: false, dv: 0, science: c.science || 0 };
  if (c.dv) {
    const r = burn(c.dv); rec.dv += r.dv; run.maneuvers += 1;
    log(t('logBurn', { name, dv: fmt(r.dv, 0), kg: fmt(r.kg, 2) }));
    if (r.out) { run.events.push(rec); return noFuel(); }
  }
  if (c.risk && Math.random() < c.risk) {
    rec.hit = true;
    const r = burn(RISK_DV); rec.dv += r.dv; run.maneuvers += 1;
    log(t('logRisk', { name, dv: fmt(r.dv, 0), kg: fmt(r.kg, 2) }), 'n3-warn');
    if (r.out) { run.events.push(rec); return noFuel(); }
  }
  if (c.science) {
    run.science += c.science;
    log(t('logScience', { name, sign: c.science > 0 ? '+' : '', n: c.science }), c.science > 0 ? 'n3-good' : '');
  }
  run.events.push(rec);
  resume();
}

function resume() { panel().innerHTML = ''; run.currentEvent = null; run.phase = 'cruise'; run.lastFrame = performance.now(); }

// --- Fallas por TRL (riesgo que el jugador aceptó en el Nivel 2) ---------------------
/** Sortea cada pieza de satellite.risk: [{ id, trl, p }] → las que fallan, con su pieza. */
function rollFailures() {
  return sat.risk
    .filter((r) => Math.random() < r.p)
    .map((r) => ({ ...r, piece: data.pieces.find((x) => x.id === r.id) }))
    .filter((r) => r.piece);
}

function failureEffect(f) {
  if (f.piece.category === 'propulsion') return { dv: RISK_DV, science: 0 };
  return { dv: 0, science: FAIL_SCIENCE[f.piece.category] ?? -5 };
}

function renderFailure(fails) {
  run.currentFailure = fails;
  const p = panel();
  const items = fails.map((f) => {
    const e = failureEffect(f);
    const what = e.dv ? t('failDv', { dv: e.dv }) : t('failScience', { n: -e.science });
    return `<li><b>${esc(tx(f.piece.name))}</b> (TRL ${f.trl}, ${fmt(f.p * 100, 0)} %): ${what}</li>`;
  }).join('');
  p.innerHTML = `<span class="n3-tag n3-tag-bad">${t('failTag')}</span><h2 class="n3-bad">${t('failTitle')}</h2>
    <p>${t('failText')}</p><ul class="n3-tips">${items}</ul>`;
  const row = document.createElement('div'); row.className = 'n3-choices';
  row.append(btn(t('failContinue'), 'n3-btn-primary', () => applyFailures(fails)));
  p.append(row);
}

function applyFailures(fails) {
  run.currentFailure = null;
  for (const f of fails) {
    const e = failureEffect(f);
    const name = tx(f.piece.name);
    const rec = { id: `trl-${f.id}`, choice: 0, hit: true, dv: 0, science: e.science };
    if (e.dv) {
      const r = burn(e.dv); rec.dv = r.dv; run.maneuvers += 1;
      log(t('logFailDv', { name, dv: fmt(r.dv, 0), kg: fmt(r.kg, 2) }), 'n3-warn');
      if (r.out) { run.events.push(rec); return noFuel(); }
    } else {
      run.science += e.science;
      log(t('logFailScience', { name, n: -e.science }), 'n3-warn');
    }
    run.events.push(rec);
  }
  resume();
}

function renderMoi() {
  run.phase = 'moi';
  const need = run.insertionNeed;
  const p = panel();
  p.innerHTML = `
    <h2>${t('moiTitle')}</h2>
    <p>${t('moiText', { dest: esc(tx(mission.name)) })} <b>${t('moiNeed', { dv: need })}</b></p>
    <div class="n3-precision" aria-hidden="true">
      <div class="n3-zones">
        <i class="z-flyby" style="width:${(0.75 / 1.3) * 100}%"><span>${t('zoneFlyby')}</span></i>
        <i class="z-ecc" style="width:${(0.2 / 1.3) * 100}%"><span>${t('zoneEcc')}</span></i>
        <i class="z-orbit" style="width:${(0.15 / 1.3) * 100}%"><span>${t('zoneOrbit')}</span></i>
        <i class="z-crash" style="width:${(0.2 / 1.3) * 100}%"><span>${t('zoneCrash')}</span></i>
      </div>
      <i class="n3-needle" id="n3-needle" style="left:0%"></i>
    </div>
    <p class="n3-burn-readout" id="n3-burn-readout">0 / ${need} m/s</p>`;
  const hold = btn(`${t('hold')} <small>${t('holdKey')}</small>`, 'n3-btn-primary n3-btn-burn', () => {});
  hold.addEventListener('pointerdown', (e) => { e.preventDefault(); startBurn(); });
  hold.addEventListener('pointerup', stopBurn);
  hold.addEventListener('pointerleave', stopBurn);
  hold.addEventListener('pointercancel', stopBurn);
  p.append(hold);
}

function startBurn() { if (run.phase === 'moi' && run.prop > 0) { run.burning = true; run.lastFrame = performance.now(); } }
function stopBurn() { if (run.burning) { run.burning = false; finishMoi(); } }

function updateNeedle() {
  const ratio = run.burnApplied / run.insertionNeed;
  const needle = $('n3-needle');
  if (needle) needle.style.left = `${Math.min(100, (ratio / 1.3) * 100)}%`;
  const out = $('n3-burn-readout');
  if (out) out.textContent = `${fmt(run.burnApplied, 0)} / ${run.insertionNeed} m/s`;
}

function finishMoi() {
  if (run.phase !== 'moi') return;
  const name = t('moiName');
  run.maneuvers += 1;
  log(t('logBurn', { name, dv: fmt(run.burnApplied, 0), kg: fmt(run.moiKg || 0, 2) }));
  const outcome = insertionOutcome(run.burnApplied, run.insertionNeed);
  // Si el tanque se vació antes de llegar a una órbita, es falla por combustible
  if (run.prop <= 1e-6 && (outcome === 'flyby')) return noFuel();
  run.outcome = outcome;
  run.phase = 'result';
  persist();
  renderResult();
}

function renderResult() {
  const used = sat.prop0 - run.prop;
  const p = panel();
  p.innerHTML = `
    <h2 class="${run.outcome === 'orbit' ? 'n3-ok' : 'n3-bad'}">${t(`outcomes.${run.outcome}`, { dest: esc(tx(mission.name)) })}</h2>
    <p>${t('resultStats', { kg: fmt(used, 2), pct: fmt(sat.prop0 ? (used / sat.prop0) * 100 : 0, 0), dv: fmt(run.dvUsed, 0), n: run.maneuvers })}</p>`;
  const row = document.createElement('div'); row.className = 'n3-choices';
  row.append(btn(t('toReport'), 'n3-btn-primary', () => goLevel(4)));
  if (run.outcome !== 'orbit') row.append(btn(t('retry'), '', restart));
  p.append(row);
}

function noFuel() {
  run.burning = false;
  run.outcome = 'no-fuel';
  run.phase = 'result';
  persist();
  log(t('noFuelTitle'), 'n3-warn');
  renderNoFuel();
}

function renderNoFuel() {
  // Números para la explicación: propelente necesario para TODAS las maniobras del plan
  const tcmDv = run.tcm === 'late' ? Math.round(mission.dvRequired * TCM_FRACTION) * TCM_LATE_FACTOR
    : run.tcm === 'early' ? Math.round(mission.dvRequired * TCM_FRACTION) : 0;
  const eventsDv = run.events.reduce((s, e) => s + (e.dv || 0), 0);
  const totalDv = tcmDv + eventsDv + run.insertionNeed;
  const needed = propellantFor(totalDv, sat.isp, sat.dry);
  // Masa seca máxima con la que el propelente cargado alcanzaría: m_dry = m_p / (e^(Δv/ve) − 1)
  const ratio = Math.exp(totalDv / (sat.isp * G0)) - 1;
  const dryOk = sat.prop0 / ratio;
  const neededIonic = propellantFor(totalDv, IONIC_ISP, sat.dry);
  const tips = [];
  if (dryOk > 0 && dryOk < sat.dry) tips.push(t('nfTipLighter', { kg: fmt(sat.dry - dryOk, 2) }));
  if (sat.isp < IONIC_ISP) tips.push(t('nfTipIsp', { kg: fmt(neededIonic, 2) }));
  tips.push(needed <= sat.maxProp ? t('nfTipMore', { kg: fmt(Math.ceil(needed * 10) / 10, 1), max: fmt(sat.maxProp, 1) }) : t('nfTipMoreMax', { max: fmt(sat.maxProp, 1) }));
  const p = panel();
  p.innerHTML = `
    <h2 class="n3-bad">${t('noFuelTitle')}</h2>
    <p>${t('noFuelLead')}</p>
    <dl class="n3-specs">
      <div><dt>${t('nfMass')}</dt><dd>${fmt(sat.dry + sat.prop0, 2)} kg</dd></div>
      <div><dt>${t('nfHad')}</dt><dd>${fmt(sat.prop0, 2)} kg</dd></div>
      <div><dt>${t('nfNeeded')}</dt><dd class="n3-bad">${fmt(needed, 2)} kg</dd></div>
      <div><dt>Δv</dt><dd>${fmt(totalDv, 0)} m/s</dd></div>
    </dl>
    <p class="n3-muted">${t('nfWhy', { isp: fmt(sat.isp, 0) })}</p>
    <h3>${t('nfTipsTitle')}</h3>
    <ul class="n3-tips">${tips.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  const row = document.createElement('div'); row.className = 'n3-choices';
  row.append(
    btn(t('toWorkshop'), 'n3-btn-primary', () => goLevel(2)),
    btn(t('retry'), '', restart),
    btn(t('toReport'), 'n3-btn-ghost', () => goLevel(4)),
  );
  p.append(row);
}

function restart() {
  $('n3-log').replaceChildren();
  run = newRun();
  renderBrief();
}

// --- Bucle principal ------------------------------------------------------------
function frame(now) {
  const dt = Math.min(0.1, (now - (run.lastFrame || now)) / 1000);
  run.lastFrame = now;
  if (run.phase === 'cruise') {
    const prev = run.progress;
    run.progress = Math.min(1, run.progress + (reduceMotion ? dt * 3 : dt) / CRUISE_SECONDS);
    if (prev < TCM_AT && run.progress >= TCM_AT && !run.tcm) { run.progress = TCM_AT; run.phase = 'decision'; renderTcm(); }
    else if (prev < EVENT_AT && run.progress >= EVENT_AT && !run.eventDone) { run.progress = EVENT_AT; run.eventDone = true; run.phase = 'decision'; renderEvent(); }
    else if (prev < FAIL_AT && run.progress >= FAIL_AT && !run.failDone) {
      run.failDone = true;
      const fails = rollFailures();
      if (fails.length) { run.progress = FAIL_AT; run.phase = 'decision'; renderFailure(fails); }
    }
    else if (run.progress >= 1) renderMoi();
  } else if (run.phase === 'moi' && run.burning) {
    const before = run.prop;
    const r = burn(run.insertionNeed * BURN_RATE * dt);
    run.burnApplied += r.dv;
    run.moiKg = (run.moiKg || 0) + (before - run.prop);
    updateNeedle();
    if (r.out) { run.burning = false; finishMoi(); }
  }
  draw();
  renderHud();
  requestAnimationFrame(frame);
}

function onKey(e) {
  if (e.code !== 'Space' || run.phase !== 'moi') return;
  e.preventDefault();
  if (e.type === 'keydown' && !e.repeat) startBurn();
  else if (e.type === 'keyup') stopBurn();
}

// --- Arranque -----------------------------------------------------------------
function applyLang() {
  document.documentElement.lang = lang;
  $('n3-title').textContent = t('title');
  $('n3-lead').textContent = t('lead', { dest: tx(mission.name) });
  $('n3-demo').textContent = t('demo');
  $('n3-lang').textContent = t('lang');
  $('n3-lang').setAttribute('aria-label', t('langLabel'));
  $('n3-brand-name').textContent = lang === 'en' ? 'Orbit Explorers' : 'Exploradores de Órbita';
  $('n3-menu').title = t('menu');
  $('n3-log-title').textContent = t('logTitle');
  document.title = `${t('title')} · ${lang === 'en' ? 'Orbit Explorers' : 'Exploradores de Órbita'}`;
}

async function boot() {
  const load = (f) => fetch(`../data/${f}.json`).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
  const [missions, pieces, events] = await Promise.all(['missions', 'pieces', 'events'].map(load));
  data = { missions, pieces, events };

  const saved = loadMission();
  const demo = !saved?.missionId || !saved?.satellite?.formFactor || !saved?.satellite?.pieces?.length;
  const src = demo ? DEMO : saved;
  mission = missions.find((m) => m.id === src.missionId) || missions[0];
  const parts = resolvePieces([src.satellite.formFactor, ...src.satellite.pieces].filter(Boolean), pieces);
  const engine = parts.find((p) => p.category === 'propulsion');
  sat = {
    dry: dryMass(parts),
    isp: systemIsp(parts),
    prop0: Number(src.satellite.propellantKg) || 0,
    maxProp: engine?.maxPropellantKg || 0,
    hasEngine: Boolean(engine),
    demo,
    // Riesgo por TRL que viene del Nivel 2 (opcional en el contrato): [{ id, trl, p }]
    risk: !demo && Array.isArray(src.satellite.risk) ? src.satellite.risk.filter((r) => r && r.p > 0) : [],
    riskTotal: !demo ? Number(src.satellite.riskTotal) || 0 : 0,
  };
  $('n3-demo').hidden = !demo;
  if (!saved) saveMission(DEMO); // solo si no hay nada guardado: nunca pisa datos reales

  run = newRun();
  applyLang();
  resize();
  renderBrief();
  addEventListener('resize', resize);
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  $('n3-lang').addEventListener('click', () => {
    lang = lang === 'es' ? 'en' : 'es';
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
    applyLang();
    // Re-dibuja el panel de la fase actual en el nuevo idioma
    if (run.phase === 'brief') renderBrief();
    else if (run.phase === 'result' && run.outcome === 'no-fuel') renderNoFuel();
    else if (run.phase === 'result') renderResult();
    else if (run.phase === 'moi') renderMoi();
    else if (run.phase === 'decision' && !run.tcm) renderTcm();
    else if (run.phase === 'decision' && run.currentFailure) renderFailure(run.currentFailure);
    else if (run.phase === 'decision' && run.currentEvent) renderEvent(run.currentEvent);
  });
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error(err);
  $('n3-panel').innerHTML = `<p class="n3-bad">${lang === 'en' ? 'Could not load the game data' : 'No se pudieron cargar los datos del juego'}: ${esc(err.message)}. ${lang === 'en' ? 'Serve the folder with' : 'Sirve la carpeta con'} <code>python3 -m http.server</code>.</p>`;
});
