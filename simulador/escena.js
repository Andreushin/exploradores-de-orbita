// OWNER: Rol 3 (@JU4NMAX) — Simulador de cohetes reales · escena 3D (Three.js 0.160).
// Ambientación inspirada en los modelos originales de modelos/originales/ (panoramas atmosféricos,
// complejo de lanzamiento LC-39A/Cabo Cañaveral sin colisiones, animaciones de desprendimiento
// de etapas, cofias bipartitas con despliegue solar, retrocohetes e inspección por clic).
// Dos vistas:
//  - Local (1 unidad = 1 m) con ORIGEN FLOTANTE: el cohete queda en el origen y la Tierra se mueve.
//  - Global (1 unidad = 1 km): la Tierra entera, la trayectoria, la órbita y el camino al destino.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { armarCohete, SUELTAS, INFO_ETAPAS } from './modelos/index.js';
import { atmosfera, propagarOrbita } from './ascenso.js';

const R = 6378137;

/**
 * Giro de la esfera de la Tierra para que Cabo Cañaveral (28.5° N, 80.6° O) quede bajo la rampa
 * (+y del grupo `tierra`), con el este hacia +x (la dirección del vuelo) y el norte hacia −z.
 * En la SphereGeometry de Three (textura equirectangular, longitud 0 al centro) un punto es
 * (cos φ·cos λ, sin φ, −cos φ·sin λ). Comprobado: en la imagen, ese punto cae en la costa de Florida.
 */
export const CABO = { lat: 28.5, lon: -80.6 };
export const QUAT_CABO = (() => {
  const f = (CABO.lat * Math.PI) / 180;
  const l = (CABO.lon * Math.PI) / 180;
  const arriba = new THREE.Vector3(Math.cos(f) * Math.cos(l), Math.sin(f), -Math.cos(f) * Math.sin(l));
  const este = new THREE.Vector3(-Math.sin(l), 0, -Math.cos(l));
  const norte = new THREE.Vector3().crossVectors(arriba, este); // completa una base derecha
  const desde = new THREE.Matrix4().makeBasis(este, arriba, norte.clone().negate());
  return new THREE.Quaternion().setFromRotationMatrix(desde.invert());
})();
const MU = 3.986004418e14;
const CIELO_ALTO = 0x040714;
const Y_SUELO = -5.6; // El suelo queda 5.6 m por debajo de las toberas (y = 0) para alojar la rampa y la trinchera

/** Configuraciones de los 4 panoramas ambientales seleccionables por el usuario. */
export const PANORAMAS = {
  amanecer: {
    id: 'amanecer',
    nombre: 'Amanecer dorado (Cabo Cañaveral)',
    horizonte: 0xf2b27a,
    paradas: [
      [0.00, '#05091a'],
      [0.36, '#13234a'],
      [0.56, '#345386'],
      [0.70, '#9c648e'],
      [0.78, '#e88354'],
      [0.835, '#fbd08c'],
      [0.86, '#4b4052'],
      [1.00, '#120e18'],
    ],
    nubeLuz: 'rgba(255, 214, 158, 0.42)',
    nubeSombra: 'rgba(68, 52, 84, 0.36)',
    solPos: [1, 0.21, 0.42],
    solColor: 0xffe3bd,
    solInt: 2.65,
    rellenoColor: 0x8fb0e8,
    rellenoInt: 0.58,
    contornoColor: 0xffc9a1,
    contornoInt: 0.95,
    hemiCielo: 0x6f8fc9,
    hemiSuelo: 0x3d3327,
    hemiInt: 0.52,
    estrellasBase: 0.08,
    destelloOp: 0.9,
    reflectores: 0.55,
  },
  dia: {
    id: 'dia',
    nombre: 'Mediodía atlántico (Cielo claro)',
    horizonte: 0x9bd2f5,
    paradas: [
      [0.00, '#0a2254'],
      [0.35, '#1b4ea3'],
      [0.62, '#3b82f6'],
      [0.78, '#7cc4fa'],
      [0.845, '#cbeafe'],
      [0.86, '#4a6b82'],
      [1.00, '#142430'],
    ],
    nubeLuz: 'rgba(255, 255, 255, 0.52)',
    nubeSombra: 'rgba(120, 155, 195, 0.25)',
    solPos: [0.72, 0.78, 0.48],
    solColor: 0xfffef8,
    solInt: 3.1,
    rellenoColor: 0xa5c8ff,
    rellenoInt: 0.85,
    contornoColor: 0xffffff,
    contornoInt: 0.7,
    hemiCielo: 0x9ad0ff,
    hemiSuelo: 0x455a44,
    hemiInt: 0.75,
    estrellasBase: 0.0,
    destelloOp: 0.7,
    reflectores: 0.05,
  },
  atardecer: {
    id: 'atardecer',
    nombre: 'Crepúsculo carmesí',
    horizonte: 0xe06d53,
    paradas: [
      [0.00, '#060515'],
      [0.34, '#1b133a'],
      [0.55, '#4c1d4b'],
      [0.70, '#9e2a4b'],
      [0.79, '#eb5e38'],
      [0.84, '#fca652'],
      [0.86, '#3d2432'],
      [1.00, '#100912'],
    ],
    nubeLuz: 'rgba(255, 148, 92, 0.45)',
    nubeSombra: 'rgba(48, 20, 46, 0.42)',
    solPos: [-0.88, 0.16, 0.45],
    solColor: 0xff9e66,
    solInt: 2.5,
    rellenoColor: 0x7e68b5,
    rellenoInt: 0.5,
    contornoColor: 0xff7b47,
    contornoInt: 1.05,
    hemiCielo: 0x8a5082,
    hemiSuelo: 0x2d1e24,
    hemiInt: 0.48,
    estrellasBase: 0.22,
    destelloOp: 0.92,
    reflectores: 0.82,
  },
  noche: {
    id: 'noche',
    nombre: 'Lanzamiento nocturno (Reflectores)',
    horizonte: 0x0c1933,
    paradas: [
      [0.00, '#02040a'],
      [0.45, '#040918'],
      [0.72, '#09152e'],
      [0.83, '#13284c'],
      [0.855, '#1b355c'],
      [0.865, '#0d1829'],
      [1.00, '#040710'],
    ],
    nubeLuz: 'rgba(110, 150, 210, 0.18)',
    nubeSombra: 'rgba(8, 14, 28, 0.45)',
    solPos: [0.82, 0.44, -0.45],
    solColor: 0x9ec5ff,
    solInt: 0.9,
    rellenoColor: 0x3b5998,
    rellenoInt: 0.42,
    contornoColor: 0x7aa8ff,
    contornoInt: 0.65,
    hemiCielo: 0x263c66,
    hemiSuelo: 0x101824,
    hemiInt: 0.38,
    estrellasBase: 0.92,
    destelloOp: 0.35,
    reflectores: 1.0,
  },
};

// --- Texturas procedurales (sin descargar imágenes) ------------------------------
function lienzo(w, h, pinta) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  pinta(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Cielo panorámico 360° con gradiente atmosférico, arreboles y bancos de nubes en el horizonte. */
function texturaCielo(cfg = PANORAMAS.amanecer) {
  return lienzo(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [stop, col] of cfg.paradas) g.addColorStop(stop, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    let s = 31;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 140; i++) {
      const cx = rnd() * w;
      const cy = h * (0.68 + rnd() * 0.155);
      const rx = 24 + rnd() * 110;
      const ry = 3 + rnd() * 12;
      ctx.fillStyle = i % 2 === 0 ? cfg.nubeLuz : cfg.nubeSombra;
      for (const dx of [-w, 0, w]) {
        ctx.beginPath();
        ctx.ellipse(cx + dx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Costa detallada de Cabo Cañaveral: laguna Banana River, isla barrera, Crawlerway, caminos, playa y Atlántico. */
const texturaCosta = () => lienzo(2048, 2048, (ctx, w, h) => {
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const gMar = ctx.createLinearGradient(w * 0.5, 0, w, 0);
  gMar.addColorStop(0, '#184366');
  gMar.addColorStop(0.25, '#143554');
  gMar.addColorStop(1, '#0c233b');
  ctx.fillStyle = gMar;
  ctx.fillRect(0, 0, w, h);

  const orilla = w * 0.55;
  const gBajio = ctx.createLinearGradient(orilla - 90, 0, orilla + 160, 0);
  gBajio.addColorStop(0, '#c9b189');
  gBajio.addColorStop(0.35, '#2b6e8c');
  gBajio.addColorStop(1, '#184366');
  ctx.fillStyle = gBajio;
  ctx.fillRect(orilla - 90, 0, 250, h);

  ctx.fillStyle = '#d4be96';
  ctx.fillRect(0, 0, orilla - 50, h);
  ctx.fillStyle = '#2d4930';
  ctx.fillRect(0, 0, orilla - 96, h);

  // Laguna costera (Banana River) al oeste
  ctx.fillStyle = '#183956';
  ctx.beginPath();
  ctx.ellipse(w * 0.16, h * 0.5, w * 0.13, h * 0.44, 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#28452c';
  ctx.beginPath();
  ctx.ellipse(w * 0.04, h * 0.5, w * 0.07, h * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = ['#3a5a38', '#253d27', '#486840', '#334d36', '#5c6b48'][i % 5];
    const px = rnd() * (orilla - 110);
    const py = rnd() * h;
    if (Math.hypot(px - w * 0.16, (py - h * 0.5) * 0.35) < w * 0.11) continue;
    ctx.beginPath();
    ctx.ellipse(px, py, 6 + rnd() * 34, 4 + rnd() * 20, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#e0f2fe';
  for (let i = 0; i < 520; i++) {
    ctx.fillRect(orilla - 45 + rnd() * (w - orilla + 20), rnd() * h, 18 + rnd() * 65, 2);
  }
  ctx.globalAlpha = 1;

  // Explanada del complejo, carreteras y doble vía del Crawlerway hacia el VAB
  const padX = w * 0.5;
  const padY = h * 0.5;
  ctx.fillStyle = '#8b8578';
  ctx.fillRect(padX - 420, padY - 12, 420, 9);
  ctx.fillRect(padX - 420, padY + 3, 420, 9);
  ctx.fillStyle = '#6c727a';
  ctx.fillRect(padX - 470, padY - 55, 75, 110);
  ctx.strokeStyle = '#646b73';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(padX, padY, 36, 0, Math.PI * 2);
  ctx.moveTo(padX - 180, h * 0.12);
  ctx.lineTo(padX - 180, h * 0.88);
  ctx.moveTo(padX - 420, padY + 45);
  ctx.lineTo(padX - 60, padY + 45);
  ctx.stroke();
});

/**
 * Detalle de pasto y matorral costero (gris neutro, media ≈ 0.5 en lineal): se repite cada ~40 m y
 * se multiplica sobre la textura grande de la costa solo donde esta es vegetación (ver `sueloCurvo`).
 */
const texturaPasto = () => {
  const tex = lienzo(512, 512, (ctx, w, h) => {
    let s = 29;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = '#bcbcb4';
    ctx.fillRect(0, 0, w, h);
    // Manchas de matas y suelo arenoso
    for (let i = 0; i < 260; i++) {
      const v = 150 + Math.floor(rnd() * 80);
      ctx.fillStyle = `rgba(${v},${v + 6},${v - 10},0.35)`;
      ctx.beginPath();
      ctx.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 26, 4 + rnd() * 16, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Briznas
    for (let i = 0; i < 9000; i++) {
      const v = 120 + Math.floor(rnd() * 130);
      ctx.strokeStyle = `rgba(${v},${v + 8},${v - 14},0.55)`;
      ctx.lineWidth = 1;
      const x = rnd() * w;
      const y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 4, y - 2 - rnd() * 5);
      ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
};

/**
 * Suelo de la zona de la rampa que sigue la curvatura de la Tierra: y = Y_SUELO − r²/(2R).
 * Coordenadas locales pequeñas (sin problemas de precisión) y siempre por encima de la esfera de la
 * Tierra, que se dibuja 30 m más abajo. `rIni..rFin` permite un disco opaco y un anillo que se funde.
 */
function sueloCurvo(rIni, rFin, extension, segRad) {
  const geo = new THREE.RingGeometry(Math.max(rIni, 0.01), rFin, 256, segRad);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const alfa = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r2 = x * x + z * z;
    pos.setY(i, Y_SUELO - r2 / (2 * R));
    // Mar al este (+x) como en Cabo Cañaveral; la textura cubre `extension` metros
    uv.setXY(i, 0.5 + x / extension, 0.5 - z / extension);
    const f = rIni > 1 ? 1 - (Math.sqrt(r2) - rIni) / (rFin - rIni) : 1;
    alfa.set([1, 1, 1, Math.max(0, Math.min(1, f))], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(alfa, 4));
  geo.computeVertexNormals();
  return geo;
}

function materialSuelo(texturas, transparente) {
  const m = new THREE.MeshStandardMaterial({
    map: texturas.costa,
    roughness: 0.95,
    vertexColors: transparente,
    transparent: transparente,
    depthWrite: !transparente,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.mapaPasto = { value: texturas.pasto };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D mapaPasto;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          vec3 base = sampledDiffuseColor.rgb;
          // Solo la vegetación (verde por encima del rojo y del azul) recibe el detalle del pasto
          float verde = smoothstep( 0.005, 0.03, base.g - max( base.r, base.b ) );
          vec3 detalle = texture2D( mapaPasto, vMapUv * 1500.0 ).rgb * 2.0;
          sampledDiffuseColor.rgb = mix( base, base * detalle, verde );
          diffuseColor *= sampledDiffuseColor;
        #endif`,
      );
  };
  return m;
}

const texturaConcreto = () => lienzo(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#92989e';
  ctx.fillRect(0, 0, w, h);
  let s = 5;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 3200; i++) {
    ctx.fillStyle = rnd() > 0.5 ? '#80868c' : '#a5abb0';
    ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
  ctx.strokeStyle = '#676d73';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo((w / 8) * i, 0);
    ctx.lineTo((w / 8) * i, h);
    ctx.moveTo(0, (h / 8) * i);
    ctx.lineTo(w, (h / 8) * i);
    ctx.stroke();
  }
  ctx.fillStyle = '#eab308';
  for (let x = 0; x < w; x += 32) {
    ctx.fillRect(x, 0, 16, 8);
    ctx.fillRect(x, h - 8, 16, 8);
  }
});

const texturaVAB = () => lienzo(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(w * 0.12, 0, w * 0.14, h);
  ctx.fillRect(w * 0.74, 0, w * 0.14, h);
  ctx.fillStyle = '#475569';
  for (let y = 20; y < h; y += 22) {
    ctx.fillRect(w * 0.14, y, w * 0.10, 12);
    ctx.fillRect(w * 0.76, y, w * 0.10, 12);
  }
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(w * 0.34, h * 0.18, w * 0.14, h * 0.24);
  ctx.fillStyle = '#ffffff';
  for (let i = 1; i < 7; i += 2) ctx.fillRect(w * 0.34, h * (0.18 + i * 0.034), w * 0.14, h * 0.034);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(w * 0.34, h * 0.18, w * 0.065, h * 0.13);
  ctx.beginPath();
  ctx.arc(w * 0.59, h * 0.30, w * 0.06, 0, Math.PI * 2);
  ctx.fill();
});

const texturaHumo = () => lienzo(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.88)');
  g.addColorStop(0.45, 'rgba(235,232,226,0.45)');
  g.addColorStop(1, 'rgba(220,216,210,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

/** Anillo suave para las ondas de telemetría (borde brillante que se difumina hacia adentro). */
const texturaOnda = () => lienzo(256, 256, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.48);
  g.addColorStop(0, 'rgba(79,195,247,0)');
  g.addColorStop(0.75, 'rgba(79,195,247,0.55)');
  g.addColorStop(0.9, 'rgba(200,240,255,1)');
  g.addColorStop(1, 'rgba(79,195,247,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

const texturaDestello = () => lienzo(256, 256, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,248,235,1)');
  g.addColorStop(0.18, 'rgba(255,205,140,0.85)');
  g.addColorStop(0.48, 'rgba(255,150,80,0.28)');
  g.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

function texturaTierra() {
  return lienzo(2048, 1024, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#dfeaf2');
    g.addColorStop(0.1, '#184a84');
    g.addColorStop(0.5, '#0b3468');
    g.addColorStop(0.9, '#184a84');
    g.addColorStop(1, '#dfeaf2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 34; i++) {
      const cx = rnd() * w;
      const cy = 160 + rnd() * (h - 320);
      const tam = 55 + rnd() * 175;
      for (let j = 0; j < 36; j++) {
        const lat = Math.abs(cy / h - 0.5) * 2;
        ctx.fillStyle = lat > 0.62 ? ['#5d6b52', '#6d7a5e'][j % 2] : ['#3a6636', '#56783c', '#88784c', '#487542'][j % 4];
        ctx.beginPath();
        ctx.ellipse(cx + (rnd() - 0.5) * tam * 1.7, cy + (rnd() - 0.5) * tam, tam * (0.2 + rnd() * 0.4), tam * (0.14 + rnd() * 0.3), rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#eef4f8';
    ctx.fillRect(0, 0, w, 54);
    ctx.fillRect(0, h - 54, w, 54);
  });
}

const texturaLuna = () => lienzo(512, 256, (ctx, w, h) => {
  ctx.fillStyle = '#b8bcc2';
  ctx.fillRect(0, 0, w, h);
  let s = 19;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 120; i++) {
    const r = 4 + rnd() * 36;
    ctx.fillStyle = i < 25 ? 'rgba(90,94,102,0.55)' : 'rgba(145,150,158,0.45)';
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
});

const texturaMarte = () => lienzo(512, 256, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f8fafc');
  g.addColorStop(0.08, '#c25934');
  g.addColorStop(0.5, '#b84726');
  g.addColorStop(0.92, '#9e3b1e');
  g.addColorStop(1, '#f1f5f9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  let s = 23;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(110,38,20,0.35)' : 'rgba(230,130,85,0.3)';
    ctx.beginPath();
    ctx.ellipse(rnd() * w, 24 + rnd() * (h - 48), 12 + rnd() * 48, 5 + rnd() * 18, rnd(), 0, Math.PI * 2);
    ctx.fill();
  }
});

const texturaJupiter = () => lienzo(512, 256, (ctx, w, h) => {
  const bandas = ['#c9b29b', '#d8c2a8', '#a67b5b', '#e6d5c3', '#9c6644', '#ddb892', '#b08968', '#e2cfb8', '#8c5e3c', '#cab59e'];
  const bh = h / bandas.length;
  bandas.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, i * bh, w, bh + 1);
  });
  ctx.fillStyle = '#c84b31';
  ctx.beginPath();
  ctx.ellipse(w * 0.62, h * 0.68, 34, 18, 0, 0, Math.PI * 2);
  ctx.fill();
});

const texturaNubes = () => lienzo(1024, 512, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  let s = 13;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  for (let i = 0; i < 360; i++) {
    ctx.globalAlpha = 0.12 + rnd() * 0.32;
    ctx.beginPath();
    ctx.ellipse(rnd() * w, 36 + rnd() * (h - 72), 18 + rnd() * 82, 3 + rnd() * 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
});

function estrellas(radio, n = 4400) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const enViaLactea = i < n * 0.35;
    const u = enViaLactea ? (Math.random() - 0.5) * 0.28 : Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const k = Math.sqrt(Math.max(0, 1 - u * u));
    const x = radio * k * Math.cos(a);
    let y = radio * u;
    let z = radio * k * Math.sin(a);
    if (enViaLactea) {
      const inc = 0.95;
      const ny = y * Math.cos(inc) - z * Math.sin(inc);
      const nz = y * Math.sin(inc) + z * Math.cos(inc);
      y = ny;
      z = nz;
    }
    pos.set([x, y, z], i * 3);
    const c = 0.52 + Math.random() * 0.48;
    const tinte = Math.random();
    col.set([tinte > 0.8 ? c : c * 0.92, c * 0.95, tinte < 0.6 ? Math.min(1, c * 1.12) : c * 0.82], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      vertexColors: true,
      size: 1.8,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    }),
  );
}

function brillo(radio, color, opacidad) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radio, 96, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: opacidad,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
}

// --- Complejo de lanzamiento libre de colisiones ----------------------------------
/**
 * Construye la torre de servicio en `x = xTorre` (con la base sobre la terraza en `y = -0.5`).
 * Calcula el largo exacto de cada brazo umbilical según el perfil real del cohete (`cajas`)
 * para que ningún brazo atraviese los propulsores laterales ni el cuerpo principal.
 */
function torreServicio(alto, xTorre, cajas) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x9c3a22, roughness: 0.5, metalness: 0.48 });
  const aceroGris = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.6 });
  const blanco = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4, metalness: 0.2 });
  const amarillo = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4, metalness: 0.35 });
  const lado = Math.max(7.2, alto * 0.082);
  const H = alto * 1.05;

  // 4 Columnas principales + núcleo de ascensor central
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(lado * 0.085, H, lado * 0.085), metal);
    col.position.set((sx * lado) / 2, H / 2, (sz * lado) / 2);
    g.add(col);
  }
  const nucleo = new THREE.Mesh(new THREE.BoxGeometry(lado * 0.34, H * 0.98, lado * 0.34), aceroGris);
  nucleo.position.y = H * 0.49;
  g.add(nucleo);

  const pisos = Math.max(7, Math.round(H / 11));
  const hPiso = H / pisos;
  // Diagonales contenidas dentro del marco (factor 0.88 para que no sobresalgan de las columnas)
  const diagLen = Math.hypot(lado * 0.88, hPiso * 0.88);
  const diagAng = Math.atan2(lado, hPiso);
  const brazos = [];

  // Radio izquierdo real del cohete a la altura `y` (evita chocar con boosters o aletas)
  const bordeIzqCoheteEn = (y) => {
    let minX = -2.0;
    for (const c of Object.values(cajas || {})) {
      if (y >= c.minY - 1.5 && y <= c.maxY + 1.5) minX = Math.min(minX, c.minX);
    }
    return minX;
  };

  for (let i = 1; i <= pisos; i++) {
    const y = hPiso * i;
    const marco = new THREE.Mesh(new THREE.BoxGeometry(lado, lado * 0.055, lado), metal);
    marco.position.y = y;
    g.add(marco);

    for (const sz of [-lado * 0.46, lado * 0.46]) {
      for (const sgn of [-1, 1]) {
        const viga = new THREE.Mesh(new THREE.BoxGeometry(lado * 0.035, diagLen, lado * 0.035), metal);
        viga.position.set(0, y - hPiso * 0.5, sz);
        viga.rotation.z = sgn * diagAng;
        g.add(viga);
      }
    }

    // Brazos umbilicales articulados en la esquina delantera (+x, -z) para girar hacia afuera al retraerse
    if (i % 2 === 0 && i < pisos) {
      const xPivoteMundo = xTorre + lado * 0.48;
      const xObjetivoMundo = bordeIzqCoheteEn(y) - 0.65; // termina a 65 cm del fuselaje sin tocarlo
      const largoBrazo = Math.max(2.5, xObjetivoMundo - xPivoteMundo);

      const pivote = new THREE.Group();
      pivote.position.set(lado * 0.48, y, -lado * 0.36);
      const brazo = new THREE.Mesh(new THREE.BoxGeometry(largoBrazo, lado * 0.055, lado * 0.14), metal);
      brazo.position.set(largoBrazo * 0.5, 0, lado * 0.18);
      const tuberia = new THREE.Mesh(new THREE.CylinderGeometry(lado * 0.022, lado * 0.022, largoBrazo, 8), aceroGris);
      tuberia.rotation.z = Math.PI / 2;
      tuberia.position.set(largoBrazo * 0.5, lado * 0.045, lado * 0.1);
      pivote.add(brazo, tuberia);

      if (i >= pisos - 2) {
        const cuartoBlanco = new THREE.Mesh(new THREE.BoxGeometry(lado * 0.24, lado * 0.2, lado * 0.26), blanco);
        cuartoBlanco.position.set(largoBrazo - lado * 0.1, 0, lado * 0.22);
        pivote.add(cuartoBlanco);
      }
      g.add(pivote);
      brazos.push(pivote);
    }
  }

  // Grúa martillo en la cumbre
  const gruaBase = new THREE.Mesh(new THREE.CylinderGeometry(lado * 0.2, lado * 0.24, lado * 0.2, 12), aceroGris);
  gruaBase.position.y = H + lado * 0.1;
  const gruaPluma = new THREE.Mesh(new THREE.BoxGeometry(lado * 1.9, lado * 0.12, lado * 0.26), amarillo);
  gruaPluma.position.set(lado * 0.35, H + lado * 0.22, 0);
  const contrapeso = new THREE.Mesh(new THREE.BoxGeometry(lado * 0.42, lado * 0.2, lado * 0.32), aceroGris);
  contrapeso.position.set(-lado * 0.52, H + lado * 0.2, 0);
  g.add(gruaBase, gruaPluma, contrapeso);

  return { grupo: g, brazos, altoTorre: H + lado * 0.32 };
}

function rampa(alto, cajas, texturas) {
  const g = new THREE.Group();
  const sujeciones = [];
  const balizas = [];
  const hacesReflectores = [];
  const lucesReflectores = [];

  // Dimensiones reales de la base del cohete para dejar el pozo de escape y los mástiles sin colisiones
  let minXBase = -3;
  let maxXBase = 3;
  for (const c of Object.values(cajas || {})) {
    if (c.minY < 6) {
      minXBase = Math.min(minXBase, c.minX);
      maxXBase = Math.max(maxXBase, c.maxX);
    }
  }
  const semiAnchoX = Math.max(4.5, (maxXBase - minXBase) * 0.5);
  const semiAnchoZ = Math.max(3.8, alto * 0.052);

  // 1. Terreno costero curvo (sigue la Tierra): disco opaco de 20 km y anillo que se funde con la
  //    esfera hasta 32 km. Una sola capa de suelo: la esfera de la Tierra queda 30 m más abajo.
  const EXT_COSTA = 60000;
  const suelo = new THREE.Mesh(sueloCurvo(0, 20000, EXT_COSTA, 140), materialSuelo(texturas, false));
  const bordeSuelo = new THREE.Mesh(sueloCurvo(20000, 32000, EXT_COSTA, 24), materialSuelo(texturas, true));
  bordeSuelo.renderOrder = -1;
  g.add(suelo, bordeSuelo);

  const matConcreto = new THREE.MeshStandardMaterial({ map: texturas.pad, roughness: 0.9 });
  const matOscuro = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.96 });
  const matAcero = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.45, metalness: 0.65 });
  const matRojo = new THREE.MeshStandardMaterial({ color: 0x9c3a22, roughness: 0.55, metalness: 0.4 });
  const matBlanco = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.25 });
  const matAzul = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.3 });

  // 2. Terraza inferior octogonal (de Y_SUELO = -5.6 m a -3.0 m)
  const baseInf = new THREE.Mesh(new THREE.CylinderGeometry(44, 56, 2.6, 8), matConcreto);
  baseInf.position.y = -4.3;
  g.add(baseInf);

  // Terraza superior dividida en dos grandes bloques laterales (de -3.0 m a -0.5 m),
  // dejando en el centro el canal abierto de la trinchera de llamas (z = -8.5..+8.5)
  const anchoCanal = Math.max(15, semiAnchoX * 2.1);
  const bloqueOeste = new THREE.Mesh(new THREE.BoxGeometry(24, 2.5, 64), matConcreto);
  bloqueOeste.position.set(-(anchoCanal * 0.5 + 12), -1.75, 0);
  const bloqueEste = new THREE.Mesh(new THREE.BoxGeometry(24, 2.5, 64), matConcreto);
  bloqueEste.position.set(anchoCanal * 0.5 + 12, -1.75, 0);
  // Piso oscuro de la trinchera en y = -3.0 m y deflector en cuña de y = -3.0 m a -1.2 m (bajo las toberas)
  const pisoTrinchera = new THREE.Mesh(new THREE.BoxGeometry(anchoCanal, 0.3, 68), matOscuro);
  pisoTrinchera.position.set(0, -2.9, 0);
  const deflector = new THREE.Mesh(new THREE.ConeGeometry(anchoCanal * 0.42, 18, 4), matRojo);
  deflector.position.set(0, -2.15, 0);
  deflector.rotation.y = Math.PI / 4;
  deflector.scale.set(1, 0.35, 1.8);
  g.add(bloqueOeste, bloqueEste, pisoTrinchera, deflector);

  // 3. Plataforma Móvil de Lanzamiento (MLP, de y = -0.5 m a -0.08 m) con pozo abierto bajo los motores
  const huecoX = semiAnchoX * 2 + 1.6;
  const huecoZ = semiAnchoZ * 2 + 1.6;
  const marcoAncho = 4.2;
  const vigaNorte = new THREE.Mesh(new THREE.BoxGeometry(huecoX + marcoAncho * 2, 0.42, marcoAncho), matAcero);
  vigaNorte.position.set(0, -0.29, -(huecoZ * 0.5 + marcoAncho * 0.5));
  const vigaSur = new THREE.Mesh(new THREE.BoxGeometry(huecoX + marcoAncho * 2, 0.42, marcoAncho), matAcero);
  vigaSur.position.set(0, -0.29, huecoZ * 0.5 + marcoAncho * 0.5);
  const vigaOeste = new THREE.Mesh(new THREE.BoxGeometry(marcoAncho, 0.42, huecoZ), matAcero);
  vigaOeste.position.set(-(huecoX * 0.5 + marcoAncho * 0.5), -0.29, 0);
  const vigaEste = new THREE.Mesh(new THREE.BoxGeometry(marcoAncho, 0.42, huecoZ), matAcero);
  vigaEste.position.set(huecoX * 0.5 + marcoAncho * 0.5, -0.29, 0);
  g.add(vigaNorte, vigaSur, vigaOeste, vigaEste);

  // 4 Mástiles de servicio de cola (Tail Service Masts) fuera del perímetro de los motores/boosters
  const hMastilCola = Math.max(2.2, alto * 0.032);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const piv = new THREE.Group();
    piv.position.set(sx * (semiAnchoX + 1.8), -0.08, sz * (semiAnchoZ + 1.4));
    const mastil = new THREE.Mesh(new THREE.BoxGeometry(1.1, hMastilCola, 0.9), matAcero);
    mastil.position.set(0, hMastilCola * 0.5, 0);
    piv.add(mastil);
    g.add(piv);
    sujeciones.push({ pivote: piv, dir: sx });
  }

  // 4. Torre de servicio fija apoyada sobre el bloque oeste (y = -0.5 m)
  const ladoTorre = Math.max(7.2, alto * 0.082);
  const xTorre = -(anchoCanal * 0.5 + ladoTorre * 0.55 + 4.5);
  const { grupo: torre, brazos, altoTorre } = torreServicio(alto, xTorre, cajas);
  torre.position.set(xTorre, -0.5, 0);
  g.add(torre);

  // 5. Torre de agua de supresión acústica apoyada sobre el suelo (y = Y_SUELO)
  const torreAgua = new THREE.Group();
  const hAgua = Math.max(42, alto * 0.62);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, hAgua * 0.72, 8), matBlanco);
    pata.position.set(Math.cos(a) * 5.2, hAgua * 0.36, Math.sin(a) * 5.2);
    torreAgua.add(pata);
  }
  const tanqueAgua = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, hAgua * 0.24, 20), matBlanco);
  tanqueAgua.position.y = hAgua * 0.8;
  const franjaAzul = new THREE.Mesh(new THREE.CylinderGeometry(6.58, 6.58, hAgua * 0.06, 20), matAzul);
  franjaAzul.position.y = hAgua * 0.8;
  const cupulaAgua = new THREE.Mesh(new THREE.ConeGeometry(6.6, hAgua * 0.12, 20), matBlanco);
  cupulaAgua.position.y = hAgua * 0.98;
  const tuboBajada = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, hAgua * 0.78, 12), matAcero);
  tuboBajada.position.y = hAgua * 0.39;
  torreAgua.add(tanqueAgua, franjaAzul, cupulaAgua, tuboBajada);
  torreAgua.position.set(42, Y_SUELO, -46);
  g.add(torreAgua);

  // 6. Esferas criogénicas de LOX y LH2 en el perímetro exterior (sobre Y_SUELO)
  for (const [zTanque, radioEsf, colEsf] of [[-72, 7.5, matBlanco], [72, 8.2, matAcero]]) {
    const grupoEsf = new THREE.Group();
    const esf = new THREE.Mesh(new THREE.SphereGeometry(radioEsf, 24, 18), colEsf);
    esf.position.y = radioEsf + 2.2;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, radioEsf + 1.5, 6), matAcero);
      col.position.set(Math.cos(a) * (radioEsf * 0.88), (radioEsf + 1.5) * 0.5, Math.sin(a) * (radioEsf * 0.88));
      grupoEsf.add(col);
    }
    const berma = new THREE.Mesh(new THREE.CylinderGeometry(radioEsf * 1.6, radioEsf * 1.75, 0.8, 24), matConcreto);
    berma.position.y = 0.4;
    grupoEsf.add(esf, berma);
    grupoEsf.position.set(-18, Y_SUELO, zTanque);
    g.add(grupoEsf);
  }

  // 7. Cuatro torres pararrayos perimetrales con cables catenarios y balizas rojas
  const matMastil = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.55 });
  const matBaliza = new THREE.MeshBasicMaterial({ color: 0xff2a2a, fog: false });
  const cimas = [];
  const hMastil = alto * 1.38;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const mx = Math.cos(a) * 64;
    const mz = Math.sin(a) * 64;
    const m = new THREE.Group();
    const baseCelosia = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 3.2, hMastil * 0.28, 4), matAcero);
    baseCelosia.position.y = hMastil * 0.14;
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.05, hMastil * 0.72, 10), matMastil);
    palo.position.y = hMastil * 0.64;
    const punta = new THREE.Mesh(new THREE.ConeGeometry(0.45, alto * 0.1, 8), matRojo);
    punta.position.y = hMastil + alto * 0.05;
    const luzRoja = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 8), matBaliza.clone());
    luzRoja.position.y = hMastil + alto * 0.11;
    balizas.push(luzRoja);
    m.add(baseCelosia, palo, punta, luzRoja);
    m.position.set(mx, Y_SUELO, mz);
    g.add(m);
    cimas.push(new THREE.Vector3(mx, Y_SUELO + hMastil + alto * 0.06, mz));
  }
  const balizaTorre = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), matBaliza.clone());
  balizaTorre.position.set(xTorre, -0.5 + altoTorre, 0);
  balizas.push(balizaTorre);
  g.add(balizaTorre);

  const matCable = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 4; i++) {
    const p1 = cimas[i];
    const p2 = cimas[(i + 1) % 4];
    const pts = [];
    for (let s = 0; s <= 16; s++) {
      const u = s / 16;
      const v = new THREE.Vector3().lerpVectors(p1, p2, u);
      v.y -= Math.sin(u * Math.PI) * (alto * 0.08);
      pts.push(v);
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matCable));
  }

  // 8. Reflectores de xenón perimetrales
  const matHaz = new THREE.MeshBasicMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.35;
    const rx = Math.cos(a) * 48;
    const rz = Math.sin(a) * 48;
    const hazLen = alto * 1.1;
    const conoHaz = new THREE.Mesh(new THREE.ConeGeometry(alto * 0.18, hazLen, 16, 1, true), matHaz.clone());
    const origen = new THREE.Vector3(rx, Y_SUELO + 1.2, rz);
    const destino = new THREE.Vector3(0, alto * 0.45, 0);
    const medio = new THREE.Vector3().addVectors(origen, destino).multiplyScalar(0.5);
    conoHaz.position.copy(medio);
    conoHaz.lookAt(destino);
    conoHaz.rotateX(Math.PI / 2);
    g.add(conoHaz);
    hacesReflectores.push(conoHaz);
  }
  const spotPad = new THREE.PointLight(0xdbeafe, 1.2, alto * 4, 1.5);
  spotPad.position.set(28, alto * 0.35, 28);
  g.add(spotPad);
  lucesReflectores.push(spotPad);

  // 9. Edificio de Ensamblaje Vertical (VAB) y Centro de Control (LCC) apoyados en Y_SUELO
  const vab = new THREE.Mesh(
    new THREE.BoxGeometry(158, 160, 218),
    new THREE.MeshStandardMaterial({ map: texturas.vab, roughness: 0.7 }),
  );
  vab.position.set(-2400, Y_SUELO + 80, -180);
  const lcc = new THREE.Mesh(new THREE.BoxGeometry(48, 26, 115), matBlanco);
  lcc.position.set(-2180, Y_SUELO + 13, 40);
  g.add(vab, lcc);

  return { grupo: g, brazos, sujeciones, balizas, hacesReflectores, lucesReflectores };
}

// --- Sistema de plumas de motor (100% conos hacia -y; jamás cubren el cohete) -----
function crearPenacho(radio, colorNucleo = 0xfff5e0, colorManto = 0xff9436, colorExterno = 0xff521b) {
  const g = new THREE.Group();
  // Cada cono tiene altura `h` y su ápice en y = 0: toda la geometría se extiende hacia abajo (y <= 0).
  // Al variar la escala vertical de una capa se reubica para que el ápice quede siempre en la tobera.
  const capa = (r, h, color, op) => {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: op,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      }),
    );
    m.rotation.x = Math.PI;
    m.position.y = -h * 0.5;
    m.userData = { h, op };
    return m;
  };
  const ext = capa(radio * 0.5, 1.0, colorExterno, 0.45);
  const manto = capa(radio * 0.34, 0.82, colorManto, 0.78);
  const nucleo = capa(radio * 0.18, 0.58, colorNucleo, 0.95);
  const ondaInterna = capa(radio * 0.11, 0.36, 0xffffff, 0.9);
  g.add(ext, manto, nucleo, ondaInterna);

  // Diamantes de choque (discos de Mach): lentes brillantes dentro del núcleo, solo cerca del suelo
  // en motores de queroseno. Forma y espaciado ilustrativos.
  const diamantes = [];
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Mesh(
      new THREE.SphereGeometry(1, 14, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    d.scale.set(radio * (0.13 - i * 0.018), 0.022, radio * (0.13 - i * 0.018));
    d.position.y = -0.07 - i * 0.075;
    d.visible = false;
    g.add(d);
    diamantes.push(d);
  }
  g.userData = { ext, manto, nucleo, ondaInterna, diamantes, capas: [ext, manto, nucleo, ondaInterna], fase: Math.random() * 10 };
  return g;
}

function crearLlama(diam) {
  const g = new THREE.Group();
  const rPen = Math.min(diam * 0.55, 5.2);
  const pCentral = crearPenacho(rPen);
  const pIzq = crearPenacho(rPen * 0.82);
  const pDer = crearPenacho(rPen * 0.82);
  const pNorte = crearPenacho(rPen * 0.82);
  const pSur = crearPenacho(rPen * 0.82);
  g.add(pCentral, pIzq, pDer, pNorte, pSur);
  // Brillo en la salida de cada tobera (sprite aparte: dentro del penacho se deformaría con su escala)
  const texBrillo = texturaDestello();
  for (const pen of [pCentral, pIzq, pDer, pNorte, pSur]) {
    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrillo, color: 0xffe6b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    b.scale.setScalar(rPen * 1.3);
    g.add(b);
    pen.userData.brillo = b;
  }
  g.userData = { pCentral, pIzq, pDer, pNorte, pSur };
  return g;
}

/**
 * Disco fino de condensación transónica con perforación central mayor que el fuselaje,
 * de modo que rodea el exterior sin tapar ni blanquear nunca la pintura del cohete.
 */
function crearAnilloMach(radioCuerpo, altura) {
  const rInt = Math.max(1.8, radioCuerpo * 1.25);
  const rExt = rInt * 2.3;
  const m = new THREE.Mesh(
    new THREE.RingGeometry(rInt, rExt, 36),
    new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    }),
  );
  m.rotation.x = Math.PI / 2;
  m.position.y = altura * 0.62;
  m.visible = false;
  return m;
}

/** Chorro del motor de desprendimiento de la torre de escape (LES), en coordenadas de la torre (metros). */
function crearChorroSeparacion(cajaEtapa) {
  const g = new THREE.Group();
  const largo = Math.max(6, cajaEtapa.alto * 0.9);
  const cono = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, largo, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff9f43,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    }),
  );
  // El motor apunta hacia abajo desde la base de la torre
  cono.rotation.x = Math.PI;
  cono.position.set(0, -cajaEtapa.alto * 0.5 - largo * 0.35, 0);
  g.add(cono);
  return g;
}

// =================================================================================
export function crearEscena(canvas, { reducirMovimiento = false, renderer: rendererInyectado = null } = {}) {
  const renderer = rendererInyectado || new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio?.(Math.min(globalThis.devicePixelRatio ?? 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const texTierra = texturaTierra();
  const texNubes = texturaNubes();
  const texturas = {
    costa: Object.assign(texturaCosta(), { anisotropy: 8 }),
    pad: texturaConcreto(),
    pasto: texturaPasto(),
    vab: texturaVAB(),
    cieloPorPanorama: Object.fromEntries(Object.entries(PANORAMAS).map(([k, v]) => [k, texturaCielo(v)])),
  };

  // ---------- Vista local (metros, origen flotante, panoramas) ----------
  const local = new THREE.Scene();
  local.background = new THREE.Color(CIELO_ALTO);
  local.fog = new THREE.Fog(PANORAMAS.amanecer.horizonte, 3000, 30000);
  const camLocal = new THREE.PerspectiveCamera(48, 1, 0.5, 5e8);

  const sol = new THREE.DirectionalLight(0xffe3bd, 2.65);
  sol.position.set(1, 0.21, 0.42);
  const relleno = new THREE.DirectionalLight(0x8fb0e8, 0.58);
  relleno.position.set(-1, 0.5, -0.6);
  const contorno = new THREE.DirectionalLight(0xffc9a1, 0.95);
  contorno.position.set(-0.4, 0.3, 1);
  const hemi = new THREE.HemisphereLight(0x6f8fc9, 0x3d3327, 0.52);
  const luzMotor = new THREE.PointLight(0xff8c42, 0, 1, 2);
  local.add(sol, relleno, contorno, hemi, luzMotor);

  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(900000, 40, 28),
    new THREE.MeshBasicMaterial({
      map: texturas.cieloPorPanorama.amanecer,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  cielo.renderOrder = -10;
  local.add(cielo);

  const destelloSol = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texturaDestello(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false,
    }),
  );
  destelloSol.renderOrder = -9;
  local.add(destelloSol);

  const cieloEstrellas = estrellas(1e7);
  local.add(cieloEstrellas);

  const tierra = new THREE.Group();
  // La esfera va 30 m por debajo del nivel real: cerca de la rampa manda el suelo curvo de `rampa()`
  // y así nunca se cruzan (con 384 segmentos las caras quedan como mucho ~210 m bajo la superficie).
  const matTierra = new THREE.MeshStandardMaterial({ map: texTierra, roughness: 0.85 });
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(R - 30, 384, 192), matTierra);
  const matNubes = new THREE.MeshStandardMaterial({ map: texNubes, transparent: true, depthWrite: false, roughness: 1 });
  const nubes = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 128, 64), matNubes);
  const globo = new THREE.Group();
  globo.quaternion.copy(QUAT_CABO);
  globo.add(esfera, nubes);
  tierra.add(globo, brillo(R * 1.012, 0x67b8ff, 0.14), brillo(R * 1.024, 0x2b6cb0, 0.12));
  local.add(tierra);

  // Nubes 3D lejanas alrededor del complejo (a > 650 m del eje de lanzamiento para no tapar nunca el cohete)
  const matNubeLocal = new THREE.SpriteMaterial({
    map: texturaHumo(),
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  const capaNubesLocal = new THREE.Group();
  capaNubesLocal.position.set(0, R, 0);
  for (let i = 0; i < 40; i++) {
    const sp = new THREE.Sprite(matNubeLocal);
    const ang = (i / 40) * Math.PI * 2 + (i % 3) * 0.25;
    const dist = 900 + (i % 6) * 650;
    const altNube = 2200 + (i % 5) * 700;
    sp.position.set(Math.cos(ang) * dist, altNube, Math.sin(ang) * dist);
    sp.scale.set(420 + (i % 4) * 160, 130 + (i % 3) * 50, 1);
    capaNubesLocal.add(sp);
  }
  tierra.add(capaNubesLocal);

  const cohete = new THREE.Group();
  local.add(cohete);
  // Ondas de telemetría: anillos tenues que salen de la punta del cohete (efecto ilustrativo)
  const texOnda = texturaOnda();
  const ondas = [];
  let proxOnda = 0;

  const controles = new OrbitControls(camLocal, canvas);
  controles.enableDamping = !reducirMovimiento;
  controles.maxDistance = 1e6;
  controles.minDistance = 2;
  let usuarioMovio = false;
  controles.addEventListener('start', () => { usuarioMovio = true; });

  const matHumo = new THREE.SpriteMaterial({ map: texturaHumo(), transparent: true, depthWrite: false });
  const matChispa = new THREE.SpriteMaterial({
    map: texturaDestello(),
    color: 0xffb74d,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const humo = [];
  const MAX_HUMO = 600; // nube en tierra, chorro en vuelo y venteos
  const columna = [];
  const MAX_COLUMNA = 480; // columna de escape que queda fija en el cielo
  const anillosSep = [];
  const chispasSep = [];
  const emisores = []; // retrocohetes y motores de ullage (chorros de partículas)
  const pendientesSep = []; // separaciones con retardo real entre el corte y la suelta
  const apagadas = new Set(); // grupos de motores ya cortados aunque la etapa siga unida
  const shakeOff = new THREE.Vector3();
  const vAux = new THREE.Vector3();
  const ejeZ = new THREE.Vector3(0, 0, 1);
  const ejeY = new THREE.Vector3(0, 1, 0);

  // ---------- Vista global (kilómetros) ----------
  const global = new THREE.Scene();
  global.background = new THREE.Color(0x02040c);
  const camGlobal = new THREE.PerspectiveCamera(45, 1, 10, 5e6);
  global.add(new THREE.AmbientLight(0xffffff, 0.32));
  const solG = new THREE.DirectionalLight(0xfff0dd, 2.4);
  solG.position.set(1, 0.4, 0.9);
  const estrellasG = estrellas(4e6, 4600);
  estrellasG.material.opacity = 1;
  global.add(solG, estrellasG);
  const tierraG = new THREE.Mesh(new THREE.SphereGeometry(R / 1000, 128, 64), matTierra);
  const nubesG = new THREE.Mesh(new THREE.SphereGeometry((R / 1000) * 1.006, 96, 48), matNubes);
  const globoG = new THREE.Group();
  globoG.quaternion.copy(QUAT_CABO);
  globoG.add(tierraG, nubesG);
  global.add(globoG, brillo((R / 1000) * 1.035, 0x4fa3ff, 0.22));

  // Texturas reales de la Tierra (Blue Marble; ver FUENTES.md). Mientras cargan, o si fallan,
  // queda el mapa estilizado.
  try {
    const cargador = new THREE.TextureLoader();
    cargador.load('texturas/tierra-color-4k.jpg', (tx) => {
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.anisotropy = 8;
      matTierra.map = tx;
      matTierra.needsUpdate = true;
    }, undefined, () => {});
    cargador.load('texturas/tierra-nubes-2k.jpg', (tx) => {
      // La imagen de nubes es blanca sobre negro: se usa como canal alfa
      matNubes.map = null;
      matNubes.alphaMap = tx;
      matNubes.color.set(0xffffff);
      matNubes.opacity = 0.6;
      matNubes.needsUpdate = true;
    }, undefined, () => {});
  } catch {
    /* sin cargador de imágenes (pruebas en Node) */
  }
  const linea = (color, op = 1) => {
    const l = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color, transparent: op < 1, opacity: op }),
    );
    l.frustumCulled = false;
    global.add(l);
    return l;
  };
  const trayG = linea(0xff6b35);
  const orbitaG = linea(0x4fc3f7, 0.85);
  const salidaG = linea(0x4ade80);
  const marcador = new THREE.Mesh(
    new THREE.SphereGeometry(65, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  global.add(marcador);

  const texAstros = {
    luna: texturaLuna(),
    marte: texturaMarte(),
    jupiter: texturaJupiter(),
  };
  const luna = new THREE.Mesh(
    new THREE.SphereGeometry(1737, 48, 24),
    new THREE.MeshStandardMaterial({ map: texAstros.luna, roughness: 0.95 }),
  );
  luna.visible = false;
  global.add(luna);
  const controlesG = new OrbitControls(camGlobal, canvas);
  controlesG.enabled = false;
  controlesG.enableDamping = !reducirMovimiento;

  // ---------- Posproceso: bloom solo en lo muy brillante (llamas, chispas, destellos) ----------
  // Con un renderer inyectado (pruebas en Node) no hay WebGL: se dibuja directo, sin compositor.
  let composer = null;
  let pasoRender = null;
  let pasoBloom = null;
  if (!rendererInyectado) {
    try {
      composer = new EffectComposer(renderer);
      pasoRender = new RenderPass(local, camLocal);
      pasoBloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.45, 0.82);
      composer.addPass(pasoRender);
      composer.addPass(pasoBloom);
      composer.addPass(new OutputPass());
    } catch {
      composer = null;
    }
  }
  // Si los cuadros tardan > 33 ms durante ~2 s seguidos, se apaga el bloom para no trabar el juego
  let tLento = 0;
  const EXPOSICION_BASE = 1.12;

  // ---------- Estado ----------
  let actual = null; // { id, grupo, etapas, cajas, alasSolares, altura, fuego, anilloMach, diam }
  let modo = 'persecucion';
  let panoramaActual = 'amanecer';
  let rastro = [];
  let restos = [];
  let omegaSuelo = 0;
  let ultimo = null;
  let sitio = null;
  let lanzado = false;
  let cofiaSoltada = false;
  let progSolar = 0;
  let reloj = 0;
  let proxVapor = 0;
  let etapaEncendidaId = '';
  let tEncendidoSim = 0;
  let encAnterior = false;
  let tUltimoEncendido = -1e9; // reloj real del último encendido (adaptación de exposición)
  let visual = {}; // tiempos visuales con fuente del cohete actual (cohetes.json → visual)
  let ultimaColumna = null; // último punto (en `tierra`) donde se dejó humo de la columna
  let ancla = null; // punto fijo en tierra de la cámara de seguimiento
  let alSeleccionar = null;
  let seleccionada = null;
  const brillosOriginales = new Map();

  function setPanorama(id = 'amanecer') {
    const cfg = PANORAMAS[id] || PANORAMAS.amanecer;
    panoramaActual = cfg.id;
    cielo.material.map = texturas.cieloPorPanorama[cfg.id];
    cielo.material.needsUpdate = true;
    sol.position.set(...cfg.solPos);
    sol.color.setHex(cfg.solColor);
    sol.intensity = cfg.solInt;
    relleno.color.setHex(cfg.rellenoColor);
    relleno.intensity = cfg.rellenoInt;
    contorno.color.setHex(cfg.contornoColor);
    contorno.intensity = cfg.contornoInt;
    hemi.color.setHex(cfg.hemiCielo);
    hemi.groundColor.setHex(cfg.hemiSuelo);
    hemi.intensity = cfg.hemiInt;
    if (sitio) {
      for (const h of sitio.hacesReflectores) h.material.opacity = 0.09 * cfg.reflectores;
      for (const l of sitio.lucesReflectores) l.intensity = 1.8 * cfg.reflectores;
    }
    if (ultimo) ponerEstado(ultimo);
  }

  function cargarCohete(id, latitud = 28.5, datosVisuales = {}) {
    cohete.clear();
    for (const r of restos) local.remove(r.obj);
    for (const a of anillosSep) local.remove(a.mesh);
    for (const c of chispasSep) local.remove(c.s);
    for (const sp of humo) tierra.remove(sp.s);
    for (const sp of columna) tierra.remove(sp.s);
    for (const o of ondas) o.s.visible = false;
    proxOnda = 0;
    for (const em of emisores) for (const p of em.particulas) local.remove(p.s);
    restos = [];
    anillosSep.length = 0;
    chispasSep.length = 0;
    rastro = [];
    humo.length = 0;
    columna.length = 0;
    emisores.length = 0;
    pendientesSep.length = 0;
    apagadas.clear();
    visual = datosVisuales || {};
    lanzado = false;
    cofiaSoltada = false;
    progSolar = 0;
    etapaEncendidaId = '';
    tEncendidoSim = 0;
    encAnterior = false;
    tUltimoEncendido = -1e9;
    ultimaColumna = null;
    ancla = null;
    renderer.toneMappingExposure = EXPOSICION_BASE;
    ultimo = null;
    usuarioMovio = false;
    quitarSeleccion();

    const { grupo, etapas, cajas, alasSolares, altura, escala } = armarCohete(THREE, id);
    const diam = new THREE.Box3().setFromObject(grupo).getSize(new THREE.Vector3()).x;
    const radioSup = (cajas.nave?.ancho ?? cajas.cofia?.ancho ?? diam * 0.4) * 0.5;
    const fuego = crearLlama(diam);
    fuego.visible = false;
    const anilloMach = crearAnilloMach(radioSup, altura);
    cohete.add(grupo, fuego, anilloMach);
    luzMotor.distance = altura * 12;
    actual = { id, grupo, etapas, cajas, alasSolares, altura, escala, fuego, anilloMach, diam };
    omegaSuelo = 7.2921159e-5 * Math.cos((latitud * Math.PI) / 180);

    if (sitio) tierra.remove(sitio.grupo);
    sitio = rampa(altura, cajas, texturas);
    sitio.grupo.position.set(0, R, 0);
    tierra.add(sitio.grupo);
    // Cámara de seguimiento: fija en tierra, de costado a la trayectoria (que va hacia +x, el este)
    ancla = new THREE.Vector3(-700, R + 25, 3200);
    setPanorama(panoramaActual);

    for (const l of [trayG, orbitaG, salidaG]) l.geometry.setFromPoints([]);
    luna.visible = false;
    ponerEstado({ t: 0, x: 0, y: R, pitch: Math.PI / 2, empuje: 0, h: 0, vr: 0, vt: 0, vRel: 0, masa: 0 });
    autoAbordoHasta = -1;
    if (autoActivo) aplicarCamara(camaraAuto(null), true);
    else setCamara(modo === 'global' ? 'persecucion' : modo, true);
  }

  /** Actualiza la posición y forma de las plumas de escape para la etapa activa (siempre hacia -y). */
  function actualizarPlumas(e, pAtm) {
    const { id, etapas, cajas, fuego, diam, altura } = actual;
    const { pCentral, pIzq, pDer, pNorte, pSur } = fuego.userData;
    // Una etapa cuenta como activa si sigue unida y sus motores no se cortaron (retardo corte → suelta)
    const unida = (k) => etapas[k]?.parent === actual.grupo.children[0] && !apagadas.has(k);
    const exp = 1 + 1.55 * (1 - pAtm);
    const pulsoOnda = reducirMovimiento ? 1 : 0.92 + 0.08 * Math.sin(reloj * 42) + (Math.random() - 0.5) * 0.08;

    pCentral.visible = true;
    pIzq.visible = false;
    pDer.visible = false;
    pNorte.visible = false;
    pSur.visible = false;
    pCentral.position.set(0, 0, 0);

    let yBase = 0;
    let claveEtapa = '1';
    let colorManto = 0xff9436;
    let colorExt = 0xff521b;

    if (id === 'saturno-v') {
      if (unida('s-ic')) {
        claveEtapa = 's-ic';
        yBase = cajas['s-ic']?.minY ?? 0;
        const rOff = diam * 0.2;
        pCentral.visible = e.t < 135.2; // Corte del motor central F-1
        pIzq.visible = pDer.visible = pNorte.visible = pSur.visible = true;
        pIzq.position.set(-rOff, 0, 0);
        pDer.position.set(rOff, 0, 0);
        pNorte.position.set(0, 0, -rOff);
        pSur.position.set(0, 0, rOff);
      } else if (unida('s-ii')) {
        claveEtapa = 's-ii';
        yBase = cajas['s-ii']?.minY ?? altura * 0.38;
        const rOff = diam * 0.14;
        pCentral.visible = e.t < 460.6; // Corte del motor central J-2
        pIzq.visible = pDer.visible = pNorte.visible = pSur.visible = true;
        pIzq.position.set(-rOff, 0, 0);
        pDer.position.set(rOff, 0, 0);
        pNorte.position.set(0, 0, -rOff);
        pSur.position.set(0, 0, rOff);
        colorManto = 0x7dd3fc; // Hidrógeno líquido (LH2/LOX) azul brillante
        colorExt = 0x38bdf8;
      } else {
        claveEtapa = 's-ivb';
        yBase = cajas['s-ivb']?.minY ?? altura * 0.61;
        colorManto = 0x7dd3fc;
        colorExt = 0x38bdf8;
      }
    } else if (id === 'atlas-agena-d') {
      if (unida('atlas')) {
        claveEtapa = unida('booster') && e.t < 130 ? 'atlas-b' : 'atlas-s';
        yBase = cajas.atlas?.minY ?? 0;
        const boostersActivos = unida('booster') && e.t < 130;
        pIzq.visible = pDer.visible = boostersActivos;
        const xOff = diam * 0.28;
        pIzq.position.set(-xOff, 0, 0);
        pDer.position.set(xOff, 0, 0);
      } else {
        claveEtapa = 'agena';
        yBase = cajas.agena?.minY ?? altura * 0.68;
      }
    } else if (id === 'falcon-heavy') {
      if (unida('central')) {
        const latActivos = unida('lateral-izq') && unida('lateral-der');
        claveEtapa = latActivos ? 'fh-3' : 'fh-1';
        yBase = cajas.central?.minY ?? 0;
        pIzq.visible = pDer.visible = latActivos;
        const xLat = cajas['lateral-der']?.cx ?? diam * 0.32;
        pIzq.position.set(-xLat, 0, 0);
        pDer.position.set(xLat, 0, 0);
      } else {
        claveEtapa = 'segunda';
        yBase = cajas.segunda?.minY ?? altura * 0.64;
      }
    }

    // Rampa de empuje en tiempo de misión desde que la etapa enciende. Si hay dato (p. ej. S-II del
    // AS-506: orden de encendido 163.0 s → plena potencia 166.2 s) se usa; si no, 0.7 s ilustrativos.
    // Solo un encendido real reinicia la rampa (no el paso booster → sustentador ni el fin de los laterales)
    if (!encAnterior) {
      etapaEncendidaId = claveEtapa;
      tEncendidoSim = e.t;
      tUltimoEncendido = reloj;
    }
    const rampa = e.t < 0 ? Math.max(0.7, visual.encendidoPrevio ?? 0.7) : visual.rampas?.[claveEtapa] ?? 0.7;
    const kIgnicion = Math.min(1, 0.2 + (0.8 * (e.t - tEncendidoSim)) / rampa);
    const largoBase = Math.max(diam * 1.9, altura * (0.24 + 0.72 * (1 - pAtm))) * pulsoOnda * kIgnicion;

    fuego.position.set(0, yBase, 0);
    // Vectorización sutil de empuje (TVC gimbal) en las plumas durante el ascenso
    fuego.rotation.z = reducirMovimiento ? 0 : Math.sin(reloj * 11) * 0.018;
    const queroseno = ['s-ic', 'atlas-b', 'atlas-s', 'fh-3', 'fh-1'].includes(claveEtapa);
    const kDiamantes = queroseno ? Math.max(0, (pAtm - 0.35) / 0.65) : 0;
    for (const pen of [pCentral, pIzq, pDer, pNorte, pSur]) {
      const u = pen.userData;
      u.brillo.visible = pen.visible;
      if (!pen.visible) continue;
      pen.scale.set(exp * kIgnicion, largoBase, exp * kIgnicion);
      u.manto.material.color.setHex(colorManto);
      u.ext.material.color.setHex(colorExt);
      // Parpadeo propio de cada capa y de cada penacho (fases distintas, sin saltos bruscos)
      u.capas.forEach((m, i) => {
        const w = reloj + u.fase + i * 1.3;
        const sy = reducirMovimiento ? 1 : 1 + 0.07 * Math.sin(w * (23 + i * 7)) + 0.04 * Math.sin(w * (57 + i * 11));
        m.scale.y = sy;
        m.position.y = -m.userData.h * 0.5 * sy;
        // En el vacío la pluma se abre y se vuelve más tenue
        m.material.opacity = m.userData.op * (0.5 + 0.5 * pAtm) * (reducirMovimiento ? 1 : 0.92 + 0.08 * Math.sin(w * 41));
      });
      u.diamantes.forEach((d, i) => {
        d.visible = kDiamantes > 0;
        d.material.opacity = kDiamantes * (0.75 - i * 0.14) * (reducirMovimiento ? 1 : 0.85 + 0.15 * Math.sin(reloj * 37 + i));
      });
      u.brillo.position.copy(pen.position);
      u.brillo.scale.setScalar(Math.min(diam * 0.55, 5.2) * (1.1 + 0.25 * kIgnicion) * exp);
      u.brillo.material.opacity = 0.75 * kIgnicion;
    }
    for (const pen of [pCentral, pIzq, pDer, pNorte, pSur]) if (!pen.visible) pen.userData.brillo.visible = false;
    return { yBase, largoBase };
  }

  /** Coloca todo para el estado `e` de la simulación. */
  function ponerEstado(e) {
    ultimo = e;
    lanzado = lanzado || e.empuje > 0 || e.t > 0;
    tierra.position.set(-e.x, -e.y, 0);
    // Antes del despegue (t < 0) el cohete está sujeto a la rampa: la Tierra no debe girar respecto de él
    tierra.rotation.z = -omegaSuelo * Math.max(0, e.t);
    const r = Math.hypot(e.x, e.y);
    const ux = e.x / r;
    const uy = e.y / r;
    const ex = uy;
    const ey = -ux;
    const dx = Math.cos(e.pitch) * ex + Math.sin(e.pitch) * ux;
    const dy = Math.cos(e.pitch) * ey + Math.sin(e.pitch) * uy;
    cohete.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;

    // Retracción animada hacia afuera de los brazos umbilicales y mástiles de cola al despegar
    // Respingo al soltarse de los brazos de sujeción (solo visual, unos centímetros, se amortigua en ~1 s)
    cohete.position.y = !reducirMovimiento && e.t > 0 && e.t < 1.2 ? 0.18 * Math.sin(e.t * 18) * Math.exp(-e.t * 4) : 0;

    // Separaciones que esperaban su tiempo real tras el corte de motores
    while (pendientesSep.length && pendientesSep[0].t <= e.t) soltarAhora(pendientesSep.shift().clave, e);

    if (sitio) {
      const kRetract = lanzado ? Math.min(1, Math.max(0, e.t) / 2.8) : 0;
      for (const b of sitio.brazos) b.rotation.y = -kRetract * 1.25;
      for (const s of sitio.sujeciones) s.pivote.rotation.z = -s.dir * kRetract * 0.52;
    }

    // Llama + luz de motores por etapa activa
    const enc = e.empuje > 0;
    actual.fuego.visible = enc;
    luzMotor.intensity = 0;
    let yBaseLlama = 0;
    if (enc) {
      const p = atmosfera(e.h).p / 101.29;
      const { yBase, largoBase } = actualizarPlumas(e, p);
      yBaseLlama = yBase;
      vAux.set(0, yBase - largoBase * 0.25, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
      luzMotor.position.copy(vAux);
      // Cerca del suelo la llama ilumina con fuerza la torre y la rampa; la luz cae con la altura
      const cercaSuelo = 1 + 1.6 * Math.max(0, 1 - Math.max(0, e.h) / 400);
      luzMotor.intensity = (3.4 + (reducirMovimiento ? 0 : Math.random() * 1.6)) * actual.altura * 0.42 * cercaSuelo;
      if (!reducirMovimiento && e.t < 6) desprenderHielo();
      if (!reducirMovimiento && e.h < 2600) emitirHumo(yBase, largoBase);
      if (!reducirMovimiento && e.h > 30 && e.h < 12000) dejarColumna(yBase, largoBase);
    }
    encAnterior = enc;

    // Anillo exterior sutil en Mach 1 (con perforación central para no tapar jamás el cohete)
    const vRel = e.vRel ?? Math.hypot(e.vr ?? 0, e.vt ?? 0);
    const enMach = enc && e.h > 4500 && e.h < 15000 && vRel >= 310 && vRel <= 375;
    actual.anilloMach.visible = enMach;
    if (enMach) {
      const kMach = 1 - Math.abs(vRel - 342.5) / 32.5;
      actual.anilloMach.material.opacity = Math.max(0, kMach * 0.28);
    }

    // Cielo: panorama elegido en la rampa → transición continua al espacio profundo
    const cfgPano = PANORAMAS[panoramaActual] || PANORAMAS.amanecer;
    const k = Math.min(1, Math.max(0, e.h) / 55000);
    cielo.material.opacity = 1 - k * k;
    cielo.position.copy(camLocal.position);
    destelloSol.material.opacity = Math.max(0.15, cfgPano.destelloOp - k * 0.45);
    const dSol = 650000;
    destelloSol.position.copy(sol.position).normalize().multiplyScalar(dSol).add(camLocal.position);
    destelloSol.scale.setScalar(dSol * (0.32 - 0.1 * k));
    local.fog.color.set(cfgPano.horizonte).lerp(new THREE.Color(CIELO_ALTO), k);
    local.fog.near = 3000 + k * 2e6;
    local.fog.far = 30000 + k * 2e7;
    const opEstrellasAscenso = Math.max(0, (e.h - 18000) / 35000);
    cieloEstrellas.material.opacity = Math.max(cfgPano.estrellasBase * (1 - k), opEstrellasAscenso);
    cieloEstrellas.position.copy(camLocal.position);

    // Trayectoria (solo para la vista global; en la local la reemplazan las ondas de telemetría)
    if (e.t >= 0 && (!rastro.length || e.t - rastro.at(-1).t > 0.5)) rastro.push({ t: e.t, x: e.x, y: e.y });
    if (rastro.length > 4000) rastro.shift();

    // Vista global
    marcador.position.set(e.x / 1000, e.y / 1000, 0);
    trayG.geometry.setFromPoints(rastro.map((p) => new THREE.Vector3(p.x / 1000, p.y / 1000, 0)));

    // Seguimiento de cámara según el modo elegido
    if (autoActivo) {
      const deseada = camaraAuto(e);
      if (deseada !== modo) aplicarCamara(deseada, true);
    }
    if (modo === 'seguimiento') {
      apuntarSeguimiento();
    } else if (modo !== 'global') {
      if (modo === 'onboard') {
        const yCam = Math.max(yBaseLlama + actual.altura * 0.26, actual.altura * 0.52);
        const posCuerpo = new THREE.Vector3(actual.diam * 0.72, yCam, actual.diam * 0.35).applyAxisAngle(ejeZ, cohete.rotation.z);
        const miraCola = new THREE.Vector3(0, yBaseLlama - actual.altura * 0.25, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
        camLocal.position.copy(posCuerpo);
        controles.target.copy(miraCola);
      } else {
        const yFoco = Math.max(actual.altura * 0.45, yBaseLlama + actual.altura * 0.22);
        vAux.set(0, yFoco, 0).applyAxisAngle(ejeZ, cohete.rotation.z).sub(controles.target);
        controles.target.add(vAux);
        camLocal.position.add(vAux);
      }
    }
    calcularSacudida(e, enc, vRel);
  }

  /**
   * Sacudida de cámara con ruido suave (suma de senos, no saltos al azar). Tiene dos fuentes:
   * el ruido acústico del escape que rebota en el suelo (máximo en la rampa, se apaga hacia ~1.5 km)
   * y la presión dinámica q = ½·ρ·v² (máxima en Max Q, nula en el vacío). Las escalas son ilustrativas.
   * El desplazamiento se suma solo al dibujar, así no se acumula en la posición de la cámara.
   */
  function calcularSacudida(e, enc, vRel) {
    shakeOff.set(0, 0, 0);
    if (reducirMovimiento || !enc || modo === 'global') return;
    const acustico = Math.max(0, 1 - Math.max(0, e.h) / 1500) * (e.t < 0 ? 0.6 : 1);
    const q = 0.5 * atmosfera(Math.max(0, e.h)).rho * vRel * vRel;
    const aero = Math.min(1, q / 35000);
    const k = Math.min(1.2, acustico + aero * 0.8);
    if (k <= 0.001) return;
    // En la cámara de seguimiento (teleobjetivo) la sacudida se nota como temblor angular, no de metros
    const escala = modo === 'seguimiento'
      ? camLocal.position.length() * Math.tan(THREE.MathUtils.degToRad(camLocal.fov) / 2) * 0.012 // ~1 % del cuadro
      : actual.diam * 0.05;
    const w = reloj;
    shakeOff.set(
      Math.sin(w * 37.1) * 0.5 + Math.sin(w * 61.7 + 1.3) * 0.3 + Math.sin(w * 13.3 + 0.4) * 0.2,
      Math.sin(w * 41.9 + 2.1) * 0.5 + Math.sin(w * 73.1 + 0.7) * 0.3 + Math.sin(w * 11.1 + 2.9) * 0.2,
      Math.sin(w * 29.3 + 4.2) * 0.4 + Math.sin(w * 53.9 + 1.9) * 0.3,
    ).multiplyScalar(k * escala);
  }

  /** Cámara fija en tierra con teleobjetivo: gira y cierra el campo de visión para seguir al cohete. */
  function apuntarSeguimiento() {
    if (!actual || !ancla) return;
    tierra.updateMatrixWorld(true);
    camLocal.position.copy(ancla);
    tierra.localToWorld(camLocal.position);
    vAux.set(0, actual.altura * 0.4, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
    controles.target.copy(vAux);
    const d = camLocal.position.distanceTo(vAux);
    // Encuadre: el cohete ocupa ~1/3 del alto de la imagen hasta que el zoom llega a su límite (0.4°)
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan((actual.altura * 1.6) / d));
    camLocal.fov = Math.min(30, Math.max(0.4, fov));
    camLocal.updateProjectionMatrix();
    camLocal.lookAt(vAux);
  }

  /**
   * Toma un sprite del pool: uno libre, uno nuevo si queda cupo o, con el pool lleno, el más viejo
   * (la nube no se corta de golpe: se renueva por la cola).
   */
  function tomarSprite(pool, max, padre) {
    let sp = pool.find((x) => !x.s.visible);
    if (!sp && pool.length < max) {
      sp = { s: new THREE.Sprite(matHumo.clone()), v: new THREE.Vector3(), vida: 0, dur: 1, tam: 1, crece: 2.1, op: 0.48, sube: 0, tinte: 0 };
      padre.add(sp.s);
      pool.push(sp);
    }
    if (!sp) {
      sp = pool.reduce((a, b) => (b.vida / b.dur > a.vida / a.dur ? b : a));
    }
    sp.s.material.map = matHumo.map;
    sp.s.material.color.setHex(0xffffff);
    sp.crece = 2.1;
    sp.op = 0.48;
    sp.sube = 0;
    sp.tinte = 0;
    return sp;
  }

  /**
   * Humo del despegue. En la rampa, el escape baja por el deflector, sale por los dos extremos de la
   * trinchera y se extiende al ras del suelo como una nube de vapor y humo que dura decenas de segundos.
   * En vuelo (hasta ~2.6 km) nace detrás de la punta de la pluma. Tamaños y tiempos de vida son ilustrativos.
   */
  function emitirHumo(yBase = 0, largoBase = 15) {
    tierra.updateMatrixWorld(true);
    const e = ultimo;
    const enSuelo = e.h < 300;
    // Durante la secuencia de encendido y los primeros 5 s la trinchera escupe más chispas y vapor
    const inicio = e.t < 5;
    const n = enSuelo ? (inicio ? 6 : 4) : 2;
    for (let i = 0; i < n; i++) {
      const sp = tomarSprite(humo, MAX_HUMO, tierra);
      const esChispa = enSuelo && e.t < 4.0 && i % 3 === 1;
      if (esChispa) {
        sp.s.material.map = matChispa.map;
        sp.s.material.color.setHex(0xffb74d);
      }

      if (enSuelo) {
        // Nace en la trinchera (y = -3.2 m) y sale disparado por el canal, hacia uno u otro extremo
        const dirTrinchera = i % 2 === 0 ? 1 : -1;
        vAux.set((Math.random() - 0.5) * actual.diam * 0.8, -3.2, dirTrinchera * (6 + Math.random() * 10));
        // Durante la secuencia de encendido el cohete está quieto en la rampa: la posición local es la del suelo
        tierra.worldToLocal(sp.s.position.copy(vAux));
        const rapido = esChispa ? 45 + Math.random() * 30 : 34 + Math.random() * 30;
        sp.v
          .set((Math.random() - 0.5) * 0.9, 0.05 + Math.random() * 0.12, dirTrinchera * (0.8 + Math.random() * 0.45))
          .multiplyScalar(rapido);
        sp.dur = esChispa ? 0.6 + Math.random() * 0.35 : 20 + Math.random() * 20;
        sp.tam = actual.diam * (esChispa ? 0.55 : 2.0 + Math.random() * 1.2);
        sp.crece = esChispa ? 1.2 : 5.5;
        sp.op = esChispa ? 0.9 : 0.55;
        sp.sube = esChispa ? 0 : 1.6 + Math.random() * 1.6; // la nube caliente sube despacio
        sp.tinte = esChispa ? 0 : 1;
      } else {
        // En vuelo nace detrás de la punta de la pluma para no envolver nunca el cuerpo del cohete
        vAux
          .set(
            (Math.random() - 0.5) * actual.diam * 0.4,
            yBase - largoBase * (0.75 + Math.random() * 0.35),
            (Math.random() - 0.5) * actual.diam * 0.4,
          )
          .applyAxisAngle(ejeZ, cohete.rotation.z);
        tierra.worldToLocal(sp.s.position.copy(vAux));
        const lado = Math.random() * Math.PI * 2;
        sp.v
          .set(Math.cos(lado) * 0.35, -0.8 - Math.random() * 0.5, Math.sin(lado) * 0.35)
          .multiplyScalar(actual.diam * 1.4);
        sp.dur = 6 + Math.random() * 6;
        sp.tam = actual.diam * 1.1;
        sp.crece = 4;
        sp.op = 0.42;
        sp.tinte = 0.6;
      }
      sp.vida = 0;
      sp.s.visible = true;
    }
  }

  /**
   * Columna de escape: cada ~1.2 diámetros recorridos (más espaciado con la altura) deja una bocanada fija al terreno, que queda
   * colgada en el cielo y se disipa en minutos (como la estela de humo de un despegue de día).
   */
  function dejarColumna(yBase, largoBase) {
    tierra.updateMatrixWorld(true);
    vAux.set(0, yBase - largoBase * 0.9, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
    const pLocal = tierra.worldToLocal(vAux.clone());
    const paso = Math.max(actual.diam * 1.2, Math.max(0, ultimo.h) * 0.006);
    if (ultimaColumna && ultimaColumna.distanceTo(pLocal) < paso) return;
    // Rellena el tramo recorrido desde la última bocanada (a alta velocidad de reproducción hay saltos)
    const desde = ultimaColumna ?? pLocal;
    const tramos = Math.min(6, Math.max(1, Math.round(desde.distanceTo(pLocal) / paso)));
    for (let k = 1; k <= tramos; k++) {
      const sp = tomarSprite(columna, MAX_COLUMNA, tierra);
      sp.s.position.lerpVectors(desde, pLocal, k / tramos);
      sp.v.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
      sp.vida = 0;
      sp.dur = 120 + Math.random() * 90;
      // Más ancha con la altura: el escape se expande más en aire poco denso
      sp.tam = actual.diam * (2 + Math.max(0, ultimo.h) / 2000);
      sp.crece = 3;
      sp.op = 0.34;
      sp.s.material.color.setHex(0xf1f1ee);
      sp.s.visible = true;
    }
    ultimaColumna = pLocal;
  }

  /**
   * Escarcha y condensación que se desprenden del fuselaje (tanques criogénicos) al encender y en los
   * primeros segundos de vuelo. Quedan fijas al terreno, así el cohete las deja atrás. Ilustrativo.
   */
  function desprenderHielo() {
    tierra.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const sp = tomarSprite(humo, MAX_HUMO, tierra);
      sp.s.material.color.setHex(0xeef6ff);
      const ang = Math.random() * Math.PI * 2;
      const r = actual.diam * 0.45;
      vAux.set(Math.cos(ang) * r, actual.altura * (0.15 + Math.random() * 0.55), Math.sin(ang) * r)
        .applyAxisAngle(ejeZ, cohete.rotation.z);
      tierra.worldToLocal(sp.s.position.copy(vAux));
      sp.v.set(Math.cos(ang) * 1.5, -4 - Math.random() * 4, Math.sin(ang) * 1.5);
      sp.vida = 0;
      sp.dur = 1.8 + Math.random() * 1.2;
      sp.tam = Math.min(actual.diam * 0.35, 3);
      sp.crece = 2.5;
      sp.op = 0.4;
      sp.s.visible = true;
    }
  }

  /** Venteo criogénico suave de oxígeno líquido (LOX) hacia un costado mientras aguarda en rampa. */
  function emitirVaporCriogenico() {
    if (!actual || lanzado || reducirMovimiento) return;
    tierra.updateMatrixWorld(true);
    const sp = tomarSprite(humo, MAX_HUMO, tierra);
    sp.s.material.color.setHex(0xe2f1ff);
    const yVent = actual.altura * (0.28 + Math.random() * 0.45);
    vAux.set(-actual.diam * 0.52, yVent, (Math.random() - 0.5) * 1.5);
    tierra.worldToLocal(sp.s.position.copy(vAux));
    sp.v.set(-3.2 - Math.random() * 2.0, -1.4 - Math.random() * 1.2, (Math.random() - 0.5) * 1.2);
    sp.vida = 0;
    sp.dur = 2.6 + Math.random() * 1.6;
    sp.tam = Math.min(actual.diam * 0.45, 4.2);
    sp.s.visible = true;
  }

  const colTinte = new THREE.Color();
  const colBlanco = new THREE.Color(0xffffff);
  const colFuego = new THREE.Color(0xffa65c);
  const vMundo = new THREE.Vector3();

  function avanzarPool(pool, dt, conTinte) {
    const luz = luzMotor.intensity > 0 && actual ? luzMotor.position : null;
    const alcance = actual ? actual.altura * 1.4 : 1;
    for (const sp of pool) {
      if (!sp.s.visible) continue;
      sp.vida += dt;
      if (sp.vida >= sp.dur) {
        sp.s.visible = false;
        continue;
      }
      const f = sp.vida / sp.dur;
      sp.s.position.addScaledVector(sp.v, dt);
      sp.v.multiplyScalar(Math.max(0, 1 - 0.55 * dt));
      if (sp.sube) sp.s.position.y += sp.sube * dt; // `tierra` tiene +y hacia arriba en la rampa
      // Crece rápido al principio y luego se va abriendo despacio
      sp.s.scale.setScalar(sp.tam * (0.6 + sp.crece * Math.sqrt(f)));
      // Aparece en 5 % de su vida y se desvanece de a poco
      sp.s.material.opacity = sp.op * Math.min(1, f / 0.05) * (1 - f) ** 1.4;
      // La llama ilumina de naranja el humo que tiene cerca
      if (conTinte && sp.tinte) {
        let k = 0;
        if (luz) {
          sp.s.getWorldPosition(vMundo);
          k = Math.max(0, 1 - vMundo.distanceTo(luz) / alcance) * sp.tinte;
        }
        sp.s.material.color.copy(colTinte.copy(colBlanco).lerp(colFuego, Math.min(0.85, k)));
      }
    }
  }

  /**
   * Ondas de telemetría: un anillo tenue sale de la punta del cohete cada ~1.2 s (más espaciado en el
   * vacío), crece y se desvanece. Ilustrativo: no representa una frecuencia ni una estación reales.
   */
  let alOnda = null;
  function avanzarOndas(dt) {
    const enVuelo = actual && ultimo && ultimo.t > 0 && !reducirMovimiento && modo !== 'global';
    if (enVuelo && reloj >= proxOnda) {
      proxOnda = reloj + (ultimo.h > 100000 ? 2.0 : 1.2);
      let o = ondas.find((x) => !x.s.visible);
      if (!o && ondas.length < 3) {
        o = {
          s: new THREE.Sprite(new THREE.SpriteMaterial({ map: texOnda, color: 0xbfe9ff, transparent: true, depthWrite: false, fog: false })),
          vida: 0,
        };
        local.add(o.s);
        ondas.push(o);
      }
      if (o) {
        o.vida = 0;
        o.s.visible = true;
        alOnda?.();
      }
    }
    for (const o of ondas) {
      if (!o.s.visible) continue;
      o.vida += dt;
      const f = o.vida / 2.5;
      if (f >= 1 || !enVuelo) {
        o.s.visible = false;
        continue;
      }
      // Sigue la punta del cohete (marco que viaja con él)
      o.s.position.set(0, actual.altura * 0.96, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
      o.s.scale.setScalar(actual.altura * (0.15 + 1.05 * f));
      o.s.material.opacity = 0.35 * (1 - f) * Math.min(1, f / 0.08);
    }
  }

  function avanzarHumo(dt) {
    avanzarPool(humo, dt, true);
    avanzarPool(columna, dt, false);
    avanzarEmisores(dt);
    for (let i = anillosSep.length - 1; i >= 0; i--) {
      const a = anillosSep[i];
      a.vida += dt;
      if (a.vida >= a.dur) {
        local.remove(a.mesh);
        anillosSep.splice(i, 1);
        continue;
      }
      const f = a.vida / a.dur;
      a.mesh.scale.setScalar(1 + f * 3.2);
      a.mesh.material.opacity = (1 - f) * 0.85;
    }
    for (let i = chispasSep.length - 1; i >= 0; i--) {
      const c = chispasSep[i];
      c.vida += dt;
      if (c.vida >= c.dur) {
        local.remove(c.s);
        chispasSep.splice(i, 1);
        continue;
      }
      const f = c.vida / c.dur;
      c.s.position.addScaledVector(c.v, dt);
      c.s.material.opacity = 1 - f;
    }
  }

  /** Avanza los restos (etapas, propulsores, cofias, LES) en el marco relativo al cohete con pivote propio. */
  function avanzarRestos(dt) {
    if (!ultimo) return;
    const r = Math.hypot(ultimo.x, ultimo.y) || R;
    const ux = ultimo.x / r;
    const uy = ultimo.y / r;
    const ex = uy;
    const ey = -ux;
    const dx = Math.cos(ultimo.pitch) * ex + Math.sin(ultimo.pitch) * ux;
    const dy = Math.cos(ultimo.pitch) * ey + Math.sin(ultimo.pitch) * uy;
    const aCohete = Math.min(10, Math.max(0, (ultimo.a || 0) * 9.81));

    for (const p of restos) {
      // Mientras el cohete acelera hacia (dx, dy), las piezas desprendidas quedan atrás a razón de -aCohete
      if ( !p.esLES ) {
        p.vx -= (aCohete * dx + 2.5 * ux) * dt;
        p.vy -= (aCohete * dy + 2.5 * uy) * dt;
      } else {
        // El motor sólido de la torre LES la acelera hacia adelante durante los primeros 2.5 s
        if (p.vida < 2.5) {
          p.vx += 28 * dx * dt;
          p.vy += 28 * dy * dt;
        }
      }
      p.dx += p.vx * dt;
      p.dy += p.vy * dt;
      p.dz += (p.vz || 0) * dt;
      if (!reducirMovimiento) {
        p.obj.rotation.x += (p.wx || 0) * dt;
        p.obj.rotation.y += (p.wy || 0) * dt;
        p.obj.rotation.z += (p.wz || 0) * dt;
      }
      p.vida += dt;
      if (p.chorro) {
        p.chorro.visible = p.vida < 2.8;
        if (p.chorro.visible) {
          const pulso = 0.85 + Math.random() * 0.3;
          p.chorro.scale.set(1, pulso, 1);
        }
      }
      p.obj.position.set(p.offset.x + p.dx, p.offset.y + p.dy, p.dz);
      p.obj.visible = p.vida < 300;
    }

    // Despliegue suave de los paneles solares de Mariner 4 o Europa Clipper tras soltar la cofia
    if (cofiaSoltada && actual?.alasSolares?.length && progSolar < 1) {
      progSolar = Math.min(1, progSolar + dt * 0.35);
      const suave = 1 - (1 - progSolar) ** 3;
      for (const ala of actual.alasSolares) {
        ala.pivote.rotation.z = ala.rotPlegada + (ala.rotDesplegada - ala.rotPlegada) * suave;
      }
    }
  }

  /**
   * Desprende en 3D las etapas o piezas asociadas al evento (`s-ic`, `inter-1`, `les`, `s-ii`,
   * `booster`, `cofia-izq`, `cofia-der`, `atlas`, `lateral-izq`, `lateral-der`, `central`),
   * centrando el pivote de rotación en el centro de masa de la pieza para que gire sobre sí misma.
   */
  function soltar(claveEvento, e) {
    const ids = SUELTAS[actual.id]?.[claveEvento] || [];
    if (!ids.length) return;
    // Entre el corte de motores y la separación real pasa un tiempo medido (p. ej. AS-506:
    // OECO de la S-IC 161.63 s → separación 162.3 s). Mientras, la etapa sigue unida pero apagada.
    const retardo = visual.separaciones?.[claveEvento]?.retardo ?? 0;
    if (retardo > 0 && !reducirMovimiento) {
      for (const id of ids) apagadas.add(id);
      pendientesSep.push({ t: e.t + retardo, clave: claveEvento });
      pendientesSep.sort((a, b) => a.t - b.t);
      return;
    }
    soltarAhora(claveEvento, e);
  }

  function soltarAhora(claveEvento, e) {
    const ids = SUELTAS[actual.id]?.[claveEvento] || [];
    if (claveEvento === 'cofia') cofiaSoltada = true;
    const sep = visual.separaciones?.[claveEvento] || {};
    if (autoActivo && !reducirMovimiento && claveEvento !== 'les') autoAbordoHasta = reloj + 5;

    // Eje longitudinal del cohete `(dx, dy)` (+Y_local) y eje derecho `(rx, ry)` (+X_local)
    const r = Math.hypot(e.x, e.y) || R;
    const ux = e.x / r;
    const uy = e.y / r;
    const ex = uy;
    const ey = -ux;
    const dx = Math.cos(e.pitch) * ex + Math.sin(e.pitch) * ux;
    const dy = Math.cos(e.pitch) * ey + Math.sin(e.pitch) * uy;
    const rx = dy;
    const ry = -dx;
    const yOffsetRaiz = actual.grupo.children[0]?.position.y ?? 0;
    const escModelo = actual.escala ?? 1;

    for (const id of ids) {
      const g = actual.etapas[id];
      if (!g || !g.parent) continue;
      const cajaEtapa = actual.cajas?.[id] || actual.cajas?.cofia || { cx: 0, cy: 0, minY: 0, maxY: 10, ancho: 4, alto: 8 };

      // `obj` queda en escala 1:1 (metros) con origen exacto en el centro de la etapa (cx, cy)
      const obj = new THREE.Group();
      const portador = new THREE.Group();
      portador.scale.setScalar(escModelo);
      portador.position.set(-cajaEtapa.cx, yOffsetRaiz - cajaEtapa.cy, 0);
      portador.add(g);
      obj.add(portador);

      const offset = new THREE.Vector3(cajaEtapa.cx, cajaEtapa.cy, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
      obj.position.copy(offset);
      obj.rotation.z = cohete.rotation.z;
      local.add(obj);

      const lado = id.endsWith('izq') ? -1 : id.endsWith('der') ? 1 : 0;
      const esCofia = id.startsWith('cofia');
      const esLES = id === 'les';
      const esLateral = id.startsWith('lateral-');

      // 1. Anillo pirotécnico y chispas de pernos explosivos en el plano de corte
      if (!reducirMovimiento) {
        const yCorte = esLES || esCofia ? cajaEtapa.minY : cajaEtapa.maxY;
        const posCorte = new THREE.Vector3(cajaEtapa.cx, yCorte, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
        if (!esCofia || lado === -1) {
          const anillo = new THREE.Mesh(
            new THREE.TorusGeometry(Math.max(1.2, cajaEtapa.ancho * 0.48), 0.22, 8, 28),
            new THREE.MeshBasicMaterial({
              color: 0xffd166,
              transparent: true,
              opacity: 0.9,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              fog: false,
            }),
          );
          anillo.rotation.x = Math.PI / 2;
          anillo.position.copy(posCorte);
          local.add(anillo);
          anillosSep.push({ mesh: anillo, vida: 0, dur: 1.2 });
        }

        for (let k = 0; k < 8; k++) {
          const ang = (k / 8) * Math.PI * 2 + Math.random() * 0.3;
          const sp = new THREE.Sprite(matChispa.clone());
          sp.position.copy(posCorte);
          sp.scale.setScalar(Math.max(0.8, actual.diam * 0.14));
          local.add(sp);
          const vRad = 12 + Math.random() * 16;
          chispasSep.push({
            s: sp,
            v: new THREE.Vector3(Math.cos(ang) * vRad, Math.sin(ang) * vRad * 0.5, (Math.random() - 0.5) * vRad),
            vida: 0,
            dur: 0.7 + Math.random() * 0.4,
          });
        }
      }

      // 2. Chorro del motor de desprendimiento de la torre de escape
      let chorro = null;
      // Solo la torre de escape lleva cono propio; retrocohetes y ullage son chorros de partículas
      // (ver `encenderMotoresSeparacion`) y solo donde una fuente dice que existían.
      if (!reducirMovimiento && esLES) {
        chorro = crearChorroSeparacion(cajaEtapa);
        obj.add(chorro);
      }

      // 3. Velocidades relativas de separación a lo largo de (dx, dy) y hacia los costados (rx, ry)
      let vAxial = -18;
      let vLateral = 0;
      let vz = (Math.random() - 0.5) * 2.5;
      let wx = 0;
      let wy = 0;
      let wz = (Math.random() - 0.5) * 0.16;

      if (esLES) {
        // La torre de escape LES se dispara hacia adelante (+dx, +dy) y a un lado
        vAxial = 52;
        vLateral = -16;
        wz = 0.55;
      } else if (esCofia) {
        // Las dos valvas de la cofia se abren hacia su respectivo costado (lado * rx, ry) y giran sobre su propio centro
        vAxial = -10;
        vLateral = lado * 16;
        vz = lado * 10;
        wz = -lado * 0.75;
        wy = lado * 0.45;
      } else if (esLateral) {
        // Apertura sincronizada en V de los propulsores laterales hacia afuera (lado * rx, ry)
        vAxial = -14;
        vLateral = lado * 13;
        vz = lado * 3;
        wz = -lado * 0.36;
      } else if (id === 'inter-1' || id === 'booster') {
        vAxial = -16;
        wz = 0.08;
      }

      restos.push({
        obj,
        chorro,
        esLES,
        dx: 0,
        dy: 0,
        dz: 0,
        offset,
        vx: vAxial * dx + vLateral * rx,
        vy: vAxial * dy + vLateral * ry,
        vz,
        wx,
        wy,
        wz,
        vida: 0,
      });
      if (sep.retros && !reducirMovimiento) encenderRetros(restos.at(-1), cajaEtapa, sep.retros, sep.retrosAbajo);
    }
    if (sep.ullage && !reducirMovimiento) encenderUllage(sep.ullage, e);
  }

  /**
   * Retrocohetes sólidos de la etapa soltada: escape hacia adelante (+y de la etapa) para frenarla y
   * alejarla. `abajo` = montados en la base (S-IC: carenados de los F-1); si no, en el borde superior.
   */
  function encenderRetros(resto, caja, { n, dur }, abajo = false) {
    const puntos = [];
    const r = caja.ancho * 0.5;
    const y = abajo ? -caja.alto * 0.5 + caja.alto * 0.07 : caja.alto * 0.5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      const radial = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      puntos.push({ pos: radial.clone().multiplyScalar(r * 0.95).setY(y), dir: radial.multiplyScalar(0.35).setY(1).normalize() });
    }
    emisores.push({
      padre: resto.obj, resto, puntos, restante: dur ?? 1, color: 0xffc58a,
      vel: 60, tam: Math.max(1.2, caja.ancho * 0.22), particulas: [],
    });
  }

  /**
   * Motores de ullage de la etapa que sigue: empujan hacia adelante para asentar el propelente en el
   * fondo de los tanques antes de encender; su escape sale hacia atrás (−y del cohete).
   */
  function encenderUllage({ n, dur, en, hastaEncendido }, e) {
    const caja = actual.cajas?.[en];
    if (!caja) return;
    const puntos = [];
    const r = caja.ancho * 0.52;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const radial = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      puntos.push({
        pos: radial.clone().multiplyScalar(r).add(new THREE.Vector3(caja.cx, caja.minY + caja.alto * 0.15, 0)),
        dir: radial.multiplyScalar(0.12).setY(-1).normalize(),
      });
    }
    emisores.push({
      padre: cohete, resto: null, puntos, restante: dur ?? 0, hastaEncendido: !!hastaEncendido, tInicio: e.t,
      color: 0xffd9a8, vel: 45, tam: Math.max(0.9, caja.ancho * 0.16), particulas: [],
    });
  }

  let dtSimActual = 0;
  function avanzarEmisores(dt) {
    const aCohete = Math.min(10, Math.max(0, (ultimo?.a || 0) * 9.81));
    const encendido = (ultimo?.empuje ?? 0) > 0;
    for (let i = emisores.length - 1; i >= 0; i--) {
      const em = emisores[i];
      // Vida en tiempo de misión: dura lo que dice la fuente aunque se acelere la reproducción
      if (em.hastaEncendido) {
        if (encendido && ultimo.t > em.tInicio) em.restante = 0;
        else em.restante = 1;
      } else {
        em.restante -= dtSimActual;
      }
      const activo = em.restante > 0 && em.padre.parent;
      if (activo) {
        em.padre.updateMatrixWorld(true);
        const q = em.padre.getWorldQuaternion(new THREE.Quaternion());
        for (const p of em.puntos) {
          const s = new THREE.Sprite(matChispa.clone());
          s.material.color.setHex(em.color);
          s.position.copy(p.pos);
          em.padre.localToWorld(s.position);
          const v = p.dir.clone().applyQuaternion(q).multiplyScalar(em.vel * (0.8 + Math.random() * 0.4));
          if (em.resto) { v.x += em.resto.vx; v.y += em.resto.vy; }
          local.add(s);
          em.particulas.push({ s, v, vida: 0, dur: 0.5 + Math.random() * 0.3 });
          // Humo gris que queda detrás del chorro
          const h = new THREE.Sprite(matHumo.clone());
          h.position.copy(s.position);
          h.material.color.setHex(0xd8d4cc);
          local.add(h);
          em.particulas.push({ s: h, v: v.clone().multiplyScalar(0.55), vida: 0, dur: 1.6 + Math.random() * 0.8, humo: true });
        }
      }
      // Las partículas quedan atrás del cohete, que sigue acelerando (marco que viaja con él)
      const r = Math.hypot(ultimo?.x ?? 0, ultimo?.y ?? R) || R;
      const ux = (ultimo?.x ?? 0) / r;
      const uy = (ultimo?.y ?? R) / r;
      const pitch = ultimo?.pitch ?? Math.PI / 2;
      const ddx = Math.cos(pitch) * uy + Math.sin(pitch) * ux;
      const ddy = Math.cos(pitch) * -ux + Math.sin(pitch) * uy;
      for (let k = em.particulas.length - 1; k >= 0; k--) {
        const p = em.particulas[k];
        p.vida += dt;
        if (p.vida >= p.dur) {
          local.remove(p.s);
          em.particulas.splice(k, 1);
          continue;
        }
        p.v.x -= aCohete * ddx * dt;
        p.v.y -= aCohete * ddy * dt;
        p.s.position.addScaledVector(p.v, dt);
        const f = p.vida / p.dur;
        p.s.scale.setScalar(em.tam * (p.humo ? 1 + f * 3.5 : 1 - f * 0.5));
        p.s.material.opacity = (p.humo ? 0.45 : 0.95) * (1 - f);
      }
      if (!activo && !em.particulas.length) emisores.splice(i, 1);
    }
  }

  /** Órbita de espera y camino de salida hacia el destino, en la vista global. */
  function dibujarSalida(sim, destinoId) {
    const fin = sim.serie.at(-1);
    const r = Math.hypot(fin.x, fin.y);
    const vC = Math.sqrt(MU / r);
    const ex = fin.y / r;
    const ey = -fin.x / r;
    const periodo = 2 * Math.PI * Math.sqrt(r ** 3 / MU);
    const orb = propagarOrbita({ x: fin.x, y: fin.y, vx: vC * ex, vy: vC * ey }, MU, { dt: 5, pasos: Math.ceil(periodo / 5) });
    orbitaG.geometry.setFromPoints(orb.map((p) => new THREE.Vector3(p.x / 1000, p.y / 1000, 0)));
    if (!sim.salida) return;
    const v = vC + sim.salida.dv;
    const sal = propagarOrbita({ x: fin.x, y: fin.y, vx: v * ex, vy: v * ey }, MU, { dt: 60, pasos: 5 * 24 * 60 });
    const lejos = sal.filter((p) => Math.hypot(p.x, p.y) < 1.2e9);
    salidaG.geometry.setFromPoints(lejos.map((p) => new THREE.Vector3(p.x / 1000, p.y / 1000, 0)));

    luna.material.map = texAstros[destinoId] || texAstros.luna;
    luna.material.needsUpdate = true;
    if (destinoId === 'luna') {
      const ap = lejos.reduce((a, p) => (Math.hypot(p.x, p.y) > Math.hypot(a.x, a.y) ? p : a), lejos[0]);
      const d = Math.hypot(ap.x, ap.y);
      luna.scale.setScalar(1);
      luna.position.set((ap.x / d) * 384400, (ap.y / d) * 384400, 0);
      luna.visible = true;
    } else if (lejos.length) {
      const pFin = lejos.at(-1);
      const d = Math.hypot(pFin.x, pFin.y) / 1000;
      const escalaAstro = destinoId === 'jupiter' ? 3.2 : 1.6;
      luna.scale.setScalar(escalaAstro);
      luna.position.set((pFin.x / 1000 / d) * Math.min(d, 650000), (pFin.y / 1000 / d) * Math.min(d, 650000), 0);
      luna.visible = true;
    }
  }

  // ---------- Inspección por clic ----------
  const ray = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  let bajada = null;

  function etapaDe(objeto) {
    for (let n = objeto; n; n = n.parent) {
      if (n.name && actual?.etapas[n.name]) return n.name;
    }
    return null;
  }

  function quitarSeleccion() {
    for (const [mat, em] of brillosOriginales) mat.emissive?.copy(em);
    brillosOriginales.clear();
    seleccionada = null;
  }

  function resaltar(id) {
    quitarSeleccion();
    if (!id || !actual?.etapas[id]) return;
    seleccionada = id;
    actual.etapas[id].traverse((n) => {
      if (n.material?.emissive && !brillosOriginales.has(n.material)) {
        brillosOriginales.set(n.material, n.material.emissive.clone());
        n.material.emissive.setHex(0x3a2410);
      }
    });
  }

  function seleccionarEtapa(id) {
    resaltar(id);
    if (!id || !actual) {
      alSeleccionar?.(null, null);
      return;
    }
    const separada = !restos.every((r) => !r.obj.getObjectByName(id));
    const info = INFO_ETAPAS[actual.id]?.[id] || { titulo: id, subtitulo: '', detalle: '', datos: [] };
    alSeleccionar?.(id, { separada, ...info });
  }

  function elegirEn(ev) {
    if (!actual || modo === 'global') return;
    const caja = canvas.getBoundingClientRect?.() ?? {
      left: 0,
      top: 0,
      width: canvas.clientWidth || 1,
      height: canvas.clientHeight || 1,
    };
    puntero.set(((ev.clientX - caja.left) / caja.width) * 2 - 1, -((ev.clientY - caja.top) / caja.height) * 2 + 1);
    ray.setFromCamera(puntero, camLocal);
    const hit = ray.intersectObjects([cohete, ...restos.map((r) => r.obj)], true).find((h) => etapaDe(h.object));
    const id = hit ? etapaDe(hit.object) : null;
    seleccionarEtapa(id);
  }

  canvas.addEventListener?.('pointerdown', (ev) => { bajada = { x: ev.clientX, y: ev.clientY }; });
  canvas.addEventListener?.('pointerup', (ev) => {
    if (!bajada) return;
    const quieto = Math.abs(ev.clientX - bajada.x) < 6 && Math.abs(ev.clientY - bajada.y) < 6;
    bajada = null;
    if (quieto) elegirEn(ev);
  });

  // ---------- Cámaras y ángulos panorámicos ----------
  /**
   * Cámara automática, como una transmisión: contrapicado al encender y despegar, torre, seguimiento
   * desde tierra, persecución, y a bordo unos segundos en cada separación.
   */
  let autoActivo = true;
  let autoAbordoHasta = -1;
  function camaraAuto(e) {
    if (reloj < autoAbordoHasta) return 'onboard';
    if (!e || !lanzado) return 'persecucion';
    if (e.t < 8) return 'heroica';
    if (e.t < 15) return 'torre';
    if (e.t < 60) return 'seguimiento';
    return 'persecucion';
  }

  function setCamara(m, inmediato = false) {
    autoActivo = m === 'auto';
    aplicarCamara(autoActivo ? camaraAuto(ultimo) : m, inmediato);
  }

  function aplicarCamara(m, inmediato = false) {
    modo = m;
    controles.enabled = m !== 'global' && m !== 'seguimiento';
    controlesG.enabled = m === 'global';
    if (m !== 'seguimiento' && camLocal.fov !== 48) {
      camLocal.fov = 48;
      camLocal.updateProjectionMatrix();
    }
    if (m === 'seguimiento') {
      apuntarSeguimiento();
      usuarioMovio = false;
      return;
    }
    const alt = actual?.altura ?? 50;
    if (m === 'global') {
      const d = luna.visible ? 900000 : 26000;
      camGlobal.position.set(0, -d * 0.35, d);
      controlesG.target.set(0, 0, 0);
      controlesG.update();
      return;
    }
    vAux.set(0, alt * 0.45, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
    controles.target.copy(vAux);
    if (m === 'persecucion' || (m === 'libre' && inmediato)) {
      camLocal.position.set(alt * 1.05, vAux.y + alt * 0.15, alt * 1.7);
    } else if (m === 'panorama') {
      controles.target.set(0, alt * 0.42, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
      camLocal.position.set(alt * 1.85, alt * 0.55, alt * 2.85);
    } else if (m === 'heroica') {
      controles.target.set(0, alt * 0.38, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
      camLocal.position.set(alt * 0.42, Math.max(2.5, alt * 0.04), alt * 0.82);
    } else if (m === 'torre') {
      controles.target.set(0, alt * 0.35, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
      camLocal.position.set(-alt * 0.32, alt * 0.96, alt * 0.65);
    } else if (m === 'onboard') {
      const posCuerpo = new THREE.Vector3(actual?.diam ?? 6, alt * 0.62, (actual?.diam ?? 6) * 0.4).applyAxisAngle(ejeZ, cohete.rotation.z);
      const miraCola = new THREE.Vector3(0, -alt * 0.2, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
      camLocal.position.copy(posCuerpo);
      controles.target.copy(miraCola);
    } else if (m === 'lateral') {
      camLocal.position.set(alt * 0.2, vAux.y, alt * 5);
    }
    controles.update();
    usuarioMovio = false;
  }

  function enfocarEtapa(id) {
    if (!actual || !actual.cajas?.[id]) return;
    seleccionarEtapa(id);
    const c = actual.cajas[id];
    const dist = Math.max(12, c.alto * 1.6, c.ancho * 2.4);
    controles.target.set(c.cx, c.cy, 0).applyAxisAngle(ejeZ, cohete.rotation.z);
    camLocal.position.set(c.cx + dist * 0.65, c.cy + dist * 0.15, dist).applyAxisAngle(ejeZ, cohete.rotation.z);
    controles.update();
    usuarioMovio = true;
  }

  function tamano() {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 500;
    renderer.setSize(w, h, false);
    if (composer) {
      composer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
      composer.setSize(w, h);
    }
    for (const c of [camLocal, camGlobal]) {
      c.aspect = w / h;
      c.updateProjectionMatrix();
    }
  }

  function dibujar(dtSim = 0, dtReal = 0.016) {
    reloj += dtReal;
    dtSimActual = dtSim;
    const dtVis = dtSim > 0 ? Math.min(dtSim, dtReal * 2.2) : 0;
    if (ultimo && dtVis) avanzarRestos(dtVis);
    if (!lanzado && reloj >= proxVapor) {
      emitirVaporCriogenico();
      proxVapor = reloj + 0.22;
    }
    avanzarHumo(dtReal);
    avanzarOndas(dtReal);
    nubes.rotation.y = reloj * 0.0004;
    nubesG.rotation.y = reloj * 0.004;

    if (sitio) {
      const pulso = 0.55 + 0.45 * Math.sin(reloj * 4.2);
      for (const b of sitio.balizas) b.scale.setScalar(0.85 + pulso * 0.35);
    }

    if (!lanzado && !usuarioMovio && !reducirMovimiento && modo !== 'global' && modo !== 'onboard' && modo !== 'seguimiento' && actual) {
      camLocal.position.sub(controles.target).applyAxisAngle(ejeY, dtReal * 0.07).add(controles.target);
    }

    // Adaptación de exposición: al encender, el destello de la llama "encandila" y la cámara
    // cierra un poco el diafragma; luego vuelve en unos segundos (efecto ilustrativo).
    const dtEnc = reloj - tUltimoEncendido;
    const encandilado = !reducirMovimiento && (ultimo?.h ?? 0) < 20000 && dtEnc >= 0 && dtEnc < 6 ? Math.exp(-dtEnc / 1.8) : 0;
    renderer.toneMappingExposure = EXPOSICION_BASE * (1 - 0.22 * encandilado);

    // Bloom: se apaga solo si el equipo no da abasto
    if (composer && pasoBloom.enabled) {
      tLento = dtReal > 0.033 ? tLento + dtReal : Math.max(0, tLento - dtReal * 0.5);
      if (tLento > 2) pasoBloom.enabled = false;
    }

    if (modo === 'global') {
      controlesG.update();
      if (composer) {
        pasoRender.scene = global;
        pasoRender.camera = camGlobal;
        composer.render(dtReal);
      } else {
        renderer.render(global, camGlobal);
      }
    } else {
      if (modo === 'seguimiento') apuntarSeguimiento();
      else controles.update();
      camLocal.position.add(shakeOff);
      if (composer) {
        pasoRender.scene = local;
        pasoRender.camera = camLocal;
        composer.render(dtReal);
      } else {
        renderer.render(local, camLocal);
      }
      camLocal.position.sub(shakeOff);
    }
  }

  tamano();
  return {
    cargarCohete,
    ponerEstado,
    soltar,
    dibujarSalida,
    setCamara,
    setPanorama,
    enfocarEtapa,
    tamano,
    dibujar,
    avanzarRestos,
    setSeleccion(cb) { alSeleccionar = cb; },
    setAlOnda(cb) { alOnda = cb; },
    deseleccionar() { quitarSeleccion(); alSeleccionar?.(null, null); },
    etapaSeleccionada: () => seleccionada,
    panoramaActual: () => panoramaActual,
    camaraActual: () => ({ modo, auto: autoActivo }),
    /** Conteos internos para las pruebas (sin WebGL). */
    estadisticas: () => ({
      humo: humo.filter((x) => x.s.visible).length,
      columna: columna.filter((x) => x.s.visible).length,
      emisores: emisores.length,
      ondas: ondas.filter((o) => o.s.visible).length,
      distRampa: sitio ? sitio.grupo.getWorldPosition(new THREE.Vector3()).length() : null,
      particulas: emisores.reduce((s, em) => s + em.particulas.length, 0),
      restos: restos.length,
      pendientes: pendientesSep.length,
      apagadas: [...apagadas],
      fov: camLocal.fov,
      sacudida: shakeOff.length(),
      exposicion: renderer.toneMappingExposure,
      bloom: !!composer,
    }),
  };
}
