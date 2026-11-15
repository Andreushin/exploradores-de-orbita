// OWNER: Rol 3 (@JU4NMAX) — Simulador de pilotaje · escena 3D en primera persona (Three.js 0.160).
// Unidades de la escena: KILÓMETROS. Marco de la misión (x → lon 0°, y → lon 90° E, z → norte) a Three.js (Y arriba):
//   three = (x, z, −y). Con ese cambio, el centro de una textura equirrectangular (lon 0°) cae en +X y el este en −Z,
//   que es justo como SphereGeometry reparte la imagen: no hace falta girar nada.
// La física NO vive aquí: la escena solo dibuja el estado de mision.js.
import * as THREE from 'three';
import * as F from './fisica.js';
import { posicionTierra } from './mision.js';

const KM = 1000;
export const aTres = (v) => new THREE.Vector3(v[0], v[2], -v[1]);

const TIERRA = {
  color: '../texturas/tierra-color-4k.jpg', nubes: '../texturas/tierra-nubes-2k.jpg', noche: '../texturas/tierra-noche-2k.jpg',
  radioKm: 6371.0, // radio medio volumétrico de la Tierra (NASA NSSDCA Earth Fact Sheet)
};

function estrellas(radio, n = 3600) {
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
  return new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size: 1.8, sizeAttenuation: false, depthWrite: false, fog: false }));
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

/** Marcador de un lugar: anillo en el suelo y un rayo vertical, pegados a la superficie del cuerpo. */
function marcador(lugar, radioKm, color) {
  const g = new THREE.Group();
  const norm = aTres([Math.cos(lugar.lat * Math.PI / 180) * Math.cos(lugar.lon * Math.PI / 180), Math.cos(lugar.lat * Math.PI / 180) * Math.sin(lugar.lon * Math.PI / 180), Math.sin(lugar.lat * Math.PI / 180)]);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const anillo = new THREE.Mesh(new THREE.RingGeometry(18, 24, 48), mat);
  const rayo = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 70, 8), mat);
  rayo.rotation.x = Math.PI / 2; rayo.position.z = 35;
  g.add(anillo, rayo);
  g.position.copy(norm.clone().multiplyScalar(radioKm + 0.5));
  g.lookAt(norm.clone().multiplyScalar(radioKm * 2)); // el eje z local apunta hacia arriba (normal)
  g.userData = { mat, norm };
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
  renderer.toneMappingExposure = 1.1;

  const cargador = new THREE.TextureLoader();
  const fallos = [];
  const tex = (url, { color = true } = {}) => {
    const absoluta = new URL(url, import.meta.url).href;
    const t = cargarTextura ? cargarTextura(absoluta) : cargador.load(absoluta, undefined, undefined, () => fallos.push(url));
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  const radioKm = m.cuerpo.radio / KM;
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x000000);
  const camara = new THREE.PerspectiveCamera(60, 1, 0.05, 2.5e6);

  // Luz: el Sol, y un poco de luz de la Tierra sobre la cara nocturna (en la Luna se llama "luz cenicienta")
  const sol = new THREE.DirectionalLight(0xfff3e0, 3.4);
  sol.position.copy(aTres(m.sol)).multiplyScalar(1e5);
  const cenicienta = new THREE.HemisphereLight(0x6f8ccc, 0x050505, 0.05);
  escena.add(sol, cenicienta);
  const fondo = estrellas(1.5e6);
  const glow = brilloSol();
  glow.position.copy(aTres(m.sol)).multiplyScalar(1.2e6); glow.scale.setScalar(260000);
  escena.add(fondo, glow);

  // Cuerpo (gira con su periodo) y sus marcadores
  const cuerpoGrupo = new THREE.Group();
  const t = m.dest.textura;
  // Las rutas de destinos.js son relativas a simulador/; este archivo vive en simulador/pilotaje/
  const matCuerpo = new THREE.MeshStandardMaterial({ map: tex(`../${t.color}`), roughness: 1, metalness: 0 });
  if (t.relieve) {
    matCuerpo.bumpMap = tex(`../${t.relieve}`, { color: false });
    matCuerpo.bumpScale = 2.5;
  }
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(radioKm, 192, 96), matCuerpo);
  cuerpoGrupo.add(esfera);
  const marcadores = new Map();
  for (const l of m.dest.lugares) {
    const mk = marcador(l, radioKm, 0x4fc3f7);
    marcadores.set(l.id, mk);
    cuerpoGrupo.add(mk);
  }
  escena.add(cuerpoGrupo);

  // La Tierra, a su distancia real (NSSDCA), con nubes y luces de ciudades
  const tierra = new THREE.Group();
  const tierraMat = new THREE.MeshStandardMaterial({ map: tex(TIERRA.color), emissiveMap: tex(TIERRA.noche), emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.9 });
  const nubes = new THREE.Mesh(
    new THREE.SphereGeometry(TIERRA.radioKm * 1.01, 64, 32),
    new THREE.MeshBasicMaterial({ map: tex(TIERRA.nubes), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  tierra.add(new THREE.Mesh(new THREE.SphereGeometry(TIERRA.radioKm, 64, 32), tierraMat), nubes);
  escena.add(tierra);

  // Trayectoria predicha (si no frenas)
  const lineaTray = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.9 }));
  lineaTray.frustumCulled = false;
  escena.add(lineaTray);
  let cuentaTray = 0;
  let predijo = { choca: false };

  function trayectoria() {
    const p = F.predecir({ r: m.r, v: m.v }, m.cuerpo.mu, { dt: 20, pasos: 520, radioCuerpo: m.cuerpo.radio });
    predijo = p;
    lineaTray.geometry.setFromPoints(p.puntos.map((q) => aTres(q).multiplyScalar(1 / KM)));
    lineaTray.material.color.set(p.choca ? 0xff7a7a : 0x4fc3f7);
  }

  function actualizar() {
    cuerpoGrupo.rotation.y = (2 * Math.PI * m.t) / m.cuerpo.rotacion;
    camara.position.copy(aTres(m.r)).multiplyScalar(1 / KM);
    camara.up.copy(aTres(m.up));
    camara.lookAt(camara.position.clone().add(aTres(m.fwd)));
    tierra.position.copy(aTres(posicionTierra(m))).multiplyScalar(1 / KM);
    tierra.rotation.y = (2 * Math.PI * m.t) / 86164.2; // día sidéreo de la Tierra: 23.9345 h (NASA NSSDCA Earth Fact Sheet)
    nubes.rotation.y = tierra.rotation.y * 0.05;
    fondo.position.copy(camara.position);
    glow.position.copy(camara.position).add(aTres(m.sol).multiplyScalar(1.2e6));
    if (cuentaTray++ % 12 === 0 && !m.fin) trayectoria();
    for (const o of m.observados) { const mk = marcadores.get(o.id); if (mk) mk.userData.mat.color.set(0x4ade80); }
  }

  /** Posición en pantalla (0…1) del marcador de un lugar, y si está delante de la cámara. */
  function proyectar(lugar) {
    const mk = marcadores.get(lugar.id);
    const v = new THREE.Vector3();
    cuerpoGrupo.updateMatrixWorld(true);
    mk.getWorldPosition(v);
    v.add(mk.userData.norm.clone().applyQuaternion(cuerpoGrupo.quaternion).multiplyScalar(40));
    v.project(camara);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, delante: v.z < 1 && v.z > -1 };
  }

  function tamano() {
    const w = canvas.clientWidth || 800; const h = canvas.clientHeight || 500;
    renderer.setSize(w, h, false);
    camara.aspect = w / h; camara.updateProjectionMatrix();
  }
  const dibujar = () => renderer.render(escena, camara);

  tamano(); actualizar();
  return {
    actualizar, dibujar, tamano, proyectar, camara, fallos,
    chocaPredicho: () => predijo.choca,
    reiniciar(nueva) { m = nueva; for (const [id, mk] of marcadores) mk.userData.mat.color.set(0x4fc3f7); cuentaTray = 0; actualizar(); },
  };
}
