// OWNER: Rol 4 — Pantalla 3: travesía e inserción orbital (Canvas 2D). Ver docs/nivel 3.md
// Estado que lee: missionId, satellite, journey.dvAvailable
// Estado que escribe: journey.{dvUsed,events,outcome,fuelOut,propellantLeftKg}
// El combustible se lleva en kg: cada maniobra gasta m·(1 − e^(−Δv / (Isp·g0))) (Tsiolkovsky),
// así un CubeSat más pesado quema más kg por cada m/s.
import { setupCanvas, makeStars, drawStars, drawBody, drawTransfer, transferPoint, drawShip, drawOrbit } from '../canvas/draw.js';

const CRUISE_SECONDS = 8;        // duración de la animación del crucero
const EVENT_AT = [0.3, 0.6];     // 1.º corrección de trayectoria (fija), 2.º evento aleatorio
const FIXED_EVENT = 'tcm';       // id en data/events.json
const RISK_PENALTY_DV = 120;     // m/s perdidos si un riesgo se materializa
const BURN_RATE = 0.45;          // fracción de dvRequired por segundo al mantener el quemado
const GAUGE_MAX = 1.3;           // la barra de precisión llega a 130 % del Δv requerido
const ZONES = [                  // mismos umbrales que physics.insertionOutcome
  { to: 0.75, cls: 'is-flyby' },
  { to: 0.95, cls: 'is-eccentric' },
  { to: 1.1, cls: 'is-orbit' },
  { to: GAUGE_MAX, cls: 'is-crash' },
];

let ctx;
let root;
let raf = 0;
let phase;          // 'cruise' | 'event' | 'insertion' | 'done'
let progress;       // 0..1 del crucero
let burnDv;         // Δv aplicado en el quemado de inserción
let burning;
let eventQueue;
let canvas;
let stars;
let last;
let ui;
let ship;           // { dry, isp, propStart, prop, arrivalProp }

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

const fmt = (n, d = 1) => Number(n).toFixed(d);
const mission = () => ctx.data.missions.find((m) => m.id === ctx.state.missionId);
const ve = () => ship.isp * ctx.physics.G0;
const mass = () => ship.dry + ship.prop;
/** Δv que aún puede dar el propelente que queda. */
const dvLeft = () => ctx.physics.deltaV(ship.isp, mass(), ship.dry);
/** kg de propelente que costaría un Δv con la masa actual. */
const kgFor = (dv) => (ship.isp ? mass() * (1 - Math.exp(-dv / ve())) : Infinity);

/** Gasta propelente para un Δv. Devuelve el Δv realmente aplicado (menor si se acaba). */
function spend(dv) {
  const kg = kgFor(dv);
  if (kg <= ship.prop) {
    ship.prop -= kg;
    return dv;
  }
  const applied = dvLeft();
  ship.prop = 0;
  return applied;
}

function addDvUsed(dv) {
  ctx.update({ journey: { dvUsed: ctx.state.journey.dvUsed + dv, propellantLeftKg: ship.prop } });
}

function initShip() {
  const { state, data, physics } = ctx;
  const pieces = physics.resolvePieces([state.satellite.formFactor, ...state.satellite.pieces].filter(Boolean), data.pieces);
  const prop = state.satellite.propellantKg;
  ship = { dry: physics.dryMass(pieces), isp: physics.systemIsp(pieces), propStart: prop, prop, arrivalProp: prop };
}

function pickEvents() {
  const all = ctx.data.events;
  const fixed = all.find((e) => e.id === FIXED_EVENT);
  const rest = all.filter((e) => e !== fixed).sort(() => Math.random() - 0.5);
  return [fixed, ...rest].filter(Boolean).slice(0, EVENT_AT.length);
}

function build() {
  const { t, tx } = ctx;
  root.replaceChildren();
  root.append(el('h1', null, t('journey.title', { dest: tx(mission().name) })));
  canvas = el('canvas', 'journey-canvas');
  root.append(canvas);

  ui = {
    hud: el('div', 'journey-hud'),
    fuel: el('div', 'journey-fuel'),
    panel: el('div', 'journey-panel'),
  };
  ui.fuel.innerHTML = `
    <span class="journey-fuel-label">${t('journey.fuel')}</span>
    <span class="journey-fuel-track"><span class="journey-fuel-fill"></span></span>
    <output class="journey-fuel-value"></output>`;
  root.append(ui.hud, ui.fuel, ui.panel);
  const { width, height } = canvas.getBoundingClientRect();
  stars = makeStars(140, width, height);
}

function renderHud() {
  const { t } = ctx;
  const m = mission();
  ui.hud.innerHTML = `
    <span>${t('journey.dvLeft')}: <b>${fmt(dvLeft(), 0)} m/s</b></span>
    <span>${t('journey.mass')}: <b>${fmt(mass(), 2)} kg</b></span>
    <span>${t('journey.day')}: <b>${Math.round(progress * m.travelDays)} / ${m.travelDays}</b></span>
    ${phase === 'insertion' || phase === 'done'
      ? `<span>${t('journey.burn')}: <b>${fmt(burnDv, 0)} / ${m.dvRequired} m/s</b></span>` : ''}`;

  const frac = ship.propStart > 0 ? ship.prop / ship.propStart : 0;
  const fill = ui.fuel.querySelector('.journey-fuel-fill');
  fill.style.width = `${(frac * 100).toFixed(1)}%`;
  fill.className = `journey-fuel-fill ${frac > 0.5 ? 'is-ok' : frac > 0.2 ? 'is-low' : 'is-critical'}`;
  ui.fuel.querySelector('.journey-fuel-value').textContent = `${fmt(ship.prop, 2)} / ${fmt(ship.propStart, 2)} kg`;
  if (phase === 'insertion') renderGauge();
}

/** Etiqueta de una opción con su costo en kg para ESTE satélite. */
function choiceLabel(ch) {
  const base = ctx.tx(ch.label);
  if (!ch.dv) return base;
  return `${base} <small class="journey-cost">≈ ${fmt(kgFor(ch.dv), 2)} kg</small>`;
}

function showEvent(ev) {
  const { t, tx } = ctx;
  phase = 'event';
  const tag = ev.id === FIXED_EVENT ? t('journey.keyDecision') : t('journey.event');
  ui.panel.replaceChildren(
    el('small', 'journey-tag', tag),
    el('h3', null, tx(ev.title)),
    el('p', null, tx(ev.text)),
  );
  for (const ch of ev.choices) {
    const b = el('button', 'btn', choiceLabel(ch));
    b.type = 'button';
    b.addEventListener('click', () => {
      let dvCost = ch.dv || 0;
      let hit = false;
      if (ch.risk && Math.random() < ch.risk) {
        dvCost += RISK_PENALTY_DV;
        hit = true;
      }
      const applied = spend(dvCost);
      const j = ctx.state.journey;
      ctx.update({ journey: { events: [...j.events, { id: ev.id, choice: ch, hit }] } });
      addDvUsed(applied);
      if (applied < dvCost || ship.prop <= 0) {
        fail('event');
        return;
      }
      ui.panel.replaceChildren(el('p', hit ? 'warn' : 'ok', hit ? t('journey.riskHit', { dv: RISK_PENALTY_DV }) : t('journey.eventOk')));
      phase = 'cruise';
      last = performance.now();
    });
    ui.panel.append(b);
  }
}

/** Barra de precisión: zonas de sobrevuelo / excéntrica / órbita / impacto y marcador del quemado. */
function gaugeHtml() {
  const { t } = ctx;
  let from = 0;
  const zones = ZONES.map((z) => {
    const w = ((z.to - from) / GAUGE_MAX) * 100;
    from = z.to;
    return `<span class="journey-zone ${z.cls}" style="width:${w}%"></span>`;
  }).join('');
  return `
    <div class="journey-gauge" role="img" aria-label="${t('journey.gaugeLabel')}">
      <div class="journey-gauge-track">${zones}
        <span class="journey-gauge-limit"></span>
        <span class="journey-gauge-marker"></span>
      </div>
      <div class="journey-gauge-legend">
        <span>${t('journey.zones.flyby')}</span><span>${t('journey.zones.eccentric')}</span>
        <span>${t('journey.zones.orbit')}</span><span>${t('journey.zones.crash')}</span>
      </div>
    </div>`;
}

function renderGauge() {
  const req = mission().dvRequired;
  const pos = (v) => `${Math.min(100, (v / req / GAUGE_MAX) * 100).toFixed(1)}%`;
  const gauge = ui.panel.querySelector('.journey-gauge');
  if (!gauge) return;
  gauge.querySelector('.journey-gauge-marker').style.left = pos(burnDv);
  // Línea roja: hasta dónde alcanza el combustible que queda.
  gauge.querySelector('.journey-gauge-limit').style.left = pos(burnDv + dvLeft());
}

function startInsertion() {
  const { t } = ctx;
  const req = mission().dvRequired;
  ship.arrivalProp = ship.prop;
  // Sin Δv para siquiera una órbita excéntrica: la misión fracasa al llegar.
  if (dvLeft() < req * ZONES[0].to) {
    fail('arrival');
    return;
  }
  phase = 'insertion';
  const btn = el('button', 'btn btn-primary btn-burn', t('journey.holdToBurn'));
  btn.type = 'button';
  const start = (e) => { e.preventDefault(); burning = true; };
  const stop = () => { if (burning) { burning = false; finishInsertion(); } };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
  ui.panel.replaceChildren(
    el('small', 'journey-tag', t('journey.keyDecision')),
    el('h3', null, t('journey.insertionTitle')),
    el('p', null, t('journey.insertionHelp')),
    el('p', 'journey-budget', t('journey.insertionBudget', { need: req, have: fmt(dvLeft(), 0) })),
  );
  ui.panel.insertAdjacentHTML('beforeend', gaugeHtml());
  ui.panel.append(btn);
  renderGauge();
}

function finishInsertion() {
  const { physics } = ctx;
  const req = mission().dvRequired;
  const outOfFuel = ship.prop <= 0;
  addDvUsed(burnDv);
  if (outOfFuel && burnDv < req * ZONES[0].to) {
    fail('burn');
    return;
  }
  phase = 'done';
  const outcome = physics.insertionOutcome(burnDv, req);
  ctx.update({ journey: { outcome } });
  showResult(outcome, outOfFuel);
}

function showResult(outcome, outOfFuel) {
  const { t } = ctx;
  const next = el('button', 'btn btn-primary', t('journey.toReport'));
  next.type = 'button';
  next.addEventListener('click', () => ctx.goTo('report'));
  ui.panel.replaceChildren(el('h3', outcome === 'orbit' ? 'ok' : 'warn', t(`journey.outcomes.${outcome}`)));
  if (outOfFuel) ui.panel.append(el('p', 'warn', t('journey.fuelOut.partial')));
  ui.panel.append(next);
  next.focus();
}

/** Fracaso por combustible: pantalla de reintento educativo. */
function fail(when) {
  const { t, physics } = ctx;
  phase = 'done';
  burning = false;
  const req = mission().dvRequired;
  ctx.update({ journey: { outcome: 'flyby', fuelOut: true, propellantLeftKg: ship.prop } });

  // Propelente que habría hecho falta al llegar para frenar (con la misma masa seca).
  const needAtArrival = physics.propellantFor(req, ship.isp, ship.dry);
  const extraKg = Math.max(0, needAtArrival - (when === 'event' ? 0 : ship.arrivalProp));
  const perDryKg = physics.propellantFor(req, ship.isp, 1); // kg de propelente por cada kg seco

  const box = el('div', 'journey-fail');
  box.append(
    el('h3', 'warn', t('journey.fuelOut.title')),
    el('p', null, t(`journey.fuelOut.when.${when}`)),
  );
  const facts = el('ul', 'journey-facts');
  facts.innerHTML = `
    <li><span>${t('journey.fuelOut.dry')}</span><b>${fmt(ship.dry, 2)} kg</b></li>
    <li><span>${t('journey.fuelOut.loaded')}</span><b>${fmt(ship.propStart, 2)} kg</b></li>
    <li><span>${t('journey.fuelOut.needed')}</span><b>${fmt(needAtArrival, 2)} kg</b></li>
    <li><span>${t('journey.fuelOut.extra')}</span><b>+${fmt(extraKg, 2)} kg</b></li>`;
  box.append(facts);
  box.append(
    el('h4', null, t('journey.fuelOut.lessonTitle')),
    el('p', null, t('journey.fuelOut.lesson', { perKg: fmt(perDryKg, 2), isp: ship.isp })),
  );
  const tips = el('ul', 'journey-tips');
  for (const k of ['lighter', 'morePropellant', 'betterIsp', 'safeChoices']) tips.append(el('li', null, t(`journey.fuelOut.tips.${k}`)));
  box.append(tips);

  const actions = el('div', 'journey-actions');
  const toWorkshop = el('button', 'btn btn-primary', t('journey.fuelOut.toWorkshop'));
  const retry = el('button', 'btn', t('journey.fuelOut.retry'));
  const report = el('button', 'btn btn-ghost', t('journey.toReport'));
  for (const b of [toWorkshop, retry, report]) b.type = 'button';
  toWorkshop.addEventListener('click', () => ctx.goTo('workshop'));
  retry.addEventListener('click', () => ctx.goTo('journey'));
  report.addEventListener('click', () => ctx.goTo('report'));
  actions.append(toWorkshop, retry, report);
  box.append(actions);

  ui.panel.replaceChildren(box);
  toWorkshop.focus();
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const m = mission();

  if (phase === 'cruise') {
    const prev = progress;
    progress = Math.min(1, progress + dt / CRUISE_SECONDS);
    const crossed = EVENT_AT.findIndex((f) => prev < f && progress >= f);
    if (crossed >= 0 && eventQueue.length) showEvent(eventQueue.shift());
    else if (progress >= 1) startInsertion();
  } else if (phase === 'insertion' && burning) {
    const want = m.dvRequired * BURN_RATE * dt;
    const applied = spend(want);
    burnDv += applied;
    if (applied < want || ship.prop <= 0) { burning = false; finishInsertion(); }
  }

  // --- Dibujo ---
  const { g, width, height } = setupCanvas(canvas);
  g.fillStyle = '#050816';
  g.fillRect(0, 0, width, height);
  drawStars(g, stars);
  const ax = width * 0.12; const ay = height * 0.7;
  const bx = width * 0.85; const by = height * 0.35;
  drawBody(g, ax, ay, 14, '#3b82f6', ctx.t('journey.earth'));
  drawBody(g, bx, by, 18, m.color, ctx.tx(m.name));
  drawTransfer(g, ax, ay, bx, by, progress);

  const { outcome, fuelOut } = ctx.state.journey;
  if (phase === 'done' && outcome) {
    if (outcome === 'orbit') drawOrbit(g, bx, by, 34, 0.1);
    else if (outcome === 'eccentric') drawOrbit(g, bx, by, 55, 0.6, '#fd5');
    else if (outcome === 'flyby') {
      // Sin combustible a mitad del viaje, la nave queda a la deriva donde iba.
      const p = fuelOut && progress < 1 ? transferPoint(ax, ay, bx, by, progress) : { x: bx + 60, y: by - 50 };
      drawShip(g, p.x, p.y, false);
    }
  } else {
    const p = transferPoint(ax, ay, bx, by, progress);
    drawShip(g, p.x, p.y, burning);
  }
  renderHud();
  raf = requestAnimationFrame(frame);
}

function onKey(e) {
  if (e.code !== 'Space' || phase !== 'insertion') return;
  e.preventDefault();
  if (e.type === 'keydown') burning = true;
  else if (burning) { burning = false; finishInsertion(); }
}

export default {
  id: 'journey',
  mount(container, context) {
    ctx = context;
    root = container;
    phase = 'cruise';
    progress = 0;
    burnDv = 0;
    burning = false;
    initShip();
    eventQueue = pickEvents();
    // Si se cambió de idioma a mitad de viaje, o se reintenta, reinicia la travesía.
    ctx.update({ journey: { dvUsed: 0, events: [], outcome: null, fuelOut: false, propellantLeftKg: ship.prop } });
    build();
    last = performance.now();
    raf = requestAnimationFrame(frame);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
  },
  unmount() {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
  },
};
