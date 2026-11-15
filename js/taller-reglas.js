// OWNER: Rol 3 — Reglas puras del Taller del CubeSat (Nivel 2), sin DOM.
// Las usan js/screens/workshop.js (app principal) y nivel2/nivel2.js. Ver docs/levelTwo.md.

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
  return {
    dv: { pct: pct(m.dv, dvScale), level: dvLevel(m.dv, req), required: req, markerPct: req > 0 ? (req / dvScale) * 100 : null },
    mass: { pct: pct(m.wet, massCap), level: limitLevel(m.wet, massCap), cap: massCap },
    power: { pct: pct(consumed, generated), level: net < 0 || powerLow ? 'danger' : limitLevel(consumed, generated), net, minW, powerLow },
    battery: { pct: pct(neededWh, usableWh), level: limitLevel(neededWh, usableWh), needed: neededWh, usable: usableWh, capacity: capacityWh },
    cost: { pct: pct(m.cost, spaceBudget), level: limitLevel(m.cost, spaceBudget) },
  };
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
