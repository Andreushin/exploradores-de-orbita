// OWNER: Rol 3 — Nivel 2 · reglas de juego puras (sin DOM): riesgo por TRL, dilemas y estrellas.
// Los umbrales viven en data/workshop.json (trlRisk, dilemmas, stars) para ajustarlos sin tocar código.
import { resolvePieces, powerBalance, energyStorage } from '../js/physics.js';

/** Probabilidad de falla en ruta de una pieza según su TRL (TRL 9 = probada en vuelo = 0). */
export function riesgoTRL(trl, tabla = {}) {
  const p = tabla[String(trl)];
  if (typeof p === 'number') return p;
  return trl >= 9 ? 0 : 0.25;
}

/**
 * Riesgo de la misión: una entrada por pieza con riesgo (> 0), más el extra de un dilema aceptado
 * con riesgo ({category, add}). Total = 1 − Π(1 − p), la probabilidad de que falle al menos una.
 * → { items: [{ id, trl, p }], total }
 */
export function riesgoMision(piezas, tabla = {}, dilema = null) {
  const extra = dilema?.choice?.kind === 'risk' ? dilema.choice.risk : null;
  let extraUsado = false;
  const items = [];
  for (const pz of piezas) {
    if (pz.category === 'structure') continue;
    let p = riesgoTRL(pz.trl, tabla);
    if (extra && !extraUsado && pz.category === extra.category) { p += extra.add; extraUsado = true; }
    if (p > 0) items.push({ id: pz.id, trl: pz.trl, p: Math.min(0.95, round3(p)) });
  }
  const total = round3(1 - items.reduce((acc, it) => acc * (1 - it.p), 1));
  return { items, total };
}

/** Elige un dilema al azar (o el de `id` si ya estaba guardado). `rand` se inyecta en pruebas. */
export function elegirDilema(dilemas, guardado = null, rand = Math.random) {
  if (!dilemas?.length) return null;
  if (guardado?.id) return dilemas.find((d) => d.id === guardado.id) || null;
  return dilemas[Math.floor(rand() * dilemas.length) % dilemas.length];
}

/**
 * ¿Se cumple el reto de un dilema? `ref` es la foto del diseño cuando apareció el dilema (para "−15 % de masa").
 * Devuelve { met, value, target } o null si el dilema no trae reto.
 * - wetKg: masa al despegar ≤ ratio × la de referencia
 * - batteryMargin: batería usable ≥ ratio × lo que se necesita
 * - eclipse: con eclipses ratio× más largos, la batería todavía alcanza
 */
export function evaluarDilema(choice, { metrics, mission, piezas, ref }) {
  const goal = choice?.kind === 'goal' ? choice.goal : null;
  if (!goal) return null;
  if (goal.metric === 'wetKg') {
    const target = round3((ref?.wetKg ?? metrics.wet) * goal.ratio);
    return { met: metrics.wet <= target + 1e-9, value: round3(metrics.wet), target };
  }
  if (goal.metric === 'batteryMargin') {
    const target = round3(metrics.storage.neededWh * goal.ratio);
    return { met: metrics.storage.usableWh >= target - 1e-9, value: round3(metrics.storage.usableWh), target };
  }
  if (goal.metric === 'eclipse') {
    const power = powerBalance(piezas, mission?.distanceAU || 1);
    const s = energyStorage(piezas, power, (mission?.eclipseHours || 0) * goal.ratio);
    return { met: s.neededWh <= s.usableWh + 1e-9, value: round3(s.usableWh), target: round3(s.neededWh) };
  }
  return null;
}

/**
 * Tres estrellas del taller. Cada criterio vale una:
 *  1. diseño válido (todas las verificaciones),
 *  2. bien dimensionado: margen de Δv entre dvMarginMin y dvMarginMax (ni corto ni cargando propelente de más),
 *  3. eficiente: costo ≤ costMaxRatio del presupuesto, riesgo total ≤ riskMax y, si aceptaste un reto, cumplirlo.
 * Las estrellas 2 y 3 solo cuentan con la 1. → { stars, criteria: [{ id, ok }] }
 */
export function estrellasTaller({ valid, metrics, mission, budgetSpace, riesgo, reto }, cfg = {}) {
  const c = { dvMarginMin: 1.03, dvMarginMax: 1.25, costMaxRatio: 0.9, riskMax: 0.1, ...cfg };
  const margin = mission?.dvRequired ? metrics.dv / mission.dvRequired : 0;
  const sized = margin >= c.dvMarginMin && margin <= c.dvMarginMax;
  const cheap = budgetSpace > 0 && metrics.cost <= budgetSpace * c.costMaxRatio + 1e-9;
  const safe = (riesgo?.total ?? 0) <= c.riskMax + 1e-9;
  const retoOk = reto == null || reto.met;
  const criteria = [
    { id: 'valid', ok: Boolean(valid) },
    { id: 'sized', ok: sized, margin },
    { id: 'efficient', ok: cheap && safe && retoOk, cheap, safe, retoOk },
  ];
  const stars = valid ? criteria.filter((x) => x.ok).length : 0;
  return { stars, criteria };
}

/** Piezas resueltas (estructura primero) a partir del satélite del contrato. */
export function piezasDe(sat, catalogo) {
  return resolvePieces([sat.formFactor, ...sat.pieces].filter(Boolean), catalogo);
}

const round3 = (n) => Math.round(n * 1000) / 1000;
