// OWNER: Rol 3 — Reglas puras del Taller del CubeSat (Nivel 2), sin DOM.
// Las usa nivel2/nivel2.js (Nivel 2 · Taller). Ver docs/niveles/nivel-2.md.
import { KG_PER_U, G0, propellantFor, deltaV, usedVolume, BATTERY_DOD, BURN_HOURS, INSTRUMENT_WEIGHTS } from './physics.js';

/** Gramos con separador de miles fino: 15960 → "15 960". */
export const grams = (kg) => String(Math.round(kg * 1000)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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

/**
 * Datos de los 5 medidores a partir de physics.validateDesign(...).metrics.
 * Energía: muestra el neto (generación − consumo) y se pone roja si es negativo o si no llega al mínimo del destino.
 * Batería: energía que deben cubrir los eclipses y quemados contra la parte usable de la capacidad (Wh).
 */
export function meterData(m, mission, spaceBudget) {
  const pct = (v, max) => {
    if (max > 0) return Math.min(100, (v / max) * 100);
    return v > 0 ? 100 : 0;
  };
  const req = mission?.dvRequired || 0;
  const dvScale = req > 0 ? Math.max(req * 1.3, m.dv * 1.05) : Math.max(m.dv, 1);
  const massCap = m.massCap === Infinity ? 0 : m.massCap;
  const minW = mission?.minPowerW || 0;
  const { generated, consumed, net } = m.power;
  const powerLow = generated < minW;
  const { neededWh, usableWh, capacityWh } = m.storage;
  // Sin estructura no hay límite de masa todavía; sin batería ni necesidad de ella, no hay nada que medir:
  // en esos casos el medidor queda en 'pending' (gris) en vez de mostrar 0 / 0.
  const noStructure = !(m.capU > 0);
  const noBattery = capacityWh === 0 && neededWh === 0;
  const out = {
    dv: { pct: pct(m.dv, dvScale), level: dvLevel(m.dv, req), required: req, markerPct: req > 0 ? (req / dvScale) * 100 : null },
    mass: { pct: pct(m.wet, massCap), level: limitLevel(m.wet, massCap), cap: massCap },
    power: { pct: pct(consumed, generated), level: net < 0 || powerLow ? 'danger' : limitLevel(consumed, generated), net, minW, powerLow },
    battery: { pct: noBattery ? 0 : pct(neededWh, usableWh), level: noBattery ? 'pending' : limitLevel(neededWh, usableWh), needed: neededWh, usable: usableWh, capacity: capacityWh },
    cost: { pct: pct(m.cost, spaceBudget), level: limitLevel(m.cost, spaceBudget) },
  };
  // Antes de elegir estructura ningún medidor juzga: ni "$0 cabe en el presupuesto" en verde ni "0 W" en rojo.
  if (noStructure) for (const k of Object.keys(out)) out[k] = { ...out[k], pct: 0, level: 'pending' };
  return out;
}

/**
 * Energía de una pieza para el catálogo: "+36 W" (genera), "−4 W" (consume) o "80 Wh" (guarda, no genera).
 * Los paneles pierden luz con la distancia: `atDest(w)` agrega cuánto dan en el destino (solarFactor = 1/d²).
 */
export function powerText(piece, solarFactor = 1, atDest = () => '') {
  if (piece.storageWh) return `${piece.storageWh} Wh`;
  const w = piece.powerW || 0;
  if (w > 0) return `−${w} W`;
  if (w === 0) return '0 W';
  const here = piece.solar ? -w * solarFactor : -w;
  const dimmer = piece.solar && Math.abs(-w - here) > 0.05;
  return dimmer ? `+${-w} W ${atDest(here)}` : `+${-w} W`;
}

/** Neto con signo para el medidor: "+1.0 W" / "−2.5 W". */
export const signedW = (w, d = 1) => `${w < 0 ? '−' : '+'}${Math.abs(w).toFixed(d)} W`;

/** ¿El cohete es el límite que manda y la masa lo supera? (si no, lo marca la estructura). */
export function rocketOverload(m, rocket) {
  if (!rocket || !(m.capU > 0)) return false;
  // massCap = min(estructura, carga útil): si es la carga útil, manda el cohete
  return rocket.maxPayloadKg <= m.massCap && m.wet > rocket.maxPayloadKg;
}

// --- Compatibilidad de instrumentos con el objetivo científico del Nivel 1 (data/workshop.json) ---

/**
 * ¿Sirve este instrumento para el objetivo elegido? Sin objetivo (o sin datos) todo es compatible.
 * @param {object} fit data/workshop.json → instrumentFit
 * @returns {{ compatible: boolean, why: {es: string, en: string} | null }}
 */
export function instrumentStatus(piece, mission, fit) {
  if (piece.category !== 'instrument') return { compatible: true, why: null };
  const entry = fit?.[mission?.missionId]?.[mission?.plan?.scienceTargetIdx]?.[piece.id];
  if (!entry) return { compatible: true, why: null };
  return { compatible: entry.ok, why: entry.why };
}

/** Ids de instrumentos elegidos que no sirven para el objetivo actual. */
export function incompatibleSelected(mission, pieces, fit) {
  return (mission.satellite?.pieces || []).filter((id) => {
    const p = pieces.find((x) => x.id === id);
    return p && !instrumentStatus(p, mission, fit).compatible;
  });
}

// --- Verificaciones sin "falsos positivos" -------------------------------------------

/**
 * Estado que se muestra de una verificación de physics.validateDesign: 'ok' | 'bad' | 'pending'.
 * Sin estructura, todo menos `structure` queda pendiente: 0 g "cabe" en cualquier límite, pero eso no
 * dice nada al jugador. La batería también queda pendiente mientras no haga falta ni haya una.
 * @param {{id:string, ok:boolean}} check
 * @param {object} metrics validateDesign(...).metrics
 */
export function checkState(check, metrics) {
  if (check.id !== 'structure' && !(metrics.capU > 0)) return 'pending';
  if (check.id === 'battery' && metrics.storage.capacityWh === 0 && metrics.storage.neededWh === 0) return 'pending';
  return check.ok ? 'ok' : 'bad';
}

// --- Por qué falla: consejos de trade study con números ------------------------------

/**
 * Orden en que se aconseja: lo que condiciona lo demás va primero (estructura y computadora),
 * la masa y el volumen antes de añadir piezas, y la ciencia al final porque depende de que todo lo anterior quepa.
 */
export const HINT_ORDER = ['structure', 'obc', 'mass', 'volume', 'power', 'battery', 'comms', 'propellant', 'deltaV', 'cost', 'science'];

/** Prioridad de un consejo (menor = antes). Cambiar de estructura es estructural: va con la masa aunque nazca del Δv. */
export const hintRank = (h) => HINT_ORDER.indexOf(h.key === 'massStructure' || h.key === 'propBigger' ? 'mass' : h.check);

const r1 = (n) => Math.round(n * 10) / 10;
const cheapest = (list) => [...list].sort((a, b) => a.cost - b.cost)[0];

/**
 * Hasta `max` consejos para las verificaciones que fallan, priorizados por dependencia lógica (HINT_ORDER).
 * Devuelve [{ check, key, vars, action }]:
 *  - check: id de la verificación que ataca (de physics.validateDesign)
 *  - key + vars: el texto lo pone cada nivel (nivel2/textos.js → tips.<key>)
 *  - action: cambio de un clic (ver nextSatellite) o null si solo se puede aconsejar
 * @param {object} result validateDesign(...)
 * @param {object[]} parts piezas instaladas (objetos de pieces.json, con la estructura)
 * @param {object[]} catalog todas las piezas de pieces.json
 * @param {object} mission destino (missions.json)
 * @param {number} budgetSpace presupuesto del segmento Espacio ($M)
 * @param {{ nameOf?: (p:object) => string, allowed?: (p:object) => boolean, max?: number }} [opts]
 *   nameOf: nombre visible de una pieza · allowed: si una pieza se puede sugerir (p. ej. instrumentos que sirven al objetivo)
 */
export function tradeHints(result, parts, catalog, mission, budgetSpace, { nameOf = (p) => p.id, allowed = () => true, max = 2 } = {}) {
  const x = result.metrics;
  const fails = new Set(result.checks.filter((c) => !c.ok).map((c) => c.id));
  const structure = parts.find((p) => p.category === 'structure');
  const prop = parts.find((p) => p.category === 'propulsion');
  const req = mission?.dvRequired || 0;
  const g = (kg) => grams(kg);
  const installed = new Set(parts.map((p) => p.id));
  const structures = catalog.filter((p) => p.category === 'structure').sort((a, b) => a.volumeU - b.volumeU);
  const used = usedVolume(parts);
  const out = [];
  const push = (check, key, vars, action = null) => out.push({ check, key, vars, action });
  const done = () => out.sort((a, b) => hintRank(a) - hintRank(b)).slice(0, max);

  // Estructura: la más chica donde caben las piezas y su masa; sin piezas todavía, la de balance.
  if (!structure) {
    const fit = structures.find((s) => s.volumeU >= used && s.volumeU * KG_PER_U >= x.wet + s.massKg);
    const pick = used > 0 || x.wet > 0 ? (fit || structures[structures.length - 1]) : structures[1] || structures[0];
    if (pick) push('structure', 'noStructure', { name: nameOf(pick), u: pick.volumeU, kg: g(pick.volumeU * KG_PER_U) }, { type: 'setStructure', id: pick.id });
    return done();
  }

  // Computadora de vuelo
  if (fails.has('obc')) {
    const obc = cheapest(catalog.filter((p) => p.category === 'obc'));
    if (obc) push('obc', 'noObc', { name: nameOf(obc), cost: obc.cost, w: obc.powerW }, { type: 'add', id: obc.id });
  }

  // Masa y volumen: ¿la estructura es demasiado chica para el propelente que pide el destino?
  if (fails.has('mass') || fails.has('volume')) {
    const capKg = structure.volumeU * KG_PER_U;
    const need = prop?.isp ? x.dry * Math.exp(req / (prop.isp * G0)) : x.wet;
    const bigger = structures.find((p) => p.volumeU > structure.volumeU && p.volumeU * KG_PER_U >= need && p.volumeU >= used);
    const action = bigger ? { type: 'setStructure', id: bigger.id } : null;
    if (fails.has('mass') && need > capKg && bigger) {
      push('mass', 'massStructure', { name: nameOf(structure), cap: g(capKg), need: g(need), next: nameOf(bigger) }, action);
    } else if (fails.has('mass')) {
      push('mass', 'massOver', { over: g(x.wet - x.massCap), cap: g(x.massCap) });
    }
    if (fails.has('volume')) {
      const usedU = result.checks.find((c) => c.id === 'volume').value;
      push('volume', 'volume', { used: +usedU.toFixed(2), cap: x.capU, next: bigger ? nameOf(bigger) : '' }, action);
    }
  }

  // Energía: la pieza generadora más barata que cubra lo que falta (los paneles rinden 1/d² lejos del Sol)
  if (fails.has('power')) {
    const sf = x.power.solarFactor;
    const gap = Math.max(x.power.consumed - x.power.generated, (mission?.minPowerW || 0) - x.power.generated, 0.1);
    const gain = (p) => (p.solar ? -p.powerW * sf : -p.powerW);
    const cands = catalog.filter((p) => p.category === 'power' && (p.powerW || 0) < 0 && !installed.has(p.id));
    const enough = cheapest(cands.filter((p) => gain(p) >= gap));
    const best = enough || [...cands].sort((a, b) => gain(b) - gain(a))[0];
    const vars = { gap: r1(gap), gen: r1(x.power.generated), use: r1(x.power.consumed) };
    if (best) push('power', enough ? 'powerAdd' : 'powerPartial', { ...vars, name: nameOf(best), gain: r1(gain(best)), cost: best.cost }, { type: 'add', id: best.id });
    else push('power', 'powerCut', vars);
  }

  // Batería: la más chica cuyos Wh usables (50 %) cubran lo que falta
  if (fails.has('battery')) {
    const gapWh = x.storage.neededWh - x.storage.usableWh;
    const cands = catalog.filter((p) => p.storageWh && !installed.has(p.id)).sort((a, b) => a.storageWh - b.storageWh);
    const enough = cands.find((p) => p.storageWh * BATTERY_DOD >= gapWh);
    const best = enough || cands[cands.length - 1];
    const vars = { need: Math.round(x.storage.neededWh), have: Math.round(x.storage.usableWh), gap: Math.ceil(gapWh) };
    if (best) push('battery', enough ? 'batteryAdd' : 'batteryPartial', { ...vars, name: nameOf(best), usable: best.storageWh * BATTERY_DOD }, { type: 'add', id: best.id });
    else push('battery', 'batteryCut', vars);
  }

  // Radio: la más barata cuyo alcance llegue al destino
  if (fails.has('comms')) {
    const need = mission?.commsDifficulty || 1;
    const comm = parts.find((p) => p.category === 'comms');
    const cand = cheapest(catalog.filter((p) => p.category === 'comms' && p.range >= need && p.id !== comm?.id));
    if (cand) {
      push('comms', comm ? 'commsSwap' : 'commsAdd', { name: nameOf(cand), have: comm ? nameOf(comm) : '', range: comm?.range || 0, need, cost: cand.cost },
        comm ? { type: 'swap', remove: comm.id, add: cand.id } : { type: 'add', id: cand.id });
    }
  }

  // Propulsión: sin motor, el de menor costo total que dé el Δv con su propio tanque. El costo total incluye
  // agrandar la estructura si no cabe y un generador extra si el motor gasta energía todo el tiempo (iónico).
  if (fails.has('propellant')) {
    if (!prop) {
      const margin = x.power.generated - x.power.consumed;
      const gens = catalog.filter((p) => p.category === 'power' && (p.powerW || 0) < 0 && !installed.has(p.id));
      const genCost = (needW) => (needW <= 0 ? 0 : cheapest(gens.filter((p) => (p.solar ? -p.powerW * x.power.solarFactor : -p.powerW) >= needW))?.cost ?? 25);
      const rocketBound = x.massCap < structure.volumeU * KG_PER_U - 1e-9; // si manda el cohete, otra estructura no ayuda
      const stats = catalog.filter((p) => p.category === 'propulsion' && p.isp).map((p) => {
        const dry = x.dry + p.massKg;
        const kg = propellantFor(req, p.isp, dry);
        const reach = kg <= (p.maxPropellantKg || 0);
        const needU = used + p.volumeU;
        const fitsHere = dry + kg <= x.massCap && needU <= x.capU;
        const bigger = fitsHere || rocketBound ? null
          : structures.find((s2) => s2.volumeU > structure.volumeU && s2.volumeU >= needU && s2.volumeU * KG_PER_U >= dry + kg);
        const upgrade = fitsHere ? 0 : bigger ? bigger.cost - structure.cost : Infinity;
        return { p, kg, dry, reach, fitsHere, bigger, score: p.cost + upgrade + (p.burnOnly ? 0 : genCost(p.powerW - margin)) };
      });
      const best = stats.filter((e) => e.reach && (e.fitsHere || e.bigger)).sort((a, b) => a.score - b.score)[0];
      if (best && !best.fitsHere) {
        push('propellant', 'propBigger', { name: nameOf(best.p), kg: (Math.ceil(best.kg * 10) / 10).toFixed(1), need: g(best.dry + best.kg), cap: g(x.massCap), next: nameOf(best.bigger) },
          { type: 'setStructure', id: best.bigger.id });
      } else {
        const pick = best || [...stats].sort((a, b) => b.p.isp - a.p.isp)[0];
        if (pick) {
          const kg = Math.min(pick.p.maxPropellantKg, Math.ceil(pick.kg * 10) / 10);
          push('propellant', 'propAdd', { name: nameOf(pick.p), isp: pick.p.isp, cost: pick.p.cost, kg: kg.toFixed(1), max: pick.p.maxPropellantKg }, { type: 'add', id: pick.p.id, kg });
        }
      }
    } else {
      push('propellant', 'propTankOver', { name: nameOf(prop), max: prop.maxPropellantKg }, { type: 'setPropellant', kg: prop.maxPropellantKg });
    }
  }

  // Δv: ¿basta con cargar más propelente, o no cabe en la estructura, o el tanque no da?
  if (fails.has('deltaV') && prop?.isp && !out.some((h) => h.key === 'massStructure')) {
    const needKg = propellantFor(req, prop.isp, x.dry);
    const bigger = structures.find((p) => p.volumeU > structure.volumeU && p.volumeU * KG_PER_U >= x.dry + needKg && p.volumeU >= used);
    if (x.dry + needKg > x.massCap) {
      push('deltaV', bigger ? 'massStructure' : 'dvHeavy', { name: nameOf(structure), cap: g(x.massCap), need: g(x.dry + needKg), next: bigger ? nameOf(bigger) : '' },
        bigger ? { type: 'setStructure', id: bigger.id } : null);
    } else if (needKg <= (prop.maxPropellantKg || 0)) {
      const kg = Math.ceil(needKg * 10) / 10;
      push('deltaV', 'dvMore', { missing: Math.ceil(req - x.dv), kg: kg.toFixed(1), max: prop.maxPropellantKg }, { type: 'setPropellant', kg });
    } else {
      // El tanque no da: otro motor con más Isp que sí alcance con su propio tanque
      const alt = cheapest(catalog.filter((p) => p.category === 'propulsion' && p.isp > prop.isp
        && propellantFor(req, p.isp, x.dry - prop.massKg + p.massKg) <= (p.maxPropellantKg || 0)));
      const kgAlt = alt ? Math.ceil(propellantFor(req, alt.isp, x.dry - prop.massKg + alt.massKg) * 10) / 10 : 0;
      push('deltaV', 'dvTank', { name: nameOf(prop), max: prop.maxPropellantKg, kg: needKg.toFixed(1), alt: alt ? nameOf(alt) : '' },
        alt ? { type: 'swap', remove: prop.id, add: alt.id, kg: kgAlt } : null);
    }
  }

  // Costo: de las piezas más caras, la primera que tenga un reemplazo más barato que cumpla el mismo papel
  // (un generador por otro generador, no por una batería) sin romper energía, batería, radio ni Δv.
  if (fails.has('cost')) {
    const over = x.cost - budgetSpace;
    const sf = x.power.solarFactor;
    const gain = (p) => (p.solar ? -p.powerW * sf : -p.powerW);
    const sameRole = (top, alt) => {
      if (top.category === 'power') {
        if (!!top.storageWh !== !!alt.storageWh) return false;
        if (alt.storageWh) return alt.storageWh * BATTERY_DOD >= x.storage.neededWh;
        const net = x.power.net - gain(top) + gain(alt);
        return net >= 0 && x.power.generated - gain(top) + gain(alt) >= (mission?.minPowerW || 0);
      }
      if (top.category === 'comms') return alt.range >= (mission?.commsDifficulty || 1);
      if (top.category === 'propulsion') {
        if (!alt.isp) return false;
        const dry = x.dry - top.massKg + alt.massKg;
        const kg = propellantFor(req, alt.isp, dry);
        return kg <= (alt.maxPropellantKg || 0) && dry + kg <= x.massCap;
      }
      return true;
    };
    const tops = parts.filter((p) => p.category !== 'structure').sort((a, b) => b.cost - a.cost);
    let top = tops[0];
    let alt;
    for (const cand of tops) {
      alt = cheapest(catalog.filter((p) => p.category === cand.category && p.id !== cand.id && p.cost < cand.cost && allowed(p) && sameRole(cand, p)));
      if (alt) { top = cand; break; }
    }
    if (top && alt) {
      const kg = top.category === 'propulsion' ? Math.min(alt.maxPropellantKg, Math.ceil(propellantFor(req, alt.isp, x.dry - top.massKg + alt.massKg) * 10) / 10) : undefined;
      push('cost', 'costSwap', { over, name: nameOf(top), price: top.cost, alt: nameOf(alt), altPrice: alt.cost, total: x.cost - top.cost + alt.cost },
        { type: 'swap', remove: top.id, add: alt.id, ...(kg != null ? { kg } : {}) });
    } else push('cost', 'costOver', { over, name: top ? nameOf(top) : '', price: top?.cost ?? 0 });
  }

  // Ciencia: el instrumento compatible con mejor valor por $M que quepa en lo que queda del presupuesto y del volumen
  if (fails.has('science')) {
    const left = budgetSpace - x.cost;
    const cands = catalog.filter((p) => p.category === 'instrument' && allowed(p));
    const room = cands.filter((p) => p.cost <= left && used + p.volumeU <= x.capU);
    const pick = [...(room.length ? room : cands)].sort((a, b) => b.scienceValue / b.cost - a.scienceValue / a.cost)[0];
    if (pick) push('science', 'noScience', { name: nameOf(pick), cost: pick.cost, value: pick.scienceValue, left: Math.max(0, left) }, { type: 'add', id: pick.id });
  }
  return done();
}

/**
 * Aplica la acción de un consejo y devuelve el satélite resultante (puro; no toca el original).
 * type: setStructure {id} · setPropellant {kg} · add {id, kg?} · swap {remove, add, kg?}.
 * Una propulsión nueva reemplaza a la anterior; quitar la propulsión deja el propelente en 0.
 */
export function nextSatellite(sat, action, catalog) {
  if (!action) return sat;
  if (action.type === 'setStructure') return { ...sat, formFactor: action.id };
  if (action.type === 'setPropellant') return { ...sat, propellantKg: action.kg };
  const piece = (id) => catalog.find((p) => p.id === id);
  const addId = action.type === 'add' ? action.id : action.add;
  let pieces = sat.pieces.filter((id) => id !== action.remove);
  let propellantKg = sat.propellantKg;
  if (action.remove && piece(action.remove)?.category === 'propulsion') propellantKg = 0;
  if (addId && !pieces.includes(addId)) {
    const added = piece(addId);
    if (added?.category === 'propulsion') {
      pieces = pieces.filter((id) => piece(id)?.category !== 'propulsion');
      propellantKg = Math.min(action.kg ?? propellantKg, added.maxPropellantKg || 0);
    }
    pieces = [...pieces, addId];
  }
  return { ...sat, pieces, propellantKg };
}

// --- Detalle de cada verificación (pop-up del panel guía) ---------------------------------

/**
 * Números de una verificación para mostrarlos: valor contra límite, con unidad y `dir`
 * ('lower' = debe quedar por debajo del límite, 'higher' = por encima, null = sí/no).
 * Recibe `check` y `metrics` ya calculados por physics.validateDesign (no vuelve a calcular nada).
 */
export function checkDetail(check, metrics, mission, budgetSpace) {
  const x = metrics;
  const base = { id: check.id, ok: check.ok, state: checkState(check, x), value: null, limit: null, unit: '', dir: null };
  const out = (patch) => {
    const d = { ...base, ...patch };
    d.pct = d.limit > 0 && d.value != null ? Math.min(100, (d.value / d.limit) * 100) : null;
    return d;
  };
  switch (check.id) {
    case 'mass': return out({ value: Math.round(check.value * 1000), limit: Math.round(check.limit * 1000), unit: 'g', dir: 'lower' });
    case 'volume': return out({ value: +check.value.toFixed(2), limit: check.limit, unit: 'U', dir: 'lower' });
    case 'power': return out({ value: r1(x.power.generated), limit: r1(Math.max(x.power.consumed, mission?.minPowerW || 0)), unit: 'W', dir: 'higher', net: r1(x.power.net), minW: mission?.minPowerW || 0, use: r1(x.power.consumed) });
    case 'battery': return out({ value: Math.round(check.value), limit: Math.round(check.limit), unit: 'Wh', dir: 'lower' });
    case 'comms': return out({ value: check.value, limit: check.limit, unit: '', dir: 'higher' });
    case 'propellant': return out({ value: check.value, limit: check.limit, unit: 'kg', dir: 'lower' });
    case 'deltaV': return out({ value: Math.round(check.value), limit: Math.round(check.limit), unit: 'm/s', dir: 'higher' });
    case 'cost': return out({ value: check.value, limit: budgetSpace, unit: '$M', dir: 'lower' });
    default: return out({});
  }
}

// --- Datos de una pieza en TU misión (pop-up ⓘ) ---------------------------------------

/**
 * Hechos de una pieza con el diseño actual. NO calcula el diseño: recibe lo ya calculado
 * (`metrics` de physics.validateDesign, que el render ya tiene) para no recalcular ni provocar re-renders.
 * @param {object} piece pieza de pieces.json
 * @param {{ mission: object, metrics: object, budgetSpace: number, rocket?: object, installed?: boolean }} ctx
 * @returns {Array<{ key: string, level: 'ok'|'warn'|'bad'|'info', vars: object }>} el texto: nivel2/textos.js → facts.<key>
 */
export function pieceFacts(piece, { mission, metrics: x, budgetSpace, rocket, installed = false }) {
  const out = [];
  const add = (key, level, vars) => out.push({ key, level, vars });
  const w = piece.powerW || 0;
  const consumedAfter = x.power.consumed + (installed || w <= 0 ? 0 : w);
  const sf = x.power.solarFactor;

  if (piece.category !== 'structure' && x.massCap > 0 && Number.isFinite(x.massCap)) {
    const pct = Math.round((piece.massKg / x.massCap) * 100);
    add('massShare', pct >= 30 ? 'warn' : 'info', { g: grams(piece.massKg), pct, cap: grams(x.massCap) });
  }
  if (budgetSpace > 0) {
    const pct = Math.round((piece.cost / budgetSpace) * 100);
    add('costShare', pct >= 40 ? 'warn' : 'info', { cost: piece.cost, pct, budget: budgetSpace });
  }

  switch (piece.category) {
    case 'structure': {
      const byU = piece.volumeU * KG_PER_U;
      const limit = Math.min(byU, rocket?.maxPayloadKg ?? Infinity);
      add('structCap', 'info', { kg: grams(byU), limit: grams(limit), u: piece.volumeU, byRocket: limit < byU });
      const here = r1(-w * sf);
      add('structPanels', here >= (mission?.minPowerW || 0) ? 'ok' : 'warn', { w: here, min: mission?.minPowerW || 0 });
      break;
    }
    case 'power': {
      if (piece.storageWh) {
        const usable = piece.storageWh * BATTERY_DOD;
        const load = Math.max(x.power.consumed - x.power.generatedNoSun, 0.01);
        const hours = r1(usable / load);
        const eclipse = mission?.eclipseHours || 0;
        add('battUsable', 'info', { usable, cap: piece.storageWh });
        add('battEclipse', hours >= eclipse ? 'ok' : 'bad', { hours, eclipse, load: r1(load) });
      } else {
        if (piece.solar) {
          add('powerGen', sf < 0.5 ? 'warn' : 'ok', { gain: r1(-w * sf), nominal: -w, pct: Math.round(sf * 100) });
        } else {
          add('powerFixed', 'ok', { w: -w });
          add('powerNoSun', 'ok', {});
        }
      }
      break;
    }
    case 'propulsion': {
      const dry = x.dry + (installed ? 0 : piece.massKg);
      const max = piece.maxPropellantKg || 0;
      const full = Math.round(deltaV(piece.isp, dry + max, dry));
      const req = mission?.dvRequired || 0;
      const need = propellantFor(req, piece.isp, dry);
      add('propDv', full >= req ? 'ok' : 'bad', { isp: piece.isp, full, max, req });
      add('propNeed', need <= max ? 'ok' : 'bad', { kg: (Math.ceil(need * 10) / 10).toFixed(1), max });
      if (piece.burnOnly) add('propBurn', 'info', { wh: w * BURN_HOURS, h: BURN_HOURS, w });
      else add('propElectric', 'warn', { w });
      break;
    }
    case 'comms': {
      const need = mission?.commsDifficulty || 1;
      add('commsRange', piece.range >= need ? 'ok' : 'bad', { range: piece.range, need });
      add('powerUse', 'info', { w, pct: Math.round((w / consumedAfter) * 100) });
      break;
    }
    case 'instrument': {
      add('science', 'info', { value: piece.scienceValue, second: Math.round(piece.scienceValue * INSTRUMENT_WEIGHTS[1]) });
      add('powerUse', 'info', { w, pct: Math.round((w / consumedAfter) * 100) });
      break;
    }
    default:
      if (w > 0) add('powerUse', 'info', { w, pct: Math.round((w / consumedAfter) * 100) });
  }
  return out;
}
