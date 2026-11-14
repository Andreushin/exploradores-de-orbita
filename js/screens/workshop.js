// OWNER: Rol 3 — Pantalla 2: Taller CubeSat (CubeSat 101).
// Estado que escribe: satellite.{formFactor,pieces,propellantKg}, journey.dvAvailable

const CATEGORIES = ['structure', 'power', 'propulsion', 'comms', 'adcs', 'obc', 'instrument'];
let ctx;
let root;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

const fmt = (n, d = 1) => Number(n).toFixed(d);

function togglePiece(p) {
  const sat = ctx.state.satellite;
  if (p.category === 'structure') {
    ctx.update({ satellite: { formFactor: p.id } });
  } else if (p.category === 'propulsion') {
    // Solo un sistema de propulsión a la vez
    const others = sat.pieces.filter((id) => ctx.data.pieces.find((x) => x.id === id)?.category !== 'propulsion');
    const has = sat.pieces.includes(p.id);
    ctx.update({ satellite: { pieces: has ? others : [...others, p.id], propellantKg: has ? 0 : sat.propellantKg } });
  } else {
    const has = sat.pieces.includes(p.id);
    ctx.update({ satellite: { pieces: has ? sat.pieces.filter((id) => id !== p.id) : [...sat.pieces, p.id] } });
  }
  render();
}

function render() {
  const { state, data, t, tx, physics } = ctx;
  const sat = state.satellite;
  const result = physics.validateDesign(state, data);
  const m = result.metrics;
  root.replaceChildren();

  root.append(el('h1', null, t('workshop.title')), el('p', 'lead', t('workshop.intro')));
  const layout = el('div', 'workshop-layout');

  // --- Catálogo ---
  const catalog = el('div', 'catalog');
  for (const cat of CATEGORIES) {
    catalog.append(el('h3', null, t(`workshop.categories.${cat}`)));
    const list = el('div', 'piece-list');
    for (const p of data.pieces.filter((x) => x.category === cat)) {
      const selected = p.id === sat.formFactor || sat.pieces.includes(p.id);
      const b = el('button', 'piece' + (selected ? ' is-selected' : ''));
      b.type = 'button';
      b.title = tx(p.desc);
      b.innerHTML = `<strong>${tx(p.name)}</strong>
        <small>${fmt(p.massKg)} kg · ${p.volumeU}U · ${p.powerW > 0 ? '−' : '+'}${Math.abs(p.powerW)} W · $${p.cost}M · TRL ${p.trl}${p.isp ? ` · Isp ${p.isp}s` : ''}</small>`;
      b.addEventListener('click', () => togglePiece(p));
      list.append(b);
    }
    catalog.append(list);
  }
  layout.append(catalog);

  // --- Panel de métricas ---
  const panel = el('aside', 'metrics');
  const prop = data.pieces.find((p) => sat.pieces.includes(p.id) && p.category === 'propulsion');
  if (prop) {
    const row = el('label', 'segment-row');
    row.innerHTML = `<span>${t('workshop.propellant')}</span>
      <input type="range" min="0" max="${prop.maxPropellantKg}" step="0.1" value="${sat.propellantKg}">
      <output>${fmt(sat.propellantKg)} kg</output>`;
    const input = row.querySelector('input');
    input.addEventListener('input', (e) => {
      row.querySelector('output').textContent = `${fmt(e.target.value)} kg`;
    });
    input.addEventListener('change', (e) => {
      ctx.update({ satellite: { propellantKg: Number(e.target.value) } });
      render();
    });
    panel.append(row);
  }

  panel.append(el('div', 'metric', `<span>Δv</span><b>${fmt(m.dv, 0)} m/s</b>`));
  panel.append(el('div', 'metric', `<span>${t('workshop.mass')}</span><b>${fmt(m.wet)} / ${fmt(m.massCap === Infinity ? 0 : m.massCap)} kg</b>`));
  panel.append(el('div', 'metric', `<span>${t('workshop.power')}</span><b>+${fmt(m.power.generated)} / −${fmt(m.power.consumed)} W</b>`));
  panel.append(el('div', 'metric', `<span>${t('workshop.cost')}</span><b>$${m.cost}M / $${state.budget.space}M</b>`));

  const checks = el('ul', 'checklist');
  for (const c of result.checks) {
    checks.append(el('li', c.ok ? 'ok' : 'warn', `${c.ok ? '✔' : '✘'} ${t(`workshop.checks.${c.id}`)}`));
  }
  panel.append(checks);

  const footer = el('div', 'screen-footer');
  const back = el('button', 'btn btn-ghost', t('common.back'));
  back.addEventListener('click', () => ctx.goTo('mission'));
  const launch = el('button', 'btn btn-primary', t('workshop.launch'));
  launch.disabled = !result.valid;
  launch.addEventListener('click', () => {
    ctx.update({ journey: { dvAvailable: m.dv, dvUsed: 0, events: [], outcome: null } });
    ctx.goTo('journey');
  });
  footer.append(back, launch);
  panel.append(footer);

  layout.append(panel);
  root.append(layout);
}

export default {
  id: 'workshop',
  mount(container, context) {
    ctx = context;
    root = container;
    render();
  },
  unmount() {},
};
