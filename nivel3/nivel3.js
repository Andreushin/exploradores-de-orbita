// OWNER: Andreushin — Nivel 3 · Travesía e inserción orbital (docs/niveles/nivel-3.md).
// El jugador pilota: gira la nave, enciende el motor y ve cómo cambia su órbita (js/orbit-sim.js).
// Lee el satélite de `eo-mision` (docs/contrato-niveles.md), gasta combustible finito en kg
// (depende de la masa, ecuación del cohete) y escribe `journey`.
import { G0, deltaV, propellantFor, resolvePieces, dryMass, systemIsp } from '../js/physics.js';
import * as orbit from '../js/orbit-sim.js';
import { loadMission, saveMission, levelHref } from '../js/mision-store.js';
import { recordLevel, starsLevel3, reachedOrbit } from '../js/campaign.js';
import { showResult, sfx, engineStart, engineStop, soundToggle } from '../js/game-ui.js';
import { createInput } from '../js/input.js';
import { createTips } from '../js/tips.js';
import { TEXTOS } from './textos.js';

// --- Reglas del nivel ---------------------------------------------------------
const RATE = 60;             // segundos simulados por segundo real durante la llegada
const DEPART_RATE = 100;     // ídem en la órbita terrestre (una vuelta ≈ 54 s)
const WARPS = [1, 4, 16, 64];    // aceleración del tiempo en el crucero
const TURN = 2.6;            // rad/s que gira la nave
const BURN_SECONDS = 6;      // lo que tarda el frenado nominal con el satélite de referencia
const REF_MASS = { moon: 6.9, mars: 15.4, europa: 11.7 }; // kg al despegar de los diseños de referencia (docs/fuentes.md)
const STAGE_SECONDS = 7;     // lo que tarda el quemado de salida del cohete
const STAGE_MARGIN = 1.2;    // el cohete lleva 20 % más Δv del ideal
const FINE_THROTTLE = 0.2;   // lejos del destino el motor empuja al 20 %: las correcciones piden pulso fino
const TCM_FRACTION = 0.04;   // una corrección temprana cuesta ≈ 4 % del Δv de inserción
const TCM_BAND = [0.9, 1.2]; // el periapsis está "en rumbo" entre 90 % y 120 % del objetivo
const EVENT_AT = 0.7;        // fracción de la distancia inicial donde aparece el evento
const RISK_DV = 120;         // m/s que se pierden si un riesgo de evento se cumple
const IONIC_ISP = 1500;      // para la sugerencia educativa
// Diseño de referencia (docs/fuentes.md) para el modo demo
const DEMO = {
  missionId: 'moon', rocketId: 'pico',
  satellite: { formFactor: 'struct-6u', pieces: ['solar-body', 'battery', 'prop-green', 'comm-uhf', 'obc', 'inst-camera'], propellantKg: 2.5 },
};
const PILOTING = ['depart', 'approach'];

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
const dest = () => esc(tx(mission.name));

// --- Datos y estado -----------------------------------------------------------
let data;          // { missions, pieces, events }
let mission;       // destino
let sat;           // { dry, isp, prop0, maxProp, hasEngine, demo }
let plan;          // llegada y captura (orbit.arrival)
let dep;           // salida desde la Tierra (orbit.departure)
let run;           // estado de una travesía (se reinicia en cada intento)
let attempts = 0;
let input;
let tips;

/** Propelente (kg) que consume un Δv con la masa actual: m · (1 − e^(−Δv / (Isp·g0))). */
function propellantUsed(massKg, dv, isp) {
  if (!(isp > 0)) return Infinity;
  return massKg * (1 - Math.exp(-dv / (isp * G0)));
}

function newRun() {
  return {
    phase: 'brief', s: null, el: null, viewR: 0,
    // El motor del CubeSat: empuje fijo, así una nave más pesada acelera menos
    ship: { dry: sat.dry, prop: sat.prop0, isp: sat.isp, thrustN: (REF_MASS[mission.id] || REF_MASS.moon) * mission.dvRequired / (BURN_SECONDS * RATE) },
    stageDv: dep.dvIdeal * STAGE_MARGIN, stageUsed: 0, departEff: 1, moonAngle: null,
    dvUsed: 0, events: [], tcm: null, outcome: null, ratio: null, science: 0, maneuvers: 0,
    eventDone: false, currentEvent: null, passedPeri: false, slowedAtPeri: false, prevR: Infinity,
    warp: 0, assist: false, thrusting: false, burnDv: 0, burnKg: 0, burnDvLast: 0, captured: false, needDv: 0,
    lastFrame: 0, lastHud: 0, failKey: null,
  };
}
const mass = () => run.ship.dry + run.ship.prop;
const dvLeft = () => deltaV(sat.isp, mass(), sat.dry);
const canThrust = () => run.ship.isp > 0 && run.ship.prop > 1e-6;

/**
 * Maniobra instantánea de `dv` m/s (eventos en ruta). Gasta propelente según la masa del momento.
 * Si no alcanza, gasta todo y devuelve el Δv logrado. → { dv, kg, out }
 */
function burn(dv) {
  const need = propellantUsed(mass(), dv, sat.isp);
  if (need <= run.ship.prop) {
    run.ship.prop -= need; run.dvUsed += dv;
    return { dv, kg: need, out: false };
  }
  const got = dvLeft();
  const kg = run.ship.prop;
  run.ship.prop = 0; run.dvUsed += got;
  return { dv: got, kg, out: true };
}

function log(msg, cls = '') {
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
      propellantUsedKg: +(sat.prop0 - run.ship.prop).toFixed(3),
      tcm: run.tcm,
      events: run.events,
      insertionRatio: run.ratio == null ? null : +run.ratio.toFixed(3),
      outcome: run.outcome,
      science: run.science,
      attempts,
    },
  });
}

/** Navega a otro nivel: su carpeta si ya existe, o su pantalla en la app principal. */
const goLevel = (n) => { location.href = levelHref(n); };

// --- Canvas -------------------------------------------------------------------
const canvas = $('n3-canvas');
const g = canvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let W = 0; let H = 0; let stars = [];
const COLOR = { text: '#eef2ff', muted: '#9aa6cf', info: '#4fc3f7', ok: '#4ade80', warn: '#fbbf24', danger: '#ff7a7a', accent: '#ff6b35' };

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

const EARTH_PHASES = ['brief', 'depart', 'cut', 'fail'];
const inEarthView = () => EARTH_PHASES.includes(run.phase);
const central = () => (inEarthView() ? orbit.BODIES.earth : plan.body);

/** Radio (km) que debe caber en pantalla: sigue a la nave y a su órbita. */
function viewTarget() {
  const r = Math.hypot(run.s.x, run.s.y);
  if (inEarthView()) {
    const cap = mission.id === 'moon' ? orbit.MOON_DISTANCE_KM * 1.04 : orbit.BODIES.earth.radius * 14;
    return Math.min(Math.max(r, Math.min(run.el.ra, cap)), cap) * 1.25;
  }
  const far = run.el.bound ? Math.min(run.el.ra, plan.limitR) : 0;
  return Math.max(r, far, plan.rpTarget * 1.9) * 1.18;
}

function draw() {
  g.fillStyle = '#070b1a'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(238,242,255,0.6)';
  for (const [x, y, r] of stars) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  if (!run.s) return;
  const body = central();
  const earth = inEarthView();
  const cx = W / 2; const cy = H / 2;
  const k = (Math.min(W, H) / 2) / run.viewR;
  const P = (x, y) => [cx + x * k, cy - y * k];

  // Objetivo: la órbita de la Luna (salida) o el anillo del periapsis (llegada)
  g.lineWidth = 1; g.setLineDash([4, 6]);
  if (earth && mission.id === 'moon') {
    g.strokeStyle = 'rgba(154,166,207,0.45)';
    g.beginPath(); g.arc(cx, cy, orbit.MOON_DISTANCE_KM * k, 0, 7); g.stroke();
    if (run.moonAngle != null) {
      const [mx, my] = P(orbit.MOON_DISTANCE_KM * Math.cos(run.moonAngle), orbit.MOON_DISTANCE_KM * Math.sin(run.moonAngle));
      g.setLineDash([]); disc(mx, my, 6, mission.color, tx(mission.name)); g.setLineDash([4, 6]);
    }
  } else if (!earth) {
    g.strokeStyle = 'rgba(74,222,128,0.7)';
    g.beginPath(); g.arc(cx, cy, plan.rpTarget * k, 0, 7); g.stroke();
  }
  g.setLineDash([]);

  // Cuerpo central
  const br = Math.max(body.radius * k, 5);
  const color = earth ? '#3b82f6' : mission.color;
  g.shadowColor = color; g.shadowBlur = 18;
  disc(cx, cy, br, color, br < 40 ? (earth ? t('earth') : tx(mission.name)) : '');
  g.shadowBlur = 0;

  // Órbita predicha: lo que pasará si no se toca nada más
  const el = run.el;
  const crash = el.rp <= body.radius;
  g.strokeStyle = crash ? COLOR.danger : (!earth && run.captured) ? COLOR.ok : COLOR.info;
  g.lineWidth = 1.5; g.setLineDash([6, 5]); g.beginPath();
  orbit.conicPoints(el, 160, run.viewR * 1.6).forEach(([x, y], i) => { const [px, py] = P(x, y); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
  g.stroke(); g.setLineDash([]); g.lineWidth = 1;

  // Periapsis (llegada) o apoapsis (salida)
  g.font = '11px "JetBrains Mono", monospace'; g.textAlign = 'left';
  if (!earth && !crash) {
    const [px, py] = P(el.rp * Math.cos(el.argp), el.rp * Math.sin(el.argp));
    mark(px, py, inBand(el) || run.captured ? COLOR.ok : COLOR.warn, 'Pe');
  } else if (earth && el.bound && el.e > 0.02) {
    const [px, py] = P(-el.ra * Math.cos(el.argp), -el.ra * Math.sin(el.argp));
    if (px > -20 && px < W + 20 && py > -20 && py < H + 20) mark(px, py, COLOR.info, 'Ap');
  }

  // Nave
  const [sx, sy] = P(run.s.x, run.s.y);
  if (run.outcome === 'crash' || run.failKey === 'reentry') {
    g.fillStyle = 'rgba(255,122,122,0.85)'; g.beginPath(); g.arc(sx, sy, 13, 0, 7); g.fill();
    return;
  }
  if (PILOTING.includes(run.phase)) guides(sx, sy);
  shipShape(sx, sy, run.s.angle, run.thrusting);
}

function disc(x, y, r, color, label) {
  g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  if (label) { g.shadowBlur = 0; g.fillStyle = COLOR.muted; g.font = '12px "Space Grotesk", system-ui'; g.textAlign = 'center'; g.fillText(label, x, y + r + 15); }
}
function mark(x, y, color, label) {
  g.fillStyle = color; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.closePath(); g.fill();
  g.fillText(label, x + 8, y + 4);
}

/** Anillo alrededor de la nave: prógrado (verde), retrógrado (naranja) y hacia dónde conviene empujar (rombo blanco). */
function guides(x, y) {
  const R = 32;
  const pg = orbit.prograde(run.s);
  g.strokeStyle = 'rgba(154,166,207,0.3)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, R, 0, 7); g.stroke();
  const at = (a, r = R) => [x + r * Math.cos(a), y - r * Math.sin(a)];
  g.font = '10px "JetBrains Mono", monospace'; g.textAlign = 'center';
  const [px, py] = at(pg);
  g.fillStyle = COLOR.ok; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill();
  const [plx, ply] = at(pg, R + 12); g.fillText(t('markPro'), plx, ply + 3);
  const [rx, ry] = at(pg + Math.PI);
  g.strokeStyle = COLOR.accent; g.lineWidth = 2; g.beginPath(); g.arc(rx, ry, 4, 0, 7); g.stroke();
  g.fillStyle = COLOR.accent; const [rlx, rly] = at(pg + Math.PI, R + 12); g.fillText(t('markRetro'), rlx, rly + 3);
  const want = recommended();
  if (want != null) {
    const [wx, wy] = at(want);
    const pulse = reduceMotion ? 7 : 7 + Math.sin(performance.now() / 160) * 1.5;
    g.strokeStyle = COLOR.text; g.lineWidth = 2; g.beginPath();
    g.moveTo(wx, wy - pulse); g.lineTo(wx + pulse, wy); g.lineTo(wx, wy + pulse); g.lineTo(wx - pulse, wy); g.closePath(); g.stroke();
  }
  g.lineWidth = 1;
}

function shipShape(x, y, angle, burning) {
  g.save(); g.translate(x, y); g.rotate(-angle);
  if (burning) {
    const len = reduceMotion ? 16 : 13 + Math.random() * 8;
    g.fillStyle = COLOR.accent; g.beginPath(); g.moveTo(-7, -4); g.lineTo(-7 - len, 0); g.lineTo(-7, 4); g.closePath(); g.fill();
  }
  g.fillStyle = COLOR.text; g.beginPath(); g.moveTo(11, 0); g.lineTo(-7, -6); g.lineTo(-4, 0); g.lineTo(-7, 6); g.closePath(); g.fill();
  g.restore();
}

// --- Guía de pilotaje -----------------------------------------------------------
const inBand = (el) => el.rp >= plan.rpTarget * TCM_BAND[0] && el.rp <= plan.rpTarget * TCM_BAND[1];
const farOut = () => !run.passedPeri && Math.hypot(run.s.x, run.s.y) > plan.rpTarget * 3;

/** Ángulo hacia donde conviene empujar ahora, o null si no hace falta. */
function recommended() {
  const pg = orbit.prograde(run.s);
  if (run.phase === 'depart') return pg;
  if (run.captured) return null;
  if (run.el.bound) return run.el.rp <= plan.body.radius ? pg : pg + Math.PI; // sube el periapsis, o sigue frenando si la órbita aún es enorme
  if (farOut()) return inBand(run.el) ? null : orbit.correctionAngle(run.s, plan);
  return pg + Math.PI;
}

/** Qué hacer ahora, en una línea. */
function objective() {
  if (run.phase === 'depart') return t('objDepart', { dest: tx(mission.name) });
  if (run.phase !== 'approach') return '';
  if (run.captured) return t(orbit.insertionRatio(run.el, plan) < 0.95 ? 'objRound' : 'objConfirm');
  if (run.el.bound) return t(run.el.rp <= plan.body.radius ? 'objRaise' : 'objShrink');
  if (farOut()) {
    if (inBand(run.el)) return t('objCoast');
    return t(run.el.rp < plan.rpTarget ? 'objCorrectLow' : 'objCorrectHigh', { dest: tx(mission.name) });
  }
  return t(run.passedPeri ? 'objBrakeLate' : 'objBrake');
}

// --- HUD ----------------------------------------------------------------------
const km = (n) => `${fmt(n, 0)} km`;
function meter(label, value, pct) {
  const lvl = pct > 40 ? 'ok' : pct > 15 ? 'warn' : 'danger';
  return `<div class="n3-fuel n3-${lvl}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}">
      <span>${label}</span><b>${value} · ${fmt(pct, 0)} %</b>
      <i class="n3-fuel-track"><i class="n3-fuel-fill" style="width:${pct}%"></i></i>
    </div>`;
}
const cell = (label, value, cls = '') => `<div><span>${label}</span><b class="${cls}">${value}</b></div>`;

function renderHud() {
  let html;
  if (run.phase === 'depart' || run.phase === 'cut' || run.phase === 'fail') {
    const total = dep.dvIdeal * STAGE_MARGIN;
    const el = run.el;
    html = meter(t('hudStage'), `${fmt(Math.max(0, run.stageDv), 0)} m/s`, (Math.max(0, run.stageDv) / total) * 100)
      + cell(t('hudProgress', { dest: dest() }), `${fmt(orbit.departureProgress(run.s, dep) * 100, 0)} %`)
      + cell(t('hudAlt'), km(Math.hypot(run.s.x, run.s.y) - orbit.BODIES.earth.radius))
      + cell(t('hudApo'), el.bound ? km(el.ra - orbit.BODIES.earth.radius) : t('escape'));
  } else {
    const pct = sat.prop0 > 0 ? (run.ship.prop / sat.prop0) * 100 : 0;
    html = meter(t('hudFuel'), `${fmt(run.ship.prop, 2)} kg`, pct) + cell(t('hudDv'), `${fmt(dvLeft(), 0)} m/s`);
    if (run.s) {
      const el = run.el; const R = plan.body.radius;
      const peCls = el.rp <= R ? 'n3-bad' : inBand(el) || run.captured ? 'n3-ok' : 'n3-warn';
      html += cell(t('hudPeri', { km: fmt(plan.rpTarget - R, 0) }), el.rp <= R ? t('impact') : km(el.rp - R), peCls)
        + cell(t('hudAlt'), km(Math.hypot(run.s.x, run.s.y) - R))
        + (el.bound ? cell(t('hudApo'), km(el.ra - R)) : cell(t('hudWarp'), `×${WARPS[run.warp]}`));
    } else {
      html += cell(t('hudMass'), `${fmt(mass(), 2)} kg`) + cell(t('isp'), `${fmt(sat.isp, 0)} s`) + cell(t('dryMass'), `${fmt(sat.dry, 2)} kg`);
    }
  }
  $('n3-hud').innerHTML = html;
  const obj = objective();
  const box = $('n3-objective');
  if (box.textContent !== obj) box.textContent = obj;
  box.hidden = !obj;
  $('n3-confirm').hidden = !(run.phase === 'approach' && run.captured);
}

// --- Fases --------------------------------------------------------------------
const panel = () => $('n3-panel');
const btn = (label, cls, on) => { const b = document.createElement('button'); b.type = 'button'; b.className = `n3-btn ${cls}`; b.innerHTML = label; b.addEventListener('click', (e) => { sfx('decision'); on(e); }); return b; };
const choices = (...buttons) => { const row = document.createElement('div'); row.className = 'n3-choices'; row.append(...buttons); return row; };

function setPhase(phase) {
  run.phase = phase;
  const piloting = PILOTING.includes(phase);
  $('n3-pad').hidden = !piloting;
  if (!piloting) { input.release(); stopEngine(); }
  if (phase !== 'decision') tips.clear(); // cada etapa empieza sin tarjetas de la anterior
  run.lastFrame = performance.now();
}

function renderBrief() {
  const tcmDv = Math.round(mission.dvRequired * TCM_FRACTION);
  // Estimación en orden: corrección con la masa llena, luego el frenado con la masa restante
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
        <tr><td>${t('moiRow', { dest: dest() })}</td><td>${mission.dvRequired} m/s</td><td>${fmt(kgMoi, 2)} kg</td></tr>
        <tr class="n3-total"><td>${t('totalRow')}</td><td>${tcmDv + mission.dvRequired} m/s</td><td>${fmt(total, 2)} kg</td></tr>
      </tbody>
    </table>
    <p class="${margin >= 0 ? 'n3-ok' : 'n3-bad'}">${t('margin')}: ${margin >= 0 ? t('marginOk', { kg: fmt(margin, 2) }) : t('marginBad', { kg: fmt(-margin, 2) })}</p>
    <h3>${t('controlsTitle')}</h3>
    <ul class="n3-keys">
      <li><kbd>←</kbd> <kbd>→</kbd> ${t('keyTurn')}</li>
      <li><kbd>↑</kbd> / <kbd>${t('keySpace')}</kbd> ${t('keyThrust')}</li>
      <li><kbd>Z</kbd> <kbd>X</kbd> ${t('keyWarp')}</li>
      <li><kbd>T</kbd> ${t('keyAssist')}</li>
    </ul>`;
  if (!sat.hasEngine) { p.insertAdjacentHTML('beforeend', `<p class="n3-bad">${t('noEngine')}</p>`); }
  p.append(btn(t('start'), 'n3-btn-primary', () => { attempts += 1; log(t('logLaunch')); startDepart(); }));
}

// --- Etapa 1 · Salida desde la órbita terrestre (motor del cohete) -------------
function startDepart() {
  run.s = orbit.circularState(orbit.BODIES.earth.mu, dep.r0);
  run.el = orbit.elements(run.s, orbit.BODIES.earth.mu);
  run.stageDv = dep.dvIdeal * STAGE_MARGIN; run.stageUsed = 0; run.moonAngle = null; run.failKey = null;
  run.viewR = 0;
  panel().innerHTML = '';
  setPhase('depart');
  $('n3-stage').scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}

function tickDepart(dt) {
  const { mu, radius } = orbit.BODIES.earth;
  turn(dt);
  const wants = input.state.thrust && run.stageDv > 0;
  if (wants && !run.thrusting) departTip();
  setThrusting(wants);
  const accel = dep.dvIdeal / (STAGE_SECONDS * DEPART_RATE); // m/s² del cohete
  let left = dt * DEPART_RATE;
  while (left > 1e-6) {
    const h = Math.min(2, left); left -= h;
    const dv = wants ? Math.min(accel * h, run.stageDv) : 0;
    run.stageDv -= dv; run.stageUsed += dv;
    orbit.step(run.s, mu, h, dv);
  }
  run.el = orbit.elements(run.s, mu);
  if (run.moonAngle == null && run.el.e > 0.05) run.moonAngle = run.el.argp + Math.PI;
  if (Math.hypot(run.s.x, run.s.y) < radius + 80) return departFail('reentry');
  if (orbit.departureProgress(run.s, dep) >= 1) return departDone();
  if (run.stageDv <= 0) return departFail('stage');
}

/** La primera vez que se enciende el motor: explica qué le hizo ese empuje a la órbita. */
function departTip() {
  const c = Math.cos(run.s.angle - orbit.prograde(run.s));
  if (c > 0.7) tips.show('pro', t('tipPrograde'));
  else if (c < -0.5) tips.show('retro', t('tipRetro'));
  else tips.show('side', t('tipSide'));
}

function departDone() {
  run.departEff = Math.min(1, dep.dvIdeal / run.stageUsed);
  log(t('logDepart', { dv: fmt(run.stageUsed, 0), ideal: fmt(dep.dvIdeal, 0) }));
  sfx('success');
  setPhase('cut');
  renderCut();
}
function renderCut() {
  const p = panel();
  p.innerHTML = `<span class="n3-tag">${t('cutTag')}</span><h2>${t('cutTitle', { dest: dest() })}</h2>
    <p>${t('cutText', { dv: fmt(run.stageUsed, 0), ideal: fmt(dep.dvIdeal, 0), pct: fmt(run.departEff * 100, 0) })}</p>
    <p class="n3-muted">${t('cutNext', { days: fmt(mission.travelDays, 0), dest: dest() })}</p>`;
  const go = btn(t('cutGo'), 'n3-btn-primary', startApproach);
  p.append(go);
  go.focus({ preventScroll: true });
}

function departFail(key) {
  run.failKey = key;
  sfx('fail');
  setPhase('fail');
  renderFail();
}
function renderFail() {
  const p = panel();
  p.innerHTML = `<h2 class="n3-bad">${t(`fail.${run.failKey}.title`)}</h2><p>${t(`fail.${run.failKey}.text`, { dest: dest() })}</p>`;
  const again = btn(t('failRetry'), 'n3-btn-primary', startDepart);
  p.append(again);
  again.focus({ preventScroll: true });
}

// --- Etapa 2 · Llegada: corrección, evento y captura (motor del CubeSat) --------
function startApproach() {
  // El error de puntería: una corrección temprana cuesta ≈ 4 % del Δv de inserción; una salida torpe lo agranda
  const sloppy = 1 + Math.min(0.8, (1 - run.departEff) * 4);
  const db = TCM_FRACTION * (mission.dvRequired / 1000) * plan.startR / plan.vInf * sloppy;
  const b0 = plan.bTarget + (Math.random() < 0.5 ? -db : db);
  run.s = orbit.arrivalState(plan, orbit.periapsisFor(b0, plan.vInf, plan.body.mu));
  run.el = orbit.elements(run.s, plan.body.mu);
  run.prevR = Infinity; run.viewR = 0; run.warp = 0;
  panel().innerHTML = '';
  setPhase('approach');
  log(t('logArrive', { dest: tx(mission.name), km: fmt(plan.startR, 0) }));
  if (mass() > (REF_MASS[mission.id] || REF_MASS.moon) * 1.15) tips.show('heavy', t('tipHeavy', { kg: fmt(mass(), 1) }));
  $('n3-stage').scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}

function tickApproach(dt) {
  const { mu, radius } = plan.body;
  turn(dt);
  const wants = input.state.thrust && canThrust();
  if (wants) run.warp = 0;
  setThrusting(wants);
  let left = dt * RATE * WARPS[run.warp];
  while (left > 1e-6) {
    const r = Math.hypot(run.s.x, run.s.y);
    const h = Math.min(wants ? 1.5 : r < radius * 6 ? 4 : 30, left); left -= h;
    let dv = 0;
    if (wants && canThrust()) {
      const c = orbit.consume(run.ship, h * (farOut() ? FINE_THROTTLE : 1));
      dv = c.dv; run.dvUsed += c.dv; run.burnDv += c.dv; run.burnKg += c.kg;
    }
    orbit.step(run.s, mu, h, dv);
  }
  const r = Math.hypot(run.s.x, run.s.y);
  run.el = orbit.elements(run.s, mu);
  if (r > run.prevR && r < plan.rpTarget * 6) run.passedPeri = true;
  const inbound = r < run.prevR;
  run.prevR = r;

  if (r <= radius) return finish('crash');
  const captured = orbit.isCaptured(run.el, plan);
  if (captured && !run.captured) { tips.show('captured', t('tipCaptured', { dest: tx(mission.name) })); sfx('star'); }
  run.captured = captured;

  // Corrección de trayectoria: ¿cuándo quedó el periapsis en rumbo?
  if (run.tcm == null && !run.passedPeri) {
    if (run.burnDvLast > 0 && !wants && inBand(run.el) && farOut()) {
      run.tcm = r > plan.startR * 0.5 ? 'early' : 'late';
      tips.show('tcm', t(run.tcm === 'early' ? 'tipEarly' : 'tipLate', { dv: fmt(run.burnDvLast, 0) }));
    } else if (!farOut()) {
      run.tcm = 'skip';
      if (!inBand(run.el)) log(t('logSkip'), 'n3-warn');
    }
  }
  // Cada vez que la nave baja hacia el periapsis, el tiempo vuelve a ×1 para poder maniobrar
  if (r > plan.rpTarget * 5) run.slowedAtPeri = false;
  if (!run.slowedAtPeri && inbound && r < plan.rpTarget * 4) { run.slowedAtPeri = true; run.warp = 0; tips.show('peri', t('tipPeri')); }
  if (run.ship.prop < sat.prop0 * 0.25 && run.ship.prop > 0) tips.show('fuel', t('tipFuel'));

  if (!run.eventDone && inbound && r < plan.startR * EVENT_AT) { run.eventDone = true; setPhase('decision'); return renderEvent(); }
  if (!captured) {
    if (r > plan.limitR || (run.passedPeri && !run.el.bound && r > plan.startR)) return canThrust() ? finish('flyby') : noFuel();
    if (!canThrust() && !run.el.bound) return noFuel();
    if (!canThrust()) run.warp = WARPS.length - 1; // órbita cerrada que choca: no queda más que ver el final
  } else if (!canThrust()) {
    return finish(orbit.captureOutcome(run.el, plan));
  }
}

function confirmOrbit() {
  if (run.phase === 'approach' && run.captured) finish(orbit.captureOutcome(run.el, plan));
}

// El evento "tcm" de data/events.json repite la corrección de rumbo que ya se pilota: se excluye.
const routeEvents = () => data.events.filter((e) => e.id !== 'tcm');
function renderEvent(ev = routeEvents()[Math.floor(Math.random() * routeEvents().length)]) {
  run.currentEvent = ev;
  const p = panel();
  p.innerHTML = `<span class="n3-tag">${t('eventTag')}</span><h2>${esc(tx(ev.title))}</h2><p>${esc(tx(ev.text))}</p>`;
  p.append(choices(...ev.choices.map((c, i) => btn(esc(tx(c.label)), i === 0 ? 'n3-btn-primary' : '', () => chooseEvent(ev, c, i)))));
  p.querySelector('button').focus({ preventScroll: true });
  p.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}

function chooseEvent(ev, c, i) {
  const name = tx(ev.title);
  const rec = { id: ev.id, choice: i, hit: false, dv: 0, science: c.science || 0 };
  if (c.dv) {
    const r = burn(c.dv); rec.dv += r.dv; run.maneuvers += 1;
    log(t('logBurn', { name, dv: fmt(r.dv, 0), kg: fmt(r.kg, 2) }));
  }
  if (c.risk && Math.random() < c.risk && canThrust()) {
    rec.hit = true;
    const r = burn(RISK_DV); rec.dv += r.dv; run.maneuvers += 1;
    log(t('logRisk', { name, dv: fmt(r.dv, 0), kg: fmt(r.kg, 2) }), 'n3-warn');
  }
  if (c.science) {
    run.science += c.science;
    log(t('logScience', { name, sign: c.science > 0 ? '+' : '', n: c.science }), c.science > 0 ? 'n3-good' : '');
  }
  run.events.push(rec);
  run.currentEvent = null;
  panel().innerHTML = '';
  setPhase('approach');
  $('n3-stage').scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}

// --- Pilotaje común --------------------------------------------------------------
function turn(dt) {
  const want = run.assist ? recommended() : null;
  if (want != null) {
    const diff = Math.atan2(Math.sin(want - run.s.angle), Math.cos(want - run.s.angle));
    run.s.angle += Math.max(-TURN * dt, Math.min(TURN * dt, diff));
  } else {
    if (input.state.left) run.s.angle += TURN * dt;
    if (input.state.right) run.s.angle -= TURN * dt;
  }
}

function stopEngine() { if (run.thrusting) setThrusting(false); }
function setThrusting(on) {
  if (on === run.thrusting) return;
  run.thrusting = on;
  if (on) { engineStart(); run.burnDv = 0; run.burnKg = 0; return; }
  engineStop();
  if (run.burnDv < 0.5) return; // el motor del cohete (salida) no gasta propelente del CubeSat
  run.maneuvers += 1;
  run.burnDvLast = run.burnDv;
  log(t('logBurn', { name: t(farOut() && !run.el.bound ? 'burnCorrection' : 'burnBrake'), dv: fmt(run.burnDv, 0), kg: fmt(run.burnKg, 2) }));
}

function onPress(action) {
  if (action === 'assist') { run.assist = !run.assist; sfx('click'); paintPad(); }
  if (run.phase !== 'approach') return;
  if (action === 'faster') { run.warp = Math.min(WARPS.length - 1, run.warp + 1); sfx('click'); }
  if (action === 'slower') { run.warp = Math.max(0, run.warp - 1); sfx('click'); }
  if (action === 'warp') { run.warp = (run.warp + 1) % WARPS.length; sfx('click'); }
  if (action === 'confirm') confirmOrbit();
}

function buildPad() {
  const pad = input.pad([
    [
      { action: 'left', label: '⟲', hint: '←', aria: t('padLeft') },
      { action: 'right', label: '⟳', hint: '→', aria: t('padRight') },
    ],
    [
      { action: 'assist', label: '🧭', hint: 'T', aria: t('padAssist'), hold: false },
      { action: 'warp', label: '⏩', hint: 'Z X', aria: t('padWarp'), hold: false },
    ],
    [{ action: 'thrust', label: '🔥', hint: t('keySpace'), aria: t('padThrust'), main: true }],
  ]);
  $('n3-pad').replaceChildren(pad);
  paintPad();
}
function paintPad() {
  $('n3-pad').querySelector('[data-action="assist"]')?.setAttribute('aria-pressed', String(run.assist));
}

// --- Resultado --------------------------------------------------------------------
function finish(outcome) {
  stopEngine();
  run.outcome = outcome;
  run.ratio = Math.max(0, orbit.insertionRatio(run.el, plan));
  if (run.tcm == null) run.tcm = 'skip';
  setPhase('result');
  persist();
  renderResult();
  celebrate();
}

/** Estrellas del nivel (js/campaign.js) y pantalla de resultado (js/game-ui.js). */
function celebrate() {
  const journey = { outcome: run.outcome, insertionRatio: run.ratio };
  const stars = starsLevel3(journey);
  const record = recordLevel(mission.id, 3, stars, { cleared: reachedOrbit(journey) });
  const next = record.unlocked && data.missions.find((m) => m.id === record.unlocked);
  const reasons = [];
  if (run.outcome === 'orbit') reasons.push(t('hint3Precision', { pct: fmt(run.ratio * 100, 0) }));
  else reasons.push(t(`hint3.${run.outcome}`));
  if (run.tcm !== 'early') reasons.push(t('hint3Tcm'));
  showResult({
    kicker: t('resultKicker'),
    title: t(`outcomes.${run.outcome}`, { dest: dest() }),
    text: resultStats(),
    stars, record, unlockedName: next ? esc(tx(next.name)) : '', reasons,
    primary: { label: t('toReport'), onClick: () => goLevel(4) },
    secondary: { label: t('retry'), onClick: restart },
  });
}

function resultStats() {
  const used = sat.prop0 - run.ship.prop;
  return t('resultStats', { kg: fmt(used, 2), pct: fmt(sat.prop0 ? (used / sat.prop0) * 100 : 0, 0), dv: fmt(run.dvUsed, 0), n: run.maneuvers });
}

function renderResult() {
  const p = panel();
  p.innerHTML = `
    <h2 class="${run.outcome === 'orbit' ? 'n3-ok' : 'n3-bad'}">${t(`outcomes.${run.outcome}`, { dest: dest() })}</h2>
    <p>${resultStats()}</p>`;
  const row = choices(btn(t('toReport'), 'n3-btn-primary', () => goLevel(4)));
  if (run.outcome !== 'orbit') row.append(btn(t('retry'), '', restart));
  p.append(row);
}

function noFuel() {
  stopEngine();
  run.ratio = Math.max(0, orbit.insertionRatio(run.el, plan));
  // Δv total que hacía falta: lo ya gastado más lo que faltaba frenar
  run.needDv = run.dvUsed + Math.max(0, 1 - run.ratio) * mission.dvRequired;
  run.outcome = 'no-fuel';
  if (run.tcm == null) run.tcm = 'skip';
  setPhase('result');
  persist();
  recordLevel(mission.id, 3, 0);
  sfx('fail');
  log(t('noFuelTitle'), 'n3-warn');
  renderNoFuel();
}

function renderNoFuel() {
  const totalDv = run.needDv;
  const needed = propellantFor(totalDv, sat.isp, sat.dry);
  // Masa seca máxima con la que el propelente cargado alcanzaría: m_dry = m_p / (e^(Δv/ve) − 1)
  const ratio = Math.exp(totalDv / (sat.isp * G0)) - 1;
  const dryOk = sat.prop0 / ratio;
  const neededIonic = propellantFor(totalDv, IONIC_ISP, sat.dry);
  const fixes = [];
  if (dryOk > 0 && dryOk < sat.dry) fixes.push(t('nfTipLighter', { kg: fmt(sat.dry - dryOk, 2) }));
  if (sat.isp < IONIC_ISP) fixes.push(t('nfTipIsp', { kg: fmt(neededIonic, 2) }));
  fixes.push(needed <= sat.maxProp ? t('nfTipMore', { kg: fmt(Math.ceil(needed * 10) / 10, 1), max: fmt(sat.maxProp, 1) }) : t('nfTipMoreMax', { max: fmt(sat.maxProp, 1) }));
  fixes.push(t('nfTipPilot'));
  const p = panel();
  p.innerHTML = `
    <h2 class="n3-bad">${t('noFuelTitle')}</h2>
    <p>${t('noFuelLead')}</p>
    <dl class="n3-specs">
      <div><dt>${t('nfMass')}</dt><dd>${fmt(sat.dry + sat.prop0, 2)} kg</dd></div>
      <div><dt>${t('nfHad')}</dt><dd>${fmt(sat.prop0, 2)} kg</dd></div>
      <div><dt>${t('nfNeeded')}</dt><dd class="n3-bad">${sat.isp > 0 ? `${fmt(needed, 2)} kg` : '—'}</dd></div>
      <div><dt>Δv</dt><dd>${fmt(totalDv, 0)} m/s</dd></div>
    </dl>
    <p class="n3-muted">${t('nfWhy', { isp: fmt(sat.isp, 0) })}</p>
    <h3>${t('nfTipsTitle')}</h3>
    <ul class="n3-tips">${fixes.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  p.append(choices(
    btn(t('toWorkshop'), 'n3-btn-primary', () => goLevel(2)),
    btn(t('retry'), '', restart),
    btn(t('toReport'), 'n3-btn-ghost', () => goLevel(4)),
  ));
  p.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}

function restart() {
  $('n3-log').replaceChildren();
  const assist = run.assist;
  run = newRun();
  run.assist = assist;
  tips.reset();
  setPhase('brief');
  renderBrief();
  paintPad();
}

// --- Bucle principal ------------------------------------------------------------
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - (run.lastFrame || now)) / 1000));
  run.lastFrame = now;
  if (run.phase === 'depart') tickDepart(dt);
  else if (run.phase === 'approach') tickApproach(dt);
  if (run.s) {
    const target = viewTarget();
    // Zoom suave (en escala logarítmica) para que la nave y su órbita siempre quepan
    run.viewR = !run.viewR || reduceMotion ? target : Math.exp(Math.log(run.viewR) + (Math.log(target) - Math.log(run.viewR)) * Math.min(1, dt * 4));
  }
  draw();
  if (now - run.lastHud > 100) { run.lastHud = now; renderHud(); }
  requestAnimationFrame(frame);
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
  $('n3-confirm').textContent = t('confirm');
  document.title = `${t('title')} · ${lang === 'en' ? 'Orbit Explorers' : 'Exploradores de Órbita'}`;
  buildPad();
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
  };
  $('n3-demo').hidden = !demo;
  if (!saved) saveMission(DEMO); // solo si no hay nada guardado: nunca pisa datos reales

  plan = orbit.arrival(mission.id, mission.dvRequired);
  dep = orbit.departure(mission.id);
  run = newRun();
  tips = createTips($('n3-tips'));
  input = createInput({
    actions: {
      left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], thrust: ['ArrowUp', 'KeyW', 'Space'],
      faster: ['KeyX'], slower: ['KeyZ'], assist: ['KeyT'], confirm: ['Enter'],
    },
    onPress,
    isActive: () => PILOTING.includes(run.phase) && !document.querySelector('.eo-overlay'),
  });
  applyLang();
  resize();
  setPhase('brief');
  renderBrief();
  addEventListener('resize', resize);
  $('n3-confirm').addEventListener('click', () => { sfx('decision'); confirmOrbit(); });
  $('n3-lang').before(soundToggle('n3-btn n3-btn-ghost'));
  $('n3-lang').addEventListener('click', () => {
    lang = lang === 'es' ? 'en' : 'es';
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
    applyLang();
    // Re-dibuja el panel de la fase actual en el nuevo idioma
    if (run.phase === 'brief') renderBrief();
    else if (run.phase === 'cut') renderCut();
    else if (run.phase === 'fail') renderFail();
    else if (run.phase === 'result' && run.outcome === 'no-fuel') renderNoFuel();
    else if (run.phase === 'result') renderResult();
    else if (run.phase === 'decision' && run.currentEvent) renderEvent(run.currentEvent);
  });
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error(err);
  $('n3-panel').innerHTML = `<p class="n3-bad">${lang === 'en' ? 'Could not load the game data' : 'No se pudieron cargar los datos del juego'}: ${esc(err.message)}. ${lang === 'en' ? 'Serve the folder with' : 'Sirve la carpeta con'} <code>python3 -m http.server</code>.</p>`;
});
