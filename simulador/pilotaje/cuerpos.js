// OWNER: Rol 3 (@JU4NMAX) — Simulador de pilotaje · escena 3D (Three.js 0.160).
// Unidades de la escena: KILÓMETROS. Marco de la misión (x → lon 0°, y → lon 90° E, z → norte) a Three.js (Y arriba):
//   three = (x, z, −y). Con ese cambio, el centro de una textura equirrectangular (lon 0°) cae en +X y el este en −Z,
//   que es justo como SphereGeometry reparte la imagen: no hace falta girar nada.
// Integra los modelos 3D reales de cada cohete (Saturno V, Atlas-Agena D, Falcon Heavy) y los shaders planetarios 4K NASA.
import * as THREE from 'three';
import * as F from './fisica.js?v=9';
import { posicionTierra, elementosActuales } from './mision.js?v=9';
import { armarCohete } from '../modelos/index.js?v=9';

const KM = 1000;
export const aTres = (v) => new THREE.Vector3(v[0], v[2], -v[1]);

const TIERRA = {
  color: '../texturas/tierra-color-4k.jpg', nubes: '../texturas/tierra-nubes-2k.jpg', noche: '../texturas/tierra-noche-2k.jpg',
  radioKm: 6371.0, // radio medio volumétrico de la Tierra (NASA NSSDCA Earth Fact Sheet)
};

// ── Shaders Planetarios 4K NASA (Luna LRO/LOLA, Marte MRO/MOLA y Europa Clipper/Galileo) ────────────────────────
const VERT_PLANETA = `
  varying vec2 vUv;
  varying vec3 vGeomN;
  varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vGeomN = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAG_LUNA = `
  precision highp float;
  uniform sampler2D uAlbedo;
  uniform sampler2D uBump;
  uniform vec3 uSun;
  varying vec2 vUv;
  varying vec3 vGeomN;
  varying vec3 vViewPos;
  void main() {
    vec3 N = normalize(vGeomN);
    vec3 V = normalize(vViewPos);
    vec3 S = normalize((viewMatrix * vec4(uSun, 0.0)).xyz);
    vec2 texel = vec2(1.0 / 4000.0, 1.0 / 2000.0);
    float hC = texture2D(uBump, vUv).r;
    float hR = texture2D(uBump, vUv + vec2(texel.x, 0.0)).r;
    float hU = texture2D(uBump, vUv + vec2(0.0, texel.y)).r;
    float dX = (hR - hC);
    float dY = (hU - hC);
    vec3 up = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
    vec3 T = normalize(cross(up, N));
    vec3 B = cross(N, T);
    vec3 bumpN = normalize(N - (T * dX + B * dY) * 1.8);
    vec3 albedo = texture2D(uAlbedo, vUv).rgb;
    float geomDot = dot(N, S);
    float sunDot = max(dot(bumpN, S), 0.0);
    float diffuse = mix(max(geomDot, 0.0), sunDot, 0.32);
    float phaseAngle = max(dot(S, V), 0.0);
    float oppositionSurge = pow(phaseAngle, 14.0) * 0.16;
    float dayFactor = smoothstep(-0.02, 0.04, geomDot);
    vec3 litDay = albedo * (diffuse + oppositionSurge) * dayFactor;
    // Luz cenicienta tenue en la cara nocturna para orientación orbital
    vec3 nightSide = albedo * 0.035 * (1.0 - dayFactor);
    vec3 finalColor = pow(clamp(litDay + nightSide, 0.0, 1.0), vec3(1.0 / 1.04));
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const FRAG_MARTE = `
  precision highp float;
  uniform sampler2D uAlbedo;
  uniform sampler2D uNormal;
  uniform vec3 uSun;
  varying vec2 vUv;
  varying vec3 vGeomN;
  varying vec3 vViewPos;
  void main() {
    vec3 N = normalize(vGeomN);
    vec3 V = normalize(vViewPos);
    vec3 S = normalize((viewMatrix * vec4(uSun, 0.0)).xyz);
    vec3 normSample = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
    vec3 up = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
    vec3 T = normalize(cross(up, N));
    vec3 B = cross(N, T);
    mat3 TBN = mat3(T, B, N);
    vec3 bumpN = normalize(TBN * (normSample * vec3(1.3, 1.3, 1.0)));
    vec3 albedo = texture2D(uAlbedo, vUv).rgb;
    float geomDot = dot(N, S);
    float sunDot = max(dot(bumpN, S), 0.0);
    float diffuse = mix(max(geomDot, 0.0), sunDot, 0.40);
    float isPolar = smoothstep(0.40, 0.47, abs(vUv.y - 0.5)) * smoothstep(0.60, 0.85, albedo.r);
    vec3 H = normalize(S + V);
    float polarSpec = pow(max(dot(bumpN, H), 0.0), 28.0) * isPolar * 0.40;
    float dayFactor = smoothstep(-0.02, 0.04, geomDot);
    float limb = pow(1.0 - max(dot(N, V), 0.0), 3.2);
    vec3 dustColor = vec3(0.85, 0.48, 0.26);
    vec3 limbHaze = dustColor * limb * 0.28 * max(geomDot, 0.0);
    vec3 litDay = (albedo * diffuse + vec3(polarSpec) + limbHaze) * dayFactor;
    vec3 nightSide = albedo * 0.035 * (1.0 - dayFactor);
    vec3 finalColor = pow(clamp(litDay + nightSide, 0.0, 1.0), vec3(1.0 / 1.05));
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const FRAG_EUROPA = `
  precision highp float;
  uniform sampler2D uAlbedo;
  uniform vec3 uSun;
  varying vec2 vUv;
  varying vec3 vGeomN;
  varying vec3 vViewPos;
  void main() {
    vec3 N = normalize(vGeomN);
    vec3 V = normalize(vViewPos);
    vec3 S = normalize((viewMatrix * vec4(uSun, 0.0)).xyz);
    vec3 albedo = texture2D(uAlbedo, vUv).rgb;
    vec2 texel = vec2(1.0 / 4096.0, 1.0 / 2048.0);
    float hC = dot(albedo, vec3(0.299, 0.587, 0.114));
    float hR = dot(texture2D(uAlbedo, vUv + vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float hU = dot(texture2D(uAlbedo, vUv + vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float dX = (hR - hC);
    float dY = (hU - hC);
    vec3 up = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
    vec3 T = normalize(cross(up, N));
    vec3 B = cross(N, T);
    vec3 bumpN = normalize(N - (T * dX + B * dY) * 2.2);
    float geomDot = dot(N, S);
    float sunDot = max(dot(bumpN, S), 0.0);
    float diffuse = mix(max(geomDot, 0.0), sunDot, 0.35);
    vec3 H = normalize(S + V);
    float iceMask = smoothstep(0.40, 0.75, albedo.r);
    float iceSpec = pow(max(dot(bumpN, H), 0.0), 32.0) * iceMask * 0.45;
    float dayFactor = smoothstep(-0.02, 0.04, geomDot);
    float limb = pow(1.0 - max(dot(N, V), 0.0), 3.8);
    vec3 cryoHaze = vec3(0.65, 0.85, 1.0) * limb * 0.25 * max(geomDot, 0.0);
    vec3 litDay = (albedo * diffuse + vec3(iceSpec) + cryoHaze) * dayFactor;
    vec3 nightSide = albedo * 0.04 * (1.0 - dayFactor);
    vec3 finalColor = pow(clamp(litDay + nightSide, 0.0, 1.0), vec3(1.0 / 1.04));
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const VERT_HALO = `
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAG_ATMO_MARTE = `
  precision highp float;
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPos);
    vec3 S = normalize((viewMatrix * vec4(uSun, 0.0)).xyz);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.5);
    vec3 dayHaze = vec3(0.92, 0.52, 0.28);
    vec3 sunsetHaze = vec3(0.48, 0.62, 0.85);
    vec3 atmoCol = mix(dayHaze, sunsetHaze, 0.32);
    float sunAlign = max(dot(N, S), 0.0);
    float alpha = fresnel * 0.60 * smoothstep(-0.05, 0.25, sunAlign);
    gl_FragColor = vec4(atmoCol * (sunAlign * 0.8 + 0.2), alpha);
  }
`;

const FRAG_EXO_EUROPA = `
  precision highp float;
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPos);
    vec3 S = normalize((viewMatrix * vec4(uSun, 0.0)).xyz);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.8);
    vec3 cryoColor = vec3(0.55, 0.82, 1.0);
    float sunAlign = max(dot(N, S), 0.0);
    float alpha = fresnel * 0.50 * smoothstep(-0.05, 0.20, sunAlign);
    gl_FragColor = vec4(cryoColor * (sunAlign * 0.8 + 0.2), alpha);
  }
`;

function estrellas(radio, n = 4800) {
  const pos = new Float32Array(n * 3); const col = new Float32Array(n * 3);
  let s = 17; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1; const a = rnd() * Math.PI * 2; const k = Math.sqrt(1 - u * u);
    pos.set([radio * k * Math.cos(a), radio * u, radio * k * Math.sin(a)], i * 3);
    const c = 0.5 + rnd() * 0.5; col.set([c, c * (0.92 + rnd() * 0.1), Math.min(1, c * (0.9 + rnd() * 0.25))], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size: 1.9, sizeAttenuation: false, depthWrite: false, fog: false }));
}

function brilloSol() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d'); const g = c.createRadialGradient(128, 128, 2, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.12, 'rgba(255,240,200,0.9)'); g.addColorStop(0.4, 'rgba(255,200,130,0.18)'); g.addColorStop(1, 'rgba(255,180,100,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
  sp.renderOrder = -5;
  return sp;
}

/** Textura procedural de Júpiter con sus bandas ecuatoriales y la Gran Mancha Roja para la misión de Europa. */
function crearJupiter() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d');
  const bandas = [
    [0.00, '#8c7a6b'], [0.12, '#b89f85'], [0.20, '#d8c5ae'], [0.28, '#a66e4e'],
    [0.36, '#e6d6c3'], [0.44, '#c78d63'], [0.50, '#f2e8dc'], [0.56, '#b5754d'],
    [0.64, '#e2ceb5'], [0.72, '#9c6b4e'], [0.82, '#c8b29b'], [1.00, '#7c6d61'],
  ];
  const grad = c.createLinearGradient(0, 0, 0, 256);
  for (const [p, col] of bandas) grad.addColorStop(p, col);
  c.fillStyle = grad;
  c.fillRect(0, 0, 512, 256);
  c.save();
  c.translate(310, 168);
  c.scale(1.6, 1.0);
  const grs = c.createRadialGradient(0, 0, 2, 0, 0, 22);
  grs.addColorStop(0, '#d95338');
  grs.addColorStop(0.65, '#b8432c');
  grs.addColorStop(1, 'rgba(184,67,44,0)');
  c.fillStyle = grs;
  c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.fill();
  c.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const radioJupKm = 69911;
  return new THREE.Mesh(
    new THREE.SphereGeometry(radioJupKm, 32, 24),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
}

/**
 * Construye el cohete 3D real de la misión:
 * - Luna: Saturno V / Apolo 11 (`saturno-v`)
 * - Marte: Atlas-Agena D / Mariner (`atlas-agena-d`)
 * - Europa: Falcon Heavy / Europa Clipper (`falcon-heavy`)
 */
function crearCoheteMision3D(coheteId = 'saturno-v') {
  const raiz = new THREE.Group();
  const modeloHolder = new THREE.Group();
  raiz.add(modeloHolder);

  // Pluma de encendido del motor principal (en -Z, la cola del cohete)
  const llamaGrupo = new THREE.Group();
  const matLlamaExt = new THREE.MeshBasicMaterial({
    color: 0xff6b1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const matLlamaMed = new THREE.MeshBasicMaterial({
    color: 0xfbbf24, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const matLlamaInt = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const conoExt = new THREE.Mesh(new THREE.ConeGeometry(0.95, 6.2, 20, 1, true), matLlamaExt);
  conoExt.rotation.x = -Math.PI / 2;
  conoExt.position.z = -5.6;
  const conoMed = new THREE.Mesh(new THREE.ConeGeometry(0.62, 4.2, 16, 1, true), matLlamaMed);
  conoMed.rotation.x = -Math.PI / 2;
  conoMed.position.z = -4.6;
  const conoInt = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 12), matLlamaInt);
  conoInt.rotation.x = -Math.PI / 2;
  conoInt.position.z = -3.7;
  llamaGrupo.add(conoExt, conoMed, conoInt);
  llamaGrupo.visible = false;
  raiz.add(llamaGrupo);

  // Propulsores RCS de maniobra (se ven disparar gas blanco cuando el cohete gira 180° en la captura orbital)
  const rcsGrupo = new THREE.Group();
  const matRcs = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const rcsProa1 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.3, 10), matRcs);
  rcsProa1.rotation.z = Math.PI / 2; rcsProa1.position.set(0.9, 0.2, 1.9);
  const rcsProa2 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.3, 10), matRcs);
  rcsProa2.rotation.z = -Math.PI / 2; rcsProa2.position.set(-0.9, -0.2, 1.9);
  const rcsPopa1 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.3, 10), matRcs);
  rcsPopa1.rotation.z = -Math.PI / 2; rcsPopa1.position.set(-0.9, 0.2, -1.9);
  const rcsPopa2 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.3, 10), matRcs);
  rcsPopa2.rotation.z = Math.PI / 2; rcsPopa2.position.set(0.9, -0.2, -1.9);
  rcsGrupo.add(rcsProa1, rcsProa2, rcsPopa1, rcsPopa2);
  rcsGrupo.visible = false;
  raiz.add(rcsGrupo);

  const luzMotor = new THREE.PointLight(0xff8c42, 0, 26);
  luzMotor.position.set(0, 0, -3.2);
  raiz.add(luzMotor);

  // Luz de contorno propia para que el cohete 3D siempre luzca nítido frente al espacio
  const luzCohete = new THREE.PointLight(0xdbeafe, 2.2, 22);
  luzCohete.position.set(3.5, 4.0, 2.5);
  raiz.add(luzCohete);

  const cacheCohetes = new Map();
  function cargarModeloCohete(id) {
    modeloHolder.clear();
    try {
      let piv = cacheCohetes.get(id);
      if (!piv) {
        const armado = armarCohete(THREE, id);
        const largoDeseado = 5.2; // Unidades de escena (km visuales en cámara de persecución)
        const esc = largoDeseado / armado.altura;
        armado.grupo.scale.setScalar(esc);
        // En armarCohete, y=0 son los motores y y=altura es la punta.
        // Al rotar +90° en X, el eje +Y del cohete pasa a apuntar hacia +Z (m.fwd).
        piv = new THREE.Group();
        armado.grupo.position.set(0, -armado.altura * esc * 0.5, 0);
        piv.add(armado.grupo);
        piv.rotation.x = Math.PI / 2;
        cacheCohetes.set(id, piv);
      }
      modeloHolder.add(piv);
    } catch (e) {
      console.warn('Fallback de modelo de cohete:', e);
    }
  }

  cargarModeloCohete(coheteId);
  return { raiz, llamaGrupo, rcsGrupo, luzMotor, cargarModeloCohete };
}

/** Marcador de un lugar: anillo doble en el suelo y columna luminosa vertical sobre la superficie. */
function marcador(lugar, radioKm, color) {
  const g = new THREE.Group();
  const norm = aTres([
    Math.cos((lugar.lat * Math.PI) / 180) * Math.cos((lugar.lon * Math.PI) / 180),
    Math.cos((lugar.lat * Math.PI) / 180) * Math.sin((lugar.lon * Math.PI) / 180),
    Math.sin((lugar.lat * Math.PI) / 180),
  ]);
  const escala = Math.max(0.85, radioKm / 1737.4);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false });
  const anillo = new THREE.Mesh(new THREE.RingGeometry(24 * escala, 34 * escala, 48), mat);
  const anilloInt = new THREE.Mesh(new THREE.RingGeometry(8 * escala, 12 * escala, 32), mat);
  const rayo = new THREE.Mesh(new THREE.CylinderGeometry(1.8 * escala, 1.8 * escala, 110 * escala, 8), mat);
  rayo.rotation.x = Math.PI / 2;
  rayo.position.z = 55 * escala;
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(6.5 * escala, 12, 12), mat);
  esfera.position.z = 112 * escala;
  g.add(anillo, anilloInt, rayo, esfera);
  g.position.copy(norm.clone().multiplyScalar(radioKm + 0.8));
  g.lookAt(norm.clone().multiplyScalar(radioKm * 2));
  g.userData = { mat, norm, esfera, anillo };
  return g;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} m mision (de crearMision)
 * @param {{reducirMovimiento?:boolean, renderer?:object, cargarTextura?:(url:string)=>THREE.Texture}} op
 */
export function crearEscenaPilotaje(canvas, m, { reducirMovimiento = false, renderer: inyectado = null, cargarTextura = null } = {}) {
  const renderer = inyectado || new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio?.(Math.min(globalThis.devicePixelRatio ?? 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const cargador = new THREE.TextureLoader();
  const fallos = [];
  const cacheTexturas = new Map();
  const tex = (url, { color = true } = {}) => {
    const absoluta = new URL(url, import.meta.url).href;
    const llave = `${absoluta}|${color ? 1 : 0}`;
    if (cacheTexturas.has(llave)) return cacheTexturas.get(llave);
    const t = cargarTextura ? cargarTextura(absoluta) : cargador.load(absoluta, undefined, undefined, () => fallos.push(url));
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cacheTexturas.set(llave, t);
    return t;
  };

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x000004);
  const camara = new THREE.PerspectiveCamera(54, 1, 0.05, 3.5e6);

  // Luz solar + luz ambiental para el cohete 3D
  const sol = new THREE.DirectionalLight(0xfff4e4, 3.4);
  const cenicienta = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.55);
  escena.add(sol, cenicienta);
  const fondo = estrellas(1.8e6);
  const glow = brilloSol();
  glow.scale.setScalar(260000);
  escena.add(fondo, glow);

  // La Tierra (en la misión de la Luna) y Júpiter (en la misión de Europa)
  const tierra = new THREE.Group();
  const tierraMat = new THREE.MeshStandardMaterial({
    map: tex(TIERRA.color), emissiveMap: tex(TIERRA.noche), emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.9,
  });
  const nubes = new THREE.Mesh(
    new THREE.SphereGeometry(TIERRA.radioKm * 1.01, 64, 32),
    new THREE.MeshBasicMaterial({ map: tex(TIERRA.nubes), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  tierra.add(new THREE.Mesh(new THREE.SphereGeometry(TIERRA.radioKm, 64, 32), tierraMat), nubes);
  escena.add(tierra);

  const jupiter = crearJupiter();
  escena.add(jupiter);

  // Cohete 3D específico de la misión (Saturno V, Atlas-Agena D o Falcon Heavy)
  const nave3D = crearCoheteMision3D(m.dest.cohete);
  escena.add(nave3D.raiz);

  // Portal 3D del Punto de Frenado (Periapsis · PE)
  const periGrupo = new THREE.Group();
  const matPeri = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false });
  const aroPeri1 = new THREE.Mesh(new THREE.RingGeometry(32, 42, 48), matPeri);
  const aroPeri2 = new THREE.Mesh(new THREE.RingGeometry(52, 58, 48), matPeri);
  periGrupo.add(aroPeri1, aroPeri2);
  escena.add(periGrupo);

  // Trayectoria predicha
  const lineaTray = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 }));
  lineaTray.frustumCulled = false;
  escena.add(lineaTray);

  let cuerpoGrupo = null;
  let marcadores = new Map();
  let radioKm = m.cuerpo.radio / KM;

  function limpiarGrupo(grupo) {
    if (!grupo) return;
    grupo.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose?.();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((mat) => mat.dispose?.());
        else obj.material.dispose?.();
      }
    });
  }

  function construirCuerpo() {
    if (cuerpoGrupo) {
      escena.remove(cuerpoGrupo);
      limpiarGrupo(cuerpoGrupo);
    }
    cuerpoGrupo = new THREE.Group();
    radioKm = m.cuerpo.radio / KM;
    const t = m.dest.textura;
    const solDir = aTres(m.sol).normalize();

    let matCuerpo;
    if (m.destino === 'marte') {
      // Textura 4K NASA MRO/MOLA de Marte-3D-NASA-4K.zip con normalMap nativo compatible con logarithmicDepthBuffer
      matCuerpo = new THREE.MeshStandardMaterial({
        map: tex(`../${t.color}`),
        normalMap: tex(`../${t.relieve}`, { color: false }),
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughness: 0.86,
        metalness: 0.04,
      });
    } else if (m.destino === 'europa') {
      // Textura 4K NASA Europa Clipper con brillo criogénico de hielo
      const mapaEuropa = tex(`../${t.color}`);
      matCuerpo = new THREE.MeshStandardMaterial({
        map: mapaEuropa,
        roughness: 0.52,
        metalness: 0.05,
      });
    } else {
      // Textura 4K NASA LRO/LOLA de Luna-3D-NASA-4K.zip
      matCuerpo = new THREE.MeshStandardMaterial({
        map: tex(`../${t.color}`),
        bumpMap: tex(`../${t.relieve}`, { color: false }),
        bumpScale: 3.2,
        roughness: 0.92,
        metalness: 0.02,
      });
    }

    const esfera = new THREE.Mesh(new THREE.SphereGeometry(radioKm, 96, 64), matCuerpo);
    cuerpoGrupo.add(esfera);

    // Halo atmosférico de Marte o exosfera criogénica de Europa (compatible con logarithmicDepthBuffer)
    if (m.destino === 'marte' || m.destino === 'europa') {
      const haloMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radioKm * (m.destino === 'marte' ? 1.016 : 1.012), 64, 48),
        new THREE.MeshBasicMaterial({
          color: m.destino === 'marte' ? 0xea580c : 0x7dd3fc,
          transparent: true,
          opacity: m.destino === 'marte' ? 0.14 : 0.12,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      cuerpoGrupo.add(haloMesh);
    }

    marcadores = new Map();
    for (const l of m.dest.lugares) {
      const mk = marcador(l, radioKm, 0x38bdf8);
      marcadores.set(l.id, mk);
      cuerpoGrupo.add(mk);
    }
    escena.add(cuerpoGrupo);

    sol.position.copy(solDir).multiplyScalar(1e5);
    tierra.visible = m.destino === 'luna';
    jupiter.visible = m.destino === 'europa';
    if (m.destino === 'europa') {
      jupiter.position.set(-520000, 120000, -390000);
    }
    nave3D.cargarModeloCohete(m.dest.cohete);
  }

  let cuentaTray = 0;
  let predijo = { choca: false, puntos: [] };
  let modoVista = 'orbita'; // 'orbita' (3ra persona viendo tu cohete y el planeta) | 'cabina' (1ra persona escáner)
  const anguloOrbita = { azimut: 0.22, elevacion: 0.20, zoom: 11.5 };
  let dirCoheteSuave = null;

  function trayectoria() {
    const p = F.predecir({ r: m.r, v: m.v }, m.cuerpo.mu, { dt: 24, pasos: 360, radioCuerpo: m.cuerpo.radio });
    predijo = p;
    const el = elementosActuales(m);
    const ptsTres = p.puntos.map((q) => aTres(q).multiplyScalar(1 / KM));
    lineaTray.geometry.setFromPoints(ptsTres);
    lineaTray.material.color.set(p.choca ? 0xff7a7a : el.ligada ? 0x4ade80 : 0x38bdf8);

    // Coloca el anillo indicador del Periapsis (PE) en el punto más cercano de la predicción
    let mejorP = null; let minR = Infinity;
    for (const pt of p.puntos) {
      const d = F.norma(pt);
      if (d < minR) { minR = d; mejorP = pt; }
    }
    if (mejorP && !el.ligada) {
      const posPe = aTres(mejorP).multiplyScalar(1 / KM);
      const posNave = aTres(m.r).multiplyScalar(1 / KM);
      periGrupo.visible = true;
      periGrupo.position.copy(posPe);
      if (posPe.distanceToSquared(posNave) > 1e-4) {
        periGrupo.lookAt(posNave);
      }
    } else {
      periGrupo.visible = false;
    }
  }

  function actualizar() {
    cuerpoGrupo.rotation.y = (2 * Math.PI * m.t) / m.cuerpo.rotacion;
    const posNaveKm = aTres(m.r).multiplyScalar(1 / KM);
    const fwd3 = aTres(m.fwd);
    if (fwd3.lengthSq() < 1e-9) fwd3.set(0, 0, 1); else fwd3.normalize();
    const up3 = aTres(m.up);
    if (up3.lengthSq() < 1e-9) up3.set(0, 1, 0); else up3.normalize();
    const vel3 = aTres(m.v);
    if (vel3.lengthSq() < 1e-9) vel3.copy(fwd3); else vel3.normalize();
    const haciaPlaneta = posNaveKm.clone().negate();
    if (haciaPlaneta.lengthSq() < 1e-9) haciaPlaneta.set(0, -1, 0); else haciaPlaneta.normalize();

    // El cohete 3D siempre apunta con la punta hacia adelante en el sentido natural de avance (vel3)
    // durante la aproximación y la captura orbital, para que nunca parezca volar en reversa.
    const dirObjetivoVisual = (m.piloto === 'captura' || m.piloto === 'progrado')
      ? vel3
      : fwd3;
    if (!dirCoheteSuave || Number.isNaN(dirCoheteSuave.x)) {
      dirCoheteSuave = dirObjetivoVisual.clone();
    } else {
      dirCoheteSuave.lerp(dirObjetivoVisual, 0.22);
      if (dirCoheteSuave.lengthSq() < 1e-6) dirCoheteSuave.copy(dirObjetivoVisual);
      else dirCoheteSuave.normalize();
    }

    // Vector 'up' seguro y siempre ortogonal a dirCoheteSuave (evita gimbal lock / NaN cuando m.up gira 180° en Fase 1/3)
    const upBase = Math.abs(dirCoheteSuave.dot(haciaPlaneta)) < 0.95 ? haciaPlaneta : new THREE.Vector3(0, 1, 0);
    const ejeDerCohete = new THREE.Vector3().crossVectors(dirCoheteSuave, upBase);
    if (ejeDerCohete.lengthSq() < 1e-6) ejeDerCohete.set(1, 0, 0); else ejeDerCohete.normalize();
    const upVisual = new THREE.Vector3().crossVectors(ejeDerCohete, dirCoheteSuave).normalize();

    // Posiciona y orienta el cohete 3D real de la misión con la nariz hacia adelante
    nave3D.raiz.position.copy(posNaveKm);
    nave3D.raiz.up.copy(upVisual);
    nave3D.raiz.lookAt(posNaveKm.clone().add(dirCoheteSuave));

    // Animación de la llama del motor principal y propulsores de maniobra RCS
    const motorOn = m.motor !== 0 && !m.fin;
    const enManiobraCaptura = m.piloto === 'captura' && !m.fin;
    nave3D.llamaGrupo.visible = (motorOn || enManiobraCaptura) && !m.fin;
    nave3D.rcsGrupo.visible = (enManiobraCaptura || motorOn || m.piloto !== null) && !m.fin;
    nave3D.luzMotor.intensity = motorOn ? 6.5 : enManiobraCaptura ? 3.2 : 0;
    if (motorOn || enManiobraCaptura) {
      const base = motorOn ? 1.0 : 0.58;
      const pulso = base + 0.24 * Math.sin(performance.now() * 0.055);
      nave3D.llamaGrupo.scale.set(pulso, pulso, m.motor < 0 ? -0.55 * pulso : pulso);
    }

    if (modoVista === 'orbita') {
      nave3D.raiz.visible = true;
      camara.fov = 52;
      // En vista exterior, la referencia base sigue la orientación natural del cohete e incluye el planeta al fondo
      const dirRef = m.piloto === 'lugar' || m.piloto === null
        ? dirCoheteSuave.clone().multiplyScalar(0.72).addScaledVector(haciaPlaneta, 0.28).normalize()
        : vel3.clone().multiplyScalar(0.62).addScaledVector(haciaPlaneta, 0.38).normalize();
      const upRef = new THREE.Vector3(0, 1, 0);
      let derRef = new THREE.Vector3().crossVectors(dirRef, upRef);
      if (derRef.lengthSq() < 1e-6) derRef.set(1, 0, 0);
      else derRef.normalize();
      const arribaLocal = new THREE.Vector3().crossVectors(derRef, dirRef).normalize();

      const distCam = anguloOrbita.zoom;
      const dirAtras = dirRef.clone().multiplyScalar(-Math.cos(anguloOrbita.azimut) * Math.cos(anguloOrbita.elevacion))
        .add(derRef.clone().multiplyScalar(Math.sin(anguloOrbita.azimut) * Math.cos(anguloOrbita.elevacion)))
        .add(arribaLocal.clone().multiplyScalar(Math.sin(anguloOrbita.elevacion)))
        .normalize();

      camara.position.copy(posNaveKm).addScaledVector(dirAtras, distCam);
      // Sacudida sutil de cámara cuando el motor principal está quemando a máxima potencia
      if (motorOn && !reducirMovimiento) {
        camara.position.x += (Math.random() - 0.5) * 0.10;
        camara.position.y += (Math.random() - 0.5) * 0.10;
      }
      camara.up.copy(arribaLocal);
      const mira = posNaveKm.clone().addScaledVector(dirCoheteSuave, 1.4);
      camara.lookAt(mira);
    } else {
      // Modo 'cabina' / Telescopio Escáner en 1ra persona
      nave3D.raiz.visible = false;
      camara.fov = 46;
      camara.position.copy(posNaveKm);
      camara.up.copy(up3);
      camara.lookAt(posNaveKm.clone().add(fwd3));
    }
    camara.updateProjectionMatrix();

    if (tierra.visible) {
      tierra.position.copy(aTres(posicionTierra(m))).multiplyScalar(1 / KM);
      tierra.rotation.y = (2 * Math.PI * m.t) / 86164.2;
      nubes.rotation.y = tierra.rotation.y * 0.05;
    }
    if (jupiter.visible) {
      jupiter.rotation.y = (2 * Math.PI * m.t) / (9.925 * 3600);
    }
    fondo.position.copy(camara.position);
    glow.position.copy(camara.position).add(aTres(m.sol).multiplyScalar(1.2e6));
    if (cuentaTray++ % 6 === 0 && !m.fin) trayectoria();

    // Colorea los marcadores: verde = observado, ámbar pulsante = objetivo actual, azul = pendiente
    for (const [id, mk] of marcadores) {
      const obs = m.observados.some((o) => o.id === id);
      const esObj = m.objetivo === id && !obs;
      mk.userData.mat.color.set(obs ? 0x4ade80 : esObj ? 0xfbbf24 : 0x38bdf8);
    }
  }

  function proyectarPuntoKm(vec3Km) {
    const v = vec3Km.clone().project(camara);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, delante: v.z < 1 && v.z > -1 };
  }

  function proyectar(lugar) {
    const mk = marcadores.get(lugar.id);
    if (!mk) return { x: 0.5, y: 0.5, delante: false };
    const v = new THREE.Vector3();
    cuerpoGrupo.updateMatrixWorld(true);
    mk.getWorldPosition(v);
    v.add(mk.userData.norm.clone().applyQuaternion(cuerpoGrupo.quaternion).multiplyScalar(40));
    v.project(camara);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, delante: v.z < 1 && v.z > -1 };
  }

  function proyectarCuerpo() {
    return proyectarPuntoKm(new THREE.Vector3(0, 0, 0));
  }

  function tamano() {
    const w = canvas.clientWidth || 800; const h = canvas.clientHeight || 500;
    renderer.setSize(w, h, false);
    camara.aspect = w / h; camara.updateProjectionMatrix();
  }
  const dibujar = () => renderer.render(escena, camara);

  construirCuerpo();
  tamano();
  actualizar();

  return {
    actualizar, dibujar, tamano, proyectar, proyectarCuerpo, camara, fallos,
    get modoVista() { return modoVista; },
    fijarModoVista(modo) {
      modoVista = modo === 'cabina' ? 'cabina' : 'orbita';
      if (modoVista === 'orbita') { anguloOrbita.azimut = 0.22; anguloOrbita.elevacion = 0.20; }
      actualizar();
    },
    rotarVistaOrbita(dx, dy) {
      anguloOrbita.azimut -= dx * 0.007;
      anguloOrbita.elevacion = Math.max(-1.1, Math.min(1.15, anguloOrbita.elevacion + dy * 0.006));
      actualizar();
    },
    zoomVistaOrbita(deltaY) {
      anguloOrbita.zoom = Math.max(5.5, Math.min(32, anguloOrbita.zoom + Math.sign(deltaY) * 1.1));
      actualizar();
    },
    centrarVistaOrbita() {
      anguloOrbita.azimut = 0.22;
      anguloOrbita.elevacion = 0.20;
      anguloOrbita.zoom = 11.5;
      actualizar();
    },
    chocaPredicho: () => predijo.choca,
    puntosPredichos: () => predijo.puntos || [],
    reiniciar(nueva) {
      m = nueva;
      cuentaTray = 0;
      dirCoheteSuave = null;
      anguloOrbita.azimut = 0.22;
      anguloOrbita.elevacion = 0.20;
      anguloOrbita.zoom = 11.5;
      nave3D.cargarModeloCohete(m.dest.cohete);
      construirCuerpo();
      actualizar();
    },
  };
}
