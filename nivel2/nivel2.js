// OWNER: Rol 3 (@JU4NMAX) — Nivel 2 · Taller del CubeSat (docs/nivel 2.md, docs/levelTwo.md).
// Lee la misión del Nivel 1 de `eo-mision` (docs/contrato-niveles.md), deja armar el CubeSat bajo
// los límites de masa, energía y presupuesto, y escribe solo la sección `satellite`.
import { validateDesign, KG_PER_U } from '../js/physics.js';
import { loadMission, saveMission, levelUrl } from '../js/mision-store.js';
import { grams, meterData, rocketOverload, instrumentStatus, incompatibleSelected } from '../js/taller-reglas.js';
import { TEXTOS } from './textos.js';

const CATEGORIES = ['structure', 'power', 'propulsion', 'comms', 'adcs', 'obc', 'instrument'];
// Misión de ejemplo para el modo demo (diseño de referencia de la Luna, docs/fuentes.md)
export const DEMO = {
  missionId: 'moon',
  rocketId: 'pico',
  budget: { total: 100, launch: 25, space: 25, ground: 8, user: 5 },
  plan: { scienceTargetIdx: 0 },
  satellite: { formFactor: 'struct-6u', pieces: ['solar-body', 'battery', 'prop-green', 'comm-uhf', 'obc', 'inst-camera'], propellantKg: 2.5 },
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
function pieceButton(p) {
  const sat = m.satellite;
  const fit = instrumentStatus(p, m, data.workshop.instrumentFit);
  const selected = p.id === sat.formFactor || sat.pieces.includes(p.id);
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `n2-piece${selected ? ' is-selected' : ''}${fit.compatible ? '' : ' is-off'}`;
  b.disabled = !fit.compatible;
  b.title = tx(p.desc);
  b.setAttribute('aria-pressed', String(selected));
  let extra = '';
  if (p.category === 'structure') {
    const form = data.workshop.formFactors?.[p.id];
    extra = `<small class="n2-hint">${form ? `${tx(form)} · ` : ''}${t('maxMass', { n: grams(p.volumeU * KG_PER_U) })}</small>`;
  } else if (fit.why) {
    extra = `<small class="n2-why" id="n2-why-${p.id}">${fit.compatible ? '✔' : '✘'} ${tx(fit.why)}</small>`;
    b.setAttribute('aria-describedby', `n2-why-${p.id}`);
  }
  // El nombre va primero: es el inicio del nombre accesible del botón.
  b.innerHTML = `<strong>${tx(p.name)}</strong>
    <small class="n2-specs">${grams(p.massKg)} g · ${p.volumeU}U · ${p.powerW > 0 ? '−' : '+'}${Math.abs(p.powerW)} W · $${p.cost}M · TRL ${p.trl}${p.isp ? ` · Isp ${p.isp}s` : ''}</small>${extra}`;
  b.addEventListener('click', () => togglePiece(p));
  return b;
}

function renderCatalog() {
  const box = $('n2-catalog');
  box.replaceChildren();
  for (const cat of CATEGORIES) {
    const h = document.createElement('h2');
    h.textContent = t(`categories.${cat}`);
    const list = document.createElement('div');
    list.className = 'n2-pieces';
    for (const p of data.pieces.filter((x) => x.category === cat)) list.append(pieceButton(p));
    box.append(h, list);
  }
}

// --- Panel: propelente, medidores, verificaciones -------------------------------
function meterHTML({ label, value, d, aria, note, marker }) {
  const tight = d.level === 'warn' ? ` · ${t('tight')}` : '';
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
  const use = t('powerUse', { c: fmt(x.power.consumed), g: fmt(x.power.generated) });
  return [
    meterHTML({
      label: 'Δv', d: M.dv, value: `${fmt(x.dv, 0)} / ${fmt(M.dv.required, 0)} m/s`, aria: `${fmt(x.dv, 0)} m/s, ${req}`,
      marker: M.dv.markerPct == null ? '' : `<i class="n2-marker" style="left:${M.dv.markerPct}%"></i>`,
      note: M.dv.markerPct == null ? '' : `│ ${req}`,
    }),
    meterHTML({ label: t('mass'), d: M.mass, value: `${grams(x.wet)} / ${grams(M.mass.cap)} g`, aria: `${grams(x.wet)} g / ${grams(M.mass.cap)} g` }),
    meterHTML({
      label: t('power'), d: M.power, value: `+${fmt(x.power.generated)} / −${fmt(x.power.consumed)} W`, aria: use,
      note: M.power.powerLow ? t('minPower', { n: M.power.minW }) : use,
    }),
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
      meters.innerHTML = metersHTML({ ...m, satellite: { ...sat, propellantKg: Number(e.target.value) } });
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
  for (const c of result.checks) {
    const li = document.createElement('li');
    li.className = c.ok ? 'n2-ok' : 'n2-bad';
    li.textContent = `${c.ok ? '✔' : '✘'} ${t(`checks.${c.id}`)}`;
    list.append(li);
  }

  const footer = document.createElement('div');
  footer.className = 'n2-footer';
  const back = document.createElement('a');
  back.className = 'n2-btn n2-btn-ghost';
  back.href = levelUrl(1);
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
  panel.append(h, list, footer);
}

/** Navega a otro nivel; si su carpeta aún no existe, vuelve al menú con un aviso. */
async function goLevel(n) {
  const url = levelUrl(n);
  try {
    const res = await fetch(`${url}index.html`, { method: 'HEAD' });
    if (!res.ok) throw new Error();
    location.href = url;
  } catch {
    alert(t('missingLevel'));
    location.href = levelUrl(1);
  }
}

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
