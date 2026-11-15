// OWNER: Rol 3 — Nivel 2 · efectos de sonido sintetizados con WebAudio (sin archivos).
// Silencio por defecto en pantallas táctiles y con "reducir movimiento"; el jugador decide con 🔊/🔇.

const KEY = 'eo-sonido';
let ctx = null;
let motor = null;

export function silenciado() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'on') return false;
    if (v === 'off') return true;
  } catch { /* storage bloqueado */ }
  return matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function setSilenciado(off) {
  try { localStorage.setItem(KEY, off ? 'off' : 'on'); } catch { /* ignore */ }
  if (off) motorStop();
}

function audio() {
  if (silenciado()) return null;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

/** Un tono corto: frecuencia inicial → final, forma de onda y volumen. */
function tono(a, { f0, f1 = f0, dur = 0.12, type = 'sine', vol = 0.15, at = 0 }) {
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Efectos: 'clic' | 'quitar' | 'alerta' | 'exito' | 'fallo' | 'estrella' | 'paso' | 'ping'. */
export function sfx(nombre) {
  const a = audio();
  if (!a) return;
  const efectos = {
    // Metálico: dos parciales cuadrados que bajan rápido, como un pestillo que encaja
    clic: () => { tono(a, { f0: 1400, f1: 500, dur: 0.06, type: 'square', vol: 0.06 }); tono(a, { f0: 2600, f1: 900, dur: 0.05, type: 'triangle', vol: 0.05, at: 0.01 }); },
    quitar: () => tono(a, { f0: 600, f1: 260, dur: 0.1, type: 'triangle', vol: 0.08 }),
    alerta: () => { tono(a, { f0: 330, dur: 0.12, type: 'sawtooth', vol: 0.05 }); tono(a, { f0: 260, dur: 0.16, type: 'sawtooth', vol: 0.05, at: 0.13 }); },
    exito: () => [523, 659, 784, 1047].forEach((f, i) => tono(a, { f0: f, dur: 0.18, type: 'triangle', vol: 0.1, at: i * 0.09 })),
    fallo: () => { tono(a, { f0: 300, f1: 120, dur: 0.45, type: 'sawtooth', vol: 0.07 }); },
    estrella: () => { tono(a, { f0: 880, f1: 1760, dur: 0.2, type: 'sine', vol: 0.12 }); tono(a, { f0: 1320, dur: 0.25, type: 'triangle', vol: 0.06, at: 0.05 }); },
    paso: () => tono(a, { f0: 700, dur: 0.07, type: 'sine', vol: 0.07 }),
    ping: () => { tono(a, { f0: 1800, f1: 1700, dur: 0.25, type: 'sine', vol: 0.08 }); tono(a, { f0: 1800, f1: 1700, dur: 0.25, type: 'sine', vol: 0.04, at: 0.3 }); },
  };
  efectos[nombre]?.();
}

/** Ruido filtrado mientras el propulsor está encendido en la prueba en tierra. */
export function motorStart() {
  const a = audio();
  if (!a || motor) return;
  const buf = a.createBuffer(1, a.sampleRate, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.12, a.currentTime + 0.2);
  src.connect(f).connect(g).connect(a.destination);
  src.start();
  motor = { src, g };
}

export function motorStop() {
  if (!motor || !ctx) { motor = null; return; }
  const { src, g } = motor;
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
  src.stop(ctx.currentTime + 0.25);
  motor = null;
}

/** Botón 🔊/🔇 para el encabezado. */
export function botonSonido(className, etiquetas) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  const pintar = () => {
    const off = silenciado();
    b.textContent = off ? '🔇' : '🔊';
    b.setAttribute('aria-pressed', String(!off));
    b.setAttribute('aria-label', etiquetas());
  };
  b.addEventListener('click', () => {
    setSilenciado(!silenciado());
    pintar();
    sfx('clic');
  });
  b.pintar = pintar;
  pintar();
  return b;
}
