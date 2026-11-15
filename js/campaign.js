// OWNER: Rol 1 — Campaña y estrellas (compartido por todos los niveles).
// Progreso en su propia clave de localStorage (`eo-campana`), aparte de la misión (`eo-mision`):
// así sobrevive a "Nueva misión". Las reglas de estrellas de los 4 niveles viven aquí, en un solo lugar.

export const CAMPAIGN_KEY = 'eo-campana';
/** Orden de la campaña: cada destino se desbloquea al poner un CubeSat en órbita del anterior. */
export const ORDER = ['moon', 'mars', 'europa'];
const IN_ORBIT = ['orbit', 'eccentric'];

function load() {
  try {
    const c = JSON.parse(localStorage.getItem(CAMPAIGN_KEY));
    if (c && typeof c === 'object' && c.best && Array.isArray(c.cleared)) return c;
  } catch { /* storage bloqueado o vacío */ }
  return { best: {}, cleared: [] };
}

function save(c) {
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

/** ¿Se puede jugar este destino? La Luna siempre; los demás, si el anterior ya se completó. */
export function isUnlocked(destId) {
  const i = ORDER.indexOf(destId);
  return i <= 0 || load().cleared.includes(ORDER[i - 1]);
}

/** Mejores estrellas por nivel en un destino: { 1: 3, 2: 2, ... } (0 si no se ha jugado). */
export function bestStars(destId) {
  const b = load().best[destId] || {};
  return { 1: b[1] || 0, 2: b[2] || 0, 3: b[3] || 0, 4: b[4] || 0 };
}

/** Total de estrellas de la campaña (máx. 3 por nivel × 4 niveles × 3 destinos = 36). */
export function totalStars() {
  const { best } = load();
  return Object.values(best).reduce((s, lv) => s + Object.values(lv).reduce((a, n) => a + n, 0), 0);
}
export const MAX_STARS = ORDER.length * 4 * 3;

/**
 * Registra el resultado de un nivel. Guarda la mejor marca y, si el CubeSat quedó en órbita
 * (Nivel 3), marca el destino como completado y desbloquea el siguiente.
 * @returns {{ stars, best, improved, unlocked }} unlocked = id del destino recién desbloqueado o null
 */
export function recordLevel(destId, level, stars, { cleared = false } = {}) {
  const c = load();
  const prev = c.best[destId]?.[level] || 0;
  c.best[destId] = { ...c.best[destId], [level]: Math.max(prev, stars) };
  let unlocked = null;
  if (cleared && !c.cleared.includes(destId)) {
    c.cleared.push(destId);
    const next = ORDER[ORDER.indexOf(destId) + 1];
    if (next) unlocked = next;
  }
  save(c);
  return { stars, best: Math.max(prev, stars), improved: stars > prev, unlocked };
}

// --- Reglas de estrellas (0–3). Leen la misión con la forma del contrato (docs/contrato-niveles.md). ---

/**
 * Nivel 1 · plan equilibrado.
 * 3★ sin penalización y CML máximo 4 · 2★ CML máximo ≥ 3 · 1★ plan validado.
 */
export function starsLevel1(plan) {
  if (!plan?.validated) return 0;
  if ((plan.penalty || 0) === 0 && plan.cmlCap >= 4) return 3;
  return plan.cmlCap >= 3 ? 2 : 1;
}

/**
 * Nivel 2 · margen de Δv bien dimensionado (ni corto ni sobrado).
 * 3★ margen entre +3 % y +25 % · 2★ hasta +60 % · 1★ diseño válido pero sobredimensionado.
 */
export function starsLevel2(satellite, mission) {
  if (!satellite?.validated || !mission?.dvRequired) return 0;
  const margin = (satellite.dvAvailable || 0) / mission.dvRequired;
  if (margin >= 1.03 && margin <= 1.25) return 3;
  return margin >= 1 && margin <= 1.6 ? 2 : 1;
}

/**
 * Nivel 3 · inserción orbital.
 * 3★ órbita estable con precisión ±4 % · 2★ órbita estable · 1★ órbita excéntrica · 0 si falló.
 */
export function starsLevel3(journey) {
  if (journey?.outcome === 'orbit') return Math.abs((journey.insertionRatio ?? 1) - 1) <= 0.04 ? 3 : 2;
  return journey?.outcome === 'eccentric' ? 1 : 0;
}

/** Nivel 4 · madurez del concepto: CML 4 → 3★ · 3 → 2★ · 2 → 1★ · 1 → 0. */
export function starsLevel4(report) {
  return Math.max(0, Math.min(3, (report?.cml || 1) - 1));
}

/** ¿El Nivel 3 dejó al CubeSat en órbita? (completa el destino). */
export const reachedOrbit = (journey) => IN_ORBIT.includes(journey?.outcome);
