// OWNER: Rol 3 (@JU4NMAX) — Nivel 2 · Taller del CubeSat (docs/niveles/nivel-2.md).
// Lee la misión del Nivel 1 de `eo-mision` (docs/contrato-niveles.md), deja armar el CubeSat bajo
// los límites de masa, energía y presupuesto, y escribe solo la sección `satellite`.
import { validateDesign, resolvePieces, KG_PER_U } from '../js/physics.js';
import { loadMission, saveMission, levelHref } from '../js/mision-store.js';
import { grams, meterData, rocketOverload, instrumentStatus, incompatibleSelected, powerText, signedW, checkState, tradeHints } from '../js/taller-reglas.js';
import { TEXTOS } from './textos.js';

const CATEGORIES = ['structure', 'power', 'propulsion', 'comms', 'adcs', 'obc', 'instrument'];
// Misión de ejemplo para el modo demo (diseño de referencia de la Luna, docs/fuentes.md)
export const DEMO = {
  missionId: 'moon',
  rocketId: 'pico',
  budget: { total: 100, launch: 25, space: 25, ground: 8, user: 5 },
  plan: { scienceTargetIdx: 0 },
  satellite: { formFactor: 'struct-6u', pieces: ['battery', 'prop-green', 'comm-uhf', 'obc', 'inst-camera'], propellantKg: 2.5 },
};

// --- Idioma -------------------------------------------------------------------
const LANG_KEY = 'srl-lang';
let lang = (() => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es'; } catch { return 'es'; } })();
function t(key, vars = {}) {
  const get = (l) => key.split('.').reduce((o, k) => o?.[k], TEXTOS[l]);
  const v = get(lang) ?? get('es') ?? key;
  return String(v).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}
const tx = (o) => (o && typeof o === 'object' ? o[lang] ?? o.es : o ?? '');
const fmt = (n, d = 1) => Number(n).toFixed(d);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// --- Datos y estado -----------------------------------------------------------
let data;      // { missions, rockets, pieces, workshop }
let m;         // misión en curso: { missionId, rocketId, budget, plan, satellite }
let demo = false;
let removedIds = []; // instrumentos quitados al entrar (se muestran hasta el siguiente cambio)

/** Misión de trabajo: la guardada si trae lo que el Nivel 2 necesita; si no, el demo. */
export function pickMission(saved) {
  const usable = saved?.missionId && saved?.rocketId && saved?.budget?.space > 0;
  if (!usable) return { mission: structuredClone(DEMO), demo: true };
  const satellite = { formFactor: null, pieces: [], propellantKg: 0, ...saved.satellite };
  return { mission: { ...saved, plan: saved.plan || {}, satellite }, demo: false };
}

/** Resumen que pide el contrato para que N3 y N4 no recalculen. */
export function satelliteSummary(sat, result, rocket) {
  const r1 = (n) => Math.round(n * 1000) / 1000;
  return {
    formFactor: sat.formFactor,
    pieces: [...sat.pieces],
    propellantKg: sat.propellantKg,
    dryKg: r1(result.metrics.dry),
    wetKg: r1(result.metrics.wet),
    isp: result.metrics.isp,
    dvAvailable: Math.round(result.metrics.dv),
    // Energía en el destino: la generación y el consumo van por separado y el neto puede ser negativo.
    powerGenW: r1(result.metrics.power.generated),
    powerUseW: r1(result.metrics.power.consumed),
    powerNetW: r1(result.metrics.power.net),
    batteryWh: result.metrics.storage.capacityWh,
    maxPayloadKg: rocket?.maxPayloadKg ?? null,
    validated: result.valid,
  };
}

/** Guarda solo `satellite` (sin el resumen hasta validar). Nunca pisa un demo sobre datos reales. */
function persist() {
  if (demo) return;
  saveMission({ satellite: { formFactor: m.satellite.formFactor, pieces: [...m.satellite.pieces], propellantKg: m.satellite.propellantKg, validated: false } });
}

function setSatellite(patch) {
  m.satellite = { ...m.satellite, ...patch };
  removedIds = [];
  persist();
  render();
}

function togglePiece(p) {
  const sat = m.satellite;
  if (p.category === 'structure') return setSatellite({ formFactor: p.id });
  const has = sat.pieces.includes(p.id);
  if (p.category === 'propulsion') {
    // Solo un sistema de propulsión a la vez
    const others = sat.pieces.filter((id) => data.pieces.find((x) => x.id === id)?.category !== 'propulsion');
    return setSatellite({ pieces: has ? others : [...others, p.id], propellantKg: has ? 0 : sat.propellantKg });
  }
  return setSatellite({ pieces: has ? sat.pieces.filter((id) => id !== p.id) : [...sat.pieces, p.id] });
}

// --- Catálogo -----------------------------------------------------------------
const popId = (p) => `n2-trl-${p.id}`;

/** Ventana del ⓘ: qué es el TRL, qué significa el de esta pieza y por qué lo tiene (popover nativo). */
function trlPopover(p) {
  const pop = document.createElement('div');
  pop.className = 'n2-pop';
  pop.id = popId(p);
  pop.setAttribute('popover', '');
  pop.innerHTML = `
    <h3>${tx(p.name)} · TRL ${p.trl}</h3>
    <p class="n2-pop-level">${t(`trlLevels.${p.trl}`)}</p>
    <h4>${t('trlWhatTitle')}</h4>
    <p>${t('trlWhat')}</p>
    <h4>${t('trlWhyTitle')}</h4>
    <p>${tx(p.desc)}</p>
    <button type="button" class="n2-btn n2-btn-primary" popovertarget="${pop.id}" popovertargetaction="hide">${t('gotIt')}</button>`;
  return pop;
}

function pieceButton(p, solarFactor) {
  const sat = m.satellite;
  const fit = instrumentStatus(p, m, data.workshop.instrumentFit);
  const selected = p.id === sat.formFactor || sat.pieces.includes(p.id);
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.id = p.id;
  b.className = `n2-piece${selected ? ' is-selected' : ''}${fit.compatible ? '' : ' is-off'}`;
  b.disabled = !fit.compatible;
  b.title = tx(p.desc);
  b.setAttribute('aria-pressed', String(selected));
  let extra = '';
  if (p.category === 'structure') {
    const form = data.workshop.formFactors?.[p.id];
    // La masa máxima va en la fuente de los números: en Space Grotesk «15 960» se leía como «45 960».
    extra = `<small class="n2-hint">${form ? `${tx(form)} · ` : ''}${t('maxMass', { n: `<span class="n2-num">${grams(p.volumeU * KG_PER_U)}</span>` })}</small>`;
  } else if (fit.why) {
    extra = `<small class="n2-why" id="n2-why-${p.id}">${fit.compatible ? '✔' : '✘'} ${tx(fit.why)}</small>`;
    b.setAttribute('aria-describedby', `n2-why-${p.id}`);
  }
  // El nombre va primero: es el inicio del nombre accesible del botón.
  b.innerHTML = `<strong>${tx(p.name)}</strong>
    <small class="n2-specs">${grams(p.massKg)} g · ${p.volumeU}U · ${powerText(p, solarFactor, (w) => t('atDest', { w: fmt(w) }))} · $${p.cost}M${p.isp ? ` · Isp ${p.isp}s` : ''}</small>
    <small class="n2-trl">TRL ${p.trl} · ${t(`trlShort.${p.trl}`)}</small>${extra}`;
  b.addEventListener('click', () => togglePiece(p));

  // El ⓘ no puede ir dentro del botón de la pieza: van juntos en un contenedor
  const wrap = document.createElement('div');
  wrap.className = 'n2-piece-wrap';
  const info = document.createElement('button');
  info.type = 'button';
  info.className = 'n2-info';
  info.textContent = 'i';
  info.setAttribute('popovertarget', popId(p));
  info.setAttribute('aria-label', t('trlInfo', { name: tx(p.name), n: p.trl }));
  wrap.append(b, info);
  return wrap;
}

function renderCatalog() {
  const box = $('n2-catalog');
  box.replaceChildren();
  const { solarFactor } = validateDesign(m, data).metrics.power; // los paneles dan menos lejos del Sol
  for (const cat of CATEGORIES) {
    const h = document.createElement('h2');
    h.textContent = t(`categories.${cat}`);
    const list = document.createElement('div');
    list.className = 'n2-pieces';
    for (const p of data.pieces.filter((x) => x.category === cat)) list.append(pieceButton(p, solarFactor));
    box.append(h, list);
  }
  const pops = document.createElement('div');
  pops.className = 'n2-pops';
  for (const p of data.pieces) pops.append(trlPopover(p));
  box.append(pops);
}

// --- Panel: propelente, medidores, verificaciones -------------------------------
function meterHTML({ label, value, d, aria, note, marker }) {
  const tight = d.level === 'warn' ? ` · ${t('tight')}` : '';
  if (d.level === 'pending') {
    return `
    <div class="n2-meter lvl-pending" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="${aria}">
      <div class="n2-meter-head"><span>${label}</span><b>${value}</b></div>
      <div class="n2-track"><div class="n2-fill" style="width:0%"></div></div>
      ${note ? `<small class="n2-note">${note}</small>` : ''}
    </div>`;
  }
  return `
    <div class="n2-meter lvl-${d.level}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="${Math.round(d.pct)}" aria-valuetext="${aria}${tight}">
      <div class="n2-meter-head"><span>${label}</span><b>${value}</b></div>
      <div class="n2-track"><div class="n2-fill" style="width:${d.pct}%"></div>${marker || ''}</div>
      ${note ? `<small class="n2-note">${note}</small>` : ''}
    </div>`;
}

function metersHTML(mission) {
  const res = validateDesign(mission, data);
  const x = res.metrics;
  const dest = data.missions.find((d) => d.id === mission.missionId);
  const rocket = data.rockets.find((r) => r.id === mission.rocketId);
  const M = meterData(x, dest, mission.budget.space);
  const req = t('required', { n: fmt(M.dv.required, 0) });
  const use = t('powerUse', { g: fmt(x.power.generated), c: fmt(x.power.consumed) });
  const sun = x.power.solarFactor < 0.995 ? t('sunAtDest', { pct: fmt(x.power.solarFactor * 100, 0) }) : '';
  const s = x.storage;
  const storeUse = t('batteryUse', { n: fmt(s.neededWh, 0), e: fmt(s.eclipseWh, 0), b: fmt(s.burnWh, 0), u: fmt(s.usableWh, 0), c: fmt(s.capacityWh, 0) });
  return [
    meterHTML({
      label: 'Δv', d: M.dv, value: M.dv.level === 'pending' ? `— / ${fmt(M.dv.required, 0)} m/s` : `${fmt(x.dv, 0)} / ${fmt(M.dv.required, 0)} m/s`, aria: `${fmt(x.dv, 0)} m/s, ${req}`,
      marker: M.dv.markerPct == null ? '' : `<i class="n2-marker" style="left:${M.dv.markerPct}%"></i>`,
      note: M.dv.markerPct == null ? '' : `│ ${req}`,
    }),
    M.mass.level === 'pending'
      ? meterHTML({ label: t('mass'), d: M.mass, value: '— / — g', aria: t('pickStructure'), note: t('pickStructure') })
      : meterHTML({ label: t('mass'), d: M.mass, value: `${grams(x.wet)} / ${grams(M.mass.cap)} g`, aria: `${grams(x.wet)} g / ${grams(M.mass.cap)} g` }),
    meterHTML({
      label: t('power'), d: M.power, value: M.power.level === 'pending' ? '—' : signedW(M.power.net), aria: `${signedW(M.power.net)}: ${use}`,
      note: [M.power.powerLow ? t('minPower', { n: M.power.minW }) : '', use, sun].filter(Boolean).join(' · '),
    }),
    M.battery.level === 'pending'
      ? meterHTML({ label: t('battery'), d: M.battery, value: '—', aria: t('noBattery'), note: t('noBattery') })
      : meterHTML({ label: t('battery'), d: M.battery, value: `${fmt(s.neededWh, 0)} / ${fmt(s.usableWh, 0)} Wh`, aria: storeUse, note: storeUse }),
    meterHTML({ label: t('cost'), d: M.cost, value: `$${x.cost}M / $${mission.budget.space}M`, aria: `$${x.cost}M / $${mission.budget.space}M` }),
    rocketOverload(x, rocket)
      ? `<p class="n2-alert" role="alert">🚫 ${t('rocketLimit', { name: tx(rocket.name), n: grams(rocket.maxPayloadKg) })}</p>`
      : '',
  ].join('');
}

function renderPanel() {
  const panel = $('n2-panel');
  panel.replaceChildren();
  const sat = m.satellite;
  const meters = document.createElement('div');
  meters.className = 'n2-meters';
  meters.innerHTML = metersHTML(m);

  const prop = data.pieces.find((p) => sat.pieces.includes(p.id) && p.category === 'propulsion');
  if (prop) {
    const row = document.createElement('label');
    row.className = 'n2-prop';
    row.innerHTML = `<span>${t('propellant')}</span>
      <input type="range" min="0" max="${prop.maxPropellantKg}" step="0.1" value="${sat.propellantKg}">
      <output>${fmt(sat.propellantKg)} kg</output>`;
    const input = row.querySelector('input');
    input.addEventListener('input', (e) => {
      row.querySelector('output').textContent = `${fmt(e.target.value)} kg`;
      // En vivo: masa y Δv cambian antes de soltar el slider
      const preview = { ...m, satellite: { ...sat, propellantKg: Number(e.target.value) } };
      meters.innerHTML = metersHTML(preview);
      renderMini(validateDesign(preview, data));
    });
    input.addEventListener('change', (e) => setSatellite({ propellantKg: Number(e.target.value) }));
    panel.append(row);
  }
  panel.append(meters);

  const result = validateDesign(m, data);
  const h = document.createElement('h2');
  h.textContent = t('checksTitle');
  const list = document.createElement('ul');
  list.className = 'n2-checks';
  const MARK = { ok: '✔', bad: '✘', pending: '○' };
  for (const c of result.checks) {
    const state = checkState(c, result.metrics);
    const li = document.createElement('li');
    li.className = `n2-${state}`;
    li.textContent = `${MARK[state]} ${t(`checks.${c.id}`)}`;
    list.append(li);
  }
  const pendingNote = document.createElement('p');
  pendingNote.className = 'n2-pending-note';
  pendingNote.hidden = !result.checks.some((c) => checkState(c, result.metrics) === 'pending');
  pendingNote.textContent = sat.formFactor ? t('pendingBattery') : t('pendingHint');

  // Por qué falla, con números: orienta hacia el trade study en vez de solo marcar ✘
  const dest = data.missions.find((d) => d.id === m.missionId);
  const parts = resolvePieces([sat.formFactor, ...sat.pieces].filter(Boolean), data.pieces);
  const tips = tradeHints(result, parts, data.pieces, dest, m.budget.space, {
    nameOf: (p) => tx(p.name),
    allowed: (p) => instrumentStatus(p, m, data.workshop.instrumentFit).compatible,
  });
  const tipsBox = document.createElement('ul');
  tipsBox.className = 'n2-tips';
  tipsBox.hidden = !tips.length;
  for (const tip of tips) {
    const li = document.createElement('li');
    li.textContent = `💡 ${t(`tips.${tip.key}`, { dest: tx(dest?.name), ...tip.vars })}`;
    tipsBox.append(li);
  }

  const footer = document.createElement('div');
  footer.className = 'n2-footer';
  const back = document.createElement('a');
  back.className = 'n2-btn n2-btn-ghost';
  back.href = levelHref(1);
  back.textContent = t('back');
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'n2-btn n2-btn-primary';
  launch.textContent = t('launch');
  launch.disabled = !result.valid;
  launch.title = t('launchHelp');
  launch.addEventListener('click', () => {
    const rocket = data.rockets.find((r) => r.id === m.rocketId);
    const satellite = satelliteSummary(m.satellite, result, rocket);
    // Contrato: solo `satellite`. En demo se guarda la misión de ejemplo, pero nunca sobre datos reales.
    if (!demo) saveMission({ satellite });
    else if (!loadMission()) saveMission({ missionId: m.missionId, rocketId: m.rocketId, budget: m.budget, plan: m.plan, satellite });
    goLevel(3);
  });
  footer.append(back, launch);
  panel.append(h, list, pendingNote, tipsBox, footer);
  renderMini(result);
}

// --- Celular: resumen fijo abajo con los 4 medidores clave ---------------------------
const MINI_MARK = { ok: '✔', warn: '▲', danger: '✘', pending: '○' };
function renderMini(result) {
  const box = $('n2-mini');
  if (!box) return;
  const x = result.metrics;
  const dest = data.missions.find((d) => d.id === m.missionId);
  const M = meterData(x, dest, m.budget.space);
  const items = [
    { label: 'Δv', d: M.dv, value: M.dv.level === 'pending' ? '—' : `${fmt(x.dv, 0)}/${fmt(M.dv.required, 0)}` },
    { label: t('mass'), d: M.mass, value: M.mass.level === 'pending' ? '—' : `${fmt(x.wet, 1)} kg` },
    { label: t('powerShort'), d: M.power, value: M.power.level === 'pending' ? '—' : signedW(M.power.net) },
    { label: t('cost'), d: M.cost, value: `$${x.cost}/${m.budget.space}M` },
  ];
  const okN = result.checks.filter((c) => checkState(c, x) === 'ok').length;
  box.innerHTML = `
    <ul class="n2-mini-list">${items.map((it) => `<li class="lvl-${it.d.level}"><span>${it.label}</span><b><span aria-hidden="true">${MINI_MARK[it.d.level]}</span> ${it.value}</b></li>`).join('')}</ul>
    <button type="button" class="n2-btn n2-btn-ghost n2-mini-more">${t('mini.more')}</button>
    <span class="n2-sr">${t('mini.status', { n: okN, t: result.checks.length })}</span>`;
  box.querySelector('.n2-mini-more').addEventListener('click', () => $('n2-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

/** Navega a otro nivel: su carpeta si ya está publicada, o su pantalla en la app (contrato, #52). */
const goLevel = (n) => { location.href = levelHref(n); };

// --- Pantalla -----------------------------------------------------------------
function render() {
  const dest = data.missions.find((d) => d.id === m.missionId);
  const target = dest?.scienceTargets?.[m.plan?.scienceTargetIdx];
  document.documentElement.lang = lang;
  const brand = lang === 'en' ? 'Orbit Explorers' : 'Exploradores de Órbita';
  document.title = `${t('title')} · ${brand}`;
  $('n2-title').textContent = t('title');
  $('n2-lead').textContent = t('lead', { dest: tx(dest?.name), space: m.budget.space });
  $('n2-demo').textContent = t('demo');
  $('n2-demo').hidden = !demo;
  $('n2-objective').hidden = !target;
  if (target) $('n2-objective').textContent = `🎯 ${t('objective', { target: tx(target) })}`;
  $('n2-notice').hidden = !removedIds.length;
  if (removedIds.length) $('n2-notice').textContent = t('removed', { list: removedIds.map((id) => tx(data.pieces.find((p) => p.id === id).name)).join(', ') });
  $('n2-lang').textContent = t('lang');
  $('n2-lang').setAttribute('aria-label', t('langLabel'));
  $('n2-brand-name').textContent = brand;
  $('n2-menu').title = t('menu');
  renderCatalog();
  renderPanel();
}

async function boot() {
  const load = (f) => fetch(`../data/${f}.json`).then((r) => { if (!r.ok) throw new Error(`data/${f}.json`); return r.json(); });
  const [missions, rockets, pieces, workshop] = await Promise.all(['missions', 'rockets', 'pieces', 'workshop'].map(load));
  data = { missions, rockets, pieces, workshop };

  ({ mission: m, demo } = pickMission(loadMission()));
  // Si el objetivo del Nivel 1 cambió, quitar los instrumentos que ya no sirven y avisar.
  const bad = incompatibleSelected(m, pieces, workshop.instrumentFit);
  if (bad.length) {
    m.satellite.pieces = m.satellite.pieces.filter((id) => !bad.includes(id));
    persist();
  }
  removedIds = bad;

  $('n2-lang').addEventListener('click', () => {
    lang = lang === 'es' ? 'en' : 'es';
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
    render();
  });
  render();
}

if (typeof document !== 'undefined' && document.getElementById('n2-catalog')) {
  boot().catch((err) => {
    console.error(err);
    $('n2-catalog').innerHTML = `<p class="n2-bad">${t('loadError')}: ${esc(err.message)}. ${t('serveHint')} <code>python3 -m http.server</code>.</p>`;
  });
}
