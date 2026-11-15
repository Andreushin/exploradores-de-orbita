// OWNER: Rol 3 (@JU4NMAX) — Simulador de cohetes reales · escena 3D (Three.js 0.160).
// Dos vistas:
//  - Local (1 unidad = 1 m) con ORIGEN FLOTANTE: el cohete queda en el origen y la Tierra se mueve.
//    Así se ve a escala real el suelo alejarse, la curvatura y el cielo oscurecerse sin temblores
//    por la precisión numérica.
//  - Global (1 unidad = 1 km): la Tierra entera, la trayectoria, la órbita y el camino al destino.
// La física NO vive aquí: esta escena solo reproduce el resultado de ascenso.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { armarCohete, SUELTAS } from './modelos/index.js';
import { atmosfera, propagarOrbita } from './ascenso.js';

const R = 6378137;
const MU = 3.986004418e14;

// --- Texturas procedurales (sin descargar imágenes) ------------------------------
function texturaTierra() {
  const cv = document.createElement('canvas');
  cv.width = 2048; cv.height = 1024;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, '#e8f1f8'); g.addColorStop(0.08, '#1d4f8a'); g.addColorStop(0.5, '#0f3e78');
  g.addColorStop(0.92, '#1d4f8a'); g.addColorStop(1, '#e8f1f8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // "Continentes" estilizados: manchas superpuestas (no es un mapa real)
  for (let i = 0; i < 28; i++) {
    const cx = rnd() * cv.width; const cy = 180 + rnd() * 660; const tam = 60 + rnd() * 170;
    for (let j = 0; j < 30; j++) {
      ctx.fillStyle = ['#3f6b3a', '#5b7d3f', '#8a7a4e', '#4c7a45'][j % 4];
      ctx.beginPath();
      ctx.ellipse(cx + (rnd() - 0.5) * tam * 1.6, cy + (rnd() - 0.5) * tam, tam * (0.2 + rnd() * 0.4), tam * (0.15 + rnd() * 0.3), rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 400; i++) { ctx.beginPath(); ctx.ellipse(rnd() * cv.width, rnd() * cv.height, 20 + rnd() * 90, 4 + rnd() * 12, 0, 0, Math.PI * 2); ctx.fill(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function estrellas(radio, n = 2500) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1; const a = Math.random() * Math.PI * 2; const k = Math.sqrt(1 - u * u);
    pos.set([radio * k * Math.cos(a), radio * u, radio * k * Math.sin(a)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0 }));
}

function brillo(radio, color, opacidad) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radio, 96, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacidad, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
}

// --- Plataforma de lanzamiento (en el suelo local) --------------------------------
function plataforma(alturaCohete) {
  const g = new THREE.Group();
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(6000, 64), new THREE.MeshStandardMaterial({ color: 0x55704a, roughness: 1 }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.4;
  const concreto = new THREE.Mesh(new THREE.BoxGeometry(60, 6, 60), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.9 }));
  concreto.position.y = -3;
  const torre = new THREE.Mesh(new THREE.BoxGeometry(8, alturaCohete * 1.1, 8), new THREE.MeshStandardMaterial({ color: 0xb4532a, roughness: 0.6, metalness: 0.3, wireframe: true }));
  torre.position.set(-18, alturaCohete * 0.55, 0);
  const mar = new THREE.Mesh(new THREE.CircleGeometry(60000, 64, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1d4f8a, roughness: 0.3 }));
  mar.rotation.x = -Math.PI / 2; mar.position.set(4000, -0.6, 0);
  g.add(suelo, mar, concreto, torre);
  return g;
}

// --- Llama del motor ----------------------------------------------------------------
function llama(radio) {
  const g = new THREE.Group();
  const interior = new THREE.Mesh(new THREE.ConeGeometry(radio * 0.6, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  const exterior = new THREE.Mesh(new THREE.ConeGeometry(radio, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  for (const m of [interior, exterior]) { m.rotation.x = Math.PI; m.position.y = -0.5; }
  g.add(exterior, interior);
  return g;
}

// =================================================================================
export function crearEscena(canvas, { reducirMovimiento = false, renderer: rendererInyectado = null } = {}) {
  // `renderer` se puede inyectar en las pruebas (Node no tiene WebGL)
  const renderer = rendererInyectado || new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const texTierra = texturaTierra();

  // ---------- Vista local (metros, origen flotante) ----------
  const local = new THREE.Scene();
  const camLocal = new THREE.PerspectiveCamera(50, 1, 0.5, 5e8);
  const sol = new THREE.DirectionalLight(0xffffff, 2.2); sol.position.set(1, 2, 1.5);
  local.add(sol, new THREE.HemisphereLight(0xbfd8ff, 0x3a3a2a, 0.9));
  const tierra = new THREE.Group(); // la Tierra entera; se mueve para que el cohete quede en el origen
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 128), new THREE.MeshStandardMaterial({ map: texTierra, roughness: 0.9 }));
  esfera.rotation.x = Math.PI / 2; // el plano del vuelo (x, y) corta la Tierra por el "ecuador" del mapa
  tierra.add(esfera, brillo(R * 1.02, 0x4fa3ff, 0.18));
  local.add(tierra);
  const cieloEstrellas = estrellas(1e7);
  local.add(cieloEstrellas);
  const cohete = new THREE.Group();
  local.add(cohete);
  const estela = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  estela.frustumCulled = false;
  local.add(estela);
  const controles = new OrbitControls(camLocal, canvas);
  controles.enableDamping = !reducirMovimiento;

  // ---------- Vista global (kilómetros) ----------
  const global = new THREE.Scene();
  const camGlobal = new THREE.PerspectiveCamera(45, 1, 10, 5e6);
  global.add(new THREE.AmbientLight(0xffffff, 0.35));
  const solG = new THREE.DirectionalLight(0xffffff, 2); solG.position.set(1, 0.6, 1);
  global.add(solG, estrellas(4e6, 3000));
  global.children.at(-1).material.opacity = 1;
  const tierraG = new THREE.Mesh(new THREE.SphereGeometry(R / 1000, 96, 48), new THREE.MeshStandardMaterial({ map: texTierra, roughness: 0.9 }));
  tierraG.rotation.x = Math.PI / 2;
  global.add(tierraG, brillo((R / 1000) * 1.03, 0x4fa3ff, 0.25));
  const linea = (color, op = 1) => { const l = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: op < 1, opacity: op })); l.frustumCulled = false; global.add(l); return l; };
  const trayG = linea(0xff6b35);
  const orbitaG = linea(0x4fc3f7, 0.8);
  const salidaG = linea(0x4ade80);
  const marcador = new THREE.Mesh(new THREE.SphereGeometry(60, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  global.add(marcador);
  const luna = new THREE.Mesh(new THREE.SphereGeometry(1737, 48, 24), new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 1 }));
  luna.visible = false;
  global.add(luna);
  const controlesG = new OrbitControls(camGlobal, canvas);
  controlesG.enabled = false;

  // ---------- Estado ----------
  let actual = null;   // { id, modelo, etapas, altura, llama }
  let modo = 'persecucion';
  let rastro = [];
  let restos = [];
  let omegaSuelo = 0;  // giro de la Tierra en el plano del vuelo
  let ultimo = null;
  let sitio = null;

  function cargarCohete(id, latitud = 28.5) {
    cohete.clear();
    for (const r of restos) local.remove(r.obj);
    restos = []; rastro = [];
    const { grupo, etapas, altura } = armarCohete(THREE, id);
    const diam = new THREE.Box3().setFromObject(grupo).getSize(new THREE.Vector3()).x;
    const fuego = llama(diam * 0.35);
    fuego.visible = false;
    cohete.add(grupo, fuego);
    actual = { id, grupo, etapas, altura, fuego, diam };
    omegaSuelo = 7.2921159e-5 * Math.cos((latitud * Math.PI) / 180);
    if (sitio) tierra.remove(sitio);
    sitio = plataforma(altura);
    sitio.position.set(0, R, 0);
    tierra.add(sitio);
    for (const l of [trayG, orbitaG, salidaG]) l.geometry.setFromPoints([]);
    luna.visible = false;
    ponerEstado({ t: 0, x: 0, y: R, pitch: Math.PI / 2, empuje: 0, h: 0 });
    setCamara(modo, true);
  }

  /** Coloca todo para el estado `e` de la simulación (interpolado por quien llama). */
  function ponerEstado(e) {
    ultimo = e;
    // Origen flotante: la Tierra se dibuja en −posición del cohete, girando con el suelo
    tierra.position.set(-e.x, -e.y, 0);
    tierra.rotation.z = -omegaSuelo * e.t;
    // Orientación: el eje del modelo (+y) apunta según el cabeceo sobre el horizonte local
    const r = Math.hypot(e.x, e.y);
    const ux = e.x / r; const uy = e.y / r; const ex = uy; const ey = -ux;
    const dx = Math.cos(e.pitch) * ex + Math.sin(e.pitch) * ux;
    const dy = Math.cos(e.pitch) * ey + Math.sin(e.pitch) * uy;
    cohete.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    // Llama: más larga y ancha a medida que baja la presión
    const enc = e.empuje > 0;
    actual.fuego.visible = enc;
    if (enc) {
      const p = atmosfera(e.h).p / 101.29;
      const largo = actual.altura * (0.35 + 1.4 * (1 - p)) * (reducirMovimiento ? 1 : 0.92 + Math.random() * 0.16);
      actual.fuego.scale.set(1 + 2.2 * (1 - p), largo, 1 + 2.2 * (1 - p));
    }
    // Cielo: azul → negro con la altitud; estrellas al salir de la atmósfera
    const k = Math.min(1, e.h / 60000);
    local.background = new THREE.Color().lerpColors(new THREE.Color(0x7fb2e5), new THREE.Color(0x02040c), Math.sqrt(k));
    cieloEstrellas.material.opacity = Math.max(0, (e.h - 25000) / 40000);
    cieloEstrellas.position.copy(camLocal.position);
    // Estela (relativa al cohete)
    if (!rastro.length || e.t - rastro.at(-1).t > 0.5) rastro.push({ t: e.t, x: e.x, y: e.y });
    if (rastro.length > 4000) rastro.shift();
    estela.geometry.setFromPoints(rastro.map((p) => new THREE.Vector3(p.x - e.x, p.y - e.y, 0)));
    estela.material.color.set(e.h < 50000 ? 0xffffff : 0xff9f43);
    // Vista global
    marcador.position.set(e.x / 1000, e.y / 1000, 0);
    trayG.geometry.setFromPoints(rastro.map((p) => new THREE.Vector3(p.x / 1000, p.y / 1000, 0)));
    if (modo === 'persecucion' || modo === 'lateral') colocarCamara();
  }

  /** Avanza los restos (etapas soltadas) en caída balística con giro. */
  function avanzarRestos(dt) {
    for (const r of restos) {
      const rr = Math.hypot(r.x, r.y);
      if (rr > R) {
        r.vx -= (MU * r.x / rr ** 3) * dt; r.vy -= (MU * r.y / rr ** 3) * dt;
        const f = Math.exp(-atmosfera(rr - R).rho * 0.002 * dt * Math.hypot(r.vx, r.vy) / 10);
        r.vx *= f; r.vy *= f;
        r.x += r.vx * dt; r.y += r.vy * dt;
        if (!reducirMovimiento) r.obj.rotation.z += r.giro * dt;
      }
      r.vida += dt;
      r.obj.position.set(r.x - ultimo.x, r.y - ultimo.y, 0).add(r.offset);
      r.obj.visible = r.vida < 240;
    }
  }

  /** Suelta en 3D las etapas asociadas al evento (fase o ítem de cohetes.json). */
  function soltar(claveEvento, e) {
    const ids = SUELTAS[actual.id]?.[claveEvento] || [];
    for (const id of ids) {
      const g = actual.etapas[id];
      if (!g || !g.parent) continue;
      g.updateWorldMatrix(true, false);
      const obj = new THREE.Group();
      local.add(obj);
      obj.applyMatrix4(g.parent.matrixWorld); // conserva orientación y escala del cohete
      obj.add(g);
      // Velocidad del cohete al soltar, menos un pequeño empujón hacia atrás o a los lados
      const r = Math.hypot(e.x, e.y);
      const ux = e.x / r; const uy = e.y / r;
      const lado = id.endsWith('izq') ? -1 : id.endsWith('der') ? 1 : 0;
      restos.push({
        obj, x: e.x, y: e.y, offset: obj.position.clone(), // dónde estaba dentro del cohete
        vx: e.vr * ux + e.vt * uy - 8 * ux + lado * 6 * uy,
        vy: e.vr * uy - e.vt * ux - 8 * uy - lado * 6 * ux,
        giro: (lado || (Math.random() - 0.5)) * 0.35, vida: 0,
      });
    }
  }

  /** Dibuja en la vista global la órbita de espera y el camino de salida hacia el destino. */
  function dibujarSalida(sim, destinoId) {
    const fin = sim.serie.at(-1);
    const r = Math.hypot(fin.x, fin.y);
    const vC = Math.sqrt(MU / r);
    const ex = fin.y / r; const ey = -fin.x / r;
    const periodo = 2 * Math.PI * Math.sqrt(r ** 3 / MU);
    const orb = propagarOrbita({ x: fin.x, y: fin.y, vx: vC * ex, vy: vC * ey }, MU, { dt: 5, pasos: Math.ceil(periodo / 5) });
    orbitaG.geometry.setFromPoints(orb.map((p) => new THREE.Vector3(p.x / 1000, p.y / 1000, 0)));
    if (!sim.salida) return;
    const v = vC + sim.salida.dv;
    const sal = propagarOrbita({ x: fin.x, y: fin.y, vx: v * ex, vy: v * ey }, MU, { dt: 60, pasos: 5 * 24 * 60 });
    const lejos = sal.filter((p) => Math.hypot(p.x, p.y) < 1.2e9);
    salidaG.geometry.setFromPoints(lejos.map((p) => new THREE.Vector3(p.x / 1000, p.y / 1000, 0)));
    if (destinoId === 'luna') {
      const ap = lejos.reduce((a, p) => (Math.hypot(p.x, p.y) > Math.hypot(a.x, a.y) ? p : a), lejos[0]);
      const d = Math.hypot(ap.x, ap.y);
      luna.position.set((ap.x / d) * 384400, (ap.y / d) * 384400, 0);
      luna.visible = true;
    }
  }

  function colocarCamara() {
    const h = actual.altura;
    if (modo === 'persecucion') {
      const off = new THREE.Vector3(h * 0.9, -h * 0.35, h * 1.6).applyAxisAngle(new THREE.Vector3(0, 0, 1), cohete.rotation.z);
      camLocal.position.copy(off);
      controles.target.set(0, 0, 0).add(new THREE.Vector3(0, h * 0.4, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), cohete.rotation.z));
    } else if (modo === 'lateral') {
      camLocal.position.set(0, h * 0.5, h * 6);
      controles.target.set(0, h * 0.5, 0);
    }
    camLocal.lookAt(controles.target);
  }

  function setCamara(m, inmediato = false) {
    modo = m;
    controles.enabled = m === 'libre';
    controlesG.enabled = m === 'global';
    if (m === 'global') {
      const d = luna.visible ? 900000 : 26000;
      camGlobal.position.set(0, -d * 0.35, d);
      controlesG.target.set(0, 0, 0);
      controlesG.update();
    } else if (m === 'libre' && inmediato !== true) {
      controles.target.set(0, actual.altura * 0.5, 0);
    } else colocarCamara();
  }

  function tamano() {
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    for (const c of [camLocal, camGlobal]) { c.aspect = w / h; c.updateProjectionMatrix(); }
  }

  function dibujar(dtReal = 0) {
    if (ultimo && dtReal) avanzarRestos(dtReal);
    if (modo === 'libre') controles.update();
    if (modo === 'global') { controlesG.update(); renderer.render(global, camGlobal); } else renderer.render(local, camLocal);
  }

  tamano();
  return { cargarCohete, ponerEstado, soltar, dibujarSalida, setCamara, tamano, dibujar, avanzarRestos };
}
