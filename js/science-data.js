// OWNER: Rol 2 — Lógica del Nivel 4 (reporte) sin DOM: CML final, sugerencias y datos científicos simulados.
// Lo usa js/screens/report.js y lo prueba tests/report.test.html.
import { computeCML, CML4_MIN_SCORE, GROUND_FULL, USER_FULL } from './physics.js';

/** Hash simple de texto a entero (FNV-1a), para sembrar el ruido. */
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Generador pseudoaleatorio reproducible (mulberry32): misma semilla → mismos números en [0, 1). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (x, at, width) => Math.exp(-((x - at) ** 2) / (2 * width * width));

/**
 * Señal ideal del modelo en x. Componentes (todas opcionales, ver data/science.json):
 * base + pendiente lineal + onda + bultos gaussianos − bandas de absorción + caída exponencial.
 */
export function signalAt(model, x, [x0, x1]) {
  const u = (x - x0) / (x1 - x0);
  let y = (model.base ?? 0) + (model.slope ?? 0) * u;
  if (model.wave) y += model.wave.amp * Math.sin((2 * Math.PI * x) / model.wave.period);
  for (const b of model.bumps ?? []) y += b.height * gauss(x, b.at, b.width);
  for (const b of model.bands ?? []) y -= b.depth * gauss(x, b.at, b.width);
  if (model.decay) y += model.decay.amp * Math.exp(-(x - x0) / model.decay.scale);
  return y;
}

/** Fracción del recorrido observada en un sobrevuelo: solo una ventana corta alrededor del máximo acercamiento. */
export const FLYBY_WINDOW = 0.3;
/** Resultados en que el CubeSat quedó en órbita (los demás cuentan como fracaso de la inserción). */
export const IN_ORBIT = ['orbit', 'eccentric'];
/** Resultados en que el CubeSat pasó de largo y solo observa una ventana corta. */
export const PASSED_BY = ['flyby', 'no-fuel'];

/** Ruido máximo (con puntaje 0), como fracción del rango de la señal de referencia. */
export const MAX_NOISE = 0.5;

/**
 * Serie simulada de un instrumento.
 * @returns {{ reference: Array<{x:number,y:number}>, measured: Array<{x:number,y:number}> }}
 *  - reference: la curva conceptual inspirada en la misión de la NASA.
 *  - measured: lo que «midió» tu CubeSat: más ruido con menos puntaje; ventana corta en sobrevuelo; nada si chocó.
 */
export function instrumentSeries(def, missionId, score, outcome, rnd = Math.random) {
  const model = def.model[missionId];
  if (!model) return { reference: [], measured: [] };
  const [x0, x1] = def.x;
  const n = def.points;
  const xs = Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1));
  const reference = xs.map((x) => ({ x, y: signalAt(model, x, def.x) }));
  if (outcome === 'crash' || !outcome) return { reference, measured: [] };

  // Relativo al rango de la señal: así una señal sutil (p. ej. reflectancia lunar) no queda tapada por el ruido.
  const ys = reference.map((p) => p.y);
  const span = Math.max(...ys) - Math.min(...ys) || 1;
  const noise = MAX_NOISE * span * (1 - Math.max(0, Math.min(100, score)) / 100);
  let points = reference;
  if (PASSED_BY.includes(outcome)) {
    const from = Math.floor(n * (0.5 - FLYBY_WINDOW / 2));
    points = reference.slice(from, from + Math.max(2, Math.round(n * FLYBY_WINDOW)));
  }
  const measured = points.map(({ x, y }) => ({ x, y: y + (rnd() - 0.5) * 2 * noise }));
  return { reference, measured };
}

/**
 * CML final del reporte = CML por desempeño (computeCML) limitado por el tope del Nivel 1 (plan.cmlCap).
 * reason explica qué lo limita: 'design' | 'insertion' | 'eccentric' | 'science' | 'budget' | 'max'.
 */
export function finalCml({ designValid, outcome, score, cmlCap = 4 }) {
  const base = computeCML({ designValid, launched: true, outcome, scienceScore: score });
  const cap = Math.max(1, Math.min(4, cmlCap ?? 4));
  const cml = Math.min(base, cap);
  let reason;
  if (cml === 4) reason = 'max';
  else if (cap < base) reason = 'budget';
  else if (!designValid) reason = 'design';
  else if (!IN_ORBIT.includes(outcome)) reason = 'insertion';
  else if (outcome === 'eccentric') reason = 'eccentric';
  else reason = 'science';
  return { cml, base, cap, reason };
}

/**
 * Sugerencias para subir de CML: lista de { key, vars } con claves de data/i18n/<lang>/report.json → "hints.<key>".
 * Nunca vacía: si no hay nada concreto que sugerir, devuelve una sugerencia general.
 */
export function improvementHints({ reason, checks = [], outcome, instruments = 0, budget = {}, eventScience = 0, plan = {} }) {
  const hints = [];
  switch (reason) {
    case 'max':
      hints.push({ key: 'max' });
      break;
    case 'budget':
      hints.push({ key: 'budget', vars: { maturity: plan.maturity ?? 0, penalty: plan.penalty ?? 0 } });
      break;
    case 'design':
      for (const c of checks.filter((c) => !c.ok)) hints.push({ key: 'design', vars: { check: c.id } });
      break;
    case 'insertion':
      hints.push({ key: { crash: 'crash', 'no-fuel': 'noFuel' }[outcome] ?? 'flyby' });
      break;
    case 'eccentric':
      hints.push({ key: 'eccentric' });
      break;
    case 'science':
      if (instruments < 4) hints.push({ key: 'instruments' });
      if ((budget.ground ?? 0) < GROUND_FULL) hints.push({ key: 'ground', vars: { full: GROUND_FULL } });
      if ((budget.user ?? 0) < USER_FULL) hints.push({ key: 'user', vars: { full: USER_FULL } });
      if (eventScience < 0) hints.push({ key: 'events', vars: { lost: -eventScience } });
      break;
    default:
      break;
  }
  if (!hints.length) hints.push({ key: 'general', vars: { min: CML4_MIN_SCORE } });
  return hints;
}

/**
 * Puntaje final del reporte: ciencia base + efectos de los eventos, siempre en 0..100.
 * Acepta los dos formatos de evento: Nivel 3 (nivel3/) guarda { id, choice: <índice>, science };
 * la travesía de la app principal guarda { id, choice: { science } }.
 */
export function reportScore(baseScore, events = []) {
  const eventScience = events.reduce((s, e) => s + (e.science ?? e.choice?.science ?? 0), 0);
  return { score: Math.min(100, Math.max(0, baseScore + eventScience)), eventScience };
}
