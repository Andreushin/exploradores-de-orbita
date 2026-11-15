// OWNER: Rol 3 (@JU4NMAX) — Nivel 2 · Taller del CubeSat (docs/niveles/nivel-2.md).
// Lee la misión del Nivel 1 de `eo-mision` (docs/contrato-niveles.md), deja armar el CubeSat bajo
// los límites de masa, energía y presupuesto, y escribe solo la sección `satellite`.
import { validateDesign, resolvePieces, KG_PER_U, propellantFor, dryMass } from '../js/physics.js';
import { loadMission, saveMission, levelHref } from '../js/mision-store.js';
import { grams, meterData, rocketOverload, instrumentStatus, incompatibleSelected, powerText, signedW, checkState, tradeHints, checkDetail, nextSatellite, pieceFacts, alertingMeters } from '../js/taller-reglas.js';
import { TEXTOS } from './textos.js';

const CATEGORIES = ['structure', 'power', 'propulsion', 'comms', 'adcs', 'obc', 'instrument'];
export const DEMO = {
  missionId: 'moon',
  rocketId: 'pico',
  budget: { total: 100, launch: 25, space: 25, ground: 8, user: 5 },
  plan: { scienceTargetIdx: 0 },
  satellite: { formFactor: 'struct-6u', pieces: ['battery', 'prop-green', 'comm-uhf', 'obc', 'inst-camera'], propellantKg: 2.5 },
};

// --- Idioma ---------------------------------------------------------------
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

// --- Datos y estado -------------------------------------------------------
let data;
let m;
let demo = false;
let removedIds = [];
let last = null; // lo calculado en el último render: { result, dest, rocket, M, allHints, tips }

export function pickMission(saved) {
  const usable = saved?.missionId && saved?.rocketId && saved?.budget?.space > 0;
  if (!usable) return { mission: structuredClone(DEMO), demo: true };
  const satellite = { formFactor: null, pieces: [], propellantKg: 0, ...saved.satellite };
  return { mission: { ...saved, plan: saved.plan || {}, satellite }, demo: false };
}

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
    powerGenW: r1(result.metrics.power.generated),
    powerUseW: r1(result.metrics.power.consumed),
    powerNetW: r1(result.metrics.power.net),
    batteryWh: result.metrics.storage.capacityWh,
    maxPayloadKg: rocket?.maxPayloadKg ?? null,
    validated: result.valid,
    launched: true, // el jugador decidió lanzar (aunque el diseño siga con rojos): desbloquea el Nivel 3
  };
}

function persist() {
  if (demo) return;
  saveMission({ satellite: { formFactor: m.satellite.formFactor, pieces: [...m.satellite.pieces], propellantKg: m.satellite.propellantKg, validated: false, launched: false } });
}

function setSatellite(patch) {
  hideUndo(); // otro cambio vuelve obsoleto el «Deshacer» del reinicio
  m.satellite = { ...m.satellite, ...patch };
  removedIds = [];
  persist();
  render();
}

let flashProp = false;
/** Propelente (kg, redondeado hacia arriba a 0.1) con el que el motor `p` llega al Δv del destino, sin pasar su tanque. */
function suggestedPropellant(p, otherIds) {
  const dest = data.missions.find((d) => d.id === m.missionId);
  const dry = dryMass(resolvePieces([m.satellite.formFactor, ...otherIds].filter(Boolean), data.pieces)) + p.massKg;
  const kg = Math.ceil(propellantFor(dest?.dvRequired || 0, p.isp, dry) * 10) / 10;
  return Math.min(p.maxPropellantKg || 0, kg);
}

function togglePiece(p) {
  const sat = m.satellite;
  if (p.category === 'structure') return setSatellite({ formFactor: p.id });
  const has = sat.pieces.includes(p.id);
  if (p.category === 'propulsion') {
    const others = sat.pieces.filter((id) => data.pieces.find((x) => x.id === id)?.category !== 'propulsion');
    // Al agregar un motor se precarga el propelente que pide el destino: con 0 kg el Δv queda en 0 y el jugador
    // no sabe que existe el control. El destello (flashProp) le muestra dónde está.
    const kg = has ? 0 : sat.propellantKg || suggestedPropellant(p, others);
    flashProp = !has;
    return setSatellite({ pieces: has ? others : [...others, p.id], propellantKg: kg });
  }
  return setSatellite({ pieces: has ? sat.pieces.filter((id) => id !== p.id) : [...sat.pieces, p.id] });
}

// ═════════════════════════════════════════════════════════
// VISOR 3D — CubeSat en CSS 3D (docs/niveles/nivel-2.md)
// ═════════════════════════════════════════════════════════

const SAT_W = 72;      // px de la sección de 1U (la carcasa mide 10×10 cm)
const U_PX = 40;       // px de largo por cada U
const GAP = 3;         // separación entre bloques internos
const FLAME_H = 98;    // cono (28) + llama (70)
const CAT_COLOR = { power: '#fbbf24', propulsion: '#ff6b35', comms: '#a78bfa', adcs: '#34d399', obc: '#60a5fa', instrument: '#4ade80' };
const PIECE_ABBR = {
  'solar-deploy': 'SOLAR', 'battery': 'BAT 80', 'battery-large': 'BAT 160', 'rtg-mini': 'RTG',
  'prop-cold': 'GAS FRÍO', 'prop-green': 'MONOPROP', 'prop-ion': 'ION',
  'comm-uhf': 'UHF', 'comm-x': 'BANDA X', 'adcs': 'ADCS', 'obc': 'OBC',
  'inst-camera': 'CAM', 'inst-spectro': 'ESPECTRO', 'inst-radar': 'RADAR', 'inst-mag': 'MAG',
};

let view = null;            // referencias al DOM del visor
const pieceEls = new Map(); // id de pieza → bloque 3D (se reutiliza para que los bloques se deslicen en vez de reaparecer)

function box(cls, label) {
  const b = document.createElement('div');
  b.className = `n2-box ${cls}`;
  for (const f of ['fr', 'bk', 'lf', 'rt', 'tp', 'bt']) {
    const face = document.createElement('i');
    face.className = `n2-f ${f}`;
    b.append(face);
  }
  if (label) b.querySelector('.fr').textContent = label;
  return b;
}

function init3D() {
  const sat = $('n2-sat');
  const shell = box('n2-shell');
  const inner = document.createElement('div');
  const wings = ['l', 'r'].map((s) => { const w = document.createElement('div'); w.className = `n2-wing n2-wing-${s}`; w.dataset.id = 'solar-deploy'; return w; });
  const thrust = document.createElement('div');
  thrust.className = 'n2-thrust';
  for (const cls of ['', ' x']) {
    for (const part of ['cone', 'flame']) {
      const e = document.createElement('div');
      e.className = `n2-${part}${cls}`;
      thrust.append(e);
    }
  }
  sat.append(shell, inner, ...wings, thrust);
  view = { scene: $('n2-scene'), fit: $('n2-fit'), sat, shell, inner, thrust, empty: $('n2-empty'), hud: $('n2-hud'), layout: null };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitView).observe(view.scene);

  // Hover bidireccional: tarjeta del catálogo ↔ bloque 3D (misma pieza = mismo data-id)
  const catalog = $('n2-catalog');
  catalog.addEventListener('mouseover', (e) => setHover(e.target.closest('.n2-piece-wrap')?.querySelector('.n2-piece')?.dataset.id ?? null));
  catalog.addEventListener('mouseleave', () => setHover(null));
  catalog.addEventListener('focusin', (e) => setHover(e.target.closest('.n2-piece-wrap')?.querySelector('.n2-piece')?.dataset.id ?? null));
  catalog.addEventListener('focusout', () => setHover(null));
  sat.addEventListener('mouseover', (e) => setHover(e.target.closest('[data-id]')?.dataset.id ?? null, true));
  sat.addEventListener('mouseleave', () => setHover(null));
}

let hoverId = null;
function paintHover(scroll = false) {
  for (const el of document.querySelectorAll('.is-hover')) el.classList.remove('is-hover');
  if (!hoverId) return;
  for (const el of document.querySelectorAll(`[data-id="${CSS.escape(hoverId)}"]`)) el.classList.add('is-hover');
  // Desde el 3D: la tarjeta puede estar fuera de vista en la columna con scroll
  if (scroll) document.querySelector(`.n2-piece[data-id="${CSS.escape(hoverId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function setHover(id, scroll = false) {
  if (id === hoverId) return;
  hoverId = id;
  paintHover(scroll);
}

/** Viñeta roja (la del Nivel 1) cuando el jugador se pasa de un límite (ver alertingMeters). El CSS solo anima opacity. */
function paintAlert(M, x) {
  document.body.classList.toggle('has-danger', alertingMeters(M, x).length > 0);
}

// El catálogo y el panel se reconstruyen en cada cambio. Sin esto el foco del teclado caería al <body>
// y quien navega con Tab tendría que empezar de nuevo desde arriba después de cada pieza.
let pendingFocus = null; // clave de foco que deja un «Aplicar», porque su botón desaparece con la ventana
function focusKey(el) {
  if (!el || el === document.body) return null;
  const wrap = el.closest?.('.n2-piece-wrap');
  if (wrap) return `${el.classList.contains('n2-info') ? 'info' : 'piece'}:${wrap.querySelector('.n2-piece')?.dataset.id}`;
  if (el.matches?.('.n2-row')) return `row:${el.dataset.check}`;
  if (el.matches?.('.n2-tip')) return `tip:${el.dataset.hint}`;
  if (el.matches?.('.n2-prop input')) return 'slider';
  if (el.matches?.('.n2-footer .n2-btn-primary')) return 'launch';
  return null;
}
function restoreFocus(key) {
  if (!key) return;
  const [kind, id] = key.split(':');
  const sel = {
    piece: `.n2-piece[data-id="${id}"]`,
    info: `.n2-piece-wrap:has(.n2-piece[data-id="${id}"]) .n2-info`,
    row: `.n2-row[data-check="${id}"]`,
    tip: `.n2-tip[data-hint="${id}"]`,
    slider: '.n2-prop input',
    launch: '.n2-footer .n2-btn-primary',
  }[kind];
  // Un consejo que ya no existe (se resolvió) deja el foco en el siguiente
  (document.querySelector(sel) ?? (kind === 'tip' ? document.querySelector('.n2-tip') : null))?.focus({ preventScroll: true });
}

/** Barra vertical de la batería: Wh que piden eclipses y quemados contra los Wh usables (50 % de la capacidad). */
function paintBattery(x) {
  const dest = data.missions.find((d) => d.id === m.missionId);
  const B = meterData(x, dest, m.budget.space).battery;
  for (const bar of view.inner.querySelectorAll('.n2-batt')) {
    bar.dataset.level = B.level;
    bar.style.setProperty('--pct', `${B.level === 'pending' ? 0 : Math.round(B.pct)}%`);
    bar.setAttribute('aria-label', `${t('battery')}: ${Math.round(B.pct)} %`);
  }
}

/** Escala y centra el modelo para que quepa siempre en la columna central (sin scroll). */
function fitView() {
  if (!view?.layout) return;
  const { top, bottom, width } = view.layout;
  const w = view.scene.clientWidth;
  const h = view.scene.clientHeight;
  if (!w || !h) return;
  const s = Math.min(2.2, (h - 56) / ((bottom - top) * 1.2), (w - 24) / (width * 1.55));
  view.fit.style.transform = `scale(${Math.max(s, 0.1)}) translateY(${-(top + bottom) / 2}px)`;
}

function render3D(result) {
  const sat = m.satellite;
  const struct = data.pieces.find((p) => p.id === sat.formFactor);
  $('n2-viewer').setAttribute('aria-label', t('viewerLabel'));
  // Destino: el ventanal muestra la Luna, Marte o Europa al fondo (is-moon | is-mars | is-europa)
  for (const id of ['moon', 'mars', 'europa']) $('n2-viewer').classList.toggle(`is-${id}`, id === m.missionId);
  view.fit.hidden = !struct;
  view.empty.hidden = !!struct;
  view.hud.hidden = !struct;
  view.empty.textContent = `← ${t('pickStructure')}`;
  if (!struct) { view.layout = null; return; }

  const capU = struct.volumeU;
  const length = capU * U_PX;
  view.shell.style.setProperty('--h', `${length}px`);
  view.shell.dataset.id = struct.id;

  // Bloques internos apilados desde arriba. El que no cabe entero se sale por la base y se pinta en rojo.
  const parts = sat.pieces.map((id) => data.pieces.find((p) => p.id === id)).filter(Boolean);
  let usedU = 0;
  let spill = false;
  for (const p of parts) {
    const vol = p.volumeU || 0;
    const y = -length / 2 + usedU * U_PX + (vol * U_PX) / 2;
    const over = usedU + vol > capU + 1e-6;
    spill ||= over;
    usedU += vol;
    let el = pieceEls.get(p.id);
    if (!el) {
      el = box('n2-b is-new', PIECE_ABBR[p.id] || p.id);
      el.dataset.id = p.id;
      el.style.setProperty('--c', CAT_COLOR[p.category] || '#9aa6cf');
      if (p.storageWh) el.querySelector('.fr').append(Object.assign(document.createElement('b'), { className: 'n2-batt', innerHTML: '<i></i>' }));
      if (p.category === 'propulsion') el.querySelector('.fr').append(Object.assign(document.createElement('b'), { className: 'n2-fuel' }));
      el.addEventListener('animationend', (e) => { if (e.target === el) el.classList.remove('is-new'); });
      pieceEls.set(p.id, el);
      view.inner.append(el);
    }
    const h = Math.max(6, vol * U_PX - GAP);
    el.style.setProperty('--h', `${h}px`);
    el.querySelector('.fr').style.fontSize = `${Math.min(8.5, h - 3)}px`;
    el.style.transform = `translate3d(${over ? 20 : 0}px, ${y}px, 0)`;
    el.classList.toggle('is-over', over);
  }
  for (const [id, el] of pieceEls) {
    if (!sat.pieces.includes(id)) { el.remove(); pieceEls.delete(id); }
  }

  // Paneles desplegables, propulsión y error
  const hasWings = sat.pieces.includes('solar-deploy');
  const prop = parts.find((p) => p.category === 'propulsion');
  const stackEnd = -length / 2 + usedU * U_PX;
  const baseY = Math.max(length / 2, stackEnd) + 2;
  view.sat.classList.toggle('has-wings', hasWings);
  view.sat.classList.toggle('has-prop', !!prop);
  view.sat.classList.toggle('is-error', result.checks.some((c) => (c.id === 'mass' || c.id === 'volume') && !c.ok));
  if (prop) view.sat.dataset.prop = prop.id; else delete view.sat.dataset.prop;
  paintBattery(result.metrics);
  view.sat.style.setProperty('--wh', `${Math.min(300, Math.max(100, length * 0.85))}px`);
  view.sat.style.setProperty('--fuel', String(prop?.maxPropellantKg ? sat.propellantKg / prop.maxPropellantKg : 0));
  view.thrust.style.transform = `translateY(${baseY}px)`;

  const x = result.metrics;
  const bad = !result.checks.find((c) => c.id === 'volume').ok || !result.checks.find((c) => c.id === 'mass').ok;
  view.hud.classList.toggle('is-error', bad);
  view.hud.textContent = `${tx(struct.name)} · ${t('volume')} ${+usedU.toFixed(2)} / ${capU} U · ${t('mass')} ${grams(x.wet)} / ${grams(x.massCap)} g`;

  view.layout = { top: -length / 2, bottom: prop ? baseY + FLAME_H : Math.max(baseY, stackEnd), width: hasWings ? SAT_W + 240 : SAT_W + (spill ? 40 : 0) };
  fitView();
}

// ═════════════════════════════════════════════════════════
// CATÁLOGO — columna izquierda
// ═════════════════════════════════════════════════════════

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
    extra = `<small class="n2-hint">${form ? `${tx(form)} · ` : ''}${t('maxMass', { n: `<span class="n2-num">${grams(p.volumeU * KG_PER_U)}</span>` })}</small>`;
  } else if (fit.why) {
    extra = `<small class="n2-why" id="n2-why-${p.id}">${fit.compatible ? '✔' : '✘'} ${tx(fit.why)}</small>`;
    b.setAttribute('aria-describedby', `n2-why-${p.id}`);
  }
  b.innerHTML = `<strong>${tx(p.name)}</strong>
    <small class="n2-specs">${grams(p.massKg)} g · ${p.volumeU}U · ${powerText(p, solarFactor, (w) => t('atDest', { w: fmt(w) }))} · $${p.cost}M${p.isp ? ` · Isp ${p.isp}s` : ''}</small>
    <small class="n2-trl">TRL ${p.trl} · ${t(`trlShort.${p.trl}`)}</small>${extra}`;
  b.addEventListener('click', () => togglePiece(p));

  const wrap = document.createElement('div');
  wrap.className = 'n2-piece-wrap';
  const info = document.createElement('button');
  info.type = 'button';
  info.className = 'n2-info';
  info.textContent = 'i';
  info.addEventListener('click', () => openInfo(infoPiece(p), info));
  info.setAttribute('aria-label', t('trlInfo', { name: tx(p.name), n: p.trl }));
  wrap.append(b, info);
  return wrap;
}

function renderCatalog(solarFactor) {
  const box = $('n2-catalog');
  box.replaceChildren();
  for (const cat of CATEGORIES) {
    const h = document.createElement('p');
    h.className = 'n2-cat-heading';
    h.textContent = t(`categories.${cat}`);
    const list = document.createElement('div');
    list.className = 'n2-pieces';
    for (const p of data.pieces.filter((x) => x.category === cat)) list.append(pieceButton(p, solarFactor));
    box.append(h, list);
  }
}

// ═════════════════════════════════════════════════════════
// TELEMETRÍA — columna derecha (Pasos 2 y 3)
// ═════════════════════════════════════════════════════════

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
      label: 'Δv', d: M.dv,
      value: M.dv.level === 'pending' ? `— / ${fmt(M.dv.required, 0)} m/s` : `${fmt(x.dv, 0)} / ${fmt(M.dv.required, 0)} m/s`,
      aria: `${fmt(x.dv, 0)} m/s, ${req}`,
      marker: M.dv.markerPct == null ? '' : `<i class="n2-marker" style="left:${M.dv.markerPct}%"></i>`,
      note: M.dv.markerPct == null ? '' : `│ ${req}`,
    }),
    M.mass.level === 'pending'
      ? meterHTML({ label: t('mass'), d: M.mass, value: '— / — g', aria: t('pickStructure'), note: t('pickStructure') })
      : meterHTML({ label: t('mass'), d: M.mass, value: `${grams(x.wet)} / ${grams(M.mass.cap)} g`, aria: `${grams(x.wet)} g / ${grams(M.mass.cap)} g` }),
    meterHTML({
      label: t('power'), d: M.power,
      // Positivo pero bajo el mínimo del destino: «+3.5 W» en rojo confunde; mejor decir cuánto falta
      value: M.power.level === 'pending' ? '—' : M.power.net >= 0 && M.power.powerLow ? t('powerMissing', { n: fmt(M.power.minW - x.power.generated) }) : signedW(M.power.net),
      aria: `${signedW(M.power.net)}: ${use}`,
      note: [M.power.powerLow ? t('minPower', { n: M.power.minW }) : '', use, sun].filter(Boolean).join(' · '),
    }),
    M.battery.level === 'pending'
      ? meterHTML({ label: t('battery'), d: M.battery, value: '—', aria: t('noBattery'), note: t('noBattery') })
      : meterHTML({ label: t('battery'), d: M.battery, value: s.capacityWh > 0 ? `${fmt(s.neededWh, 0)} / ${fmt(s.usableWh, 0)} Wh` : t('noBatteryShort', { n: fmt(s.neededWh, 0) }), aria: storeUse, note: storeUse }),
    meterHTML({ label: t('cost'), d: M.cost, value: `$${x.cost}M / $${mission.budget.space}M`, aria: `$${x.cost}M / $${mission.budget.space}M` }),
    rocketOverload(x, rocket)
      ? `<p class="n2-alert" role="alert">🚫 ${t('rocketLimit', { name: tx(rocket.name), n: grams(rocket.maxPayloadKg) })}</p>`
      : '',
  ].join('');
}

// ═════════════════════════════════════════════════════════
// VENTANA DE INFORMACIÓN — una sola, reutilizable (verificaciones, consejos, piezas y lanzamiento)
// No se vuelve a calcular el diseño: todo sale de `last`, lo que render() ya calculó.
// ═════════════════════════════════════════════════════════

const HAS_POPOVER = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';
let infoPop = null;
let infoBackdrop = null;
let lastOpener = null;
let popActions = []; // acciones de los botones «Aplicar» de la ventana abierta

const hasText = (path) => path.split('.').reduce((o, k) => o?.[k], TEXTOS.es) !== undefined;
const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const nameOf = (id) => tx(data.pieces.find((p) => p.id === id)?.name);

function initInfo() {
  // Sin soporte de `popover` (navegadores viejos) la ventana se muestra con clases CSS: .n2-no-popover / .is-open
  if (!HAS_POPOVER) document.documentElement.classList.add('n2-no-popover');
  infoPop = document.createElement('div');
  infoPop.className = 'n2-pop';
  infoPop.id = 'n2-info';
  infoPop.setAttribute('popover', '');
  infoPop.setAttribute('role', 'dialog');
  infoBackdrop = document.createElement('div');
  infoBackdrop.className = 'n2-pop-backdrop';
  infoBackdrop.hidden = true;
  $('n2-pops').replaceChildren(infoPop, infoBackdrop);
  infoBackdrop.addEventListener('click', closeInfo);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !HAS_POPOVER && infoOpen()) closeInfo(); });
  infoPop.addEventListener('toggle', (e) => { if (e.newState === 'closed') afterInfoClosed(); });
  infoPop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'close') return closeInfo();
    if (b.dataset.act === 'launch') { closeInfo(); return doLaunch(); }
    if (b.dataset.act === 'apply') { const act = popActions[Number(b.dataset.i)]; pendingFocus = focusKey(lastOpener); closeInfo(); applyAction(act); }
  });
}

const infoOpen = () => (HAS_POPOVER ? infoPop.matches(':popover-open') : infoPop.classList.contains('is-open'));

function openInfo(html, opener) {
  popActions = [];
  infoPop.innerHTML = typeof html === 'function' ? html() : html;
  lastOpener = opener || document.activeElement;
  clearNudge();
  if (HAS_POPOVER) { try { infoPop.showPopover(); } catch { /* ya estaba abierta */ } }
  else { infoPop.classList.add('is-open'); infoBackdrop.hidden = false; }
  infoPop.querySelector('button')?.focus({ preventScroll: true });
}

function closeInfo() {
  if (HAS_POPOVER) { try { infoPop.hidePopover(); } catch { /* ya cerrada */ } return; }
  infoPop.classList.remove('is-open');
  infoBackdrop.hidden = true;
  afterInfoClosed();
}

function afterInfoClosed() {
  armNudge();
  const o = lastOpener;
  lastOpener = null;
  if (o?.isConnected) o.focus({ preventScroll: true });
}

/** Aplica la acción de un consejo con las mismas funciones que usa el catálogo (el visor 3D reacciona solo). */
function applyAction(action) {
  const next = nextSatellite(m.satellite, action, data.pieces);
  setSatellite({ formFactor: next.formFactor, pieces: next.pieces, propellantKg: next.propellantKg });
}

function actionLabel(a) {
  if (a.type === 'setStructure') return t('actions.setStructure', { name: nameOf(a.id) });
  if (a.type === 'setPropellant') return t('actions.setPropellant', { kg: fmt(a.kg) });
  if (a.type === 'swap') return t('actions.swap', { from: nameOf(a.remove), to: nameOf(a.add) });
  return a.kg != null ? t('actions.addKg', { name: nameOf(a.id), kg: fmt(a.kg) }) : t('actions.add', { name: nameOf(a.id) });
}

// Los consejos que proponen el mismo cambio (p. ej. «cambia a 6U» por masa y por volumen) se muestran una sola vez
const uniqueByAction = (hints) => {
  const seen = new Set();
  return hints.filter((h) => {
    if (!h.action) return true;
    const k = JSON.stringify(h.action);
    return seen.has(k) ? false : seen.add(k);
  });
};

function hintTexts(h) {
  const key = h.key === 'volume' && !h.vars.next ? 'volumeCut' : h.key === 'dvTank' && !h.vars.alt ? 'dvTankNoAlt' : h.key;
  const vars = { dest: tx(last.dest?.name), ...h.vars };
  return { title: t(`tips.${key}.title`, vars), why: t(`tips.${key}.why`, vars) };
}

/** Valor contra límite de una verificación, con barra. */
function detailHTML(d) {
  if (d.state === 'pending') return `<p class="n2-pop-muted">${t('popup.pendingNow')}</p>`;
  if (d.limit == null) return `<p class="${d.ok ? 'n2-ok' : 'n2-bad'}">${d.ok ? '✔' : '✘'} ${t(`checks.${d.id}`)}</p>`;
  const num = (n) => (d.unit === 'g' ? thousands(n) : n);
  const withUnit = (n) => (d.unit === '$M' ? `$${n}M` : `${num(n)}${d.unit ? ` ${d.unit}` : ''}`);
  const extra = d.id === 'power'
    ? `<small class="n2-note">${t('powerUse', { g: fmt(d.value), c: fmt(d.use) })}${d.minW ? ` · ${t('minPower', { n: d.minW })}` : ''}</small>` : '';
  return `<div class="n2-meter lvl-${d.ok ? 'ok' : 'danger'}">
      <div class="n2-meter-head"><span>${t('popup.valueLimit')}</span><b>${withUnit(d.value)} / ${withUnit(d.limit)}</b></div>
      <div class="n2-track"><div class="n2-fill" style="width:${d.pct}%"></div></div>${extra}</div>`;
}

function hintBlock(h) {
  const { title, why } = hintTexts(h);
  let btn = `<small class="n2-pop-muted">${t('popup.noFix')}</small>`;
  if (h.action) {
    const i = popActions.push(h.action) - 1;
    btn = `<button type="button" class="n2-btn n2-btn-primary" data-act="apply" data-i="${i}">${t('popup.apply')}: ${actionLabel(h.action)}</button>`;
  }
  return `<div class="n2-hint-block"><b>${title}</b><p>${why}</p>${btn}</div>`;
}

const closeBtn = (label = t('gotIt')) => `<button type="button" class="n2-btn n2-btn-ghost n2-pop-close" data-act="close">${label}</button>`;

function infoCheck(c) {
  const d = checkDetail(c, last.result.metrics, last.dest, m.budget.space);
  const related = last.allHints.filter((h) => h.check === c.id);
  const fix = related.length
    ? related.map(hintBlock).join('')
    : `<p>${d.ok ? t('popup.haveOk') : t(`checkInfo.${c.id}.fix`)}</p>`;
  return `<h3>${t(`checks.${c.id}`)}</h3>
    <h4>${t('popup.what')}</h4><p>${t(`checkInfo.${c.id}.what`)}</p>
    <h4>${t('popup.formula')}</h4><p class="n2-formula">${t(`checkInfo.${c.id}.formula`)}</p>
    <h4>${t('popup.now')}</h4>${detailHTML(d)}
    ${d.ok && d.state !== 'pending' ? '' : `<h4>${t('popup.fix')}</h4>${fix}`}
    ${closeBtn()}`;
}

function infoHint(h) {
  const { title, why } = hintTexts(h);
  const c = last.result.checks.find((x) => x.id === h.check);
  const i = h.action ? popActions.push(h.action) - 1 : -1;
  return `<h3>${title}</h3>
    <h4>${t('popup.why')}</h4><p>${why}</p>
    ${c ? `<h4>${t('popup.now')}</h4>${detailHTML(checkDetail(c, last.result.metrics, last.dest, m.budget.space))}` : ''}
    ${h.action
    ? `<button type="button" class="n2-btn n2-btn-primary n2-pop-apply" data-act="apply" data-i="${i}">${t('popup.apply')}: ${actionLabel(h.action)}</button>`
    : `<p class="n2-pop-muted">${t('popup.noFix')}</p>`}
    ${closeBtn()}`;
}

const FACT_MARK = { ok: '✔', warn: '▲', bad: '✘', info: '•' };
function factText(f) {
  const key = f.key === 'structCap' && f.vars.byRocket ? 'structCapRocket' : f.key;
  const lvl = `facts.${key}_${f.level}`;
  return t(hasText(lvl) ? lvl : `facts.${key}`, { dest: tx(last.dest?.name), ...f.vars });
}

function infoPiece(p) {
  const info = data.workshop.pieceInfo?.[p.id];
  const installed = p.id === m.satellite.formFactor || m.satellite.pieces.includes(p.id);
  const fit = instrumentStatus(p, m, data.workshop.instrumentFit);
  const facts = pieceFacts(p, { mission: last.dest, metrics: last.result.metrics, budgetSpace: m.budget.space, rocket: last.rocket, installed });
  const lines = facts.map((f) => `<li class="lvl-${f.level}"><span aria-hidden="true">${FACT_MARK[f.level]}</span> ${factText(f)}</li>`);
  if (fit.why) lines.push(`<li class="lvl-${fit.compatible ? 'ok' : 'bad'}"><span aria-hidden="true">${fit.compatible ? '✔' : '✘'}</span> ${tx(fit.why)}</li>`);
  return `<header class="n2-pop-head"><h3>${tx(p.name)}</h3>
      <span class="n2-chip">${t(`categories.${p.category}`)}</span><span class="n2-chip n2-chip-trl">TRL ${p.trl} · ${t(`trlShort.${p.trl}`)}</span></header>
    <h4>${t('piece.real')}</h4><p>${info ? tx(info.real) : tx(p.desc)}</p>
    <h4>${t('piece.mission')}</h4><ul class="n2-facts">${lines.join('')}</ul>
    ${info ? `<h4>${t('piece.tradeoff')}</h4><p>${tx(info.tradeoff)}</p>` : ''}
    <details class="n2-trl-note"><summary>${t('piece.trlWhat')}</summary><p>${t('trlWhat')}</p></details>
    ${closeBtn()}`;
}

function infoLaunchEmpty() {
  const h = last.allHints.find((x) => x.check === 'structure');
  const i = h?.action ? popActions.push(h.action) - 1 : -1;
  return `<h3>${t('launchEmpty.title')}</h3><p>${t('launchEmpty.body')}</p>
    ${h?.action ? `<button type="button" class="n2-btn n2-btn-primary n2-pop-apply" data-act="apply" data-i="${i}">${t('popup.apply')}: ${actionLabel(h.action)}</button>` : ''}
    ${closeBtn(t('launchEmpty.ok'))}`;
}

function infoLaunchConfirm() {
  const bad = last.result.checks.filter((c) => checkState(c, last.result.metrics) === 'bad');
  return `<h3>${t('launchConfirm.title', { n: bad.length })}</h3><p>${t('launchConfirm.body')}</p>
    <ul class="n2-facts">${bad.map((c) => `<li class="lvl-bad"><span aria-hidden="true">✘</span> ${t(`checks.${c.id}`)}</li>`).join('')}</ul>
    <div class="n2-pop-actions">
      <button type="button" class="n2-btn n2-btn-primary" data-act="close">${t('launchConfirm.keep')}</button>
      <button type="button" class="n2-btn n2-btn-ghost" data-act="launch">${t('launchConfirm.go')}</button>
    </div>`;
}

function doLaunch() {
  const { result, rocket } = last;
  const satellite = satelliteSummary(m.satellite, result, rocket);
  // Contrato: solo `satellite`. En demo se guarda la misión de ejemplo, pero nunca sobre datos reales.
  if (!demo) saveMission({ satellite });
  else if (!loadMission()) saveMission({ missionId: m.missionId, rocketId: m.rocketId, budget: m.budget, plan: m.plan, satellite });
  location.href = levelHref(3);
}

/** Lanzar siempre responde: sin estructura explica qué falta; con rojos pide confirmar; en verde lanza. */
function onLaunch(btn) {
  if (!m.satellite.formFactor) return openInfo(infoLaunchEmpty, btn);
  if (!last.result.valid) return openInfo(infoLaunchConfirm, btn);
  doLaunch();
}

// ═════════════════════════════════════════════════════════
// EMPUJÓN POR INACTIVIDAD — si el jugador no toca nada, la primera verificación en rojo y el primer consejo laten
// ═════════════════════════════════════════════════════════

const NUDGE_MS = 8000;
let nudgeTimer = 0;
function clearNudge() {
  clearTimeout(nudgeTimer);
  for (const el of document.querySelectorAll('.is-nudge')) el.classList.remove('is-nudge');
}
function armNudge() {
  clearNudge();
  nudgeTimer = setTimeout(showNudge, NUDGE_MS);
}
function showNudge() {
  if (infoOpen()) return armNudge();
  document.querySelector('.n2-row.is-bad')?.classList.add('is-nudge');
  document.querySelector('.n2-tip')?.classList.add('is-nudge');
}

// ═════════════════════════════════════════════════════════
// TELEMETRÍA — columna derecha
// ═════════════════════════════════════════════════════════

function guideSection(result, tips) {
  const x = result.metrics;
  const sec = document.createElement('div');
  sec.className = 'n2-telem-section n2-guide';
  const MARK = { ok: '✔', bad: '✘', pending: '○' };
  const states = result.checks.map((c) => checkState(c, x));
  const okN = states.filter((s) => s === 'ok').length;
  const rows = result.checks.map((c, i) => {
    const label = t(`checks.${c.id}`);
    return `<button type="button" class="n2-row is-${states[i]}" data-check="${c.id}" aria-label="${t(`guide.state.${states[i]}`)}: ${label}">
      <span class="n2-row-mark" aria-hidden="true">${MARK[states[i]]}</span><span class="n2-row-txt">${label}</span><span class="n2-row-go" aria-hidden="true">›</span></button>`;
  }).join('');
  const pending = states.includes('pending') ? `<p class="n2-pending-note">${m.satellite.formFactor ? t('pendingBattery') : t('pendingHint')}</p>` : '';
  const tipsHTML = tips.length
    ? `<p class="n2-telem-heading n2-guide-next">${t('guide.next')}</p><div class="n2-tips">${tips.map((h, i) => {
      const { title, why } = hintTexts(h);
      return `<button type="button" class="n2-tip" data-hint="${i}"><span class="n2-tip-n" aria-hidden="true">${i + 1}</span>
        <span class="n2-tip-body"><b>${title}</b><small>${why}</small></span><span class="n2-row-go" aria-hidden="true">›</span></button>`;
    }).join('')}</div>`
    : result.valid ? `<p class="n2-allgreen">✔ ${t('guide.allGreen')}</p>` : '';
  sec.innerHTML = `<div class="n2-guide-head"><p class="n2-telem-heading">${t('guide.title')}</p><span class="n2-guide-count">${t('guide.ok', { n: okN, t: result.checks.length })}</span></div>
    <div class="n2-guide-bar" aria-hidden="true"><i style="width:${(okN / result.checks.length) * 100}%"></i></div>
    ${tipsHTML}<div class="n2-rows">${rows}</div>${pending}<p class="n2-pop-muted n2-guide-tap">${t('guide.tapHint')}</p>`;
  sec.addEventListener('click', (e) => {
    const row = e.target.closest('.n2-row');
    if (row) return openInfo(() => infoCheck(last.result.checks.find((c) => c.id === row.dataset.check)), row);
    const tip = e.target.closest('.n2-tip');
    if (tip) openInfo(() => infoHint(last.tips[Number(tip.dataset.hint)]), tip);
  });
  return sec;
}

function renderTelem() {
  const telem = $('n2-telem');
  telem.replaceChildren();
  const sat = m.satellite;
  const { result, tips } = last;

  // — Slider de propelente —
  const prop = data.pieces.find((p) => sat.pieces.includes(p.id) && p.category === 'propulsion');
  const metersDiv = document.createElement('div');
  metersDiv.className = 'n2-meters';
  metersDiv.innerHTML = metersHTML(m);

  if (prop) {
    const propSec = document.createElement('div');
    propSec.className = 'n2-telem-section';
    const ph = document.createElement('p');
    ph.className = 'n2-telem-heading';
    ph.textContent = t('propellant');
    const propRow = document.createElement('label');
    propRow.className = `n2-prop${flashProp ? ' is-new' : ''}`;
    flashProp = false;
    propRow.innerHTML = `
      <div class="n2-prop-row">
        <span>${t('propellant')}</span>
        <output>${fmt(sat.propellantKg)} kg</output>
      </div>
      <input type="range" min="0" max="${prop.maxPropellantKg}" step="0.1" value="${sat.propellantKg}">`;
    const input = propRow.querySelector('input');
    input.addEventListener('input', (e) => {
      propRow.querySelector('output').textContent = `${fmt(e.target.value)} kg`;
      const preview = { ...m, satellite: { ...sat, propellantKg: Number(e.target.value) } };
      metersDiv.innerHTML = metersHTML(preview);
      const pr = validateDesign(preview, data);
      const pm = pr.metrics;
      view.sat.style.setProperty('--fuel', String(Number(e.target.value) / prop.maxPropellantKg));
      paintBattery(pm);
      paintAlert(meterData(pm, last.dest, m.budget.space), pm);
      renderMini(pr);
    });
    input.addEventListener('change', (e) => setSatellite({ propellantKg: Number(e.target.value) }));
    propSec.append(ph, propRow);
    telem.append(propSec);
  }

  // — Medidores —
  const metersSec = document.createElement('div');
  metersSec.className = 'n2-telem-section';
  const mh = document.createElement('p');
  mh.className = 'n2-telem-heading';
  mh.textContent = t('resources');
  metersSec.append(mh, metersDiv);
  telem.append(metersSec);

  // — Panel guía: verificaciones + qué hacer ahora —
  telem.append(guideSection(result, tips));
  renderMini(result);

  // — Botones Atrás / Lanzar (siempre activo) —
  const footer = document.createElement('div');
  footer.className = 'n2-footer';
  const back = document.createElement('a');
  back.className = 'n2-btn n2-btn-ghost';
  back.href = levelHref(1);
  back.textContent = t('back');
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.className = `n2-btn n2-btn-primary${result.valid ? '' : ' is-risky'}`;
  launch.textContent = t('launch');
  launch.title = t('launchHelp');
  launch.addEventListener('click', () => onLaunch(launch));
  footer.append(back, launch);
  telem.append(footer);
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
  box.querySelector('.n2-mini-more').addEventListener('click', () => $('n2-telem').scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

// ═════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ═════════════════════════════════════════════════════════

function render() {
  const focusBefore = pendingFocus ?? focusKey(document.activeElement);
  pendingFocus = null;
  const dest = data.missions.find((d) => d.id === m.missionId);
  const target = dest?.scienceTargets?.[m.plan?.scienceTargetIdx];
  const brand = lang === 'en' ? 'Orbit Explorers' : 'Exploradores de Órbita';

  document.documentElement.lang = lang;
  document.title = `${t('title')} · ${brand}`;
  $('n2-brand-name').textContent = brand;
  $('n2-menu').title = t('menu');
  $('n2-lang').textContent = t('lang');
  $('n2-lang').setAttribute('aria-label', t('langLabel'));
  $('n2-reset').title = t('reset');
  $('n2-reset').setAttribute('aria-label', t('reset'));
  $('n2-catalog').setAttribute('aria-label', t('a11y.catalog'));
  $('n2-telem').setAttribute('aria-label', t('a11y.telem'));

  // Objetivo en la barra superior
  const objBar = $('n2-topbar-obj');
  if (target) {
    objBar.innerHTML = `🎯 ${t('objective', { target: `<strong>${esc(tx(target))}</strong>` })}`;
  } else {
    objBar.textContent = t('title');
  }

  // Avisos
  $('n2-demo').textContent = t('demo');
  $('n2-demo').hidden = !demo;
  $('n2-notice').hidden = !removedIds.length;
  if (removedIds.length) $('n2-notice').textContent = t('removed', { list: removedIds.map((id) => tx(data.pieces.find((p) => p.id === id).name)).join(', ') });

  // Se calcula UNA vez por render; todo lo demás (catálogo, visor, panel, ventanas) lee de `last`.
  const result = validateDesign(m, data);
  const parts = resolvePieces([m.satellite.formFactor, ...m.satellite.pieces].filter(Boolean), data.pieces);
  const allHints = tradeHints(result, parts, data.pieces, dest, m.budget.space, {
    nameOf: (p) => tx(p.name),
    allowed: (p) => instrumentStatus(p, m, data.workshop.instrumentFit).compatible,
    max: 99,
  });
  last = {
    result, dest, allHints,
    rocket: data.rockets.find((r) => r.id === m.rocketId),
    M: meterData(result.metrics, dest, m.budget.space),
    tips: uniqueByAction(allHints).slice(0, 3),
  };

  renderCatalog(result.metrics.power.solarFactor);
  render3D(result);
  renderTelem();
  paintAlert(last.M, result.metrics);
  paintHover();
  armNudge();
  restoreFocus(focusBefore);
}

// --- ↺ Reiniciar: aviso con «Deshacer» durante unos segundos ---------------------------
let undoTimer = 0;
function hideUndo() {
  clearTimeout(undoTimer);
  const el = $('n2-undo');
  if (el) el.hidden = true;
}
function showUndo(snapshot) {
  const el = $('n2-undo');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'n2-undo-btn';
  btn.textContent = t('undo');
  btn.addEventListener('click', () => { setSatellite(snapshot); }); // setSatellite oculta el aviso
  el.replaceChildren(`${t('resetDone')} `, btn);
  el.hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndo, 7000);
}

// ═════════════════════════════════════════════════════════
// BOOT
// ═════════════════════════════════════════════════════════

async function boot() {
  const load = (f) => fetch(`../data/${f}.json`).then((r) => { if (!r.ok) throw new Error(`data/${f}.json`); return r.json(); });
  const [missions, rockets, pieces, workshop] = await Promise.all(['missions', 'rockets', 'pieces', 'workshop'].map(load));
  data = { missions, rockets, pieces, workshop };

  ({ mission: m, demo } = pickMission(loadMission()));
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

  $('n2-reset').addEventListener('click', () => {
    const before = { formFactor: m.satellite.formFactor, pieces: [...m.satellite.pieces], propellantKg: m.satellite.propellantKg };
    setSatellite({ formFactor: null, pieces: [], propellantKg: 0 });
    if (before.formFactor || before.pieces.length) showUndo(before);
  });

  initInfo();
  init3D();
  // Cualquier gesto del jugador reinicia la cuenta del empujón
  for (const ev of ['pointerdown', 'keydown', 'wheel']) document.addEventListener(ev, armNudge, { passive: true, capture: true });
  render();
}

if (typeof document !== 'undefined' && document.getElementById('n2-catalog')) {
  boot().catch((err) => {
    console.error(err);
    $('n2-catalog').innerHTML = `<p class="n2-bad" style="padding:12px">${t('loadError')}: ${esc(err.message)}. ${t('serveHint')} <code>python3 -m http.server</code>.</p>`;
  });
}
