// OWNER: Andreushin — Nivel 3 · ARIA (Asistente de Ruta de Ingeniería Aeroespacial).
// Asistente flotante: un círculo blanco con el astronauta y, a su izquierda, un recuadro que muestra un mensaje,
// lo deja unos momentos y lo desvanece. Va contando lo que pasa en cada fase para que el jugador no tenga que hacer nada.
// Este módulo solo maneja el DOM y los tiempos; los textos y las fases viven en nivel3.js / textos.js.
//
// Un "guion" es una lista de pasos { k: 'clave', v?: () => variables }. Las variables son una función porque
// dependen del idioma y se evalúan al mostrar (así el botón ES/EN cambia el mensaje que está en pantalla).

const FADE_MS = 400;            // lo que dura el desvanecido (debe coincidir con nivel3.css)
const MIN_MS = 3500;            // un mensaje se queda al menos esto…
const MAX_MS = 9000;            // …y como mucho esto
const BASE_MS = 2500;           // lectura: base + MS_PER_CHAR por carácter
const MS_PER_CHAR = 50;
const DEFAULT_GAP_MS = 900;     // pausa entre mensajes de un mismo guion
const MUTE_KEY = 'srl-aria-off';

/**
 * @param {object} o
 * @param {(step: object) => string} o.text    texto del paso en el idioma actual
 * @param {() => string} o.muteLabel           etiqueta accesible del botón ("Silenciar a ARIA" / "Activar a ARIA")
 * @param {string} o.avatarSrc                 imagen del astronauta
 */
export function createAria({ text, muteLabel, avatarSrc }) {
  const root = document.createElement('div');
  root.className = 'n3-aria';
  root.innerHTML = `
    <div class="n3-aria-bubble" id="n3-aria-bubble" role="status" aria-live="polite" aria-atomic="true">
      <b class="n3-aria-name">ARIA</b><span class="n3-aria-text"></span>
    </div>
    <button class="n3-aria-avatar" id="n3-aria-avatar" type="button" aria-pressed="false">
      <img src="${avatarSrc}" alt="" width="88" height="88" draggable="false">
    </button>`;
  document.body.append(root);
  const bubble = root.querySelector('.n3-aria-bubble');
  const txt = root.querySelector('.n3-aria-text');
  const avatar = root.querySelector('.n3-aria-avatar');

  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* ignore */ }

  let queue = [];     // pasos pendientes
  let gap = DEFAULT_GAP_MS;
  let current = null; // paso en pantalla
  let timer = 0;
  let last = '';      // id del último guion (para no repetirlo si la fase se vuelve a dibujar)

  const duration = (s) => Math.min(MAX_MS, Math.max(MIN_MS, BASE_MS + text(s).length * MS_PER_CHAR));

  function hide() {
    bubble.classList.remove('is-on');
    avatar.classList.remove('is-talking');
    current = null;
  }

  function next() {
    clearTimeout(timer);
    const s = queue.shift();
    if (!s || muted) { hide(); return; }
    current = s;
    txt.textContent = text(s);
    bubble.classList.add('is-on');
    avatar.classList.add('is-talking');
    timer = setTimeout(() => {
      hide();
      timer = setTimeout(next, FADE_MS + gap);
    }, duration(s));
  }

  /**
   * Reproduce un guion. Por defecto reemplaza lo que ARIA estuviera diciendo; con `append` lo pone al final de la fila
   * (para no cortar un mensaje corto). `id` evita repetir el mismo guion dos veces seguidas (p. ej. al re-dibujar la fase).
   */
  function play(id, steps, { gapMs = DEFAULT_GAP_MS, append = false, force = false } = {}) {
    if (!force && id && id === last && (current || queue.length)) return;
    last = id || '';
    gap = gapMs;
    if (append && (current || queue.length)) { queue.push(...steps); return; }
    queue = [...steps];
    if (current) { hide(); clearTimeout(timer); timer = setTimeout(next, FADE_MS / 2); } else next();
  }

  /** Mensaje suelto que corta lo que se estaba diciendo; la fila pendiente sigue después (p. ej. «¡Impacto!»). */
  function interject(step) {
    if (muted) return;
    const wasOn = Boolean(current);
    queue.unshift(step);
    if (wasOn) hide();
    clearTimeout(timer);
    timer = setTimeout(next, wasOn ? FADE_MS / 2 : 0);
  }

  /** Vuelve a escribir el mensaje en pantalla (cambio de idioma) y la etiqueta del botón. */
  function refresh() {
    if (current) txt.textContent = text(current);
    avatar.setAttribute('aria-label', muteLabel(muted));
  }

  function stop() { queue = []; clearTimeout(timer); hide(); last = ''; }

  avatar.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
    avatar.setAttribute('aria-pressed', String(muted));
    root.classList.toggle('is-muted', muted);
    if (muted) stop(); else play('back', [{ k: 'aria.back' }], { force: true });
    refresh();
  });
  avatar.setAttribute('aria-pressed', String(muted));
  root.classList.toggle('is-muted', muted);
  refresh();

  return { play, interject, refresh, stop };
}
