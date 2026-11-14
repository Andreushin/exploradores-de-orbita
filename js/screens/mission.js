// OWNER: Rol 3 — Pantalla 1: selección de misión, cohete y presupuesto por segmentos.
// Estado que escribe: missionId, rocketId, budget.{total,launch,space,ground,user}

const SEGMENTS = ['launch', 'space', 'ground', 'user'];
// Reparto inicial sugerido: 40% lanzamiento, 35% espacio, 15% tierra, 10% usuario
const SPLIT = { launch: 0.4, space: 0.35, ground: 0.15, user: 0.1 };
let ctx;

/** Reparto inicial que suma exactamente `total`: floor en 3 segmentos, el resto a Usuario. */
export function initialSplit(total) {
  const launch = Math.floor(total * SPLIT.launch);
  const space = Math.floor(total * SPLIT.space);
  const ground = Math.floor(total * SPLIT.ground);
  return { launch, space, ground, user: total - launch - space - ground };
}

/**
 * Sube Lanzamiento hasta `cost` sin pasarse del total: usa primero lo libre
 * y luego descuenta de Usuario → Tierra → Espacio (sin bajar de 0).
 */
export function fitLaunch(budget, cost) {
  const b = { ...budget };
  if (b.launch >= cost) return b;
  const free = b.total - SEGMENTS.reduce((s, k) => s + b[k], 0);
  let missing = cost - b.launch - Math.max(0, free);
  b.launch = cost;
  for (const k of ['user', 'ground', 'space']) {
    if (missing <= 0) break;
    const take = Math.min(b[k], missing);
    b[k] -= take;
    missing -= take;
  }
  return b;
}
let root;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function render() {
  const { state, data, t, tx } = ctx;
  const mission = data.missions.find((m) => m.id === state.missionId);
  root.replaceChildren();

  root.append(el('h1', null, t('mission.title')), el('p', 'lead', t('mission.intro')));

  // --- Destinos ---
  const grid = el('div', 'card-grid');
  for (const m of data.missions) {
    const card = el('button', 'card mission-card' + (m.id === state.missionId ? ' is-selected' : ''));
    card.type = 'button';
    card.innerHTML = `
      <span class="planet-dot" style="--c:${m.color}"></span>
      <h3>${tx(m.name)}</h3>
      <p class="muted">${tx(m.desc)}</p>
      <ul class="stats">
        <li>${t('mission.difficulty')}: ${'★'.repeat(m.difficulty)}</li>
        <li>Δv: ${m.dvRequired} m/s</li>
        <li>${t('mission.distance')}: ${m.distanceAU} AU</li>
        <li>${t('mission.budget')}: $${m.budget}M</li>
      </ul>`;
    card.addEventListener('click', () => selectMission(m));
    grid.append(card);
  }
  root.append(grid);

  if (!mission) return;

  // --- Cohete ---
  root.append(el('h2', null, t('mission.rocketTitle')));
  const rgrid = el('div', 'card-grid');
  for (const r of data.rockets) {
    const capable = r.destinations.includes(mission.id);
    const card = el('button', 'card rocket-card' + (r.id === state.rocketId ? ' is-selected' : ''));
    card.type = 'button';
    card.disabled = !capable;
    card.innerHTML = `
      <h3>${tx(r.name)}</h3>
      <p class="muted">${tx(r.desc)}</p>
      <ul class="stats">
        <li>${t('mission.cost')}: $${r.cost}M</li>
        <li>${t('mission.payload')}: ${r.maxPayloadKg} kg</li>
        <li>${t('mission.reliability')}: ${Math.round(r.reliability * 100)}%</li>
      </ul>
      ${capable ? '' : `<p class="warn">${t('mission.cantReach')}</p>`}`;
    card.addEventListener('click', () => {
      ctx.update({ rocketId: r.id, budget: fitLaunch(ctx.state.budget, r.cost) });
      render();
    });
    rgrid.append(card);
  }
  root.append(rgrid);

  // --- Presupuesto por segmentos (Design and Develop Science Missions) ---
  root.append(el('h2', null, t('mission.segmentsTitle')), el('p', 'muted', t('mission.segmentsHelp')));
  const b = state.budget;
  const spent = SEGMENTS.reduce((s, k) => s + b[k], 0);
  const box = el('div', 'segments');
  for (const k of SEGMENTS) {
    const row = el('label', 'segment-row');
    row.innerHTML = `
      <span class="segment-name">${t(`mission.segments.${k}.name`)}</span>
      <input type="range" min="0" max="${b.total}" step="1" value="${b[k]}">
      <output>$${b[k]}M</output>
      <small class="muted">${t(`mission.segments.${k}.help`)}</small>`;
    const input = row.querySelector('input');
    input.addEventListener('input', (e) => {
      row.querySelector('output').textContent = `$${e.target.value}M`;
    });
    input.addEventListener('change', (e) => {
      ctx.update({ budget: { [k]: Number(e.target.value) } });
      render();
    });
    box.append(row);
  }
  root.append(box);

  const rocket = data.rockets.find((r) => r.id === state.rocketId);
  const problems = [];
  if (!rocket) problems.push(t('mission.errNoRocket'));
  else if (b.launch < rocket.cost) problems.push(t('mission.errLaunch', { cost: rocket.cost }));
  if (spent > b.total) problems.push(t('mission.errOver', { spent, total: b.total }));

  const footer = el('div', 'screen-footer');
  footer.append(el('p', problems.length ? 'warn' : 'ok', problems.join(' · ') || t('mission.ready', { left: b.total - spent })));
  const next = el('button', 'btn btn-primary', t('common.next'));
  next.disabled = problems.length > 0;
  next.addEventListener('click', () => ctx.goTo('workshop'));
  footer.append(next);
  root.append(footer);
}

function selectMission(m) {
  const total = m.budget;
  ctx.update({
    missionId: m.id,
    rocketId: null,
    budget: { total, ...initialSplit(total) },
  });
  render();
}

export default {
  id: 'mission',
  mount(container, context) {
    ctx = context;
    root = container;
    render();
  },
  unmount() {},
};
