// OWNER: Rol 4 — Pantalla 3: travesía e inserción orbital (Canvas 2D).
// Estado que lee: missionId, journey.dvAvailable
// Estado que escribe: journey.{dvUsed,events,outcome}
import { setupCanvas, makeStars, drawStars, drawBody, drawTransfer, transferPoint, drawShip, drawOrbit } from '../canvas/draw.js';

const CRUISE_SECONDS = 8;        // duración de la animación del crucero
const EVENT_AT = [0.3, 0.65];    // fracciones del viaje donde aparecen eventos
const RISK_PENALTY_DV = 120;     // m/s perdidos si un riesgo se materializa
const BURN_RATE = 0.45;          // fracción de dvRequired por segundo al mantener el quemado

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

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

const mission = () => ctx.data.missions.find((m) => m.id === ctx.state.missionId);
const dvLeft = () => ctx.state.journey.dvAvailable - ctx.state.journey.dvUsed - burnDv;

function build() {
  const { t, tx } = ctx;
  root.replaceChildren();
  root.append(el('h1', null, t('journey.title', { dest: tx(mission().name) })));
  canvas = el('canvas', 'journey-canvas');
  root.append(canvas);

  ui = {
    hud: el('div', 'journey-hud'),
    panel: el('div', 'journey-panel'),
  };
  root.append(ui.hud, ui.panel);
  const { width, height } = canvas.getBoundingClientRect();
  stars = makeStars(140, width, height);
}

function renderHud() {
  const { t } = ctx;
  const m = mission();
  ui.hud.innerHTML = `
    <span>${t('journey.dvLeft')}: <b>${Math.max(0, dvLeft()).toFixed(0)} m/s</b></span>
    <span>${t('journey.day')}: <b>${Math.round(progress * m.travelDays)} / ${m.travelDays}</b></span>
    ${phase === 'insertion' || phase === 'done'
      ? `<span>${t('journey.burn')}: <b>${burnDv.toFixed(0)} / ${m.dvRequired} m/s</b></span>` : ''}`;
}

function showEvent(ev) {
  const { t, tx } = ctx;
  phase = 'event';
  ui.panel.replaceChildren(el('h3', null, tx(ev.title)), el('p', null, tx(ev.text)));
  for (const ch of ev.choices) {
    const b = el('button', 'btn', tx(ch.label));
    b.addEventListener('click', () => {
      let dvCost = ch.dv || 0;
      let hit = false;
      if (ch.risk && Math.random() < ch.risk) {
        dvCost += RISK_PENALTY_DV;
        hit = true;
      }
      const j = ctx.state.journey;
      ctx.update({ journey: { dvUsed: j.dvUsed + dvCost, events: [...j.events, { id: ev.id, choice: ch, hit }] } });
      ui.panel.replaceChildren(el('p', hit ? 'warn' : 'ok', hit ? t('journey.riskHit', { dv: RISK_PENALTY_DV }) : t('journey.eventOk')));
      phase = 'cruise';
      last = performance.now();
    });
    ui.panel.append(b);
  }
}

function startInsertion() {
  const { t } = ctx;
  phase = 'insertion';
  const btn = el('button', 'btn btn-primary btn-burn', t('journey.holdToBurn'));
  const start = (e) => { e.preventDefault(); burning = true; };
  const stop = () => { if (burning) { burning = false; finishInsertion(); } };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  ui.panel.replaceChildren(el('p', null, t('journey.insertionHelp')), btn);
}

function finishInsertion() {
  const { t, physics } = ctx;
  phase = 'done';
  const outcome = physics.insertionOutcome(burnDv, mission().dvRequired);
  ctx.update({ journey: { dvUsed: ctx.state.journey.dvUsed + burnDv, outcome } });
  burnDv = 0;
  const next = el('button', 'btn btn-primary', t('journey.toReport'));
  next.addEventListener('click', () => ctx.goTo('report'));
  ui.panel.replaceChildren(el('h3', outcome === 'orbit' ? 'ok' : 'warn', t(`journey.outcomes.${outcome}`)), next);
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
    burnDv += m.dvRequired * BURN_RATE * dt;
    const avail = ctx.state.journey.dvAvailable - ctx.state.journey.dvUsed;
    if (burnDv >= avail) { burnDv = Math.max(0, avail); burning = false; finishInsertion(); }
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

  const outcome = ctx.state.journey.outcome;
  if (phase === 'done' && outcome) {
    if (outcome === 'orbit') drawOrbit(g, bx, by, 34, 0.1);
    else if (outcome === 'eccentric') drawOrbit(g, bx, by, 55, 0.6, '#fd5');
    else if (outcome === 'flyby') drawShip(g, bx + 60, by - 50, false);
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
    eventQueue = [...ctx.data.events].sort(() => Math.random() - 0.5).slice(0, EVENT_AT.length);
    // Si se cambió de idioma a mitad de viaje, reinicia la travesía.
    ctx.update({ journey: { dvUsed: 0, events: [], outcome: null } });
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
