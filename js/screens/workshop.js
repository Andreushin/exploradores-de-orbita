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
/** Gramos con separador de miles fino: 15960 → "15 960". */
const grams = (kg) => String(Math.round(kg * 1000)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// --- Medidores en vivo (#14 · Nivel 2) ---
export const WARN_AT = 0.85;  // amarillo desde el 85 % del límite
export const DV_MARGIN = 1.1; // Δv: verde con ≥10 % de margen sobre el requerido

/** Nivel de una métrica con límite superior (masa, costo, consumo): ok | warn | danger. */
export function limitLevel(value, limit) {
  if (!(limit > 0)) return value > 0 ? 'danger' : 'ok';
  const r = value / limit;
  if (r > 1) return 'danger';
  return r >= WARN_AT ? 'warn' : 'ok';
}

/** Nivel del Δv, donde más es mejor. */
export function dvLevel(dv, required) {
  if (!(required > 0)) return 'ok';
  if (dv < required) return 'danger';
  return dv / required < DV_MARGIN ? 'warn' : 'ok'; // proporción: evita 1800 × 1.1 = 1980.0000000000002
}

/** Datos de los 4 medidores a partir de physics.validateDesign(...).metrics. */
export function meterData(m, mission, spaceBudget) {
  const pct = (v, max) => {
    if (max > 0) return Math.min(100, (v / max) * 100);
    return v > 0 ? 100 : 0;
  };
  const req = mission?.dvRequired || 0;
  const dvScale = req > 0 ? Math.max(req * 1.3, m.dv * 1.05) : Math.max(m.dv, 1);
  const massCap = m.massCap === Infinity ? 0 : m.massCap;
  const minW = mission?.minPowerW || 0;
  const powerLow = m.power.generated < minW;
  return {
    dv: { pct: pct(m.dv, dvScale), level: dvLevel(m.dv, req), required: req, markerPct: req > 0 ? (req / dvScale) * 100 : null },
    mass: { pct: pct(m.wet, massCap), level: limitLevel(m.wet, massCap), cap: massCap },
    power: { pct: pct(m.power.consumed, m.power.generated), level: powerLow ? 'danger' : limitLevel(m.power.consumed, m.power.generated), minW, powerLow },
    cost: { pct: pct(m.cost, spaceBudget), level: limitLevel(m.cost, spaceBudget) },
  };
}

/** ¿El cohete es el límite que manda y la masa lo supera? (si no, lo marca la estructura). */
export function rocketOverload(m, rocket) {
  if (!rocket || !(m.capU > 0)) return false;
  // massCap = min(estructura, carga útil): si es la carga útil, manda el cohete
  return rocket.maxPayloadKg <= m.massCap && m.wet > rocket.maxPayloadKg;
}

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
  const use = t('workshop.powerUse', { c: fmt(m.power.consumed), g: fmt(m.power.generated) });
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
      value: `+${fmt(m.power.generated)} / −${fmt(m.power.consumed)} W`,
      aria: use,
      note: M.power.powerLow ? t('workshop.minPower', { n: M.power.minW }) : use,
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

// --- Compatibilidad de instrumentos con el objetivo científico del Nivel 1 (data/workshop.json) ---

/**
 * ¿Sirve este instrumento para el objetivo elegido? Sin objetivo (o sin datos) todo es compatible.
 * @returns {{ compatible: boolean, why: {es,en} | null }}
 */
export function instrumentStatus(piece, state, fitData) {
  if (piece.category !== 'instrument') return { compatible: true, why: null };
  const entry = fitData?.[state.missionId]?.[state.plan?.scienceTargetIdx]?.[piece.id];
  if (!entry) return { compatible: true, why: null };
  return { compatible: entry.ok, why: entry.why };
}

/** Ids de instrumentos elegidos que no sirven para el objetivo actual. */
export function incompatibleSelected(state, data) {
  return state.satellite.pieces.filter((id) => {
    const p = data.pieces.find((x) => x.id === id);
    return p && !instrumentStatus(p, state, data.workshop?.instrumentFit).compatible;
  });
}

let removedNotice = []; // nombres quitados automáticamente al entrar al taller

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
  const mission = data.missions.find((x) => x.id === state.missionId);
  const target = mission?.scienceTargets?.[state.plan?.scienceTargetIdx];
  if (target) root.append(el('p', 'objective-banner', `🎯 ${t('workshop.objective', { target: tx(target) })}`));
  if (removedNotice.length) {
    root.append(el('p', 'warn removed-notice', t('workshop.removedIncompatible', { list: removedNotice.join(', ') })));
  }
  const fit = data.workshop?.instrumentFit;
  const layout = el('div', 'workshop-layout');

  // --- Catálogo ---
  const catalog = el('div', 'catalog');
  for (const cat of CATEGORIES) {
    catalog.append(el('h3', null, t(`workshop.categories.${cat}`)));
    const list = el('div', 'piece-list');
    for (const p of data.pieces.filter((x) => x.category === cat)) {
      const selected = p.id === sat.formFactor || sat.pieces.includes(p.id);
      const fitInfo = instrumentStatus(p, state, fit);
      const b = el('button', 'piece' + (selected ? ' is-selected' : '') + (fitInfo.compatible ? '' : ' is-incompatible'));
      b.type = 'button';
      b.title = tx(p.desc);
      b.disabled = !fitInfo.compatible;
      // Nombre primero: el E2E busca la pieza por el inicio de su nombre accesible.
      let extra = '';
      if (p.category === 'structure') {
        const form = data.workshop?.formFactors?.[p.id];
        extra = `<small class="piece-hint">${form ? `${tx(form)} · ` : ''}${t('workshop.maxMass', { n: grams(p.volumeU * physics.KG_PER_U) })}</small>`;
      } else if (fitInfo.why) {
        extra = `<small class="piece-why" id="why-${p.id}">${fitInfo.compatible ? '✔' : '✘'} ${tx(fitInfo.why)}</small>`;
        b.setAttribute('aria-describedby', `why-${p.id}`);
      }
      b.innerHTML = `<strong>${tx(p.name)}</strong>
        <small>${grams(p.massKg)} g · ${p.volumeU}U · ${p.powerW > 0 ? '−' : '+'}${Math.abs(p.powerW)} W · $${p.cost}M · TRL ${p.trl}${p.isp ? ` · Isp ${p.isp}s` : ''}</small>${extra}`;
      b.addEventListener('click', () => {
        removedNotice = [];
        togglePiece(p);
      });
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
    // Si el objetivo del Nivel 1 cambió, quitar los instrumentos que ya no sirven y avisar.
    const bad = incompatibleSelected(ctx.state, ctx.data);
    removedNotice = bad.map((id) => ctx.tx(ctx.data.pieces.find((p) => p.id === id).name));
    if (bad.length) ctx.update({ satellite: { pieces: ctx.state.satellite.pieces.filter((id) => !bad.includes(id)) } });
    render();
  },
  unmount() {},
};
