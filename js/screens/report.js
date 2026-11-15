// OWNER: Rol 2 (reasignado desde Rol 4) — Nivel 4: reporte final, CML y datos científicos simulados.
// Estado que lee: missionId, budget, plan.{cmlCap,maturity,penalty,scienceTargetIdx}, satellite, journey
// Estado que escribe: report.{score,cml,scienceData}
// Lógica sin DOM (CML final, sugerencias, series): js/science-data.js. Datos y referencias NASA: data/science.json.
import { finalCml, improvementHints, instrumentSeries, reportScore, seededRandom, hashSeed, FLYBY_WINDOW } from '../science-data.js';

const CML_LEVELS = [1, 2, 3, 4];
// Ruta relativa a este módulo: funciona en la raíz o en una subruta (como en GitHub Pages).
const SCIENCE_URL = new URL('../../data/science.json', import.meta.url);

let ctx;
let root;
let charts = [];   // [{ canvas, series, def }] para redibujar al cambiar el tamaño
let onResize = null;
let sciencePromise = null;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/** Texto plano (sin interpretar HTML): para nombres que escribe el jugador. */
function text(tag, cls, str) {
  const e = el(tag, cls);
  e.textContent = str;
  return e;
}

function loadScience() {
  sciencePromise ??= fetch(SCIENCE_URL).then((r) => {
    if (!r.ok) throw new Error(`science.json: HTTP ${r.status}`);
    return r.json();
  });
  return sciencePromise;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Dibuja la referencia NASA (punteada) y lo medido por el CubeSat (línea con puntos). */
function drawChart({ canvas, series, def }) {
  const { t, tx } = ctx;
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);

  const small = width < 420;
  const pad = { l: small ? 34 : 56, r: small ? 12 : 40, t: small ? 18 : 48, b: small ? 34 : 52 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const all = [...series.reference, ...series.measured];
  const ys = all.map((p) => p.y);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const ySpan = yMax - yMin || 1;
  const [x0, x1] = def.x;
  const px = (x) => pad.l + ((x - x0) / (x1 - x0)) * W;
  const py = (y) => pad.t + H - ((y - yMin) / ySpan) * H;

  const muted = cssVar('--muted', '#9aa6cf');
  const border = cssVar('--border', '#263362');
  const accent = cssVar('--accent-2', '#4fc3f7');
  const mono = cssVar('--font-mono', 'monospace');

  g.fillStyle = cssVar('--bg', '#070b1a');
  g.fillRect(0, 0, width, height);

  // Rejilla tenue: 4 líneas horizontales y 3 verticales
  g.strokeStyle = 'rgba(154,166,207,0.10)';
  g.lineWidth = 1;
  g.setLineDash([2, 4]);
  g.beginPath();
  for (let i = 1; i <= 4; i++) { const y = pad.t + (H * i) / 5; g.moveTo(pad.l, y); g.lineTo(pad.l + W, y); }
  for (let i = 1; i <= 3; i++) { const x = pad.l + (W * i) / 4; g.moveTo(x, pad.t); g.lineTo(x, pad.t + H); }
  g.stroke();
  g.setLineDash([]);

  // Ejes y etiquetas
  g.strokeStyle = border;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(pad.l, pad.t);
  g.lineTo(pad.l, pad.t + H);
  g.lineTo(pad.l + W, pad.t + H);
  g.stroke();
  g.fillStyle = muted;
  g.font = `11px ${mono}`;
  g.textAlign = 'left';
  g.fillText(String(x0), pad.l, pad.t + H + 18);
  g.textAlign = 'right';
  g.fillText(String(x1), pad.l + W, pad.t + H + 18);
  g.textAlign = 'center';
  g.fillText(tx(def.xLabel), pad.l + W / 2, pad.t + H + (small ? 30 : 34));
  g.save();
  g.translate(small ? 12 : 24, pad.t + H / 2);
  g.rotate(-Math.PI / 2);
  g.fillText(tx(def.yLabel), 0, 0);
  g.restore();

  // Medido por el CubeSat (debajo, para que la referencia punteada siempre se vea encima)
  if (series.measured.length) {
    // Área bajo la curva medida
    const pts = series.measured;
    const area = g.createLinearGradient(0, pad.t, 0, pad.t + H);
    area.addColorStop(0, 'rgba(79,195,247,0.22)');
    area.addColorStop(1, 'rgba(79,195,247,0)');
    g.fillStyle = area;
    g.beginPath();
    g.moveTo(px(pts[0].x), pad.t + H);
    for (const p of pts) g.lineTo(px(p.x), py(p.y));
    g.lineTo(px(pts[pts.length - 1].x), pad.t + H);
    g.closePath();
    g.fill();

    g.strokeStyle = accent;
    g.fillStyle = accent;
    g.lineWidth = 2;
    g.lineJoin = 'round';
    g.beginPath();
    series.measured.forEach((p, i) => (i ? g.lineTo(px(p.x), py(p.y)) : g.moveTo(px(p.x), py(p.y))));
    g.stroke();
    for (const p of series.measured) {
      g.beginPath();
      g.arc(px(p.x), py(p.y), 2, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.fillStyle = muted;
    g.textAlign = 'center';
    g.font = `13px ${mono}`;
    g.fillText(t('report.noSignal'), pad.l + W / 2, pad.t + 16);
  }

  // Referencia NASA (conceptual), encima
  g.strokeStyle = cssVar('--muted', '#9aa6cf');
  g.globalAlpha = 0.8;
  g.lineWidth = 1.5;
  g.setLineDash([5, 4]);
  g.beginPath();
  series.reference.forEach((p, i) => (i ? g.lineTo(px(p.x), py(p.y)) : g.moveTo(px(p.x), py(p.y))));
  g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 1;
}

function redrawAll() {
  for (const c of charts) drawChart(c);
}

/** Tono visual de cada resultado: ok (verde), warn (amarillo) o bad (rojo). */
const OUTCOME_TONE = { orbit: 'ok', eccentric: 'warn', flyby: 'warn', 'no-fuel': 'warn', crash: 'bad' };
/** Porcentaje de enlace (cuántos datos llegaron) por resultado; excéntrica = intermitente, sin %. */
const LINK_PCT = { orbit: 100, flyby: FLYBY_WINDOW * 100, 'no-fuel': FLYBY_WINDOW * 100, crash: 0 };

const SAT_ICON = `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="9" y="9" width="6" height="6" rx="1"/><path d="M12 9V6M12 18v-3M9 12H6M18 12h-3"/>
  <path d="M4.5 4.5l2.5 2.5M17 17l2.5 2.5M19.5 4.5L17 7M7 17l-2.5 2.5"/><circle cx="12" cy="12" r="9" stroke-dasharray="2 3"/></svg>`;

/** Encabezado tipo «centro de control»: estado de la transmisión, enlace y órbita. */
function renderHero(outcome, mission) {
  const { t, tx } = ctx;
  const key = outcome || 'flyby';
  const tone = OUTCOME_TONE[key] || 'warn';
  const hero = el('section', `report-hero tone-${tone}`);
  hero.append(el('div', 'hero-icon', SAT_ICON));
  const body = el('div', 'hero-body');
  body.append(el('span', 'hero-badge', `<i aria-hidden="true"></i>${t(`report.heroBadge.${key}`)}`));
  body.append(el('p', 'hero-title', t(`report.outcomes.${key}`, { dest: tx(mission.name) })));
  body.append(el('p', 'hero-sub', t(`report.heroSub.${key}`)));
  hero.append(body);
  const pct = LINK_PCT[key];
  const stats = el('dl', 'hero-stats');
  stats.append(
    el('div', 'hero-stat', `<dt>${t('report.linkLabel')}</dt><dd class="tone">${t(`report.link.${key}`)}${pct == null ? '' : ` ${pct}%`}</dd>`),
    el('div', 'hero-stat', `<dt>${t('report.orbitLabel')}</dt><dd>${t(`report.orbitType.${key}`)}</dd>`),
  );
  hero.append(stats);
  return hero;
}

function renderCml(final) {
  const { t } = ctx;
  const section = el('section', 'report-section');
  const head = el('div', 'section-head');
  const titles = el('div');
  titles.append(el('h2', null, t('report.cmlTitle')), el('p', 'muted section-sub', t('report.cmlSubtitle')));
  head.append(titles, el('p', 'cml-badge', `<span aria-hidden="true">★</span> ${t('report.cmlReached', { cml: final.cml, name: t(`report.cml.${final.cml}`) })}`));
  section.append(head);

  const bar = el('ol', 'cml-bar');
  const steps = [];
  for (const lvl of CML_LEVELS) {
    const capped = lvl > final.cml && lvl <= final.base;
    const isFinal = lvl === final.cml;
    const step = el('li', 'cml-step' + (capped ? ' is-capped' : '') + (isFinal ? ' is-final' : ''));
    step.style.setProperty('--i', String(lvl - 1));
    let state;
    if (isFinal) state = `<span class="cml-state is-live"><i aria-hidden="true"></i>${t(lvl === 4 ? 'report.cmlState.max' : 'report.cmlState.current')}</span>`;
    else if (lvl < final.cml) state = `<span class="cml-state">${t('report.cmlState.done')}</span>`;
    else if (capped) state = `<span class="cml-state cml-lock">🔒 ${t('report.cappedStep')}</span>`;
    else state = `<span class="cml-state is-pending">${t('report.cmlState.pending')}</span>`;
    step.innerHTML = `
      ${isFinal ? `<span class="cml-tab">${t('report.cmlTab')}</span>` : ''}
      <div class="cml-head"><b class="cml-pill">CML ${lvl}</b>${state}</div>
      <h3 class="cml-name">${t(`report.cml.${lvl}`)}${isFinal && lvl === 4 ? ' <span aria-hidden="true">🎯</span>' : ''}</h3>
      <p class="cml-desc">${t(`report.cmlExplain.${lvl}`)}</p>`;
    if (isFinal) step.setAttribute('aria-current', 'step');
    bar.append(step);
    steps.push(step);
  }
  section.append(bar);

  // Animación: los niveles alcanzados se encienden en orden (sin animación si el jugador la desactivó).
  const fill = () => steps.forEach((s, i) => { if (i < final.cml) s.classList.add('is-reached'); });
  if (reducedMotion()) fill();
  else requestAnimationFrame(() => requestAnimationFrame(fill));
  return section;
}

function renderHints(final, hints) {
  const { t } = ctx;
  const box = el('section', 'report-hints' + (final.cml === 4 ? ' is-max' : ''));
  const left = el('div', 'hints-main');
  left.append(el('h2', null, t(final.cml === 4 ? 'report.hintsTitleMax' : 'report.hintsTitle')));
  left.append(el('p', 'muted', t(`report.reasons.${final.reason}`, { cap: final.cap, base: final.base })));
  const ul = el('ul', 'hint-list');
  for (const h of hints) {
    const vars = { ...h.vars };
    if (vars.check) vars.check = t(`workshop.checks.${vars.check}`);
    ul.append(el('li', null, t(`report.hints.${h.key}`, vars)));
  }
  const aside = el('div', 'hint-box');
  aside.append(el('span', 'hint-icon', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'), ul);
  box.append(left, aside);
  return box;
}

function renderTargets(mission, chosenIdx) {
  const { t, tx } = ctx;
  const ul = el('ul', 'target-list');
  mission.scienceTargets.forEach((tg, i) => {
    const li = el('li', i === chosenIdx ? 'is-target' : null);
    li.append(el('i', 'target-dot'), text('span', null, tx(tg)));
    if (i === chosenIdx) li.append(el('small', 'target-tag', `· ${t('report.yourTarget')}`));
    ul.append(li);
  });
  return ul;
}

function renderCharts(container, { science, instruments, missionId, score, outcome, seed }) {
  const { t, tx } = ctx;
  container.replaceChildren();
  charts = [];
  const scienceData = [];
  if (!instruments.length) {
    container.append(el('p', 'muted', t('report.noInstruments')));
    return scienceData;
  }
  if (outcome === 'flyby') container.append(el('p', 'warn', t('report.flybyData')));
  if (outcome === 'no-fuel') container.append(el('p', 'warn', t('report.noFuelData')));
  if (outcome === 'crash') container.append(el('p', 'warn', t('report.crashData')));

  const grid = el('div', 'chart-grid');
  let lastRef = null;
  for (const piece of instruments) {
    const def = science[piece.id];
    if (!def) continue;
    const rnd = seededRandom(hashSeed(`${seed}|${piece.id}`));
    const series = instrumentSeries(def, missionId, score, outcome, rnd);
    scienceData.push({ id: piece.id, measured: series.measured });
    const ref = def.reference[missionId];

    const card = el('figure', 'chart-card');
    const head = el('div', 'chart-head');
    head.append(el('h3', null, `${tx(piece.name)} <small>· ${tx(def.title)}</small>`));
    head.append(el('div', 'chart-legend', `
      <span><i class="lg-ref" aria-hidden="true"></i>${t('report.legendRef')}</span>
      <span><i class="lg-you" aria-hidden="true"></i>${t('report.legendYou')}</span>`));
    card.append(head);
    const canvas = el('canvas', 'report-chart');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', t('report.chartLabel', { instrument: tx(piece.name), title: tx(def.title), points: series.measured.length }));
    card.append(canvas);
    if (ref) {
      const cap = el('figcaption', 'nasa-ref');
      cap.append(el('b', null, `<span aria-hidden="true">🛰️</span> ${t('report.inspiredBy', { mission: ref.mission, instrument: ref.instrument, year: ref.year })}`));
      cap.append(text('p', null, tx(ref.fact)));
      card.append(cap);
      lastRef = cap;
    }
    grid.append(card);
    charts.push({ canvas, series, def });
  }
  container.append(grid);
  // La nota de «datos simulados» va al pie de la última ficha (o sola si no hay fichas).
  const note = el('p', 'sim-note', t('report.simulatedNote'));
  if (lastRef) lastRef.append(note);
  else container.append(note);
  requestAnimationFrame(redrawAll);
  return scienceData;
}

function statRow(label, value) {
  return el('li', 'stat-row', `<span>${label}:</span><b>${value}</b>`);
}

function renderTelemetry(state, design, final) {
  const { t } = ctx;
  const j = state.journey;
  const maturity = state.plan?.maturity ?? 100;
  const panel = el('section', 'report-panel telemetry');
  const head = el('div', 'panel-head');
  const titles = el('div');
  titles.append(el('p', 'eyebrow', t('report.telemetryEyebrow')), el('h2', null, t('report.summaryTitle')));
  head.append(titles, el('span', 'panel-icon', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/></svg>'));
  panel.append(head);
  const ul = el('ul', 'stat-list');
  ul.append(
    statRow(t('report.dvBudget'), `${j.dvAvailable.toFixed(0)} m/s`),
    statRow(t('report.dvUsed'), `${j.dvUsed.toFixed(0)} m/s`),
    statRow(t('report.massLaunched'), `${design.metrics.wet.toFixed(1)} kg`),
    statRow(t('report.events'), String(j.events.length)),
  );
  const mat = el('li', 'stat-row stat-maturity', `
    <span>${t('report.maturityLabel')}:<small>${t('report.maturityCap', { cap: final.cap })}</small></span>
    <b>${maturity}/100<small class="${maturity >= 90 ? 'ok' : 'warn'}">${maturity >= 90 ? t('report.maturityMax') : t('report.maturityPenalty', { penalty: state.plan?.penalty ?? 100 - maturity })}</small></b>
    <i class="maturity-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, maturity))}%"></i></i>`);
  ul.append(mat);
  panel.append(ul);
  return panel;
}

function render() {
  const { state, data, t, tx, physics } = ctx;
  root.replaceChildren();
  root.append(el('h1', null, t('report.title')));

  const mission = data.missions.find((m) => m.id === state.missionId);
  if (!mission) {
    root.append(el('p', 'warn', t('report.noMission')));
    root.append(renderFooter());
    return;
  }

  const pieces = physics.resolvePieces([state.satellite.formFactor, ...state.satellite.pieces].filter(Boolean), data.pieces);
  const instruments = pieces.filter((p) => p.category === 'instrument');
  const outcome = state.journey.outcome;
  const design = physics.validateDesign(state, data);
  const { score, eventScience } = reportScore(physics.scienceScore(pieces, state.budget, outcome), state.journey.events);
  const final = finalCml({ designValid: design.valid, outcome, score, cmlCap: state.plan?.cmlCap });
  const hints = improvementHints({
    reason: final.reason,
    checks: design.checks,
    outcome,
    instruments: instruments.length,
    budget: state.budget,
    eventScience,
    plan: state.plan,
  });

  const name = state.plan?.projectName?.trim();
  if (name) root.append(text('p', 'report-project', t('report.project', { name })));
  root.append(renderHero(outcome, mission), renderCml(final), renderHints(final, hints));

  // Ciencia (columna ancha) + telemetría y aprendizaje (columna lateral)
  const grid = el('div', 'report-grid');
  const sci = el('section', 'report-panel science');
  const head = el('div', 'panel-head');
  const titles = el('div');
  titles.append(el('p', 'eyebrow', t('report.scienceEyebrow')), el('h2', null, t('report.scienceTitle')));
  const scoreBox = el('dl', 'score-box', `<div><dt>${t('report.scoreLabel')}</dt><dd><b>${score}</b> / 100</dd></div>`);
  if (eventScience) {
    scoreBox.append(el('div', null, `<dt>${t(eventScience > 0 ? 'report.bonusLabel' : 'report.penaltyLabel')}</dt>
      <dd class="score-chip ${eventScience > 0 ? 'is-up' : 'is-down'}">${t('report.eventScience', { n: eventScience > 0 ? `+${eventScience}` : eventScience })}</dd>`));
  }
  head.append(titles, scoreBox);
  // Para lectores de pantalla, el puntaje también como frase
  sci.append(head, el('p', 'sr-only', t('report.score', { score })));
  sci.append(el('p', 'eyebrow', t('report.targetsTitle')), renderTargets(mission, state.plan?.scienceTargetIdx));
  const chartsBox = el('div', 'charts-box');
  chartsBox.append(el('p', 'muted', t('report.loadingData')));
  sci.append(chartsBox);

  const side = el('div', 'report-side');
  const learn = el('section', 'report-panel learn');
  learn.append(el('div', 'learn-head', `<span class="panel-icon" aria-hidden="true">💡</span><h2>${t('report.learnTitle')}</h2>`), el('p', null, t('report.learn')));
  side.append(renderTelemetry(state, design, final), learn);
  grid.append(sci, side);
  root.append(grid);
  root.append(renderFooter());

  ctx.update({ report: { score, cml: final.cml, scienceData: [] } });

  const seed = [mission.id, state.satellite.formFactor, ...state.satellite.pieces, state.satellite.propellantKg, outcome].join('|');
  loadScience()
    .then((science) => {
      if (!chartsBox.isConnected) return;
      const scienceData = renderCharts(chartsBox, { science, instruments, missionId: mission.id, score, outcome, seed });
      ctx.update({ report: { scienceData } });
    })
    .catch((err) => {
      console.error(err);
      if (chartsBox.isConnected) chartsBox.replaceChildren(el('p', 'warn', t('report.dataError')));
    });
}

function renderFooter() {
  const { t } = ctx;
  const footer = el('div', 'screen-footer');
  const menu = el('button', 'btn btn-ghost', t('report.mainMenu'));
  menu.type = 'button';
  menu.addEventListener('click', () => ctx.goTo('levels'));
  const retry = el('button', 'btn btn-ghost', t('report.redesign'));
  retry.type = 'button';
  retry.addEventListener('click', () => ctx.goTo('workshop'));
  const again = el('button', 'btn btn-primary', `${t('report.newMission')} <span aria-hidden="true">🚀</span>`);
  again.type = 'button';
  again.addEventListener('click', () => { ctx.reset(); ctx.goTo('mission'); });
  footer.append(menu, retry, again);
  return footer;
}

export default {
  id: 'report',
  mount(container, context) {
    ctx = context;
    root = container;
    onResize = () => requestAnimationFrame(redrawAll);
    window.addEventListener('resize', onResize);
    render();
  },
  unmount() {
    window.removeEventListener('resize', onResize);
    onResize = null;
    charts = [];
  },
};
