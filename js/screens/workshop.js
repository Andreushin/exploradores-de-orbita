// OWNER: Rol 3 — Pantalla 2: Taller CubeSat (CubeSat 101).
// Estado que escribe: satellite.{formFactor,pieces,propellantKg}, journey.dvAvailable
import { grams, meterData, rocketOverload, powerText, signedW } from '../taller-reglas.js';

// Reglas puras en js/taller-reglas.js (las comparte nivel2/). Se reexportan para no romper importaciones.
export { WARN_AT, DV_MARGIN, limitLevel, dvLevel, meterData, rocketOverload } from '../taller-reglas.js';

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
function meterHTML({ label, value, d, aria, note, marker }) {
  const tight = d.level === 'warn' ? ` · ${ctx.t('workshop.tight')}` : '';
  return `
    <div class="meter lvl-${d.level}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="${Math.round(d.pct)}" aria-valuetext="${aria}${tight}">
      <div class="meter-head"><span>${label}</span><b>${value}</b></div>
      <div class="meter-track"><div class="meter-fill" style="width:${d.pct}%"></div>${marker || ''}</div>
      ${note ? `<small class="meter-note">${note}</small>` : ''}
    </div>`;
}

function renderMeters(box, state) {
  const { data, t, physics } = ctx;
  const m = physics.validateDesign(state, data).metrics;
  const mission = data.missions.find((x) => x.id === state.missionId);
  const rocket = data.rockets.find((r) => r.id === state.rocketId);
  const M = meterData(m, mission, state.budget.space);
  const req = t('workshop.required', { n: fmt(M.dv.required, 0) });
  const use = t('workshop.powerUse', { g: fmt(m.power.generated), c: fmt(m.power.consumed) });
  const sun = m.power.solarFactor < 0.995 ? t('workshop.sunAtDest', { pct: fmt(m.power.solarFactor * 100, 0) }) : '';
  const s = m.storage;
  const storeUse = t('workshop.batteryUse', { n: fmt(s.neededWh, 0), e: fmt(s.eclipseWh, 0), b: fmt(s.burnWh, 0), u: fmt(s.usableWh, 0), c: fmt(s.capacityWh, 0) });
  box.innerHTML = [
    meterHTML({
      label: 'Δv', d: M.dv,
      value: `${fmt(m.dv, 0)} / ${fmt(M.dv.required, 0)} m/s`,
      aria: `${fmt(m.dv, 0)} m/s, ${req}`,
      marker: M.dv.markerPct == null ? '' : `<i class="meter-marker" style="left:${M.dv.markerPct}%"></i>`,
      note: M.dv.markerPct == null ? '' : `│ ${req}`,
    }),
    meterHTML({
      label: t('workshop.mass'), d: M.mass,
      value: `${grams(m.wet)} / ${grams(M.mass.cap)} g`,
      aria: `${grams(m.wet)} g / ${grams(M.mass.cap)} g`,
    }),
    meterHTML({
      label: t('workshop.power'), d: M.power,
      value: signedW(M.power.net),
      aria: `${signedW(M.power.net)}: ${use}`,
      note: [M.power.powerLow ? t('workshop.minPower', { n: M.power.minW }) : '', use, sun].filter(Boolean).join(' · '),
    }),
    meterHTML({
      label: t('workshop.battery'), d: M.battery,
      value: `${fmt(s.neededWh, 0)} / ${fmt(s.usableWh, 0)} Wh`,
      aria: storeUse,
      note: storeUse,
    }),
    meterHTML({
      label: t('workshop.cost'), d: M.cost,
      value: `$${m.cost}M / $${state.budget.space}M`,
      aria: `$${m.cost}M / $${state.budget.space}M`,
    }),
    rocketOverload(m, rocket)
      ? `<p class="error rocket-alert" role="alert">🚫 ${t('workshop.rocketLimit', { name: ctx.tx(rocket.name), n: grams(rocket.maxPayloadKg) })}</p>`
      : '',
  ].join('');
}

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
        <small>${fmt(p.massKg)} kg · ${p.volumeU}U · ${powerText(p, m.power.solarFactor, (w) => t('workshop.atDest', { w: fmt(w) }))} · $${p.cost}M · TRL ${p.trl}${p.isp ? ` · Isp ${p.isp}s` : ''}</small>`;
      b.addEventListener('click', () => togglePiece(p));
      list.append(b);
    }
    catalog.append(list);
  }
  layout.append(catalog);

  // --- Panel de métricas ---
  const panel = el('aside', 'metrics');
  const prop = data.pieces.find((p) => sat.pieces.includes(p.id) && p.category === 'propulsion');
  const meters = el('div', 'meters');
  renderMeters(meters, state);
  if (prop) {
    const row = el('label', 'segment-row');
    row.innerHTML = `<span>${t('workshop.propellant')}</span>
      <input type="range" min="0" max="${prop.maxPropellantKg}" step="0.1" value="${sat.propellantKg}">
      <output>${fmt(sat.propellantKg)} kg</output>`;
    const input = row.querySelector('input');
    input.addEventListener('input', (e) => {
      row.querySelector('output').textContent = `${fmt(e.target.value)} kg`;
      // En vivo: masa y Δv cambian con el propelente antes de soltar el slider
      renderMeters(meters, { ...state, satellite: { ...sat, propellantKg: Number(e.target.value) } });
    });
    input.addEventListener('change', (e) => {
      ctx.update({ satellite: { propellantKg: Number(e.target.value) } });
      render();
    });
    panel.append(row);
  }

  panel.append(meters);

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
