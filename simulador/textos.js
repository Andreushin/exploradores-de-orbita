// OWNER: Rol 3 (@JU4NMAX) — Simulador de cohetes reales · idioma (ES/EN).
// - `t(clave)` traduce la interfaz.
// - `tr(texto)` traduce los textos que vienen de los DATOS (cohetes.json, ascenso.js y fichas de modelos/index.js),
//   que están escritos en español: busca el texto exacto o un patrón; lo que no conoce lo deja como está.
// El idioma se comparte con el resto del juego (clave `srl-lang`). Prueba de cobertura: simulador/tests/textos.test.mjs.

export const LANG_KEY = 'srl-lang';
let lang = 'es';
try { lang = (globalThis.localStorage?.getItem(LANG_KEY) === 'en') ? 'en' : 'es'; } catch { /* sin almacenamiento */ }

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'es';
  try { globalThis.localStorage?.setItem(LANG_KEY, lang); } catch { /* sin almacenamiento */ }
}

// ═══════════════════════════ Interfaz ═══════════════════════════
const UI = {
  es: {
    brand: 'Exploradores de Órbita',
    title: 'Simulador de cohetes reales',
    skip: 'Saltar al simulador',
    lang: 'EN', langLabel: 'Cambiar idioma a inglés',
    tabs: 'Cohete', canvas: 'Vista 3D del lanzamiento',
    lockedRocket: 'Cohete de tu misión: no se puede cambiar',
    launch: '▶ Lanzar', pause: '⏸ Pausa', resume: '▶ Seguir', reset: '↺ Reiniciar',
    speed: 'Velocidad', camera: 'Cámara', scenery: 'Hora del lanzamiento', payload: 'Carga útil',
    cam: { auto: 'Automática (transmisión)', seguimiento: 'Seguimiento desde tierra', persecucion: 'Persecución', panorama: 'Panorama del complejo', heroica: 'Contrapicado (motores)', torre: 'Torre umbilical', onboard: 'A bordo (fuselaje)', lateral: 'Lateral', libre: 'Libre (arrastra)', global: 'Global (Tierra)' },
    pan: { amanecer: '🌅 Amanecer dorado', dia: '☀️ Mediodía claro', atardecer: '🌇 Crepúsculo carmesí', noche: '🌃 Nocturno (reflectores)' },
    model: '🧩 Ver modelo armado / despiezado',
    logTitle: 'Bitácora del vuelo', logHelp: 'Tiempo simulado y, al lado, el de la misión real cuando hay dato.',
    resultTitle: 'Resultado', resultIdle: 'Lanza el cohete para ver si llega a su destino.',
    sourcesTitle: 'Fuentes, modelo físico y simplificaciones',
    sources: 'Masas, motores y tiempos de NASA (informe de vuelo AS-506 del Apolo 11, JPL/NSSDCA) y fuentes contrastadas para el Atlas-Agena D y el Falcon Heavy. Ascenso en el plano de la trayectoria con gravedad, rotación terrestre, arrastre (atmósfera de NASA Glenn) y programa de cabeceo; salida al destino con la ecuación del cohete y transferencia de Hohmann. Las ondas de telemetría, el humo y la cámara son ilustrativos. Detalle completo en <code>simulador/FUENTES.md</code>.',
    dlgTabs: 'Vista del modelo', assembled: 'Armado', exploded: 'Despiezado', close: 'Cerrar', iframe: 'Modelo 3D del cohete',
    fMission: 'Misión real', fDest: 'Destino', fSite: 'Sitio', fMass: 'Masa al despegar', fPayload: 'Carga real', fStages: 'Etapas y motores', fRoute: 'Ruta real',
    real: '(real)',
    hTime: 'Tiempo', hAlt: 'Altitud', hSpeed: 'Velocidad', hAcc: 'Aceleración', hMass: 'Masa', hThrust: 'Empuje',
    hHint: '💡 Clic en el cohete 3D para inspeccionar etapas',
    layer: { pad: 'En plataforma · Venteo LOX', maxq: '⚡ Régimen transónico (Max-Q)', tropo: 'Troposfera', strato: 'Estratósfera', meso: 'Mesósfera', termo: 'Termósfera', space: '🌌 Espacio (> 100 km · Línea de Kármán)' },
    separated: 'Etapa separada', attached: 'Unida al vehículo', closeInspect: 'Cerrar inspección', focusStage: '🔍 Enfocar etapa',
    logReal: 'real: {t} ({d} %)',
    failTitle: 'Prueba con menos carga útil.',
    orbitOk: '✅ En órbita de espera: {p} × {a} km a {t}.',
    vOrbital: 'Velocidad orbital', mOrbit: 'Masa en órbita', propLeft: 'Propelente restante',
    burn: '🔥 Encender hacia {dest}',
    vDirect: '🚀 ¡Rumbo a {dest}! El encendido da un C3 de {c3} km²/s² y hacían falta {req}.',
    vAssisted: '🪐 No alcanza para ir directo a {dest} (C3 {c3} de {req}), pero sí para la ruta con asistencias gravitatorias. Así lo hizo la misión real: {ruta}.',
    vFail: '❌ Falta energía para llegar a {dest}: C3 {c3} de {req} km²/s². Reduce la carga útil.',
    mC3: 'Energía de salida (C3) hacia {dest}', mC3Assist: 'C3 para la ruta con asistencias (vía Marte)',
    dDv: 'Δv del encendido', dDvReq: 'Δv necesario', dBurn: 'Encendido justo', dHist: '(real {n} s)', dMax: 'Carga máxima', calculating: 'calculando…',
    maxDirect: '{n} kg directo', maxAssist: ' · {n} kg con asistencias',
    noWebgl: 'No se pudo iniciar la vista 3D (WebGL). La simulación, la bitácora y el resultado funcionan igual.',
    loadErr: 'No se pudo cargar el simulador: {msg}. Sírvelo con <code>python3 -m http.server</code>.',
    // Pantalla completa (ajustes ⚙, información ⓘ, cartel de resultado, cámara automática y telemetría)
    settings: 'Ajustes', info: 'Información del vuelo', mission: 'Misión', flight: 'Vuelo',
    closeSettings: 'Cerrar ajustes', closeInfo: 'Cerrar información', closeResult: 'Cerrar resultado',
    camBtn: 'Cambiar cámara (C)', speedTitle: 'Velocidad de reproducción',
    camShort: { auto: 'Auto', persecucion: 'Persecución', seguimiento: 'Seguimiento', onboard: 'A bordo', global: 'Global', heroica: 'Contrapicado', torre: 'Torre', panorama: 'Panorama', lateral: 'Lateral', libre: 'Libre' },
    hAltUnit: 'km de altitud', hSpeedUnit: 'km/s',
    telemetry: 'Telemetría · {cohete}',
    preIgnition: 'Comienza la secuencia de encendido (cohete sujeto en la rampa)',
    bannerOk: '✅ ¡En órbita!', bannerFail: '❌ No llegó a órbita', bannerFailHelp: '{motivo}. Prueba con menos carga en ⚙.',
    dvAvail: 'Δv disponible',
    vWould: '🚀 Con lo que queda alcanzaría {dest}: C3 {c3} de {req} km²/s².',
    vWouldFail: '❌ No alcanzaría {dest}: C3 {c3} de {req} km²/s².',
    maxOnOpen: 'se calcula al abrir este panel',
  },
  en: {
    brand: 'Orbit Explorers',
    title: 'Real rocket simulator',
    skip: 'Skip to the simulator',
    lang: 'ES', langLabel: 'Switch language to Spanish',
    tabs: 'Rocket', canvas: '3D launch view',
    lockedRocket: 'Your mission’s rocket: it cannot be changed',
    launch: '▶ Launch', pause: '⏸ Pause', resume: '▶ Resume', reset: '↺ Reset',
    speed: 'Speed', camera: 'Camera', scenery: 'Launch time', payload: 'Payload',
    cam: { auto: 'Automatic (broadcast)', seguimiento: 'Ground tracking', persecucion: 'Chase', panorama: 'Launch complex overview', heroica: 'Low angle (engines)', torre: 'Umbilical tower', onboard: 'Onboard (fuselage)', lateral: 'Side', libre: 'Free (drag)', global: 'Global (Earth)' },
    pan: { amanecer: '🌅 Golden sunrise', dia: '☀️ Clear noon', atardecer: '🌇 Crimson dusk', noche: '🌃 Night (floodlights)' },
    model: '🧩 View assembled / exploded model',
    logTitle: 'Flight log', logHelp: 'Simulated time and, next to it, the real mission time when available.',
    resultTitle: 'Result', resultIdle: 'Launch the rocket to see if it reaches its destination.',
    sourcesTitle: 'Sources, physics model and simplifications',
    sources: 'Masses, engines and timings from NASA (Apollo 11 AS-506 flight report, JPL/NSSDCA) and cross-checked sources for the Atlas-Agena D and the Falcon Heavy. Ascent in the trajectory plane with gravity, Earth rotation, drag (NASA Glenn atmosphere) and a pitch program; departure to the destination with the rocket equation and a Hohmann transfer. Telemetry waves, smoke and camera work are illustrative. Full detail in <code>simulador/FUENTES.md</code> (in Spanish).',
    dlgTabs: 'Model view', assembled: 'Assembled', exploded: 'Exploded', close: 'Close', iframe: '3D rocket model',
    fMission: 'Real mission', fDest: 'Destination', fSite: 'Site', fMass: 'Liftoff mass', fPayload: 'Real payload', fStages: 'Stages and engines', fRoute: 'Real route',
    real: '(real)',
    hTime: 'Time', hAlt: 'Altitude', hSpeed: 'Speed', hAcc: 'Acceleration', hMass: 'Mass', hThrust: 'Thrust',
    hHint: '💡 Click the 3D rocket to inspect stages',
    layer: { pad: 'On the pad · LOX venting', maxq: '⚡ Transonic regime (Max-Q)', tropo: 'Troposphere', strato: 'Stratosphere', meso: 'Mesosphere', termo: 'Thermosphere', space: '🌌 Space (> 100 km · Kármán line)' },
    separated: 'Stage separated', attached: 'Attached to the vehicle', closeInspect: 'Close inspection', focusStage: '🔍 Focus stage',
    logReal: 'actual: {t} ({d} %)',
    failTitle: 'Try a lighter payload.',
    orbitOk: '✅ In parking orbit: {p} × {a} km at {t}.',
    vOrbital: 'Orbital speed', mOrbit: 'Mass in orbit', propLeft: 'Propellant left',
    burn: '🔥 Burn toward {dest}',
    vDirect: '🚀 Heading for {dest}! The burn gives a C3 of {c3} km²/s² and {req} was needed.',
    vAssisted: '🪐 Not enough to go direct to {dest} (C3 {c3} of {req}), but enough for the gravity-assist route. The real mission did it that way: {ruta}.',
    vFail: '❌ Not enough energy to reach {dest}: C3 {c3} of {req} km²/s². Reduce the payload.',
    mC3: 'Departure energy (C3) toward {dest}', mC3Assist: 'C3 for the gravity-assist route (via Mars)',
    dDv: 'Burn Δv', dDvReq: 'Required Δv', dBurn: 'Exact burn', dHist: '(actual {n} s)', dMax: 'Maximum payload', calculating: 'calculating…',
    maxDirect: '{n} kg direct', maxAssist: ' · {n} kg with assists',
    noWebgl: 'The 3D view could not start (WebGL). The simulation, the log and the result work the same.',
    loadErr: 'The simulator could not load: {msg}. Serve it with <code>python3 -m http.server</code>.',
    // Full screen (settings ⚙, info ⓘ, result banner, automatic camera and telemetry)
    settings: 'Settings', info: 'Flight information', mission: 'Mission', flight: 'Flight',
    closeSettings: 'Close settings', closeInfo: 'Close information', closeResult: 'Close result',
    camBtn: 'Change camera (C)', speedTitle: 'Playback speed',
    camShort: { auto: 'Auto', persecucion: 'Chase', seguimiento: 'Tracking', onboard: 'Onboard', global: 'Global', heroica: 'Low angle', torre: 'Tower', panorama: 'Overview', lateral: 'Side', libre: 'Free' },
    hAltUnit: 'km altitude', hSpeedUnit: 'km/s',
    telemetry: 'Telemetry · {cohete}',
    preIgnition: 'Ignition sequence starts (rocket held on the pad)',
    bannerOk: '✅ In orbit!', bannerFail: '❌ Did not reach orbit', bannerFailHelp: '{motivo}. Try a lighter payload in ⚙.',
    dvAvail: 'Available Δv',
    vWould: '🚀 With what is left it would reach {dest}: C3 {c3} of {req} km²/s².',
    vWouldFail: '❌ It would not reach {dest}: C3 {c3} of {req} km²/s².',
    maxOnOpen: 'calculated when this panel opens',
  },
};

export function t(clave, vars = {}) {
  const buscar = (l) => clave.split('.').reduce((o, k) => o?.[k], UI[l]);
  const v = buscar(lang) ?? buscar('es') ?? clave;
  return String(v).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

// ═══════════════════ Textos de los datos (español → inglés) ═══════════════════
const DICT = {
  // destinos, misiones y sitios (cohetes.json)
  'la Luna': 'the Moon', 'Marte': 'Mars', 'Júpiter': 'Jupiter',
  'Saturno V (AS-506)': 'Saturn V (AS-506)', 'Apolo 11': 'Apollo 11',
  'Nave Apolo (Columbia + Eagle)': 'Apollo spacecraft (Columbia + Eagle)',
  '16 de julio de 1969': 'July 16, 1969', '28 de noviembre de 1964': 'November 28, 1964', '14 de octubre de 2024': 'October 14, 2024',
  'LC-12, Cabo Cañaveral': 'LC-12, Cape Canaveral',
  'asistencias gravitatorias de Marte (2025) y la Tierra (2026); llegada a Júpiter en abril de 2030': 'gravity assists at Mars (2025) and Earth (2026); arrival at Jupiter in April 2030',
  'Falcon Heavy (desechable)': 'Falcon Heavy (expendable)',
  // etapas, piezas y eventos
  'Torre de escape (LES)': 'Launch escape tower (LES)', 'Unidad de instrumentos': 'Instrument unit',
  'S-IC (1.ª etapa)': 'S-IC (1st stage)', 'S-II (2.ª etapa)': 'S-II (2nd stage)', 'S-IVB (3.ª etapa)': 'S-IVB (3rd stage)',
  'Interetapa S-IC/S-II': 'S-IC/S-II interstage', 'Interetapa S-II/S-IVB': 'S-II/S-IVB interstage', 'Interetapa': 'Interstage',
  'Corte del motor central F-1': 'F-1 center engine cutoff', 'Corte del motor central J-2': 'J-2 center engine cutoff',
  'Separación de la S-IC': 'S-IC separation', 'Separación de la S-II': 'S-II separation',
  'Cofia y adaptador de Mariner 4': 'Mariner 4 fairing and adapter',
  'Atlas (1½ etapas)': 'Atlas (1½ stages)', 'Faldón de motores booster': 'Booster engine skirt',
  'Separación del faldón booster (BECO)': 'Booster skirt separation (BECO)',
  'LR105 (sustentador)': 'LR105 (sustainer)',
  'Apagado del sustentador y separación del Atlas': 'Sustainer shutdown and Atlas separation',
  'Cofia de 5.2 m': '5.2 m fairing',
  'Propulsores laterales (2 × 9 Merlin 1D)': 'Side boosters (2 × 9 Merlin 1D)', 'Núcleo central (9 Merlin 1D)': 'Center core (9 Merlin 1D)',
  'Separación de los propulsores laterales': 'Side booster separation',
  'Apagado y separación del núcleo central': 'Center core shutdown and separation',
  '2.ª etapa (Merlin Vacuum)': '2nd stage (Merlin Vacuum)',
  '~45 min después del despegue': '~45 min after liftoff',
  'Despegue': 'Liftoff', 'Inserción en la órbita de espera': 'Insertion into parking orbit',
  'El cohete cayó': 'The rocket fell', 'No llegó a la órbita a tiempo': 'It did not reach orbit in time',
  // notas de incertidumbre (cohetes.json)
  'Residuo del total publicado (117 934 kg) tras restar las etapas, que a su vez salen del mismo total: no es independiente. Efecto: 500→0 kg cambia la carga máxima en 3.6 %.':
    'Remainder of the published total (117,934 kg) after subtracting the stages, which themselves come from the same total: it is not independent. Effect: 500→0 kg changes the maximum payload by 3.6 %.',
  'Ninguna fuente consultada da la masa de la cofia. Efecto: 0→3 000 kg cambia la carga máxima en ±1.5 %.':
    'No consulted source gives the fairing mass. Effect: 0→3,000 kg changes the maximum payload by ±1.5 %.',
  // fichas de inspección (modelos/index.js)
  '1.ª Etapa · S-IC (Boeing)': '1st stage · S-IC (Boeing)',
  '5× Motores Rocketdyne F-1 (RP-1 / LOX)': '5× Rocketdyne F-1 engines (RP-1 / LOX)',
  'Impulsa los primeros 67 km del ascenso con 33.85 MN de empuje al nivel del mar. El motor central se apaga a T+135 s para limitar la aceleración a ~4 g.':
    'Powers the first 67 km of the climb with 33.85 MN of sea-level thrust. The center engine shuts down at T+135 s to limit acceleration to ~4 g.',
  'Altura / Ø': 'Height / Ø', 'Masa seca': 'Dry mass', 'Propelente': 'Propellant', 'Isp (mar / vac)': 'Isp (sea / vac)',
  'Anillo Interetapa S-IC / S-II': 'S-IC / S-II interstage ring',
  'Faldón cilíndrico con motores de ullage': 'Cylindrical skirt with ullage motors',
  'Permanece unido a la 2.ª etapa durante los primeros 30 segundos tras separar la S-IC y luego se desprende en caída libre alrededor de los 5 motores J-2.':
    'It stays attached to the 2nd stage for the first 30 seconds after S-IC separation and then drops away in free fall around the 5 J-2 engines.',
  'Diámetro': 'Diameter', 'Masa': 'Mass', 'Separación': 'Separation', '30 s tras encender S-II': '30 s after S-II ignition',
  'Función': 'Function', 'Separación en dos planos': 'Two-plane separation',
  '2.ª Etapa · S-II (North American)': '2nd stage · S-II (North American)',
  '5× Motores Rocketdyne J-2 (LH2 / LOX)': '5× Rocketdyne J-2 engines (LH2 / LOX)',
  'Etapa criogénica de hidrógeno líquido que acelera el vehículo por la alta atmósfera hasta casi alcanzar la velocidad orbital (~6.9 km/s).':
    'Cryogenic liquid-hydrogen stage that accelerates the vehicle through the upper atmosphere to nearly orbital speed (~6.9 km/s).',
  'Isp (vacío)': 'Isp (vacuum)',
  '3.ª Etapa · S-IVB + Unidad IU (Douglas / IBM)': '3rd stage · S-IVB + IU unit (Douglas / IBM)',
  '1× Motor Rocketdyne J-2 reencendible': '1× restartable Rocketdyne J-2 engine',
  'Completa la inserción en órbita terrestre de espera (185 km) y vuelve a encenderse para la inyección translunar (TLI) rumbo a la Luna.':
    'Completes insertion into a 185 km Earth parking orbit and relights for the translunar injection (TLI) toward the Moon.',
  'Empuje (vac)': 'Thrust (vac)',
  'Nave Apolo · CSM Columbia + LM Eagle': 'Apollo spacecraft · CSM Columbia + LM Eagle',
  'Módulo de Mando/Servicio y Módulo Lunar': 'Command/Service Module and Lunar Module',
  'Transporta a los 3 astronautas hacia la órbita lunar, desciende a la superficie con el Eagle y regresa a la Tierra protegido por su escudo térmico.':
    'Carries the 3 astronauts to lunar orbit, descends to the surface with the Eagle and returns to Earth protected by its heat shield.',
  'Masa total': 'Total mass', 'Tripulación': 'Crew', '3 astronautas': '3 astronauts',
  'Destino': 'Destination', 'Órbita y superficie lunar': 'Lunar orbit and surface', 'Misión': 'Mission', 'Apolo 11 (AS-506)': 'Apollo 11 (AS-506)',
  'Torre de Escape al Lanzamiento (LES)': 'Launch Escape System (LES)',
  'Motor de combustible sólido de emergencia': 'Emergency solid-fuel motor',
  'Diseñada para separar la cápsula Apolo de inmediato ante una anomalía en la rampa o los primeros 90 km. Se desecha a T+197.9 s tras encender la S-II.':
    'Designed to pull the Apollo capsule away immediately in case of an anomaly on the pad or in the first 90 km. It is jettisoned at T+197.9 s after S-II ignition.',
  'Altura': 'Height', 'Descarte': 'Jettison', 'Estado normal': 'Normal state', 'Eyección con motor': 'Motor ejection',
  'Faldón Booster · 2× XLR89-NA-7': 'Booster skirt · 2× XLR89-NA-7',
  'Media etapa desechable de despegue (MA-2)': 'Expendable half-stage for liftoff (MA-2)',
  'Proporciona el empuje principal durante el despegue desde Cabo Cañaveral. A T+130 s (BECO) se apaga y se desliza por rieles fuera del tanque Atlas.':
    'Provides the main thrust at liftoff from Cape Canaveral. At T+130 s (BECO) it shuts down and slides off its rails away from the Atlas tank.',
  'Motores': 'Engines', '2× Rocketdyne LR89': '2× Rocketdyne LR89', 'Empuje (mar)': 'Thrust (sea level)', 'Masa del faldón': 'Skirt mass',
  'Tanque Sustentador · Atlas LV-3A': 'Sustainer tank · Atlas LV-3A',
  'Tanque globo de acero inoxidable + 1× LR105': 'Stainless-steel balloon tank + 1× LR105',
  'Sus paredes de acero son tan delgadas como una moneda y mantienen su forma por presión interna de helio. El motor central LR105 sigue empujando tras soltar los boosters.':
    'Its steel walls are as thin as a coin and keep their shape through internal helium pressure. The central LR105 engine keeps pushing after the boosters are dropped.',
  'Isp sustentador': 'Sustainer Isp',
  'Etapa Superior · Agena D': 'Upper stage · Agena D',
  '1× Motor Bell 8096 (UDMH / IRFNA)': '1× Bell 8096 engine (UDMH / IRFNA)',
  'Etapa hipergólica reencendible: su primer encendido coloca a Mariner 4 en órbita de espera (185 km) y el segundo la inyecta en trayectoria de transferencia a Marte.':
    'Restartable hypergolic stage: its first burn puts Mariner 4 into a 185 km parking orbit and the second injects it onto a transfer trajectory to Mars.',
  'Sonda Interplanetaria Mariner 4 (JPL)': 'Mariner 4 interplanetary probe (JPL)',
  'Primera nave en realizar un sobrevuelo exitoso de Marte': 'First spacecraft to complete a successful flyby of Mars',
  'Bus octogonal de magnesio con 4 paneles solares desplegables, antena parabólica de alta ganancia y cámara de televisión que tomó las primeras fotos cercanas de Marte.':
    'Octagonal magnesium bus with 4 deployable solar panels, a high-gain dish antenna and a television camera that took the first close-up photos of Mars.',
  'Paneles solares': 'Solar panels', '4 alas (6.88 m)': '4 wings (6.88 m)', 'Lanzamiento': 'Launch', '28 nov 1964': 'Nov 28, 1964', 'Sobrevuelo de Marte': 'Mars flyby',
  'Cofia Aerodinámica de Mariner 4': 'Mariner 4 aerodynamic fairing', 'Carenado protector bipartito': 'Two-piece protective shroud',
  'Protege la sonda Mariner 4 del calentamiento aerodinámico y se abre en dos valvas al superar los 110 km de altitud.':
    'Protects the Mariner 4 probe from aerodynamic heating and splits into two halves above 110 km of altitude.',
  'Masa cofia': 'Fairing mass', 'Masa Mariner 4': 'Mariner 4 mass', '110 km de altitud': '110 km altitude',
  'Propulsor Lateral Izquierdo (Side Booster)': 'Left side booster',
  '9× Motores Merlin 1D en disposición Octaweb': '9× Merlin 1D engines in an Octaweb layout',
  'Núcleo derivado del Falcon 9 con cono aerodinámico frontal. Al separarse activa propulsores de nitrógeno frío y despliega sus 4 aletas de rejilla de titanio.':
    'Falcon 9-derived core with an aerodynamic nose cone. On separation it fires cold-nitrogen thrusters and deploys its 4 titanium grid fins.',
  '9× Merlin 1D': '9× Merlin 1D',
  'Propulsor Lateral Derecho (Side Booster)': 'Right side booster',
  'Gemelo del propulsor izquierdo; ambos aportan dos tercios del empuje de despegue antes de separarse en sincronía con apertura en V.':
    'Twin of the left booster; together they supply two thirds of the liftoff thrust before separating in sync in a V-shaped opening.',
  'Núcleo Central (Center Core)': 'Center core',
  '9× Motores Merlin 1D con regulación de empuje': '9× Merlin 1D engines with thrust throttling',
  'Reduce su empuje al 45 % tras el despegue para ahorrar propelente y evitar sobrecargas en Max-Q, y vuelve a subir potencia al separarse los propulsores laterales.':
    'Throttles down to 45 % after liftoff to save propellant and avoid overloads at Max-Q, then throttles back up once the side boosters separate.',
  'Separación real': 'Actual separation',
  '2.ª Etapa · Falcon Heavy Upper Stage': '2nd stage · Falcon Heavy upper stage',
  '1× Motor Merlin 1D Vacuum (tobera de niobio)': '1× Merlin 1D Vacuum engine (niobium nozzle)',
  'Su gran campana radiativa brilla al rojo vivo en el vacío. Realiza un primer encendido hasta la órbita de espera y un segundo encendido para escapar hacia Marte/Júpiter.':
    'Its large radiative bell glows red-hot in the vacuum. It performs a first burn to parking orbit and a second burn to escape toward Mars/Jupiter.',
  'Motor': 'Engine', '1× Merlin Vacuum': '1× Merlin Vacuum',
  'Sonda Interplanetaria Europa Clipper (NASA / JPL)': 'Europa Clipper interplanetary probe (NASA / JPL)',
  'Explorador de la luna oceánica Europa de Júpiter': "Explorer of Jupiter's ocean moon Europa",
  'Equipada con bóveda antirradiación de titanio-aluminio, antena de alta ganancia de 3 m y dos enormes alas solares de 5 paneles que se despliegan tras soltar la cofia.':
    'Equipped with a titanium-aluminum radiation vault, a 3 m high-gain antenna and two huge 5-panel solar wings that deploy after the fairing is jettisoned.',
  'Masa al lanzamiento': 'Launch mass', 'Envergadura solar': 'Solar wingspan', 'Instrumentos': 'Instruments', '9 científicos': '9 scientific',
  'Sistema de Júpiter': 'Jupiter system',
  'Cofia Bipartita (5.2 m) + Europa Clipper': 'Two-piece fairing (5.2 m) + Europa Clipper',
  'Carenado compuesto de fibra de carbono': 'Carbon-fiber composite shroud',
  'Aloja la sonda Europa Clipper (6 065 kg) con sus enormes paneles solares plegados. Se divide en dos mitades al superar los 115 km de altitud.':
    'Houses the Europa Clipper probe (6,065 kg) with its huge solar panels folded. It splits into two halves above 115 km of altitude.',
  'Carga útil': 'Payload', '6 065 kg (Clipper)': '6,065 kg (Clipper)', '115 km de altitud': '115 km altitude',
};

// Patrones con partes variables (eventos de la simulación y sus nombres compuestos)
const PATRONES = [
  [/^Encendido: (.+)$/, (m) => `Ignition: ${tr(m[1])}`],
  [/^Se suelta: (.+)$/, (m) => `Jettison: ${tr(m[1])}`],
  [/^Encendido hacia (.+): (Δv .+)$/, (m) => `Burn toward ${tr(m[1])}: ${m[2]}`],
  [/^Se agotó (.+) antes de llegar a la órbita$/, (m) => `${tr(m[1])} ran out before reaching orbit`],
];

/** Traduce un texto de los datos. En español, o si no se conoce, devuelve el original. */
export function tr(texto) {
  if (lang === 'es' || typeof texto !== 'string') return texto;
  if (DICT[texto] !== undefined) return DICT[texto];
  for (const [re, fn] of PATRONES) { const m = texto.match(re); if (m) return fn(m); }
  if (texto.includes(' + ')) return texto.split(' + ').map(tr).join(' + '); // «Propulsores laterales (…) + Núcleo central (…)»
  return texto;
}

/** Para pruebas de cobertura. */
export const _DICT = DICT;
export const _UI = UI;
