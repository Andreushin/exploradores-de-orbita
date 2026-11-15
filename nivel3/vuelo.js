// OWNER: Andreushin — Nivel 3 · Fase 1: la nave nodriza cruza un campo de asteroides
// (primera persona) antes de desplegar el CubeSat. No toca el propelente del satélite.

// --- Reglas del minijuego -------------------------------------------------------
export const FLIGHT_SECONDS = 25;  // duración del trayecto hasta el punto de despliegue
export const FLIGHT_HITS = 5;      // impactos que aguanta el escudo
const SPEED0 = 9;                  // velocidad de avance al inicio (unidades/s)
const SPEED1 = 15;                 // … y al final
const SPAWN0 = 0.5;                // segundos entre asteroides al inicio
const SPAWN1 = 0.28;               // … y al final
const AIMED = 0.25;                // fracción de asteroides que vienen directo hacia la nave
const Z_FAR = 28;                  // distancia a la que aparecen
const Z_HIT = 0.8;                 // distancia a la que chocan con la nave
const SHIP_R = 0.12;               // radio de la nave (unidades del mundo)
const X_LIM = 1.2; const Y_LIM = 0.8; // cuánto se puede mover la nave
const MAX_V = 1.9; const ACCEL = 9;
const HORIZON = 0.45;              // altura del punto de fuga (fracción del alto)

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ROCK = [
  { base: '#8a7a6a', light: '#cdbba5', dark: '#2f2822' },
  { base: '#7d8089', light: '#c3c7d1', dark: '#262830' },
  { base: '#94735a', light: '#d9b08c', dark: '#33251b' },
];

function makeStars(n = 180) {
  return Array.from({ length: n }, () => ({ x: rand(-3, 3), y: rand(-2, 2), z: rand(0.5, Z_FAR) }));
}

export function createFlight() {
  return {
    state: 'intro', time: 0, progress: 0, shield: 1, hits: 0, dodged: 0,
    camX: 0, camY: 0, vx: 0, vy: 0, speed: 2, spawnIn: 0.6, flash: 0,
    asteroids: [], stars: makeStars(),
  };
}

export function startFlight(f) {
  Object.assign(f, createFlight(), { state: 'playing', stars: f.stars });
}

function makeAsteroid(f) {
  const aimed = Math.random() < AIMED;
  const n = 9;
  return {
    x: aimed ? f.camX + rand(-0.15, 0.15) : f.camX + rand(-1.6, 1.6),
    y: aimed ? f.camY + rand(-0.12, 0.12) : f.camY + rand(-1.1, 1.1),
    z: Z_FAR,
    r: rand(0.16, 0.38),
    shape: Array.from({ length: n }, () => rand(0.72, 1)),
    rot: rand(0, 7), spin: rand(-1.5, 1.5),
    rock: ROCK[Math.floor(Math.random() * ROCK.length)],
    craters: [[rand(-0.4, 0.2), rand(-0.4, 0.2), rand(0.15, 0.24)], [rand(0, 0.4), rand(0, 0.4), rand(0.1, 0.17)]],
    passed: false,
  };
}

/**
 * Avanza el minijuego `dt` segundos.
 * input = { keys: Set('left'|'right'|'up'|'down'), pointer: { x, y } | null } (x, y en −1…1)
 * Devuelve 'hit' | 'crashed' | 'cleared' | null.
 */
export function updateFlight(f, dt, input) {
  const playing = f.state === 'playing';
  f.speed = playing ? SPEED0 + (SPEED1 - SPEED0) * f.progress : 2;
  for (const s of f.stars) {
    s.z -= f.speed * dt;
    if (s.z < 0.3) { s.x = rand(-3, 3); s.y = rand(-2, 2); s.z = Z_FAR; }
  }
  f.flash = Math.max(0, f.flash - dt * 2.5);
  if (!playing) { f.vx *= 0.9; f.vy *= 0.9; return null; }

  // Pilotaje: teclado acelera; el puntero lleva la nave hacia donde apunta
  const k = input.keys;
  const ax = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
  const ay = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
  if (ax || ay) {
    f.vx += ax * ACCEL * dt; f.vy += ay * ACCEL * dt;
    if (!ax) f.vx *= 1 - Math.min(1, 6 * dt);
    if (!ay) f.vy *= 1 - Math.min(1, 6 * dt);
  } else if (input.pointer) {
    f.vx = (input.pointer.x * X_LIM - f.camX) * 5;
    f.vy = (input.pointer.y * Y_LIM - f.camY) * 5;
  } else {
    f.vx *= 1 - Math.min(1, 6 * dt); f.vy *= 1 - Math.min(1, 6 * dt);
  }
  f.vx = clamp(f.vx, -MAX_V, MAX_V); f.vy = clamp(f.vy, -MAX_V, MAX_V);
  f.camX += f.vx * dt; f.camY += f.vy * dt;
  if (Math.abs(f.camX) > X_LIM) { f.camX = Math.sign(f.camX) * X_LIM; f.vx = 0; }
  if (Math.abs(f.camY) > Y_LIM) { f.camY = Math.sign(f.camY) * Y_LIM; f.vy = 0; }

  f.time += dt;
  f.progress = Math.min(1, f.time / FLIGHT_SECONDS);

  f.spawnIn -= dt;
  if (f.spawnIn <= 0 && f.progress < 0.9) {
    f.asteroids.push(makeAsteroid(f));
    f.spawnIn = SPAWN0 - (SPAWN0 - SPAWN1) * f.progress;
  }

  let event = null;
  for (const a of f.asteroids) {
    a.z -= f.speed * dt; a.rot += a.spin * dt;
    if (!a.passed && a.z <= Z_HIT) {
      a.passed = true;
      if (Math.hypot(a.x - f.camX, a.y - f.camY) < a.r + SHIP_R) {
        a.gone = true; f.hits += 1; f.flash = 1; event = 'hit';
        f.shield = Math.max(0, 1 - f.hits / FLIGHT_HITS);
      } else f.dodged += 1;
    }
  }
  f.asteroids = f.asteroids.filter((a) => !a.gone && a.z > 0.35);

  if (f.hits >= FLIGHT_HITS) { f.state = 'crashed'; return 'crashed'; }
  if (f.progress >= 1) { f.state = 'cleared'; f.asteroids = []; return 'cleared'; }
  return event;
}

// --- Dibujo -------------------------------------------------------------------------
/** opts = { destColor, labels: { shield, deploy }, reduceMotion, now } */
export function drawFlight(g, W, H, f, opts) {
  const F = Math.min(W, H) * 0.6;
  const cx = W / 2; const cy = H * HORIZON;
  g.fillStyle = '#04060f'; g.fillRect(0, 0, W, H);

  g.save();
  const shake = opts.reduceMotion ? 0 : f.flash * 8;
  g.translate(cx + rand(-1, 1) * shake, cy + rand(-1, 1) * shake);
  if (!opts.reduceMotion) g.rotate(-f.vx * 0.06);

  // Destino a lo lejos: crece a medida que te acercas
  const dr = 5 + 20 * f.progress;
  g.fillStyle = opts.destColor; g.shadowColor = opts.destColor; g.shadowBlur = 22;
  g.beginPath(); g.arc(-f.camX * 14, -H * 0.14 - f.camY * 14, dr, 0, 7); g.fill(); g.shadowBlur = 0;

  // Estrellas que pasan (estelas)
  g.lineCap = 'round';
  for (const s of f.stars) {
    const px = ((s.x - f.camX * 0.2) * F) / s.z; const py = ((s.y - f.camY * 0.2) * F) / s.z;
    const alpha = Math.min(1, (1 - s.z / Z_FAR) * 1.3);
    if (opts.reduceMotion) {
      g.fillStyle = `rgba(238,242,255,${alpha})`; g.fillRect(px, py, 1.5, 1.5);
      continue;
    }
    const z2 = s.z + f.speed * 0.05;
    const qx = ((s.x - f.camX * 0.2) * F) / z2; const qy = ((s.y - f.camY * 0.2) * F) / z2;
    g.strokeStyle = `rgba(238,242,255,${alpha})`; g.lineWidth = Math.min(2.5, 0.6 + 6 / s.z);
    g.beginPath(); g.moveTo(qx, qy); g.lineTo(px, py); g.stroke();
  }

  // Asteroides, del más lejano al más cercano
  const rocks = [...f.asteroids].sort((a, b) => b.z - a.z);
  for (const a of rocks) {
    const px = ((a.x - f.camX) * F) / a.z; const py = ((a.y - f.camY) * F) / a.z;
    const pr = (a.r * F) / a.z;
    g.globalAlpha = clamp((Z_FAR - a.z) / (Z_FAR * 0.5), 0, 1);
    const grad = g.createRadialGradient(px - pr * 0.35, py - pr * 0.4, pr * 0.1, px, py, pr * 1.05);
    grad.addColorStop(0, a.rock.light); grad.addColorStop(0.45, a.rock.base); grad.addColorStop(1, a.rock.dark);
    g.fillStyle = grad;
    g.beginPath();
    a.shape.forEach((m, i) => {
      const ang = a.rot + (i / a.shape.length) * Math.PI * 2;
      const x = px + Math.cos(ang) * pr * m; const y = py + Math.sin(ang) * pr * m;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (const [ox, oy, cr] of a.craters) {
      const c = Math.cos(a.rot); const s = Math.sin(a.rot);
      g.beginPath(); g.arc(px + (ox * c - oy * s) * pr, py + (ox * s + oy * c) * pr, cr * pr, 0, 7); g.fill();
    }
  }
  g.globalAlpha = 1;
  g.restore();

  // Retícula: el círculo es el tamaño de la nave al momento del choque
  const rr = (SHIP_R * F) / Z_HIT;
  g.strokeStyle = 'rgba(79,195,247,0.55)'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.stroke();
  g.beginPath();
  g.moveTo(cx - rr - 10, cy); g.lineTo(cx - rr + 4, cy); g.moveTo(cx + rr - 4, cy); g.lineTo(cx + rr + 10, cy);
  g.moveTo(cx, cy - rr - 10); g.lineTo(cx, cy - rr + 4); g.moveTo(cx, cy + rr - 4); g.lineTo(cx, cy + rr + 10);
  g.stroke();

  drawCockpit(g, W, H, f, opts);

  if (f.flash > 0) { g.fillStyle = `rgba(255,80,80,${f.flash * 0.35})`; g.fillRect(0, 0, W, H); }
}

function drawCockpit(g, W, H, f, opts) {
  g.fillStyle = '#0a0f22'; g.strokeStyle = '#263362'; g.lineWidth = 2;
  // Marco superior
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H * 0.06);
  g.quadraticCurveTo(W / 2, H * 0.15, 0, H * 0.06); g.closePath(); g.fill(); g.stroke();
  // Pilares
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.06, 0); g.lineTo(W * 0.14, H * 0.82); g.lineTo(0, H * 0.82); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(W, 0); g.lineTo(W * 0.94, 0); g.lineTo(W * 0.86, H * 0.82); g.lineTo(W, H * 0.82); g.closePath(); g.fill(); g.stroke();
  // Tablero
  g.fillStyle = '#0e1530';
  g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.8); g.quadraticCurveTo(W / 2, H * 0.66, W, H * 0.8); g.lineTo(W, H); g.closePath(); g.fill(); g.stroke();

  const fs = Math.max(9, Math.round(H * 0.03));
  const barW = W * 0.18; const barH = Math.max(5, H * 0.018); const by = H * 0.92;
  g.font = `600 ${fs}px "Space Grotesk", system-ui`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  // Escudo
  const lvl = f.shield > 0.5 ? '#4ade80' : f.shield > 0.25 ? '#fbbf24' : '#ff7a7a';
  meter(g, W * 0.2, by, barW, barH, f.shield, lvl, opts.labels.shield);
  // Progreso al despliegue
  meter(g, W * 0.8 - barW, by, barW, barH, f.progress, '#4fc3f7', opts.labels.deploy);

  // Radar (vista desde arriba: adelante es arriba)
  const R = Math.min(H * 0.085, 30); const rx = W / 2; const ry = H - R - H * 0.03;
  g.fillStyle = '#04060f'; g.strokeStyle = 'rgba(79,195,247,0.6)'; g.lineWidth = 1;
  g.beginPath(); g.arc(rx, ry, R, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.arc(rx, ry, R * 0.5, 0, 7); g.stroke();
  const sweep = (opts.now / 900) % (Math.PI * 2);
  g.strokeStyle = 'rgba(79,195,247,0.35)';
  g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Math.cos(sweep) * R, ry + Math.sin(sweep) * R); g.stroke();
  g.save(); g.beginPath(); g.arc(rx, ry, R, 0, 7); g.clip();
  for (const a of f.asteroids) {
    if (a.z > 14) continue;
    const danger = Math.hypot(a.x - f.camX, a.y - f.camY) < a.r + SHIP_R + 0.08;
    g.fillStyle = danger ? '#ff7a7a' : '#9aa6cf';
    g.beginPath(); g.arc(rx + ((a.x - f.camX) / 1.8) * R, ry + R * 0.8 - (a.z / 14) * R * 1.6, danger ? 2.5 : 1.8, 0, 7); g.fill();
  }
  g.restore();
  g.fillStyle = '#eef2ff'; g.fillRect(rx - 2, ry + R * 0.8 - 2, 4, 4);

  // Luces del tablero (solo si hay espacio junto a las barras)
  if (W < 560) return;
  const blink = Math.floor(opts.now / 500) % 2;
  [[0.1, '#4ade80', 1], [0.13, '#fbbf24', blink], [0.87, '#4fc3f7', 1 - blink], [0.9, '#ff6b35', f.flash > 0 ? 1 : 0.3]].forEach(([x, c, on]) => {
    g.globalAlpha = on ? 1 : 0.25; g.fillStyle = c;
    g.beginPath(); g.arc(W * x, H * 0.9, Math.max(2, H * 0.008), 0, 7); g.fill();
  });
  g.globalAlpha = 1;
}

function meter(g, x, y, w, h, value, color, label) {
  g.fillStyle = '#9aa6cf'; g.fillText(label, x, y - 6);
  g.fillStyle = '#16204a'; g.fillRect(x, y, w, h);
  g.fillStyle = color; g.fillRect(x, y, w * clamp(value, 0, 1), h);
  g.strokeStyle = '#263362'; g.lineWidth = 1; g.strokeRect(x, y, w, h);
  // En pantallas angostas solo cabe la etiqueta (el % está en el HUD de abajo)
  const pct = `${Math.round(value * 100)} %`;
  if (g.measureText(label).width + g.measureText(pct).width + 8 > w) return;
  g.fillStyle = '#eef2ff'; g.textAlign = 'right';
  g.fillText(pct, x + w, y - 6);
  g.textAlign = 'left';
}

/** Normaliza la posición del puntero sobre el canvas a −1…1 (centro = punto de fuga). */
export function pointerToInput(e, canvas) {
  const r = canvas.getBoundingClientRect();
  return {
    x: clamp(((e.clientX - r.left) / r.width - 0.5) / 0.36, -1, 1),
    y: clamp(((e.clientY - r.top) / r.height - HORIZON) / 0.3, -1, 1),
  };
}
