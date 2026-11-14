// OWNER: Rol 1 — Catálogo de niveles: carga diferida y reglas de desbloqueo.
// Cada nivel se descarga (JS + CSS) solo cuando el jugador lo abre por primera vez.
// Para agregar un nivel: una entrada aquí + su <section id="screen-<id>"> en index.html.

export const LEVELS = [
  {
    id: 'mission',
    icon: '🛰️',
    resource: 'Design and Develop Science Missions',
    css: ['css/screens/mission.css'],
    load: () => import('./screens/mission.js'),
    done: (s) => s.plan.validated,
  },
  {
    id: 'workshop',
    icon: '🔧',
    resource: 'CubeSat 101',
    // El Taller reutiliza .segment-row de mission.css (slider de propelente).
    css: ['css/screens/mission.css', 'css/screens/workshop.css'],
    load: () => import('./screens/workshop.js'),
    done: (s) => s.journey.dvAvailable > 0,
  },
  {
    id: 'journey',
    icon: '🚀',
    resource: 'GMAT / NASA Mission Viz',
    css: ['css/screens/journey.css'],
    load: () => import('./screens/journey.js'),
    done: (s) => s.journey.outcome != null,
  },
  {
    id: 'report',
    icon: '📊',
    resource: 'Concept Maturity Levels (CML)',
    css: ['css/screens/report.css'],
    load: () => import('./screens/report.js'),
    done: (s) => s.report.cml > 0,
  },
];

/** Estado de cada nivel: un nivel se desbloquea al completar el anterior. */
export function levelStatus(state) {
  return LEVELS.map((level, i) => ({
    ...level,
    num: i + 1,
    done: Boolean(level.done(state)),
    unlocked: i === 0 || Boolean(LEVELS[i - 1].done(state)),
  }));
}
