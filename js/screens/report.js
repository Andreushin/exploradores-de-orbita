// OWNER: Rol 2 (reasignado desde Rol 4) — Nivel 4: reporte final, CML y datos científicos simulados.
// Estado que lee: missionId, budget, plan.{cmlCap,maturity,penalty,scienceTargetIdx}, satellite, journey
// Estado que escribe: report.{score,cml,scienceData}
// Lógica sin DOM (CML final, sugerencias, series): js/science-data.js. Datos y referencias NASA: data/science.json.
import { finalCml, improvementHints, instrumentSeries, reportScore, seededRandom, hashSeed } from '../science-data.js';

const CML_LEVELS = [1, 2, 3, 4];
// Ruta relativa a este módulo: funciona en la raíz o en una subruta (GitHub Pages, Firebase Hosting).
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

  const pad = { l: 34, r: 10, t: 10, b: 30 };
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

  g.fillStyle = cssVar('--surface', '#0e1530');
  g.fillRect(0, 0, width, height);

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
  g.fillText(String(x0), pad.l, height - 16);
  g.textAlign = 'right';
  g.fillText(String(x1), pad.l + W, height - 16);
  g.textAlign = 'center';
  g.fillText(tx(def.xLabel), pad.l + W / 2, height - 4);
  g.save();
  g.translate(12, pad.t + H / 2);
  g.rotate(-Math.PI / 2);
  g.fillText(tx(def.yLabel), 0, 0);
  g.restore();

  // Medido por el CubeSat (debajo, para que la referencia punteada siempre se vea encima)
  if (series.measured.length) {
    g.strokeStyle = accent;
    g.fillStyle = accent;
    g.lineWidth = 2;
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
  g.strokeStyle = cssVar('--text', '#eef2ff');
  g.globalAlpha = 0.75;
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

function renderCml(final) {
  const { t } = ctx;
  const section = el('section', 'report-section');
  section.append(el('h2', null, t('report.cmlTitle')));
  const bar = el('ol', 'cml-bar');
  const steps = [];
  for (const lvl of CML_LEVELS) {
    const capped = lvl > final.cml && lvl <= final.base;
    const step = el('li', 'cml-step' + (capped ? ' is-capped' : ''));
    step.style.setProperty('--i', String(lvl - 1));
    step.innerHTML = `
      <b>CML ${lvl}</b>
      <span class="cml-name">${t(`report.cml.${lvl}`)}</span>
      <small class="muted">${t(`report.cmlExplain.${lvl}`)}</small>
      ${capped ? `<small class="cml-lock">🔒 ${t('report.cappedStep')}</small>` : ''}`;
    if (lvl === final.cml) step.setAttribute('aria-current', 'step');
    bar.append(step);
    steps.push(step);
  }
  section.append(bar);
  section.append(el('p', 'cml-result', t('report.cmlReached', { cml: final.cml, name: t(`report.cml.${final.cml}`) })));

  // Animación: los niveles alcanzados se llenan en orden (sin animación si el jugador la desactivó).
  const fill = () => steps.forEach((s, i) => { if (i < final.cml) s.classList.add('is-reached'); });
  if (reducedMotion()) fill();
  else requestAnimationFrame(() => requestAnimationFrame(fill));
  return section;
}

function renderHints(final, hints) {
  const { t } = ctx;
  const box = el('section', 'report-section report-hints' + (final.cml === 4 ? ' is-max' : ''));
  box.append(el('h2', null, t(final.cml === 4 ? 'report.hintsTitleMax' : 'report.hintsTitle')));
  box.append(el('p', 'muted', t(`report.reasons.${final.reason}`, { cap: final.cap, base: final.base })));
  const ul = el('ul', 'hint-list');
  for (const h of hints) {
    const vars = { ...h.vars };
    if (vars.check) vars.check = t(`workshop.checks.${vars.check}`);
    ul.append(el('li', null, t(`report.hints.${h.key}`, vars)));
  }
  box.append(ul);
  return box;
}

function renderTargets(mission, chosenIdx) {
  const { t, tx } = ctx;
  const ul = el('ul', 'target-list');
  mission.scienceTargets.forEach((tg, i) => {
    const li = text('li', i === chosenIdx ? 'is-target' : null, tx(tg));
    if (i === chosenIdx) li.append(el('small', 'muted', ` · ${t('report.yourTarget')}`));
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
  for (const piece of instruments) {
    const def = science[piece.id];
    if (!def) continue;
    const rnd = seededRandom(hashSeed(`${seed}|${piece.id}`));
    const series = instrumentSeries(def, missionId, score, outcome, rnd);
    scienceData.push({ id: piece.id, measured: series.measured });
    const ref = def.reference[missionId];

    const card = el('figure', 'card chart-card');
    card.append(el('h3', null, `${tx(piece.name)} <small class="muted">· ${tx(def.title)}</small>`));
    const canvas = el('canvas', 'report-chart');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', t('report.chartLabel', { instrument: tx(piece.name), title: tx(def.title), points: series.measured.length }));
    card.append(canvas);
    card.append(el('div', 'chart-legend', `
      <span><i class="lg-ref" aria-hidden="true"></i>${t('report.legendRef')}</span>
      <span><i class="lg-you" aria-hidden="true"></i>${t('report.legendYou')}</span>`));
    if (ref) {
      const cap = el('figcaption', 'nasa-ref');
      cap.append(el('b', null, t('report.inspiredBy', { mission: ref.mission, instrument: ref.instrument, year: ref.year })));
      cap.append(text('p', null, tx(ref.fact)));
      card.append(cap);
    }
    grid.append(card);
    charts.push({ canvas, series, def });
  }
  container.append(grid, el('p', 'sim-note muted', t('report.simulatedNote')));
  requestAnimationFrame(redrawAll);
  return scienceData;
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
  root.append(el('p', `lead ${outcome === 'orbit' ? 'ok' : 'warn'}`,
    t(`report.outcomes.${outcome || 'flyby'}`, { dest: tx(mission.name) })));

  root.append(renderCml(final), renderHints(final, hints));

  // Ciencia
  const sci = el('section', 'report-section');
  sci.append(el('h2', null, t('report.scienceTitle')));
  const scoreLine = el('p', 'report-score', t('report.score', { score }));
  if (eventScience) scoreLine.append(el('small', 'muted', ` · ${t('report.eventScience', { n: eventScience > 0 ? `+${eventScience}` : eventScience })}`));
  sci.append(scoreLine, el('h3', null, t('report.targetsTitle')), renderTargets(mission, state.plan?.scienceTargetIdx));
  const chartsBox = el('div', 'charts-box');
  chartsBox.append(el('p', 'muted', t('report.loadingData')));
  sci.append(chartsBox);
  root.append(sci);

  // Resumen
  const j = state.journey;
  const summary = el('section', 'report-section');
  summary.append(el('h2', null, t('report.summaryTitle')));
  summary.append(el('ul', 'stats', `
    <li>${t('report.dvBudget')}: ${j.dvAvailable.toFixed(0)} m/s</li>
    <li>${t('report.dvUsed')}: ${j.dvUsed.toFixed(0)} m/s</li>
    <li>${t('report.massLaunched')}: ${design.metrics.wet.toFixed(1)} kg</li>
    <li>${t('report.events')}: ${j.events.length}</li>
    <li>${t('report.planMaturity', { maturity: state.plan?.maturity ?? 100, cap: final.cap })}</li>`));
  root.append(summary);

  root.append(el('h2', null, t('report.learnTitle')), el('p', 'muted', t('report.learn')));
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
  const again = el('button', 'btn btn-primary', t('report.newMission'));
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
