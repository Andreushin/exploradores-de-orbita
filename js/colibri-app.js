// OWNER: Rol 1 — Colibrí en la app principal: Inicio, selector de niveles, Nivel 1 y Reporte (docs/colibri.md).
// Solo LEE el estado de js/state.js: no toca mission.js ni report.js. Lo carga js/main.js con import() dinámico, así que si algo
// falla el juego sigue sin Colibrí. La lógica de «qué decir y cuándo» está en funciones puras (snapshot, enterScreen, changes)
// para probarla en Node: tests/colibri.test.mjs.
import { createColibri, forgetColibri } from './colibri.js';
import { STEPS, SEGMENTS, evaluatePlan } from './budget.js';
import { hasProgress, resumeLevel } from './levels.js';

/** Lo que Colibrí necesita saber del estado. Comparar dos fotos dice qué cambió. */
export function snapshot(state, { data, t, tx }) {
  const plan = state.plan ?? {};
  const mission = data?.missions?.find((m) => m.id === state.missionId);
  let over = false;
  let insufficient = [];
  if (state.screen === 'mission' && mission) { // la evaluación solo cuenta mientras se arma el plan
    try {
      const ev = evaluatePlan(state, data);
      over = ev.spent > ev.total;
      insufficient = SEGMENTS.filter((k) => ev.segments[k].status === 'insufficient');
    } catch { /* datos a medias: sin reacciones */ }
  }
  const next = resumeLevel(state);
  return {
    screen: state.screen,
    lang: state.lang,
    progress: hasProgress(state),
    resume: next ? { num: next.num, title: t(`menu.levels.items.${next.id}.title`) } : null,
    step: STEPS[plan.step ?? 0] ?? STEPS[0],
    over,
    insufficient,
    segLabels: Object.fromEntries(SEGMENTS.map((k) => [k, t(`mission.sections.${k}.title`)])),
    outcome: state.journey?.outcome ?? null,
    cml: state.report?.cml ?? 0,
    dest: mission ? tx(mission.name) : '',
  };
}

/** Al entrar a una pantalla: «AHORA / LUEGO», tamaño y lo que dice (una lista de [id, vars]). */
export function enterScreen(s) {
  switch (s.screen) {
    case 'start': {
      const say = !s.progress ? [['inicio.hola']] : s.resume ? [['inicio.regreso', { n: s.resume.num, title: s.resume.title }]] : [['inicio.completo']];
      return { goal: 'start', tam: 'grande', say };
    }
    case 'levels': return { goal: 'levels', say: [['levels.hola']] };
    case 'mission': return { goal: `n1.${s.step}`, say: [[`n1.${s.step}`]] };
    case 'report': {
      // El Reporte escribe su CML al montarse: cuando Colibrí entra, ya está en el estado.
      const say = s.outcome ? [[`n4.hola.${s.outcome}`, { dest: s.dest }]] : [];
      if (s.cml > 0) say.push([`n4.cml.${s.cml}`], [s.cml >= 4 ? 'n4.cierre' : 'n4.mejorar']);
      return { goal: 'report', say };
    }
    default: return { goal: null, say: [] };
  }
}

/** Mientras el jugador sigue en la misma pantalla: nuevo paso del Nivel 1, sobregasto, tarjeta que se queda corta. */
export function changes(prev, next) {
  const out = { say: [], react: [] };
  if (!prev || prev.screen !== next.screen) return out; // entrar a una pantalla lo resuelve enterScreen
  if (next.screen === 'mission') {
    if (prev.step !== next.step) { out.say.push([`n1.${next.step}`]); out.goal = `n1.${next.step}`; out.clear = true; } // paso nuevo: lo del anterior ya no viene al caso
    if (!prev.over && next.over) out.react.push(['n1.sobregasto']);
    for (const k of next.insufficient) if (!prev.insufficient.includes(k)) out.react.push(['n1.insuficiente', { seg: next.segLabels[k] }]);
  }
  return out;
}

/** Arranca a Colibrí en la app principal. → { onScreen(id), forget(), destroy() } */
export function startColibriApp({ getState, subscribe, data, t, tx }) {
  const colibri = createColibri({ getLang: () => getState().lang });
  const snap = () => snapshot(getState(), { data, t, tx });
  let prev = snap();
  let entered = null; // pantalla en la que ya entró: antes de eso, los cambios de estado no son suyos
  let fresh = false;  // true tras «Reiniciar»: la misma pantalla vuelve a recibirlo como si fuera nueva

  const run = (plan) => {
    if (plan.clear) colibri.clear();
    if (plan.goal !== undefined) colibri.setGoal(plan.goal);
    for (const [id, vars] of plan.say ?? []) colibri.say(id, vars);
    for (const [id, vars] of plan.react ?? []) colibri.react(id, vars);
  };

  // Colibrí es un extra: esta función corre dentro de update() del estado, así que si algo falla aquí no puede romper el juego.
  let broken = false;
  const guard = (fn) => (...args) => {
    if (broken) return;
    try { fn(...args); } catch (err) { broken = true; console.warn('Colibrí se desactivó:', err); }
  };

  const unsubscribe = subscribe(guard(() => {
    const s = snap();
    if (s.lang !== prev.lang) colibri.setLang(s.lang);
    if (s.screen === entered) run(changes(prev, s));
    prev = s;
  }));

  return {
    /** js/main.js lo llama cuando una pantalla ya está montada (y también al arrancar). */
    onScreen: guard((id) => {
      if (id === entered && !fresh) return; // re-montaje por cambio de idioma: setLang ya repintó lo que hace falta
      fresh = false;
      const s = snap();
      entered = id;
      prev = s;
      const plan = enterScreen(s);
      colibri.clear(); // lo que se decía en la pantalla anterior ya no viene al caso
      // En pantallas anchas el Inicio deja libre el pie de página; en angostas, lo más abajo posible para no tapar «Comenzar».
      const wide = globalThis.matchMedia?.('(min-width: 900px)').matches;
      colibri.float({ tam: plan.tam ?? 'normal', y: plan.tam === 'grande' && wide ? '56px' : '12px' });
      run(plan);
    }),
    /** «Reiniciar» / «Nueva misión»: Colibrí vuelve a contar la historia desde el principio. */
    forget() { forgetColibri(); fresh = true; },
    destroy() { unsubscribe(); colibri.destroy(); },
  };
}
