// OWNER: Rol 2 — Física y reglas del juego.
// CONTRATO: las firmas exportadas no cambian sin avisar a Roles 3 y 4.
// Valores ludificados con orden de magnitud real (ver docs/fuentes.md).

export const G0 = 9.80665;          // m/s²
export const KG_PER_U = 1.33;       // CubeSat Design Spec: masa máx. por unidad U
export const SOLAR_AT_1AU = 1;      // factor de generación solar en la órbita terrestre

/** Ecuación de Tsiolkovsky. Devuelve Δv en m/s. */
export function deltaV(isp, wetMassKg, dryMassKg) {
  if (!isp || dryMassKg <= 0 || wetMassKg <= dryMassKg) return 0;
  return isp * G0 * Math.log(wetMassKg / dryMassKg);
}

/** Propelente necesario para lograr cierto Δv con una masa seca. */
export function propellantFor(dv, isp, dryMassKg) {
  return dryMassKg * (Math.exp(dv / (isp * G0)) - 1);
}

/** Resuelve ids de piezas a objetos. */
export function resolvePieces(ids, pieces) {
  return ids.map((id) => pieces.find((p) => p.id === id)).filter(Boolean);
}

/** Masa seca (sin propelente) del satélite, incluida la estructura. */
export function dryMass(pieceObjs) {
  return pieceObjs.reduce((sum, p) => sum + (p.massKg || 0), 0);
}

/** Masa total = seca + propelente. */
export function totalMass(pieceObjs, propellantKg = 0) {
  return dryMass(pieceObjs) + propellantKg;
}

/** Volumen ocupado en U (la estructura no ocupa volumen, lo provee). */
export function usedVolume(pieceObjs) {
  return pieceObjs.filter((p) => p.category !== 'structure').reduce((s, p) => s + (p.volumeU || 0), 0);
}

/**
 * Balance de energía en W. Generación solar escala con 1/d².
 * powerW > 0 = consumo; powerW < 0 = generación.
 */
export function powerBalance(pieceObjs, distanceAU = 1) {
  const solarFactor = SOLAR_AT_1AU / (distanceAU * distanceAU);
  let generated = 0;
  let consumed = 0;
  for (const p of pieceObjs) {
    const w = p.powerW || 0;
    if (p.burnOnly) continue; // solo consume durante quemados; lo cubre la batería
    if (w < 0) generated += -w * (p.solar ? solarFactor : 1);
    else consumed += w;
  }
  return { generated, consumed, net: generated - consumed };
}

/** Isp del sistema de propulsión instalado (0 si no hay). */
export function systemIsp(pieceObjs) {
  const prop = pieceObjs.find((p) => p.category === 'propulsion');
  return prop?.isp || 0;
}

/**
 * Resultado de la inserción orbital.
 * @param dvApplied Δv del quemado de frenado (m/s)
 * @param dvRequired Δv nominal de inserción del destino (m/s)
 * @returns 'orbit' | 'eccentric' | 'flyby' | 'crash'
 */
export function insertionOutcome(dvApplied, dvRequired) {
  const ratio = dvApplied / dvRequired;
  if (ratio < 0.75) return 'flyby';
  if (ratio < 0.95) return 'eccentric';
  if (ratio <= 1.1) return 'orbit';
  return 'crash';
}

/** Puntaje científico mínimo para CML 4 (diseño puntual). */
export const CML4_MIN_SCORE = 50;

/**
 * Nivel CML alcanzado (1-4), inspirado en NASA Concept Maturity Levels.
 * 1 Concepto: el diseño no cumple las restricciones.
 * 2 Factibilidad inicial: diseño válido, pero no quedó en órbita (sobrevuelo o choque).
 * 3 Trade space: en órbita, pero excéntrica o con poca ciencia (< CML4_MIN_SCORE).
 * 4 Diseño puntual: órbita estable y ciencia ≥ CML4_MIN_SCORE.
 */
export function computeCML({ designValid, launched, outcome, scienceScore }) {
  if (!designValid) return 1;
  if (!launched || outcome === 'flyby' || outcome === 'crash' || !outcome) return 2;
  if (outcome === 'eccentric' || scienceScore < CML4_MIN_SCORE) return 3;
  return 4;
}

/**
 * Valida el diseño completo. Lo usan el Taller (botón Lanzar) y el Reporte (CML).
 * @returns {{ valid: boolean, checks: Array<{ id: string, ok: boolean, value: number, limit: number }>, metrics: object }}
 * Cada check.id tiene su texto en data/i18n/<lang>/workshop.json → "checks.<id>".
 */
export function validateDesign(state, data) {
  const mission = data.missions.find((m) => m.id === state.missionId);
  const rocket = data.rockets.find((r) => r.id === state.rocketId);
  const pieces = resolvePieces(
    [state.satellite.formFactor, ...state.satellite.pieces].filter(Boolean),
    data.pieces,
  );
  const structure = pieces.find((p) => p.category === 'structure');
  const prop = pieces.find((p) => p.category === 'propulsion');
  const comms = pieces.find((p) => p.category === 'comms');
  const propellant = state.satellite.propellantKg;

  const dry = dryMass(pieces);
  const wet = dry + propellant;
  const capU = structure?.volumeU || 0;
  const massCap = Math.min(capU * KG_PER_U, rocket?.maxPayloadKg ?? Infinity);
  const power = powerBalance(pieces, mission?.distanceAU || 1);
  const dv = deltaV(prop?.isp || 0, wet, dry);
  const cost = pieces.reduce((s, p) => s + (p.cost || 0), 0);

  const checks = [
    { id: 'structure', ok: !!structure, value: capU, limit: 1 },
    { id: 'obc', ok: pieces.some((p) => p.category === 'obc'), value: 0, limit: 0 },
    { id: 'mass', ok: wet <= massCap, value: wet, limit: massCap },
    { id: 'volume', ok: usedVolume(pieces) <= capU, value: usedVolume(pieces), limit: capU },
    { id: 'power', ok: power.net >= 0 && power.generated >= (mission?.minPowerW || 0), value: power.generated, limit: power.consumed },
    { id: 'battery', ok: !pieces.some((p) => p.burnOnly) || pieces.some((p) => p.id === 'battery'), value: 0, limit: 0 },
    { id: 'comms', ok: !!comms && comms.range >= (mission?.commsDifficulty || 1), value: comms?.range || 0, limit: mission?.commsDifficulty || 1 },
    { id: 'propellant', ok: !!prop && propellant <= (prop.maxPropellantKg || 0), value: propellant, limit: prop?.maxPropellantKg || 0 },
    { id: 'deltaV', ok: dv >= (mission?.dvRequired || 0), value: dv, limit: mission?.dvRequired || 0 },
    { id: 'cost', ok: cost <= state.budget.space, value: cost, limit: state.budget.space },
    { id: 'science', ok: pieces.some((p) => p.category === 'instrument'), value: 0, limit: 0 },
  ];

  return {
    valid: checks.every((c) => c.ok),
    checks,
    metrics: { dry, wet, massCap, capU, power, dv, cost, isp: prop?.isp || 0 },
  };
}

/** Pesos de rendimientos decrecientes: el instrumento más valioso cuenta completo, los siguientes cada vez menos. */
export const INSTRUMENT_WEIGHTS = [1, 0.6, 0.4, 0.25];
/** Inversión ($M) con la que cada segmento llega a su máximo (factor 1) = tarjeta más cara del Nivel 1 (data/segments.json). */
export const GROUND_FULL = 25; // antenas y tiempo de DSN (tarjeta ground-dsn)
export const USER_FULL = 12;   // procesamiento, calibración y archivo de datos PDS (tarjeta advanced)

/** Factor de un segmento: 0.6 sin inversión → 1 al llegar a `full` $M. Crece de forma lineal hasta ahí. */
function segmentFactor(amount, full) {
  return 0.6 + 0.4 * Math.min(1, Math.max(0, amount || 0) / full);
}

/**
 * Puntaje científico (0-100). Ver la explicación en docs/fuentes.md → «Puntaje científico y CML».
 * puntaje = (40 + Σ valor_i · peso_i) × resultado × Tierra × Usuario
 *  - Instrumentos ordenados de mayor a menor valor, con pesos INSTRUMENT_WEIGHTS (rendimientos decrecientes).
 *  - resultado: orbit 1 · eccentric 0.5 · flyby 0.15 · crash 0.
 *  - Tierra / Usuario: 0.6 → 1 según inversión, hasta GROUND_FULL / USER_FULL.
 */
export function scienceScore(pieceObjs, budget, outcome) {
  const values = pieceObjs
    .filter((p) => p.category === 'instrument')
    .map((p) => p.scienceValue || 0)
    .sort((a, b) => b - a);
  const last = INSTRUMENT_WEIGHTS[INSTRUMENT_WEIGHTS.length - 1];
  const instruments = values.reduce((s, v, i) => s + v * (INSTRUMENT_WEIGHTS[i] ?? last), 0);
  const raw = 40 + instruments;
  const outcomeFactor = { orbit: 1, eccentric: 0.5, flyby: 0.15, crash: 0 }[outcome] ?? 0;
  const groundFactor = segmentFactor(budget?.ground, GROUND_FULL);
  const userFactor = segmentFactor(budget?.user, USER_FULL);
  return Math.round(Math.min(100, raw * outcomeFactor * groundFactor * userFactor));
}
