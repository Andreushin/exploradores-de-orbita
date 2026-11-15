// OWNER: Rol 3 (@JU4NMAX) — Nivel 2 · Taller del CubeSat (docs/niveles/nivel-2.md).
// Lee la misión del Nivel 1 de `eo-mision` (docs/contrato-niveles.md), deja armar el CubeSat bajo
// los límites de masa, energía y presupuesto, y escribe solo la sección `satellite`.
// Capa de juego: cuadrícula de U (ensamble.js), riesgo por TRL, dilemas y estrellas (juego.js),
// prueba en tierra animada (prueba.js) y sonido (sonido.js).
import { validateDesign, KG_PER_U } from '../js/physics.js';
import { loadMission, saveMission, levelHref } from '../js/mision-store.js';
import { grams, meterData, rocketOverload, instrumentStatus, incompatibleSelected, powerText, signedW } from '../js/taller-reglas.js';
import { riesgoTRL, riesgoMision, elegirDilema, evaluarDilema, estrellasTaller, piezasDe } from './juego.js';
import { renderBanco, packCells, estiloPieza } from './ensamble.js';
import { correrPrueba } from './prueba.js';
import { sfx, botonSonido, silenciado } from './sonido.js';
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
const BEST_KEY = 'eo-taller-mejor';
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
const pct = (p) => fmt(p * 100, 0);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// --- Datos y estado -----------------------------------------------------------
let data;      // { missions, rockets, pieces, workshop }
let m;         // misión en curso: { missionId, rocketId, budget, plan, satellite }
let demo = false;
let removedIds = []; // instrumentos quitados al entrar (se muestran hasta el siguiente cambio)
let nuevo = null;    // pieza recién instalada (se anima en el banco y en el catálogo)
let foco = null;     // id de la pieza que tenía el foco antes de redibujar
let prueba = { estado: 'none', firma: null, fallida: null, ctl: null }; // none | running | passed | failed
let dilemaAbierto = false;

/** Misión de trabajo: la guardada si trae lo que el Nivel 2 necesita; si no, el demo. */
export function pickMission(saved) {
  const usable = saved?.missionId && saved?.rocketId && saved?.budget?.space > 0;
  if (!usable) return { mission: structuredClone(DEMO), demo: true };
  const satellite = { formFactor: null, pieces: [], propellantKg: 0, ...saved.satellite };
  return { mission: { ...saved, plan: saved.plan || {}, satellite }, demo: false };
}

/**
 * Resumen que pide el contrato para que N3 y N4 no recalculen.
 * `extra` (opcional) agrega la capa de juego: stars, risk, riskTotal, dilemma, groundTest.
 */
export function satelliteSummary(sat, result, rocket, extra = {}) {
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
    ...extra,
  };
}

/** Guarda solo `satellite` (sin el resumen hasta validar). Nunca pisa un demo sobre datos reales. */
function persist() {
  if (demo) return;
  const { formFactor, pieces, propellantKg, dilemma } = m.satellite;
  saveMission({ satellite: { formFactor, pieces: [...pieces], propellantKg, validated: false, ...(dilemma ? { dilemma } : {}) } });
}

/** Huella del diseño: si cambia, la prueba en tierra hay que repetirla. */
const firma = () => JSON.stringify([m.satellite.formFactor, [...m.satellite.pieces].sort(), m.satellite.propellantKg]);

function setSatellite(patch) {
  const antes = validateDesign(m, data);
  m.satellite = { ...m.satellite, ...patch };
  removedIds = [];
  persist();
  const despues = validateDesign(m, data);
  // Alerta suave cuando un cambio rompe un límite que antes estaba bien
  const roto = ['mass', 'volume', 'cost', 'power'].some((id) => antes.checks.find((c) => c.id === id)?.ok && !despues.checks.find((c) => c.id === id)?.ok);
  if (roto) sfx('alerta');
  render();
  maybeDilema(despues);
}

function togglePiece(p) {
  if (prueba.estado === 'running') return; // durante la prueba en tierra el banco está cerrado
  const sat = m.satellite;
  foco = p.id;
  if (p.category === 'structure') {
    nuevo = p.id === sat.formFactor ? null : p.id;
    sfx('clic');
    return setSatellite({ formFactor: p.id });
  }
  const has = sat.pieces.includes(p.id);
  nuevo = has ? null : p.id;
  sfx(has ? 'quitar' : 'clic');
  if (p.category === 'propulsion') {
    // Solo un sistema de propulsión a la vez
    const others = sat.pieces.filter((id) => data.pieces.find((x) => x.id === id)?.category !== 'propulsion');
    return setSatellite({ pieces: has ? others : [...others, p.id], propellantKg: has ? 0 : sat.propellantKg });
  }
  return setSatellite({ pieces: has ? sat.pieces.filter((id) => id !== p.id) : [...sat.pieces, p.id] });
}

// --- Capa de juego: dilema, riesgo, estrellas ------------------------------------
const dilemas = () => data.workshop.dilemmas || [];
function dilemaActual() {
  const saved = m.satellite.dilemma;
  if (!saved) return null;
  const def = elegirDilema(dilemas(), saved);
  return def ? { def, choice: def.choices[saved.choice], saved } : null;
}

/** El dilema aparece una sola vez: la primera vez que el diseño pasa todas las verificaciones. */
function maybeDilema(result) {
  if (!result.valid || m.satellite.dilemma || dilemaAbierto || !dilemas().length) return;
  const def = elegirDilema(dilemas());
  abrirDilema(def, { wetKg: Math.round(result.metrics.wet * 1000) / 1000 });
}

function abrirDilema(def, ref) {
  const dlg = $('n2-dialog');
  dilemaAbierto = true;
  dlg.className = 'n2-dialog n2-dialog-dilemma';
  dlg.innerHTML = `
    <p class="n2-kicker">${def.icon} ${t('dilemmaTag')}</p>
    <h2 id="n2-dlg-title">${esc(tx(def.title))}</h2>
    <p>${esc(tx(def.text))}</p>
    <div class="n2-dlg-actions"></div>`;
  dlg.setAttribute('aria-labelledby', 'n2-dlg-title');
  const row = dlg.querySelector('.n2-dlg-actions');
  def.choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `n2-btn ${i === 0 ? 'n2-btn-primary' : ''}`;
    b.textContent = tx(c.label);
    b.addEventListener('click', () => {
      sfx('clic');
      dilemaAbierto = false;
      dlg.close();
      m.satellite = { ...m.satellite, dilemma: { id: def.id, choice: i, ref } };
      persist();
      render();
    });
    row.append(b);
  });
  // Hay que elegir: Escape no cierra el dilema
  dlg.oncancel = (e) => e.preventDefault();
  sfx('alerta');
  dlg.showModal();
}

/** Todo lo que se deriva del diseño actual. */
function estado() {
  const result = validateDesign(m, data);
  const dest = data.missions.find((d) => d.id === m.missionId);
  const piezas = piezasDe(m.satellite, data.pieces);
  const dil = dilemaActual();
  const riesgo = riesgoMision(piezas, data.workshop.trlRisk, dil);
  const reto = dil ? evaluarDilema(dil.choice, { metrics: result.metrics, mission: dest, piezas, ref: dil.saved.ref }) : null;
  const est = estrellasTaller({ valid: result.valid, metrics: result.metrics, mission: dest, budgetSpace: m.budget.space, riesgo, reto }, data.workshop.stars);
  return { result, dest, piezas, dil, riesgo, reto, est };
}

function retoTexto(dil, reto) {
  const metric = dil.choice.goal.metric;
  const g = (n) => (metric === 'wetKg' ? grams(n) : fmt(n, 0));
  return t(`goal.${metric}`, { target: g(reto.target), value: g(reto.value) });
}

// --- Catálogo -----------------------------------------------------------------
function trlBadge(p) {
  const r = riesgoTRL(p.trl, data.workshop.trlRisk);
  const lvl = r === 0 ? 'ok' : r <= 0.05 ? 'low' : r <= 0.1 ? 'mid' : 'high';
  const txt = r === 0 ? t('riskBadgeSafe', { trl: p.trl }) : t('riskBadge', { trl: p.trl, pct: pct(r) });
  return `<span class="n2-trl n2-trl-${lvl}">★ ${txt}</span>`;
}

function pieceButton(p, solarFactor) {
  const sat = m.satellite;
  const fit = instrumentStatus(p, m, data.workshop.instrumentFit);
  const selected = p.id === sat.formFactor || sat.pieces.includes(p.id);
  const { color, icon } = p.category === 'structure' ? { color: '#9aa6cf', icon: '🧊' } : estiloPieza(p);
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.id = p.id;
  b.className = `n2-piece${selected ? ' is-selected' : ''}${fit.compatible ? '' : ' is-off'}${nuevo === p.id ? ' is-pop' : ''}`;
  b.style.setProperty('--cat', color);
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
  const power = powerText(p, solarFactor, (w) => t('atDest', { w: fmt(w) }));
  // El nombre va primero: es el inicio del nombre accesible del botón.
  b.innerHTML = `<span class="n2-piece-head"><span class="n2-piece-icon" aria-hidden="true">${icon}</span><strong>${tx(p.name)}</strong>
      <span class="n2-piece-state">${selected ? `✓ ${t('installed')}` : `+ ${t('install')}`}</span></span>
    <span class="n2-stats">
      <span title="${t('mass')}">⚖️ ${grams(p.massKg)} g</span>
      <span title="U">🧊 ${p.volumeU}U</span>
      <span title="${t('power')}">${p.storageWh ? '🔋' : '⚡'} ${power}</span>
      <span title="${t('cost')}">💰 $${p.cost}M</span>
      ${p.isp ? `<span title="Isp">🔥 ${p.isp}s</span>` : ''}
    </span>
    ${trlBadge(p)}${extra}`;
  b.addEventListener('click', () => togglePiece(p));
  return b;
}

function renderCatalog() {
  const box = $('n2-catalog');
  box.replaceChildren();
  const { solarFactor } = validateDesign(m, data).metrics.power; // los paneles dan menos lejos del Sol
  for (const cat of CATEGORIES) {
    const h = document.createElement('h2');
    h.id = `n2-cat-${cat}`;
    h.textContent = t(`categories.${cat}`);
    const list = document.createElement('div');
    list.className = 'n2-pieces';
    for (const p of data.pieces.filter((x) => x.category === cat)) list.append(pieceButton(p, solarFactor));
    box.append(h, list);
  }
}

// --- Banco de ensamblaje ---------------------------------------------------------
function renderBench(s) {
  const estructura = s.piezas.find((p) => p.category === 'structure') || null;
  const piezas = s.piezas.filter((p) => p.category !== 'structure');
  $('n2-bench-title').textContent = t('benchTitle');
  $('n2-banco').innerHTML = renderBanco({
    estructura, piezas, nuevo,
    nombre: (p) => tx(p.name),
    vacio: t('benchEmpty'),
    ariaLabel: estructura ? t('benchAria', { u: estructura.volumeU, n: piezas.length }) : t('benchEmpty'),
  });
  const use = $('n2-bench-use');
  if (!estructura) { use.textContent = ''; use.className = 'n2-bench-use'; }
  else {
    const used = s.result.metrics ? s.result.checks.find((c) => c.id === 'volume').value : 0;
    const over = packCells(piezas, estructura.volumeU).overflow;
    use.className = `n2-bench-use ${over.length ? 'n2-bad' : used / estructura.volumeU >= 0.85 ? 'is-warn' : ''}`;
    use.textContent = `🧊 ${t('benchUse', { used: fmt(used, 2).replace(/\.?0+$/, ''), cap: estructura.volumeU })}${over.length ? ` · ${t('benchOverflow', { list: over.map((o) => tx(data.pieces.find((p) => p.id === o.id).name)).join(', ') })}` : ''}`;
  }
}

// --- Panel: estrellas, dilema, riesgo, medidores, verificaciones, prueba ----------
function meterHTML({ icon, label, value, d, aria, note, marker }) {
  const tight = d.level === 'warn' ? ` · ${t('tight')}` : '';
  return `
    <div class="n2-meter lvl-${d.level}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="${Math.round(d.pct)}" aria-valuetext="${aria}${tight}">
      <div class="n2-meter-head"><span><span aria-hidden="true">${icon}</span> ${label}</span><b>${value}</b></div>
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
      icon: '🚀', label: 'Δv', d: M.dv, value: `${fmt(x.dv, 0)} / ${fmt(M.dv.required, 0)} m/s`, aria: `${fmt(x.dv, 0)} m/s, ${req}`,
      marker: M.dv.markerPct == null ? '' : `<i class="n2-marker" style="left:${M.dv.markerPct}%"></i>`,
      note: M.dv.markerPct == null ? '' : `│ ${req}`,
    }),
    meterHTML({ icon: '⚖️', label: t('mass'), d: M.mass, value: `${grams(x.wet)} / ${grams(M.mass.cap)} g`, aria: `${grams(x.wet)} g / ${grams(M.mass.cap)} g` }),
    meterHTML({
      icon: '⚡', label: t('power'), d: M.power, value: signedW(M.power.net), aria: `${signedW(M.power.net)}: ${use}`,
      note: [M.power.powerLow ? t('minPower', { n: M.power.minW }) : '', use, sun].filter(Boolean).join(' · '),
    }),
    meterHTML({ icon: '🔋', label: t('battery'), d: M.battery, value: `${fmt(s.neededWh, 0)} / ${fmt(s.usableWh, 0)} Wh`, aria: storeUse, note: storeUse }),
    meterHTML({ icon: '💰', label: t('cost'), d: M.cost, value: `$${x.cost}M / $${mission.budget.space}M`, aria: `$${x.cost}M / $${mission.budget.space}M` }),
    rocketOverload(x, rocket)
      ? `<p class="n2-alert" role="alert">🚫 ${t('rocketLimit', { name: tx(rocket.name), n: grams(rocket.maxPayloadKg) })}</p>`
      : '',
  ].join('');
}

const starRow = (n) => [0, 1, 2].map((i) => `<span class="n2-star${i < n ? ' is-on' : ''}" aria-hidden="true">★</span>`).join('');

function starsHTML(s) {
  return `
    <section class="n2-card n2-stars-card" aria-label="${t('starsTitle')}: ${s.est.stars} / 3">
      <div class="n2-card-head"><h2>${t('starsTitle')}</h2><span class="n2-stars">${starRow(s.est.stars)}</span></div>
      <ul class="n2-crit">${s.est.criteria.map((c) => `<li class="${c.ok ? 'is-ok' : ''}">${c.ok ? '★' : '☆'} ${t(`crit.${c.id}`)}</li>`).join('')}</ul>
    </section>`;
}

function dilemaHTML(s) {
  if (!s.dil) return '';
  const { def, choice } = s.dil;
  let body;
  if (choice.kind === 'goal') body = `<p>${t('dilemmaGoal', { detail: retoTexto(s.dil, s.reto) })}</p><p class="${s.reto.met ? 'n2-ok' : 'n2-warn'}">${s.reto.met ? t('dilemmaMet') : t('dilemmaPending')}</p>`;
  else if (choice.kind === 'risk') body = `<p>${t('dilemmaRisk', { pct: pct(choice.risk.add), cat: t(`catName.${choice.risk.category}`) })}</p>`;
  else body = `<p>${t('dilemmaNone')}</p>`;
  return `<section class="n2-card n2-dilemma-card"><p class="n2-kicker">${def.icon} ${t('dilemmaTag')} · ${esc(tx(def.title))}</p>${body}</section>`;
}

function riesgoHTML(s) {
  const r = s.riesgo;
  const lvl = r.total === 0 ? 'ok' : r.total <= 0.1 ? 'warn' : 'danger';
  const items = r.items.map((it) => `<li>${tx(data.pieces.find((p) => p.id === it.id)?.name)} <b>${pct(it.p)} %</b> <small>TRL ${it.trl}</small></li>`).join('');
  return `
    <section class="n2-card n2-risk-card lvl-${lvl}">
      <div class="n2-card-head"><h2>⚠️ ${t('riskTitle')}</h2><b class="n2-risk-total">${pct(r.total)} %</b></div>
      ${r.items.length ? `<ul class="n2-risk-list">${items}</ul>` : `<p class="n2-ok">${t('riskNone')}</p>`}
      <small class="n2-note">${t('riskHelp')}</small>
    </section>`;
}

function renderPanel(s) {
  const panel = $('n2-panel');
  panel.replaceChildren();
  const sat = m.satellite;
  panel.insertAdjacentHTML('beforeend', starsHTML(s) + dilemaHTML(s) + riesgoHTML(s));

  const meters = document.createElement('div');
  meters.className = 'n2-meters';
  meters.innerHTML = metersHTML(m);

  const prop = data.pieces.find((p) => sat.pieces.includes(p.id) && p.category === 'propulsion');
  if (prop) {
    const row = document.createElement('label');
    row.className = 'n2-prop';
    row.innerHTML = `<span>⛽ ${t('propellant')}</span>
      <input type="range" min="0" max="${prop.maxPropellantKg}" step="0.1" value="${sat.propellantKg}">
      <output>${fmt(sat.propellantKg)} kg</output>`;
    const input = row.querySelector('input');
    input.addEventListener('input', (e) => {
      row.querySelector('output').textContent = `${fmt(e.target.value)} kg`;
      // En vivo: masa y Δv cambian antes de soltar el slider
      meters.innerHTML = metersHTML({ ...m, satellite: { ...sat, propellantKg: Number(e.target.value) } });
    });
    input.addEventListener('change', (e) => { foco = 'propellant'; nuevo = null; setSatellite({ propellantKg: Number(e.target.value) }); });
    panel.append(row);
  }
  panel.append(meters);

  // Verificaciones: las que fallan a la vista; las que pasan, resumidas
  const { result } = s;
  const okN = result.checks.filter((c) => c.ok).length;
  const det = document.createElement('details');
  det.className = 'n2-checks-box';
  det.open = okN < result.checks.length;
  det.innerHTML = `<summary>${t('checksTitle')} · ${t('checksOk', { n: okN, t: result.checks.length })}</summary>`;
  const list = document.createElement('ul');
  list.className = 'n2-checks';
  for (const c of [...result.checks].sort((a, b) => a.ok - b.ok)) {
    const li = document.createElement('li');
    li.className = c.ok ? 'n2-ok' : 'n2-bad';
    li.textContent = `${c.ok ? '✔' : '✘'} ${t(`checks.${c.id}`)}`;
    list.append(li);
  }
  det.append(list);
  panel.append(det);

  // Prueba en tierra y lanzamiento
  const fresh = prueba.firma === firma();
  const passed = prueba.estado === 'passed' && fresh;
  const testBox = document.createElement('section');
  testBox.className = 'n2-card n2-test-card';
  let status = t('testNeeded');
  let cls = 'n2-muted';
  if (prueba.estado === 'running') status = '';
  else if (prueba.estado !== 'none' && !fresh) { status = t('testStale'); cls = 'n2-warn'; }
  else if (passed) { status = t('testPassed'); cls = 'n2-ok'; }
  else if (prueba.estado === 'failed') { status = t('testFailed', { phase: prueba.fallida?.label || '' }); cls = 'n2-bad'; }
  testBox.innerHTML = `<h2>🧪 ${t('testTitle')}</h2><p class="n2-note">${t('testIntro')}</p>${status ? `<p class="${cls}" role="status">${status}</p>` : ''}`;
  panel.append(testBox);

  const footer = document.createElement('div');
  footer.className = 'n2-footer';
  const back = document.createElement('a');
  back.className = 'n2-btn n2-btn-ghost';
  back.href = levelHref(1);
  back.textContent = t('back');
  const test = document.createElement('button');
  test.type = 'button';
  test.id = 'n2-test-btn';
  test.className = `n2-btn ${passed ? '' : 'n2-btn-test'}`;
  if (prueba.estado === 'running') {
    test.textContent = t('testSkip');
    test.addEventListener('click', () => prueba.ctl?.saltar());
  } else {
    test.textContent = prueba.estado === 'none' ? t('testBtn') : t('testAgain');
    test.addEventListener('click', iniciarPrueba);
  }
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.id = 'n2-launch';
  launch.className = 'n2-btn n2-btn-primary';
  launch.textContent = t('launch');
  launch.disabled = !(result.valid && passed) || dilemaAbierto;
  launch.title = t('launchLocked');
  launch.addEventListener('click', () => lanzar(estado()));
  footer.append(back, test, launch);
  panel.append(footer);
}

// --- Prueba en tierra --------------------------------------------------------------
function fasesPrueba(s) {
  const { result, dest } = s;
  const x = result.metrics;
  const ck = Object.fromEntries(result.checks.map((c) => [c.id, c]));
  const radio = s.piezas.find((p) => p.category === 'comms');
  const engine = s.piezas.find((p) => p.category === 'propulsion');
  const nInst = s.piezas.filter((p) => p.category === 'instrument').length;
  const st = x.storage;
  return [
    { id: 'boot', icon: '💾', ok: ck.structure.ok && ck.obc.ok, cat: ck.structure.ok ? 'obc' : 'structure',
      detail: !ck.structure.ok ? t('testDetail.noStructure') : ck.obc.ok ? t('testDetail.bootOk') : t('testDetail.noObc') },
    { id: 'shake', icon: '📳', ok: ck.mass.ok && ck.volume.ok, cat: 'structure',
      detail: t('testDetail.shake', { wet: grams(x.wet), cap: grams(x.massCap === Infinity ? 0 : x.massCap), used: fmt(ck.volume.value, 2), capU: x.capU }) },
    { id: 'deploy', icon: '☀️', ok: ck.power.ok, cat: 'power',
      detail: t('testDetail.deploy', { net: signedW(x.power.net), g: fmt(x.power.generated), c: fmt(x.power.consumed) }) },
    { id: 'eclipse', icon: '🌑', ok: ck.battery.ok, cat: 'power',
      detail: t('testDetail.eclipse', { n: fmt(st.neededWh, 0), u: fmt(st.usableWh, 0) }),
      bar: { from: 100, to: st.usableWh > 0 ? (1 - st.neededWh / st.usableWh) * 100 : 0 } },
    { id: 'burn', icon: '🔥', ok: ck.propellant.ok && ck.deltaV.ok, cat: 'propulsion',
      detail: engine ? t('testDetail.burn', { dv: fmt(x.dv, 0), req: dest?.dvRequired ?? 0 }) : t('testDetail.noEngine'),
      bar: { from: 0, to: dest?.dvRequired ? (x.dv / dest.dvRequired) * 100 : 0 } },
    { id: 'link', icon: '📡', ok: ck.comms.ok, cat: 'comms',
      detail: radio ? t('testDetail.link', { r: radio.range, d: dest?.commsDifficulty ?? 1 }) : t('testDetail.noRadio') },
    { id: 'science', icon: '🔬', ok: ck.science.ok, cat: 'instrument',
      detail: nInst ? t('testDetail.science', { n: nInst }) : t('testDetail.noScience') },
    { id: 'cost', icon: '💰', ok: ck.cost.ok, cat: null,
      detail: t('testDetail.cost', { c: x.cost, b: m.budget.space }) },
  ].map((f) => ({ ...f, label: t(`test.${f.id}`) }));
}

function iniciarPrueba() {
  const s = estado();
  const host = $('n2-bench');
  const lista = $('n2-test-log');
  host.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  prueba = { estado: 'running', firma: firma(), fallida: null, ctl: null };
  nuevo = null;
  render();
  prueba.ctl = correrPrueba({
    host, lista, fases: fasesPrueba(s), reduce: reduceMotion,
    onFin: (ok, fallida) => {
      prueba = { estado: ok ? 'passed' : 'failed', firma: prueba.firma, fallida, ctl: null };
      render();
      if (!ok && fallida?.cat) {
        const h = $(`n2-cat-${fallida.cat}`);
        h?.classList.add('is-flag');
        h?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
      $(ok ? 'n2-launch' : 'n2-test-btn')?.focus({ preventScroll: true });
    },
  });
}

// --- Lanzamiento y resultado ----------------------------------------------------------
function lanzar(s) {
  const { result, est, riesgo, dil, reto } = s;
  const rocket = data.rockets.find((r) => r.id === m.rocketId);
  const satellite = satelliteSummary(m.satellite, result, rocket, {
    stars: est.stars,
    risk: riesgo.items,
    riskTotal: riesgo.total,
    ...(dil ? { dilemma: { id: dil.def.id, choice: dil.saved.choice, kind: dil.choice.kind, met: reto ? reto.met : null, ref: dil.saved.ref } } : {}),
    groundTest: true,
  });
  // Contrato: solo `satellite`. En demo se guarda la misión de ejemplo, pero nunca sobre datos reales.
  if (!demo) saveMission({ satellite });
  else if (!loadMission()) saveMission({ missionId: m.missionId, rocketId: m.rocketId, budget: m.budget, plan: m.plan, satellite });
  const record = guardarMejor(m.missionId, est.stars);
  mostrarResultado(s, record);
}

function guardarMejor(destId, stars) {
  let best = {};
  try { best = JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch { /* ignore */ }
  const prev = best[destId] || 0;
  if (stars > prev) {
    best[destId] = stars;
    try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* ignore */ }
  }
  return { prev, improved: stars > prev };
}

function consejos(s) {
  const { est, result, riesgo, dil, reto } = s;
  const out = [];
  const sized = est.criteria.find((c) => c.id === 'sized');
  const eff = est.criteria.find((c) => c.id === 'efficient');
  const cfg = { dvMarginMin: 1.03, costMaxRatio: 0.9, ...data.workshop.stars };
  if (!sized.ok) out.push(t(sized.margin < cfg.dvMarginMin ? 'hint.short' : 'hint.over', { pct: fmt((sized.margin - 1) * 100, 0) }));
  if (!eff.cheap) out.push(t('hint.cost', { c: result.metrics.cost, b: m.budget.space, max: Math.floor(m.budget.space * cfg.costMaxRatio) }));
  if (!eff.safe) out.push(t('hint.risk', { pct: pct(riesgo.total) }));
  if (!eff.retoOk && dil && reto) out.push(t('hint.reto', { detail: retoTexto(dil, reto) }));
  return out;
}

function mostrarResultado(s, record) {
  const dlg = $('n2-dialog');
  const tips = consejos(s);
  dlg.className = 'n2-dialog n2-dialog-result';
  dlg.innerHTML = `
    <p class="n2-kicker">${t('resultKicker')}</p>
    <h2 id="n2-dlg-title">${t('resultTitle')}</h2>
    <p class="n2-result-stars" aria-label="${s.est.stars} / 3">${[0, 1, 2].map(() => '<span class="n2-star" aria-hidden="true">★</span>').join('')}</p>
    <p class="n2-best">${record.improved ? t('resultBest') : t('resultBestWas', { n: Math.max(record.prev, s.est.stars) })}</p>
    <p class="n2-note">${t('resultRisk', { pct: pct(s.riesgo.total) })}</p>
    ${tips.length ? `<h3>${t('resultHow')}</h3><ul class="n2-tips">${tips.map((x) => `<li>${x}</li>`).join('')}</ul>` : `<p class="n2-ok">${t('resultPerfect')}</p>`}
    <div class="n2-dlg-actions"></div>`;
  dlg.setAttribute('aria-labelledby', 'n2-dlg-title');
  const row = dlg.querySelector('.n2-dlg-actions');
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'n2-btn n2-btn-primary';
  go.textContent = t('launchNow');
  go.addEventListener('click', () => goLevel(3));
  const stay = document.createElement('button');
  stay.type = 'button';
  stay.className = 'n2-btn';
  stay.textContent = t('keepTuning');
  stay.addEventListener('click', () => dlg.close());
  row.append(stay, go);
  dlg.oncancel = null;
  dlg.showModal();
  go.focus();
  // Las estrellas se encienden una por una
  const stars = [...dlg.querySelectorAll('.n2-result-stars .n2-star')];
  stars.slice(0, s.est.stars).forEach((el, i) => setTimeout(() => { el.classList.add('is-on'); sfx('estrella'); }, reduceMotion ? 0 : 350 + i * 420));
  if (s.est.stars === 3 && !reduceMotion) setTimeout(() => confeti(dlg), 350 + 3 * 420);
}

function confeti(host) {
  const box = document.createElement('div');
  box.className = 'n2-confetti';
  box.setAttribute('aria-hidden', 'true');
  const colors = ['#ff6b35', '#4fc3f7', '#4ade80', '#fbbf24', '#f472b6'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.4}s`;
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    box.append(c);
  }
  host.append(box);
  setTimeout(() => box.remove(), 2600);
}

/** Navega a otro nivel: su carpeta si ya está publicada, o su pantalla en la app (contrato, #52). */
const goLevel = (n) => { location.href = levelHref(n); };

// --- Pantalla -----------------------------------------------------------------
function render() {
  const s = estado();
  const target = s.dest?.scienceTargets?.[m.plan?.scienceTargetIdx];
  document.documentElement.lang = lang;
  const brand = lang === 'en' ? 'Orbit Explorers' : 'Exploradores de Órbita';
  document.title = `${t('title')} · ${brand}`;
  $('n2-title').textContent = t('title');
  $('n2-lead').textContent = t('lead', { dest: tx(s.dest?.name), space: m.budget.space });
  $('n2-demo').textContent = t('demo');
  $('n2-demo').hidden = !demo;
  $('n2-objective').hidden = !target;
  if (target) $('n2-objective').textContent = `🎯 ${t('objective', { target: tx(target) })}`;
  $('n2-notice').hidden = !removedIds.length;
  if (removedIds.length) $('n2-notice').textContent = t('removed', { list: removedIds.map((id) => tx(data.pieces.find((p) => p.id === id).name)).join(', ') });
  $('n2-lang').textContent = t('lang');
  $('n2-lang').setAttribute('aria-label', t('langLabel'));
  $('n2-sound')?.pintar();
  $('n2-brand-name').textContent = brand;
  $('n2-menu').title = t('menu');
  renderCatalog();
  if (prueba.estado !== 'running') renderBench(s);
  renderPanel(s);
  // El catálogo se redibuja: devolver el foco a la pieza (o al slider) que se tocó
  if (foco === 'propellant') document.querySelector('.n2-prop input')?.focus({ preventScroll: true });
  else if (foco) document.querySelector(`.n2-piece[data-id="${foco}"]`)?.focus({ preventScroll: true });
  foco = null;
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
  // Una prueba en tierra ya superada del mismo diseño sigue valiendo al volver
  if (m.satellite.groundTest && m.satellite.validated) prueba = { estado: 'passed', firma: firma(), fallida: null, ctl: null };

  const sound = botonSonido('n2-btn n2-btn-ghost n2-btn-icon', () => t(silenciado() ? 'soundOff' : 'soundOn'));
  sound.id = 'n2-sound';
  $('n2-lang').before(sound);
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
