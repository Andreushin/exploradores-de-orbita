// OWNER: Rol 4 — Pantalla 4: reporte científico y nivel CML.
// Estado que escribe: report.{score,cml,scienceData}

const CML_LEVELS = [1, 2, 3, 4];
let ctx;
let root;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/** Serie simulada de datos científicos: más instrumentos y mejor órbita = señal más limpia. */
function simulateData(score) {
  const noise = 1 - score / 100;
  return Array.from({ length: 40 }, (_, i) => {
    const signal = Math.sin(i / 4) * 0.6 + Math.sin(i / 1.7) * 0.2;
    return signal + (Math.random() - 0.5) * 2 * noise;
  });
}

function drawChart(canvas, series) {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = '#0b1230';
  g.fillRect(0, 0, width, height);
  g.strokeStyle = '#7cf';
  g.lineWidth = 2;
  g.beginPath();
  series.forEach((v, i) => {
    const x = (i / (series.length - 1)) * (width - 20) + 10;
    const y = height / 2 - v * (height / 3);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.stroke();
}

function render() {
  const { state, data, t, tx, physics } = ctx;
  const mission = data.missions.find((m) => m.id === state.missionId);
  const pieces = physics.resolvePieces([state.satellite.formFactor, ...state.satellite.pieces].filter(Boolean), data.pieces);
  const outcome = state.journey.outcome;
  const design = physics.validateDesign(state, data);
  let score = physics.scienceScore(pieces, state.budget, outcome);
  const safeMode = state.journey.events.filter((e) => e.choice.science).reduce((s, e) => s + e.choice.science, 0);
  score = Math.max(0, score + safeMode);
  const cml = physics.computeCML({ designValid: design.valid, launched: true, outcome, scienceScore: score });
  const series = simulateData(score);
  ctx.update({ report: { score, cml, scienceData: series } });

  root.replaceChildren();
  root.append(el('h1', null, t('report.title')));
  root.append(el('p', `lead ${outcome === 'orbit' ? 'ok' : 'warn'}`,
    t(`report.outcomes.${outcome || 'flyby'}`, { dest: tx(mission.name) })));

  // CML
  const bar = el('div', 'cml-bar');
  for (const lvl of CML_LEVELS) {
    bar.append(el('div', 'cml-step' + (lvl <= cml ? ' is-reached' : ''),
      `<b>CML ${lvl}</b><small>${t(`report.cml.${lvl}`)}</small>`));
  }
  root.append(el('h2', null, t('report.cmlTitle')), bar);

  // Ciencia
  root.append(el('h2', null, t('report.scienceTitle')));
  root.append(el('p', null, t('report.score', { score })));
  const ul = el('ul');
  mission.scienceTargets.forEach((tg) => ul.append(el('li', null, tx(tg))));
  root.append(ul);
  const chart = el('canvas', 'report-chart');
  root.append(chart);
  requestAnimationFrame(() => drawChart(chart, series));

  // Resumen
  const j = state.journey;
  root.append(el('h2', null, t('report.summaryTitle')));
  root.append(el('ul', 'stats', `
    <li>${t('report.dvBudget')}: ${j.dvAvailable.toFixed(0)} m/s</li>
    <li>${t('report.dvUsed')}: ${j.dvUsed.toFixed(0)} m/s</li>
    <li>${t('report.massLaunched')}: ${design.metrics.wet.toFixed(1)} kg</li>
    <li>${t('report.events')}: ${j.events.length}</li>`));

  root.append(el('h2', null, t('report.learnTitle')), el('p', 'muted', t('report.learn')));

  const footer = el('div', 'screen-footer');
  const retry = el('button', 'btn btn-ghost', t('report.redesign'));
  retry.addEventListener('click', () => ctx.goTo('workshop'));
  const again = el('button', 'btn btn-primary', t('report.newMission'));
  again.addEventListener('click', () => { ctx.reset(); ctx.goTo('mission'); });
  footer.append(retry, again);
  root.append(footer);
}

export default {
  id: 'report',
  mount(container, context) {
    ctx = context;
    root = container;
    render();
  },
  unmount() {},
};
