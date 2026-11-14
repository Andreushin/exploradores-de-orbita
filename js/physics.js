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

/**
 * Nivel CML alcanzado (1-4), inspirado en NASA Concept Maturity Levels.
 * 1 Concepto · 2 Factibilidad inicial · 3 Trade space · 4 Diseño puntual
 */
export function computeCML({ designValid, launched, outcome, scienceScore }) {
  if (!designValid) return 1;
  if (!launched || outcome === 'flyby' || outcome === 'crash') return 2;
  if (outcome === 'eccentric' || scienceScore < 50) return 3;
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

/** Puntaje científico base (0-100) según instrumentos, objetivo y segmentos Tierra/Usuario. */
export function scienceScore(pieceObjs, budget, outcome) {
  // TODO(Rol 2): balancear. Base 40 + valor de instrumentos.
  const raw = 40 + 1.2 * pieceObjs.reduce((s, p) => s + (p.scienceValue || 0), 0);
  const outcomeFactor = { orbit: 1, eccentric: 0.5, flyby: 0.15, crash: 0 }[outcome] ?? 0;
  const groundFactor = Math.min(1, 0.5 + budget.ground / 50);  // antenas/DSN
  const userFactor = Math.min(1, 0.5 + budget.user / 30);      // procesamiento y archivo de datos
  return Math.round(Math.min(100, raw * outcomeFactor * groundFactor * userFactor));
}
