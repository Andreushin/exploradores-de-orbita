// OWNER: Rol 3 — Reglas puras del Taller del CubeSat (Nivel 2), sin DOM.
// Las usa nivel2/nivel2.js (Nivel 2 · Taller). Ver docs/niveles/nivel-2.md.
import { KG_PER_U, propellantFor, G0 } from './physics.js';

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
 * Hasta `max` consejos para las verificaciones que fallan, con los números del diseño actual.
 * Devuelve [{ key, vars }]: el texto lo pone cada nivel (nivel2/textos.js → tips.<key>).
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
  const out = [];
  if (!structure) return out;

  // Masa: ¿la estructura es demasiado chica para el propelente que pide el destino?
  if (fails.has('mass') || fails.has('volume')) {
    const capKg = structure.volumeU * KG_PER_U;
    const need = prop?.isp ? x.dry * Math.exp(req / (prop.isp * G0)) : x.wet;
    const bigger = catalog
      .filter((p) => p.category === 'structure' && p.volumeU > structure.volumeU)
      .sort((a, b) => a.volumeU - b.volumeU)
      .find((p) => p.volumeU * KG_PER_U >= need && p.volumeU >= x.capU);
    if (fails.has('mass') && need > capKg && bigger) {
      out.push({ key: 'massStructure', vars: { name: nameOf(structure), cap: g(capKg), need: g(need), next: nameOf(bigger) } });
    } else if (fails.has('mass')) {
      out.push({ key: 'massOver', vars: { over: g(x.wet - x.massCap), cap: g(x.massCap) } });
    }
    if (fails.has('volume')) {
      const used = result.checks.find((c) => c.id === 'volume').value;
      out.push({ key: 'volume', vars: { used: +used.toFixed(2), cap: x.capU, next: bigger ? nameOf(bigger) : '' } });
    }
  }

  // Costo: la pieza más cara y, si existe, otra más barata de la misma categoría que también sirva.
  // Una propulsión alternativa tiene que poder dar el Δv del destino con su propio tanque.
  if (fails.has('cost')) {
    const top = parts.filter((p) => p.category !== 'structure').sort((a, b) => b.cost - a.cost)[0];
    const over = x.cost - budgetSpace;
    const reaches = (alt) => {
      if (alt.category !== 'propulsion') return true;
      if (!alt.isp) return false;
      const dry = x.dry - top.massKg + alt.massKg;
      return propellantFor(req, alt.isp, dry) <= (alt.maxPropellantKg || 0);
    };
    const alt = top && catalog
      .filter((p) => p.category === top.category && p.id !== top.id && p.cost < top.cost && allowed(p) && reaches(p))
      .sort((a, b) => a.cost - b.cost)[0];
    if (top && alt) {
      out.push({ key: 'costSwap', vars: { over, name: nameOf(top), price: top.cost, alt: nameOf(alt), altPrice: alt.cost, total: x.cost - top.cost + alt.cost } });
    } else out.push({ key: 'costOver', vars: { over, name: top ? nameOf(top) : '', price: top?.cost ?? 0 } });
  }

  // Δv: ¿basta con cargar más propelente, o no cabe en la estructura, o el tanque no da?
  if (fails.has('deltaV') && prop?.isp && !out.some((h) => h.key === 'massStructure')) {
    const needKg = propellantFor(req, prop.isp, x.dry);
    const bigger = catalog
      .filter((p) => p.category === 'structure' && p.volumeU > structure.volumeU)
      .sort((a, b) => a.volumeU - b.volumeU)
      .find((p) => p.volumeU * KG_PER_U >= x.dry + needKg);
    if (x.dry + needKg > x.massCap) {
      out.push({ key: bigger ? 'massStructure' : 'dvHeavy', vars: { name: nameOf(structure), cap: g(x.massCap), need: g(x.dry + needKg), next: bigger ? nameOf(bigger) : '' } });
    } else if (needKg <= (prop.maxPropellantKg || 0)) {
      out.push({ key: 'dvMore', vars: { missing: Math.ceil(req - x.dv), kg: (Math.ceil(needKg * 10) / 10).toFixed(1), max: prop.maxPropellantKg } });
    } else {
      out.push({ key: 'dvTank', vars: { name: nameOf(prop), max: prop.maxPropellantKg, kg: needKg.toFixed(1) } });
    }
  }
  return out.slice(0, max);
}
