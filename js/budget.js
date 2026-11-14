// OWNER: Rol 3 — Reglas del Nivel 1: tarjetas por segmento (Design and Develop Science Missions).
// Módulo puro (sin DOM): lo usan js/screens/mission.js y tests/budget.test.html.
// Valores en data/segments.json (+ rockets.json para Lanzamiento). Documentación: docs/levelOne.md

export const SEGMENTS = ['launch', 'space', 'ground', 'user'];
/** Pasos del Nivel 1: proyecto → un paso por segmento → revisión. */
export const STEPS = ['project', ...SEGMENTS, 'review'];
const PASSING = new Set(['optimal', 'margin', 'oversized']);

/** Paso 1 completo: nombre, destino y objetivo científico. */
export function projectComplete(state) {
  const plan = state.plan ?? {};
  return Boolean(plan.projectName?.trim() && state.missionId && plan.scienceTargetIdx != null);
}

/**
 * Estado de cada paso para el asistente: { id, unlocked, done }.
 * - Los pasos de segmento se abren al completar el proyecto; están "done" si su tarjeta cumple (aunque sobre).
 * - La revisión se abre cuando hay una tarjeta en cada segmento; está "done" si la misión pasa.
 * @param ev resultado de evaluatePlan(state, data)
 */
export function stepStatus(state, ev) {
  const project = projectComplete(state);
  const allPlaced = SEGMENTS.every((k) => ev.segments[k].card);
  return STEPS.map((id) => {
    if (id === 'project') return { id, unlocked: true, done: project };
    if (id === 'review') return { id, unlocked: project && allPlaced, done: ev.ready };
    return { id, unlocked: project, done: PASSING.has(ev.segments[id].status) };
  });
}

/**
 * Catálogo de tarjetas por segmento. Todas tienen { id, segment, level (1..3), cost, icon, name, desc }.
 * Lanzamiento sale de rockets.json: su nivel es el orden por costo (el más barato = 1).
 */
export function cardCatalog(data) {
  const rockets = [...data.rockets].sort((a, b) => a.cost - b.cost);
  const tag = (segment) => (c) => ({ ...c, segment });
  return {
    launch: rockets.map((r, i) => ({ id: r.id, segment: 'launch', level: i + 1, cost: r.cost, icon: '🚀', name: r.name, desc: r.desc, rocket: r })),
    space: data.segments.cards.space.map(tag('space')),
    ground: data.segments.cards.ground.map(tag('ground')),
    user: data.segments.cards.user.map(tag('user')),
  };
}

/** Nivel mínimo que exige el destino en cada segmento (la ciencia dicta la ingeniería). */
export function requiredLevels(mission, data, catalog = cardCatalog(data)) {
  if (!mission) return null;
  const capable = catalog.launch.filter((c) => c.rocket.destinations.includes(mission.id));
  return {
    launch: capable.length ? Math.min(...capable.map((c) => c.level)) : Infinity,
    space: data.segments.requirements.space[mission.id] ?? 1,
    ground: mission.commsDifficulty ?? 1,
    user: data.segments.requirements.user[mission.id] ?? 1,
  };
}

/** ¿La tarjeta cumple lo que exige el destino? Para cohetes manda la lista real de destinos. */
function fits(card, segment, mission, required) {
  return segment === 'launch' ? card.rocket.destinations.includes(mission.id) : card.level >= required;
}

/**
 * Evalúa la misión configurada.
 * Estado por segmento: 'empty' | 'insufficient' | 'optimal' | 'margin' | 'oversized'.
 * - insufficient: no cumple el destino → bloquea (riesgo de fallo técnico).
 * - margin: hasta `rules.margin[seg]` niveles por encima → aceptable, sin penalización.
 * - oversized: más allá del margen → resta madurez (sobrefinanciación sin justificación).
 * Además, pasarse del presupuesto bloquea y resta madurez.
 * @returns {{ total, spent, available, segments, flags, penalty, maturity, cmlCap, blockers, ready }}
 * Textos: data/i18n/<lang>/mission.json → "flags.*" y "blockers.*".
 */
/** Evalúa una tarjeta colocada frente al destino. Devuelve su estado y, si aplica, una alerta. */
function evaluateSegment(k, card, { mission, req, catalog, rules, penalty }) {
  if (!card) return { status: 'empty' };
  if (!mission) return { status: 'optimal' }; // sin destino aún no hay contra qué evaluar
  if (!fits(card, k, mission, req[k])) {
    return { status: 'insufficient', flag: { kind: 'insufficient', segment: k, points: 0, required: req[k], level: card.level } };
  }
  const maxReasonable = req[k] + rules.margin[k];
  const excess = card.level - maxReasonable;
  if (excess <= 0) return { status: card.level > req[k] ? 'margin' : 'optimal' };
  // Lo que se paga de más frente a la opción más cara que aún sería razonable.
  const reasonable = catalog[k].filter((c) => fits(c, k, mission, req[k]) && c.level <= maxReasonable);
  const extra = card.cost - Math.max(...reasonable.map((c) => c.cost));
  return { status: 'oversized', flag: { kind: 'oversized', segment: k, points: excess * penalty.perExcessLevel, extra } };
}

function collectBlockers(plan, mission, segments, spent, total) {
  const blockers = [];
  if (!plan.projectName?.trim()) blockers.push({ id: 'name' });
  if (!mission) blockers.push({ id: 'mission' });
  else if (plan.scienceTargetIdx == null) blockers.push({ id: 'science' });
  for (const k of SEGMENTS) {
    if (segments[k].status === 'empty') blockers.push({ id: 'missing', segment: k });
    if (segments[k].status === 'insufficient') blockers.push({ id: 'insufficient', segment: k });
  }
  if (spent > total) blockers.push({ id: 'overBudget', over: spent - total });
  return blockers;
}

export function evaluatePlan(state, data) {
  const { rules, penalty, cmlCap } = data.segments;
  const plan = state.plan ?? {};
  const mission = data.missions.find((m) => m.id === state.missionId);
  const catalog = cardCatalog(data);
  const req = requiredLevels(mission, data, catalog);
  const total = mission?.budget ?? state.budget.total;
  const env = { mission, req, catalog, rules, penalty };

  const segments = {};
  const flags = [];
  for (const k of SEGMENTS) {
    const card = catalog[k].find((c) => c.id === plan.cards?.[k]) ?? null;
    const { status, flag } = evaluateSegment(k, card, env);
    if (flag) flags.push(flag);
    segments[k] = { card, status, required: req?.[k] ?? null, cost: card?.cost ?? 0 };
  }

  const spent = SEGMENTS.reduce((s, k) => s + segments[k].cost, 0);
  if (spent > total) {
    const over = spent - total;
    flags.push({ kind: 'overBudget', points: Math.min(penalty.overBudgetCap, Math.ceil(over * penalty.overBudgetPerM)), over, spent, total });
  }

  const totalPenalty = flags.reduce((s, f) => s + f.points, 0);
  const maturity = Math.max(0, 100 - totalPenalty);
  const cap = cmlCap.find((c) => maturity >= c.minMaturity)?.cml ?? 1;
  const blockers = collectBlockers(plan, mission, segments, spent, total);

  return {
    total,
    spent,
    available: total - spent,
    segments,
    flags,
    penalty: totalPenalty,
    maturity,
    cmlCap: cap,
    blockers,
    ready: blockers.length === 0,
  };
}
