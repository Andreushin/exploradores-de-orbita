// OWNER: Rol 1 — Guion de Colibrí, el holograma que cuenta la historia (docs/colibri.md).
// Un solo guion para todo el juego: las páginas de nivel (nivel2/, nivel3/) no cargan data/i18n.
//
// GUION[id] = {
//   es: [páginas], en: [páginas],   ← una o varias páginas de ≤ 110 caracteres, con {variables}
//   prio: 'alta' | 'normal' | 'baja',  ← alta interrumpe (errores del jugador); baja (anécdotas) no hace cola
//   once: true | 'sesion',             ← true: una vez por partida (se borra al reiniciar); 'sesion': una vez por carga
//   mood: 'neutral' | 'feliz' | 'asombro' | 'alerta',
//   vars: ['dest', …],                 ← variables que usa el texto (la prueba lo verifica)
// }
// Convención de ids: <nivel>.<tema>[.<variante>]  →  inicio.hola · n1.project · n4.cml.3
// Personalidad: mentor entusiasta, algo nerd con la ciencia y alentador; analogías de vuelo y de naturaleza.
// Cada dato real (colibríes, CML…) tiene su fuente en docs/fuentes.md → «Colibrí».

export const GUION = {
  // ── Inicio ────────────────────────────────────────────────────────────────
  'inicio.hola': {
    prio: 'normal', once: true, mood: 'feliz',
    es: [
      '¡Hola, explorador! Soy Colibrí, el holograma que te guiará en esta misión.',
      'Un colibrí puede cruzar el golfo de México sin parar con muy poca energía. Tu CubeSat hará algo parecido.',
      'Serán 4 niveles: diseñas la misión, armas el satélite, lo llevas hasta allá y lees tu reporte.',
    ],
    en: [
      'Hi, explorer! I\'m Colibrí, the hologram that will guide you through this mission.',
      'A hummingbird can cross the Gulf of Mexico nonstop on little energy. Your CubeSat will do something similar.',
      'There are 4 levels: design the mission, build the satellite, fly it there and read your report.',
    ],
  },
  'inicio.regreso': {
    prio: 'normal', once: 'sesion', mood: 'feliz', vars: ['n', 'title'],
    es: ['¡Qué bueno verte de vuelta! Retomamos en el Nivel {n}: {title}.'],
    en: ['Great to see you again! We pick up at Level {n}: {title}.'],
  },
  'inicio.completo': {
    prio: 'normal', once: 'sesion', mood: 'asombro',
    es: ['¡Completaste todos los niveles! Puedes rediseñar tu misión o empezar una nueva.'],
    en: ['You completed every level! You can redesign your mission or start a new one.'],
  },

  // ── Selector de niveles ───────────────────────────────────────────────────
  'levels.hola': {
    prio: 'normal', once: true, mood: 'neutral',
    es: ['Cada nivel es una etapa real del diseño de una misión. Termina uno para abrir el siguiente.'],
    en: ['Each level is a real stage of mission design. Finish one to unlock the next.'],
  },

  // ── Nivel 1 · Diseña tu misión (un beat por paso, ver STEPS en js/budget.js) ───
  'n1.project': {
    prio: 'normal', once: true, mood: 'neutral',
    es: ['Todo empieza con una pregunta: ¿qué quieres descubrir? Primero la ciencia, después la ingeniería.'],
    en: ['It all starts with a question: what do you want to discover? Science first, engineering second.'],
  },
  'n1.launch': {
    prio: 'normal', once: true, mood: 'neutral',
    es: ['El cohete decide cuánta masa llevas y qué tan lejos llegas. Más potencia cuesta más presupuesto.'],
    en: ['The rocket decides how much mass you carry and how far you go. More power costs more budget.'],
  },
  'n1.space': {
    prio: 'normal', once: true, mood: 'neutral',
    es: ['Aquí va tu satélite. Todo lo que lleve a bordo se paga con dinero, masa y energía.'],
    en: ['Here goes your satellite. Everything on board is paid for with money, mass and power.'],
  },
  'n1.ground': {
    prio: 'normal', once: true, mood: 'neutral',
    es: ['Un mensaje que nadie escucha no sirve de nada: las antenas en Tierra reciben tus datos.'],
    en: ['A message nobody hears is useless: ground antennas are what receive your data.'],
  },
  'n1.user': {
    prio: 'normal', once: true, mood: 'neutral',
    es: ['¿Quién usará tus datos? Sin usuarios, hasta la mejor ciencia se queda sin destino.'],
    en: ['Who will use your data? Without users, even great science has nowhere to go.'],
  },
  'n1.review': {
    prio: 'normal', once: true, mood: 'neutral',
    es: ['Último vistazo. Lo que falta arriesga la misión; lo que sobra sin razón baja tu madurez (CML).'],
    en: ['One last look. What\'s missing risks the mission; what\'s oversized for no reason lowers your maturity (CML).'],
  },
  'n1.sobregasto': {
    prio: 'alta', mood: 'alerta',
    es: ['Te pasaste del presupuesto. Cada millón extra sale de otro segmento: ¡reacomoda con calma!'],
    en: ['You\'re over budget. Every extra million comes from another segment: rebalance calmly!'],
  },
  'n1.insuficiente': {
    prio: 'alta', mood: 'alerta', vars: ['seg'],
    es: ['La tarjeta elegida en «{seg}» se queda corta para tu objetivo. Una más potente lo arregla.'],
    en: ['The card you picked in “{seg}” falls short of your goal. A stronger one fixes it.'],
  },

  // ── Nivel 4 · Reporte ─────────────────────────────────────────────────────
  'n4.hola.orbit': {
    prio: 'normal', once: true, mood: 'asombro', vars: ['dest'],
    es: ['¡ÓRBITA! Tu CubeSat ya estudia su destino: {dest}. Esto es hacer ciencia de verdad.'],
    en: ['ORBIT! Your CubeSat is now studying its destination: {dest}. This is real science.'],
  },
  'n4.hola.eccentric': {
    prio: 'normal', once: true, mood: 'neutral', vars: ['dest'],
    es: ['Quedaste en una órbita alargada ({dest}): hay datos, pero llegan a ratos. ¡Se puede afinar!'],
    en: ['You\'re in a stretched orbit ({dest}): data arrives in bursts. You can fine-tune it!'],
  },
  'n4.hola.flyby': {
    prio: 'normal', once: true, mood: 'neutral', vars: ['dest'],
    es: ['Pasaste de largo ({dest}): frenaste poco. Hay pocos datos, ¡pero ya sabes cómo mejorar!'],
    en: ['You flew past ({dest}): not enough braking. Little data, but now you know how to improve!'],
  },
  'n4.hola.crash': {
    prio: 'normal', once: true, mood: 'alerta',
    es: ['Frenaste de más y el CubeSat se perdió. Ni el mejor colibrí acierta siempre: ¡otra vez!'],
    en: ['Too much braking and the CubeSat was lost. Even the best hummingbird misses sometimes: try again!'],
  },
  'n4.hola.no-fuel': {
    prio: 'normal', once: true, mood: 'alerta',
    es: ['Se acabó el propelente antes de frenar. Menos masa pide menos combustible: el Taller te espera.'],
    en: ['You ran out of propellant before braking. Less mass needs less fuel: the Workshop awaits.'],
  },
  'n4.cml.1': {
    prio: 'normal', once: true, mood: 'neutral',
    es: ['CML 1, idea en servilleta: el diseño aún no cumple las restricciones. Es un primer paso, ¡sigue!'],
    en: ['CML 1, idea on a napkin: the design doesn\'t meet the constraints yet. It\'s a first step, keep going!'],
  },
  'n4.cml.2': {
    prio: 'normal', once: true, mood: 'neutral',
    es: ['CML 2, factibilidad inicial: el diseño es posible, pero la misión no logró quedarse en órbita.'],
    en: ['CML 2, initial feasibility: the design is possible, but the mission didn\'t stay in orbit.'],
  },
  'n4.cml.3': {
    prio: 'normal', once: true, mood: 'feliz',
    es: ['CML 3, espacio de compromisos: la misión funciona y aún hay mejoras de órbita o de ciencia.'],
    en: ['CML 3, trade space: the mission works and there\'s still room to improve orbit or science.'],
  },
  'n4.cml.4': {
    prio: 'normal', once: true, mood: 'asombro',
    es: ['CML 4, diseño puntual: cumple tus objetivos con buen margen. ¡Nivel máximo del juego!'],
    en: ['CML 4, point design: it meets your goals with a good margin. Top level of the game!'],
  },
  'n4.mejorar': {
    prio: 'normal', once: true, mood: 'feliz',
    es: ['Mira las sugerencias del reporte: pequeños ajustes suben tu madurez. ¡Rediseña y vuelve a volar!'],
    en: ['Check the report\'s suggestions: small tweaks raise your maturity. Redesign and fly again!'],
  },
  'n4.cierre': {
    prio: 'normal', once: true, mood: 'feliz',
    es: ['Gracias por explorar conmigo. Cada misión real empezó como una idea, ¡como la tuya!'],
    en: ['Thanks for exploring with me. Every real mission started as an idea, just like yours!'],
  },
};

// «AHORA / LUEGO»: se queda fijo bajo Colibrí y responde «¿qué hago?» y «¿qué sigue?» aunque se le silencie.
// OBJETIVOS[clave] = { ahora: {es, en}, luego: {es, en} }, con ≤ 70 caracteres por texto.
const O = (ahoraEs, ahoraEn, luegoEs, luegoEn) => ({ ahora: { es: ahoraEs, en: ahoraEn }, luego: { es: luegoEs, en: luegoEn } });

export const OBJETIVOS = {
  start: O('Pulsa «Comenzar» (o «Continuar»)', 'Press “Start” (or “Continue”)', 'Nivel 1: diseñar tu misión', 'Level 1: design your mission'),
  levels: O('Elige un nivel disponible', 'Pick an available level', 'Cada nivel abre el siguiente', 'Each level unlocks the next'),
  'n1.project': O('Nombra tu misión y elige destino y objetivo', 'Name your mission, pick a destination and goal', 'Elegir tu cohete', 'Choose your rocket'),
  'n1.launch': O('Elige la tarjeta de Lanzamiento', 'Pick the Launch card', 'Equipar el segmento Espacio', 'Equip the Space segment'),
  'n1.space': O('Elige la tarjeta de Espacio', 'Pick the Space card', 'Segmento Tierra', 'Ground segment'),
  'n1.ground': O('Elige la tarjeta de Tierra', 'Pick the Ground card', 'Segmento Usuario', 'User segment'),
  'n1.user': O('Elige la tarjeta de Usuario', 'Pick the User card', 'Revisar tu misión', 'Review your mission'),
  'n1.review': O('Revisa el presupuesto y la madurez', 'Check the budget and maturity', 'Nivel 2: armar el CubeSat', 'Level 2: build the CubeSat'),
  report: O('Lee tu reporte y tu CML', 'Read your report and your CML', 'Mejorar tu diseño o empezar otra misión', 'Improve your design or start a new mission'),
};
