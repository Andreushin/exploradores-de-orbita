// OWNER: Rol 1 — Sensación de juego compartida: sonido, pantalla de resultado con estrellas
// y botón de silencio. Trae sus propios estilos (prefijo eo-) y textos ES/EN, así funciona igual
// en la app principal y en las carpetas nivelN/ sin depender de su CSS.

const LANG_KEY = 'srl-lang';
const SOUND_KEY = 'eo-sonido';
const lang = () => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es'; } catch { return 'es'; } };
const TXT = {
  es: { stars: '{n} de 3 estrellas', best: 'Mejor marca: {n} ★', record: '¡Nueva mejor marca!', unlocked: '🔓 Nuevo destino desbloqueado: {dest}', soundOn: 'Silenciar sonido', soundOff: 'Activar sonido' },
  en: { stars: '{n} of 3 stars', best: 'Best: {n} ★', record: 'New best!', unlocked: '🔓 New destination unlocked: {dest}', soundOn: 'Mute sound', soundOff: 'Turn sound on' },
};
const tr = (k, v = {}) => TXT[lang()][k].replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Sonido (Web Audio: sin archivos ni licencias) -----------------------------------------
let audio = null;
let engine = null;

/** Activado salvo que el jugador lo apague; en pantallas táctiles empieza apagado. */
export function isMuted() {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    if (v) return v === 'off';
  } catch { /* ignore */ }
  return matchMedia('(pointer: coarse)').matches;
}
function setMuted(m) {
  try { localStorage.setItem(SOUND_KEY, m ? 'off' : 'on'); } catch { /* ignore */ }
  if (m) engineStop();
}
function ctx() {
  if (isMuted()) return null;
  audio ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
  return audio;
}
function tone(freq, start, dur, { type = 'sine', vol = 0.15, slide = 0 } = {}) {
  const a = ctx(); if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}

/** Efectos cortos: 'click' | 'star' | 'success' | 'fail' | 'unlock' | 'decision'. */
export function sfx(name) {
  if (isMuted()) return;
  switch (name) {
    case 'click': tone(660, 0, 0.06, { type: 'triangle', vol: 0.06 }); break;
    case 'decision': tone(520, 0, 0.08, { type: 'triangle', vol: 0.08 }); tone(780, 0.07, 0.1, { type: 'triangle', vol: 0.08 }); break;
    case 'star': tone(880, 0, 0.12, { vol: 0.12 }); tone(1320, 0.06, 0.18, { vol: 0.1 }); break;
    case 'success': [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.25, { type: 'triangle', vol: 0.12 })); break;
    case 'fail': tone(330, 0, 0.3, { type: 'sawtooth', vol: 0.08, slide: -180 }); tone(220, 0.25, 0.4, { type: 'sawtooth', vol: 0.07, slide: -120 }); break;
    case 'unlock': [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.08, 0.2, { vol: 0.1 })); break;
    default: break;
  }
}

/** Rugido del motor mientras se mantiene un quemado (ruido filtrado). */
export function engineStart() {
  const a = ctx(); if (!a || engine) return;
  const len = a.sampleRate; const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(0.18, a.currentTime + 0.15);
  src.connect(f).connect(g).connect(a.destination); src.start();
  engine = { src, g };
}
export function engineStop() {
  if (!engine || !audio) return;
  const { src, g } = engine; engine = null;
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.2);
  src.stop(audio.currentTime + 0.25);
}

/** Botón 🔊/🔇 para el header. `className` permite usar las clases de botón de cada página. */
export function soundToggle(className = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `eo-sound ${className}`.trim();
  const paint = () => {
    const m = isMuted();
    b.textContent = m ? '🔇' : '🔊';
    b.setAttribute('aria-label', m ? tr('soundOff') : tr('soundOn'));
    b.setAttribute('aria-pressed', String(!m));
  };
  b.addEventListener('click', () => { setMuted(!isMuted()); paint(); sfx('click'); });
  paint();
  return b;
}

// --- Estilos (una sola vez) ----------------------------------------------------------------
function injectStyles() {
  if (document.getElementById('eo-game-ui')) return;
  const s = document.createElement('style');
  s.id = 'eo-game-ui';
  s.textContent = `
    .eo-overlay { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 16px; background: rgba(4, 7, 18, 0.78); backdrop-filter: blur(4px); animation: eo-fade .25s ease; }
    .eo-card { position: relative; width: min(440px, 100%); background: #0e1530; color: #eef2ff; border: 1px solid #263362; border-radius: 16px; padding: 24px 20px 20px; text-align: center; font-family: "Space Grotesk", system-ui, sans-serif; box-shadow: 0 20px 60px rgba(0,0,0,.5); animation: eo-pop .35s cubic-bezier(.2,1.4,.4,1); overflow: hidden; }
    .eo-kicker { font: 500 .75rem "JetBrains Mono", monospace; letter-spacing: .1em; text-transform: uppercase; color: #4fc3f7; }
    .eo-card h2 { margin: 6px 0 4px; font-size: 1.5rem; }
    .eo-card p { margin: 6px 0; color: #9aa6cf; }
    .eo-stars { display: flex; justify-content: center; gap: 10px; margin: 14px 0 6px; font-size: 2.6rem; line-height: 1; }
    .eo-star { color: #263362; transform: scale(.6); transition: transform .3s cubic-bezier(.2,1.6,.4,1), color .2s; }
    .eo-star.is-on { color: #fbbf24; transform: scale(1); text-shadow: 0 0 18px rgba(251,191,36,.6); }
    .eo-meta { font: 500 .8rem "JetBrains Mono", monospace; color: #9aa6cf; }
    .eo-record { color: #4ade80; font-weight: 700; }
    .eo-unlock { margin-top: 10px; padding: 8px 10px; border-radius: 10px; background: rgba(74,222,128,.12); border: 1px solid #4ade80; color: #4ade80; font-weight: 600; }
    .eo-reasons { text-align: left; margin: 12px 0 4px; padding-left: 20px; color: #eef2ff; font-size: .92rem; }
    .eo-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 16px; }
    .eo-btn { font: inherit; min-height: 44px; padding: 10px 16px; border-radius: 10px; border: 1px solid #263362; background: #16204a; color: #eef2ff; cursor: pointer; }
    .eo-btn:hover { background: #263362; }
    .eo-btn-primary { background: #ff6b35; border-color: #ff6b35; color: #0a0f22; font-weight: 700; }
    .eo-btn-primary:hover { background: #ff8a5c; }
    .eo-btn:focus-visible, .eo-sound:focus-visible { outline: 2px solid #4fc3f7; outline-offset: 2px; }
    .eo-confetti { position: absolute; inset: 0; pointer-events: none; }
    .eo-sound { font-size: 1.1rem; line-height: 1; min-width: 44px; min-height: 40px; cursor: pointer; }
    .eo-starline { letter-spacing: 2px; color: #fbbf24; white-space: nowrap; }
    .eo-starline .off { color: #3a4470; }
    @keyframes eo-fade { from { opacity: 0 } }
    @keyframes eo-pop { from { transform: scale(.85); opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .eo-overlay, .eo-card { animation: none } .eo-star { transition: none } }`;
  document.head.append(s);
}

/** Texto ★★☆ para listas y tarjetas (con estrellas apagadas atenuadas). */
export function starLine(n, max = 3) {
  injectStyles();
  return `<span class="eo-starline" aria-label="${tr('stars', { n })}">${'★'.repeat(n)}<span class="off">${'★'.repeat(max - n)}</span></span>`;
}

function confetti(card) {
  if (reducedMotion()) return;
  const c = document.createElement('canvas'); c.className = 'eo-confetti';
  card.prepend(c);
  const r = card.getBoundingClientRect(); c.width = r.width; c.height = r.height;
  const g = c.getContext('2d');
  const colors = ['#ff6b35', '#4fc3f7', '#4ade80', '#fbbf24', '#eef2ff'];
  const bits = Array.from({ length: 90 }, () => ({ x: r.width / 2, y: r.height * 0.35, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 8 - 2, s: Math.random() * 5 + 3, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6 }));
  let frames = 0;
  (function step() {
    g.clearRect(0, 0, c.width, c.height);
    for (const b of bits) { b.vy += 0.25; b.x += b.vx; b.y += b.vy; b.a += 0.2; g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.fillStyle = b.c; g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); g.restore(); }
    if (++frames < 110) requestAnimationFrame(step); else c.remove();
  })();
}

/**
 * Pantalla de resultado de un nivel.
 * @param {object} o
 * @param {string} o.kicker    ej. "Nivel 3 · Travesía"
 * @param {string} o.title     ej. "¡Órbita estable!"
 * @param {string} [o.text]    una línea de contexto
 * @param {number} o.stars     0–3
 * @param {{best:number, improved:boolean, unlocked:string|null}} [o.record] resultado de recordLevel
 * @param {string} [o.unlockedName] nombre visible del destino desbloqueado
 * @param {string[]} [o.reasons] cómo conseguir más estrellas (si no fueron 3)
 * @param {{label:string, onClick:Function}} o.primary
 * @param {{label:string, onClick:Function}} [o.secondary]
 */
export function showResult(o) {
  injectStyles();
  const overlay = document.createElement('div');
  overlay.className = 'eo-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'eo-result-title');
  const rec = o.record;
  overlay.innerHTML = `
    <div class="eo-card">
      <div class="eo-kicker">${o.kicker}</div>
      <h2 id="eo-result-title">${o.title}</h2>
      ${o.text ? `<p>${o.text}</p>` : ''}
      <div class="eo-stars" aria-label="${tr('stars', { n: o.stars })}">${[0, 1, 2].map(() => '<span class="eo-star" aria-hidden="true">★</span>').join('')}</div>
      ${rec ? `<div class="eo-meta">${rec.improved && rec.best > 0 ? `<span class="eo-record">${tr('record')}</span>` : tr('best', { n: rec.best })}</div>` : ''}
      ${rec?.unlocked && o.unlockedName ? `<div class="eo-unlock">${tr('unlocked', { dest: o.unlockedName })}</div>` : ''}
      ${o.stars < 3 && o.reasons?.length ? `<ul class="eo-reasons">${o.reasons.map((r) => `<li>${r}</li>`).join('')}</ul>` : ''}
      <div class="eo-actions"></div>
    </div>`;
  const actions = overlay.querySelector('.eo-actions');
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const mk = (b, primary) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = `eo-btn${primary ? ' eo-btn-primary' : ''}`; el.textContent = b.label;
    el.addEventListener('click', () => { sfx('click'); close(); b.onClick?.(); });
    return el;
  };
  if (o.secondary) actions.append(mk(o.secondary, false));
  const primary = mk(o.primary, true);
  actions.append(primary);
  const onKey = (e) => { if (e.key === 'Escape' && o.secondary) { close(); o.secondary.onClick?.(); } };
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  primary.focus();

  // Estrellas una por una, con sonido; confeti con 3.
  const stars = [...overlay.querySelectorAll('.eo-star')];
  const delay = reducedMotion() ? 0 : 320;
  sfx(o.stars > 0 ? 'success' : 'fail');
  stars.forEach((s, i) => {
    if (i < o.stars) setTimeout(() => { s.classList.add('is-on'); sfx('star'); }, 450 + i * delay);
  });
  if (o.stars === 3) setTimeout(() => confetti(overlay.querySelector('.eo-card')), 450 + 3 * delay);
  if (rec?.unlocked) setTimeout(() => sfx('unlock'), 600 + 3 * delay);
  return close;
}
