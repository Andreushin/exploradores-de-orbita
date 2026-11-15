// OWNER: Rol 3 (@JU4NMAX) — Arma los modelos 3D con cada etapa y pieza desprendible como grupo separable.
// Incluye cofias bipartitas (clamshell en 2 mitades), anillo interetapa S-IC/S-II y las sondas
// espaciales (Mariner 4 y Europa Clipper) con paneles solares articulados dentro de la cofia.
import { construir as saturnoV } from './saturno-v.js?v=9';
import { construir as atlasAgena } from './atlas-agena-d.js?v=9';
import { construir as falconHeavy } from './falcon-heavy.js?v=9';

/** Radio aproximado de la geometría de una pieza (para distinguir faldones y cuerpos anchos). */
function radioPieza(obj) {
  const p = obj.geometry?.parameters;
  if (!p) return 0;
  return Math.max(p.radiusTop ?? 0, p.radiusBottom ?? 0, p.radius ?? 0);
}

// Reglas: la primera que coincide gana. `p` = { x, y, r } de cada pieza en coordenadas del modelo.
export const MODELOS = {
  'saturno-v': {
    construir: saturnoV,
    alturaReal: 110.6,
    etapas: [
      { id: 'les', regla: (p) => p.y >= 15.0 },
      { id: 'nave', regla: (p) => p.y >= 9.45 },
      { id: 's-ivb', regla: (p) => p.y >= 5.2 },
      { id: 's-ii', regla: (p) => p.y >= -2.8 },
      { id: 'inter-1', regla: () => false }, // anillo interetapa generado para la suelta a T+194 s
      { id: 's-ic', regla: () => true },
    ],
  },
  'atlas-agena-d': {
    construir: atlasAgena,
    alturaReal: 28.4, // Atlas-Agena D completo: 93 ft (ver FUENTES.md)
    etapas: [
      { id: 'cofia', regla: (p) => p.y >= 12.0 },
      { id: 'cofia-izq', regla: () => false },
      { id: 'cofia-der', regla: () => false },
      { id: 'nave', regla: () => false }, // Sonda Mariner 4 alojada dentro de la cofia
      { id: 'agena', regla: (p) => p.y >= 8.0 },
      { id: 'booster', regla: (p) => p.y < -6.5 && (Math.abs(p.x) > 0.3 || p.r > 1.6) },
      { id: 'atlas', regla: () => true },
    ],
  },
  'falcon-heavy': {
    construir: falconHeavy,
    alturaReal: 70.0,
    etapas: [
      { id: 'lateral-izq', regla: (p) => p.x < -1.5 },
      { id: 'lateral-der', regla: (p) => p.x > 1.5 },
      { id: 'cofia', regla: (p) => p.y >= 12.0 },
      { id: 'cofia-izq', regla: () => false },
      { id: 'cofia-der', regla: () => false },
      { id: 'nave', regla: () => false }, // Sonda Europa Clipper alojada dentro de la cofia
      { id: 'segunda', regla: (p) => p.y >= 7.0 },
      { id: 'central', regla: () => true },
    ],
  },
};

/** Qué grupos 3D se sueltan con cada evento de la simulación (fase o ítem de cohetes.json). */
export const SUELTAS = {
  'saturno-v': {
    's-ic': ['s-ic'],
    'inter-1': ['inter-1'],
    les: ['les'],
    's-ii': ['s-ii'],
  },
  'atlas-agena-d': {
    booster: ['booster'],
    cofia: ['cofia-izq', 'cofia-der'],
    atlas: ['atlas'],
  },
  'falcon-heavy': {
    laterales: ['lateral-izq', 'lateral-der'],
    cofia: ['cofia-izq', 'cofia-der'],
    central: ['central'],
  },
};

/** Información técnica de cada etapa 3D para la tarjeta de inspección interactiva. */
export const INFO_ETAPAS = {
  'saturno-v': {
    's-ic': {
      titulo: '1.ª Etapa · S-IC (Boeing)',
      subtitulo: '5× Motores Rocketdyne F-1 (RP-1 / LOX)',
      detalle: 'Impulsa los primeros 67 km del ascenso con 33.85 MN de empuje al nivel del mar. El motor central se apaga a T+135 s para limitar la aceleración a ~4 g.',
      datos: [['Altura / Ø', '42.1 m × 10.1 m'], ['Masa seca', '166.5 t'], ['Propelente', '2 071.7 t'], ['Isp (mar / vac)', '263 / 304 s']],
    },
    'inter-1': {
      titulo: 'Anillo Interetapa S-IC / S-II',
      subtitulo: 'Faldón cilíndrico con motores de ullage',
      detalle: 'Permanece unido a la 2.ª etapa durante los primeros 30 segundos tras separar la S-IC y luego se desprende en caída libre alrededor de los 5 motores J-2.',
      datos: [['Diámetro', '10.1 m'], ['Masa', '5 206 kg'], ['Separación', '30 s tras encender S-II'], ['Función', 'Separación en dos planos']],
    },
    's-ii': {
      titulo: '2.ª Etapa · S-II (North American)',
      subtitulo: '5× Motores Rocketdyne J-2 (LH2 / LOX)',
      detalle: 'Etapa criogénica de hidrógeno líquido que acelera el vehículo por la alta atmósfera hasta casi alcanzar la velocidad orbital (~6.9 km/s).',
      datos: [['Altura / Ø', '24.9 m × 10.1 m'], ['Masa seca', '36.2 t'], ['Propelente', '444.8 t'], ['Isp (vacío)', '421 s']],
    },
    's-ivb': {
      titulo: '3.ª Etapa · S-IVB + Unidad IU (Douglas / IBM)',
      subtitulo: '1× Motor Rocketdyne J-2 reencendible',
      detalle: 'Completa la inserción en órbita terrestre de espera (185 km) y vuelve a encenderse para la inyección translunar (TLI) rumbo a la Luna.',
      datos: [['Altura / Ø', '17.8 m × 6.6 m'], ['Masa seca', '11.2 t'], ['Propelente', '107.9 t'], ['Empuje (vac)', '1 033 kN']],
    },
    nave: {
      titulo: 'Nave Apolo · CSM Columbia + LM Eagle',
      subtitulo: 'Módulo de Mando/Servicio y Módulo Lunar',
      detalle: 'Transporta a los 3 astronautas hacia la órbita lunar, desciende a la superficie con el Eagle y regresa a la Tierra protegido por su escudo térmico.',
      datos: [['Masa total', '45 693 kg'], ['Tripulación', '3 astronautas'], ['Destino', 'Órbita y superficie lunar'], ['Misión', 'Apolo 11 (AS-506)']],
    },
    les: {
      titulo: 'Torre de Escape al Lanzamiento (LES)',
      subtitulo: 'Motor de combustible sólido de emergencia',
      detalle: 'Diseñada para separar la cápsula Apolo de inmediato ante una anomalía en la rampa o los primeros 90 km. Se desecha a T+197.9 s tras encender la S-II.',
      datos: [['Masa', '4 200 kg'], ['Altura', '10.2 m'], ['Descarte', 'T+3:18'], ['Estado normal', 'Eyección con motor']],
    },
  },
  'atlas-agena-d': {
    booster: {
      titulo: 'Faldón Booster · 2× XLR89-NA-7',
      subtitulo: 'Media etapa desechable de despegue (MA-2)',
      detalle: 'Proporciona el empuje principal durante el despegue desde Cabo Cañaveral. A T+130 s (BECO) se apaga y se desliza por rieles fuera del tanque Atlas.',
      datos: [['Motores', '2× Rocketdyne LR89'], ['Empuje (mar)', '1 263 kN'], ['Masa del faldón', '3 050 kg'], ['Separación', 'T+2:10']],
    },
    atlas: {
      titulo: 'Tanque Sustentador · Atlas LV-3A',
      subtitulo: 'Tanque globo de acero inoxidable + 1× LR105',
      detalle: 'Sus paredes de acero son tan delgadas como una moneda y mantienen su forma por presión interna de helio. El motor central LR105 sigue empujando tras soltar los boosters.',
      datos: [['Diámetro', '3.05 m'], ['Masa seca', '2 347 kg'], ['Propelente', '104 955 kg'], ['Isp sustentador', '220 / 309 s']],
    },
    agena: {
      titulo: 'Etapa Superior · Agena D',
      subtitulo: '1× Motor Bell 8096 (UDMH / IRFNA)',
      detalle: 'Etapa hipergólica reencendible: su primer encendido coloca a Mariner 4 en órbita de espera (185 km) y el segundo la inyecta en trayectoria de transferencia a Marte.',
      datos: [['Masa seca', '673 kg'], ['Propelente', '6 148 kg'], ['Empuje (vac)', '71.2 kN'], ['Isp (vacío)', '300 s']],
    },
    nave: {
      titulo: 'Sonda Interplanetaria Mariner 4 (JPL)',
      subtitulo: 'Primera nave en realizar un sobrevuelo exitoso de Marte',
      detalle: 'Bus octogonal de magnesio con 4 paneles solares desplegables, antena parabólica de alta ganancia y cámara de televisión que tomó las primeras fotos cercanas de Marte.',
      datos: [['Masa', '260.7 kg'], ['Paneles solares', '4 alas (6.88 m)'], ['Lanzamiento', '28 nov 1964'], ['Destino', 'Sobrevuelo de Marte']],
    },
    cofia: {
      titulo: 'Cofia Aerodinámica de Mariner 4',
      subtitulo: 'Carenado protector bipartito',
      detalle: 'Protege la sonda Mariner 4 del calentamiento aerodinámico y se abre en dos valvas al superar los 110 km de altitud.',
      datos: [['Masa cofia', '500 kg'], ['Masa Mariner 4', '260.7 kg'], ['Descarte', '110 km de altitud'], ['Destino', 'Sobrevuelo de Marte']],
    },
  },
  'falcon-heavy': {
    'lateral-izq': {
      titulo: 'Propulsor Lateral Izquierdo (Side Booster)',
      subtitulo: '9× Motores Merlin 1D en disposición Octaweb',
      detalle: 'Núcleo derivado del Falcon 9 con cono aerodinámico frontal. Al separarse activa propulsores de nitrógeno frío y despliega sus 4 aletas de rejilla de titanio.',
      datos: [['Motores', '9× Merlin 1D'], ['Empuje (mar)', '7 605 kN'], ['Masa seca', '25.6 t'], ['Propelente', '395.7 t']],
    },
    'lateral-der': {
      titulo: 'Propulsor Lateral Derecho (Side Booster)',
      subtitulo: '9× Motores Merlin 1D en disposición Octaweb',
      detalle: 'Gemelo del propulsor izquierdo; ambos aportan dos tercios del empuje de despegue antes de separarse en sincronía con apertura en V.',
      datos: [['Motores', '9× Merlin 1D'], ['Empuje (mar)', '7 605 kN'], ['Masa seca', '25.6 t'], ['Propelente', '395.7 t']],
    },
    central: {
      titulo: 'Núcleo Central (Center Core)',
      subtitulo: '9× Motores Merlin 1D con regulación de empuje',
      detalle: 'Reduce su empuje al 45 % tras el despegue para ahorrar propelente y evitar sobrecargas en Max-Q, y vuelve a subir potencia al separarse los propulsores laterales.',
      datos: [['Motores', '9× Merlin 1D'], ['Masa seca', '25.6 t'], ['Propelente', '395.7 t'], ['Separación real', 'T+4:11 (251 s)']],
    },
    segunda: {
      titulo: '2.ª Etapa · Falcon Heavy Upper Stage',
      subtitulo: '1× Motor Merlin 1D Vacuum (tobera de niobio)',
      detalle: 'Su gran campana radiativa brilla al rojo vivo en el vacío. Realiza un primer encendido hasta la órbita de espera y un segundo encendido para escapar hacia Marte/Júpiter.',
      datos: [['Motor', '1× Merlin Vacuum'], ['Empuje (vac)', '981 kN'], ['Isp (vacío)', '348 s'], ['Propelente', '107.5 t']],
    },
    nave: {
      titulo: 'Sonda Interplanetaria Europa Clipper (NASA / JPL)',
      subtitulo: 'Explorador de la luna oceánica Europa de Júpiter',
      detalle: 'Equipada con bóveda antirradiación de titanio-aluminio, antena de alta ganancia de 3 m y dos enormes alas solares de 5 paneles que se despliegan tras soltar la cofia.',
      datos: [['Masa al lanzamiento', '6 065 kg'], ['Envergadura solar', '30.5 m'], ['Instrumentos', '9 científicos'], ['Destino', 'Sistema de Júpiter']],
    },
    cofia: {
      titulo: 'Cofia Bipartita (5.2 m) + Europa Clipper',
      subtitulo: 'Carenado compuesto de fibra de carbono',
      detalle: 'Aloja la sonda Europa Clipper (6 065 kg) con sus enormes paneles solares plegados. Se divide en dos mitades al superar los 115 km de altitud.',
      datos: [['Diámetro', '5.2 m'], ['Masa cofia', '1 900 kg'], ['Carga útil', '6 065 kg (Clipper)'], ['Descarte', '115 km de altitud']],
    },
  },
};
INFO_ETAPAS['atlas-agena-d']['cofia-izq'] = INFO_ETAPAS['atlas-agena-d'].cofia;
INFO_ETAPAS['atlas-agena-d']['cofia-der'] = INFO_ETAPAS['atlas-agena-d'].cofia;
INFO_ETAPAS['falcon-heavy']['cofia-izq'] = INFO_ETAPAS['falcon-heavy'].cofia;
INFO_ETAPAS['falcon-heavy']['cofia-der'] = INFO_ETAPAS['falcon-heavy'].cofia;

/** Divide las piezas de la cofia en dos valvas (izquierda y derecha) para abrirse en bisagra. */
function dividirCofiaEnValvas(THREE, cofiaOriginal, cofiaIzq, cofiaDer) {
  for (const pieza of [...cofiaOriginal.children]) {
    const p = pieza.geometry?.parameters;
    if (!p) continue;
    for (const [lado, dest, thetaStart] of [[-1, cofiaIzq, Math.PI * 0.5], [1, cofiaDer, -Math.PI * 0.5]]) {
      let geo;
      if (pieza.geometry.type === 'SphereGeometry') {
        geo = new THREE.SphereGeometry(p.radius, 16, 8, thetaStart, Math.PI, 0, Math.PI / 2);
      } else {
        geo = new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, 20, 1, false, thetaStart, Math.PI);
      }
      const m = new THREE.Mesh(geo, pieza.material);
      m.position.copy(pieza.position);
      m.position.x += lado * 0.01;
      dest.add(m);
    }
    cofiaOriginal.remove(pieza);
  }
}

/** Construye la sonda Mariner 4 o Europa Clipper con paneles solares plegados que se despliegan en órbita. */
function construirSondaInterna(THREE, id, etapas, alasSolares) {
  const g = etapas.nave;
  if (!g) return;
  const matOro = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.28, metalness: 0.82 });
  const matPlata = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.78 });
  const matPanel = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3, metalness: 0.5, side: THREE.DoubleSide });
  const matAntena = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.3 });

  if (id === 'atlas-agena-d') {
    // Mariner 4 sobre el adaptador de Agena (y ≈ 11.6..13.5 en coords del modelo)
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.45, 8), matOro);
    bus.position.y = 11.95;
    const plato = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.08, 0.18, 16, 1, true), matAntena);
    plato.position.set(0.12, 12.32, 0);
    const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 8), matPlata);
    mastil.position.y = 12.75;
    g.add(bus, plato, mastil);

    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const piv = new THREE.Group();
      piv.position.set(Math.cos(ang) * 0.4, 12.0, Math.sin(ang) * 0.4);
      piv.rotation.y = -ang;
      const ala = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.03, 0.26), matPanel);
      ala.position.x = 0.48;
      piv.add(ala);
      // Empieza plegada hacia arriba dentro de la cofia (rotación Z = +1.42 rad)
      piv.rotation.z = 1.42;
      g.add(piv);
      alasSolares.push({ pivote: piv, rotPlegada: 1.42, rotDesplegada: 0 });
    }
  } else if (id === 'falcon-heavy') {
    // Europa Clipper dentro de la cofia de 5.2 m (y ≈ 11.9..15.8 en coords del modelo)
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.62, 2.2, 20), matOro);
    cuerpo.position.y = 13.1;
    const boveda = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.65, 20), matPlata);
    boveda.position.y = 14.35;
    const antenaHGA = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.12, 0.32, 24, 1, true), matAntena);
    antenaHGA.position.set(0, 14.1, 0.48);
    antenaHGA.rotation.x = Math.PI * 0.42;
    g.add(cuerpo, boveda, antenaHGA);

    for (const sgn of [-1, 1]) {
      const piv = new THREE.Group();
      piv.position.set(sgn * 0.6, 13.2, 0);
      const ala = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.68), matPanel);
      ala.position.x = sgn * 1.32;
      piv.add(ala);
      piv.rotation.z = sgn * 1.48;
      g.add(piv);
      alasSolares.push({ pivote: piv, rotPlegada: sgn * 1.48, rotDesplegada: 0 });
    }
  }
}

/**
 * Construye el cohete `id` a escala real (1 unidad = 1 m), con la base en y = 0.
 * @returns {{ grupo: THREE.Group, etapas: Record<string, THREE.Group>, cajas: Record<string, object>, alasSolares: Array, altura: number }}
 */
export function armarCohete(THREE, id) {
  const def = MODELOS[id];
  const original = def.construir(THREE);
  const grupo = new THREE.Group();
  const etapas = Object.fromEntries(def.etapas.map((e) => [e.id, new THREE.Group()]));
  for (const [k, g] of Object.entries(etapas)) {
    g.name = k;
    grupo.add(g);
  }

  for (const pieza of [...original.children]) {
    const p = { x: pieza.position.x, y: pieza.position.y, r: radioPieza(pieza) };
    const etapa = def.etapas.find((e) => e.regla(p));
    etapas[etapa.id].add(pieza);
  }

  // Anillo interetapa S-IC/S-II separable para el Saturno V (se suelta 30 s tras encender la S-II)
  if (id === 'saturno-v' && etapas['inter-1']) {
    const matInter = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.15, side: THREE.DoubleSide });
    const matFranja = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.15, side: THREE.DoubleSide });
    const anillo = new THREE.Mesh(new THREE.CylinderGeometry(3.01, 3.01, 1.35, 32, 1, true), matInter);
    anillo.position.y = -2.85;
    const franja = new THREE.Mesh(new THREE.CylinderGeometry(3.02, 3.02, 0.38, 32, 1, true), matFranja);
    franja.position.y = -2.85;
    etapas['inter-1'].add(anillo, franja);
  }

  // Cofia dividida en dos valvas (izquierda y derecha) y sonda interior con paneles solares articulados
  const alasSolares = [];
  if (etapas.cofia && etapas['cofia-izq'] && etapas['cofia-der']) {
    dividirCofiaEnValvas(THREE, etapas.cofia, etapas['cofia-izq'], etapas['cofia-der']);
    construirSondaInterna(THREE, id, etapas, alasSolares);
  }

  // Escala a la altura real y base en y = 0
  const caja = new THREE.Box3().setFromObject(grupo);
  const escala = def.alturaReal / (caja.max.y - caja.min.y);
  grupo.scale.setScalar(escala);
  grupo.position.y = -caja.min.y * escala;
  const contenedor = new THREE.Group();
  contenedor.add(grupo);
  contenedor.updateMatrixWorld(true);

  const cajas = {};
  for (const [k, g] of Object.entries(etapas)) {
    const b = new THREE.Box3().setFromObject(g);
    if (b.isEmpty()) continue;
    cajas[k] = {
      minY: b.min.y,
      maxY: b.max.y,
      minX: b.min.x,
      maxX: b.max.x,
      cx: (b.min.x + b.max.x) * 0.5,
      cy: (b.min.y + b.max.y) * 0.5,
      ancho: Math.max(0.5, b.max.x - b.min.x),
      alto: Math.max(0.5, b.max.y - b.min.y),
    };
  }
  if (!cajas.cofia && cajas['cofia-izq'] && cajas['cofia-der']) {
    cajas.cofia = {
      minY: Math.min(cajas['cofia-izq'].minY, cajas['cofia-der'].minY),
      maxY: Math.max(cajas['cofia-izq'].maxY, cajas['cofia-der'].maxY),
      minX: cajas['cofia-izq'].minX,
      maxX: cajas['cofia-der'].maxX,
      cx: 0,
      cy: cajas['cofia-izq'].cy,
      ancho: cajas['cofia-der'].maxX - cajas['cofia-izq'].minX,
      alto: cajas['cofia-izq'].alto,
    };
  }
  return { grupo: contenedor, etapas, cajas, alasSolares, altura: def.alturaReal, escala };
}
