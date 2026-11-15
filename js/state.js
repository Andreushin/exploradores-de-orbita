// OWNER: Rol 1 — Estado único del juego.
// CONTRATO: el esquema de abajo es compartido. Para agregar campos, pedirlo al Rol 1.

export const TOTAL_BUDGET = 150; // millones de USD

function initialState() {
  return {
    lang: 'es',
    screen: 'start',       // 'start' | 'levels' | id de nivel (js/levels.js)
    missionId: null,       // id de data/missions.json
    rocketId: null,        // id de data/rockets.json
    budget: {              // millones USD; launch+space+ground+user <= total
      total: TOTAL_BUDGET, // el Nivel 1 lo fija al presupuesto del destino
      launch: 0,           // cada segmento = costo de la tarjeta elegida en el Nivel 1
      space: 0,
      ground: 0,
      user: 0,
    },
    plan: {                // Nivel 1 (Rol 3): decisiones de misión y madurez inicial. Ver docs/niveles/nivel-1.md
      step: 0,             // paso actual del Nivel 1 (índice en STEPS de js/budget.js)
      projectName: '',
      scienceTargetIdx: null, // índice en missions[].scienceTargets
      cards: {                // tarjeta elegida por segmento (ids de js/budget.js → cardCatalog)
        launch: null,         // id de rockets.json (se copia también en rocketId)
        space: null,
        ground: null,
        user: null,
      },
      maturity: 100,          // 0..100 tras penalizaciones por gestión del presupuesto
      penalty: 0,             // puntos restados
      cmlCap: 4,              // tope de CML (1..4) que permite el reparto del presupuesto
      validated: false,       // true al pulsar "Validar misión"
    },
    simulation: {          // Despegue en el simulador de cohetes reales (simulador/), al inicio del Nivel 3
      rocketId: null,      // id de simulador/cohetes.json; el Nivel 1 lo fija al elegir destino (missions[].simRocket.id)
      locked: false,       // Nivel 3: true al abrir el simulador; desde ahí el cohete ya no se cambia
      done: false,         // Nivel 3: true cuando el cohete llegó a órbita (o el jugador saltó el despegue)
      result: null,        // Nivel 3: { ok, perigeoKm, apogeoKm, tiempoS, propRestanteKg } o { skipped: true }
    },
    satellite: {
      formFactor: null,    // id de pieza con category "structure" (ej. "struct-6u")
      pieces: [],          // ids de data/pieces.json
      propellantKg: 0,
    },
    journey: {
      dvAvailable: 0,      // m/s al despegar
      dvUsed: 0,           // m/s gastados en correcciones + inserción
      events: [],          // [{ id, choice }]
      outcome: null,       // 'orbit' | 'eccentric' | 'flyby' | 'crash'
      fuelOut: false,      // Nivel 3: true si la misión falló por agotar el propelente
      propellantLeftKg: 0, // kg de propelente que quedan (Tsiolkovsky con la masa del CubeSat)
    },
    report: {
      score: 0,
      cml: 0,              // 1..4
      scienceData: [],     // puntos para la gráfica
    },
  };
}

let state = initialState();
const listeners = new Set();

export function getState() {
  return state;
}

/** Mezcla superficial por rama: update({ budget: { launch: 70 } }) conserva el resto de budget. */
export function update(patch) {
  const next = { ...state };
  for (const [k, v] of Object.entries(patch)) {
    next[k] = v && typeof v === 'object' && !Array.isArray(v) && state[k] && typeof state[k] === 'object'
      ? { ...state[k], ...v }
      : v;
  }
  state = next;
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reinicia la partida conservando el idioma. */
export function reset() {
  const lang = state.lang;
  state = { ...initialState(), lang };
  listeners.forEach((fn) => fn(state));
}
