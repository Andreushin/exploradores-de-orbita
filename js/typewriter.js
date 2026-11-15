// OWNER: Rol 1 — Máquina de escribir compartida (bitácora del Nivel 3 y Colibrí).
// Módulo sin DOM al importar, para probarlo en Node: tests/typewriter.test.mjs.
//
// Patrón accesible: el texto COMPLETO va en un <span class="sr-only"> (el lector de pantalla lo lee de golpe,
// ver css/a11y.css) y la copia visible, con aria-hidden, se escribe poco a poco.

/** ¿El jugador pidió menos movimiento? Se lee en cada llamada, así que respeta un cambio en vivo. */
export function prefersReducedMotion() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

// Un «carácter» es un grafema: un emoji (🚀, 🛰️) o una letra con tilde nunca se parte a la mitad.
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
export const graphemes = (text) => {
  const s = String(text ?? '');
  return segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s);
};

const MIN_DELAY_MS = 16; // un cuadro

/**
 * Plan de escritura: cuántos caracteres por paso y cada cuántos ms, para ir a `cps` caracteres por segundo
 * sin pasar de `maxMs` en total (las líneas largas escriben de a varios caracteres).
 * @returns {{ step: number, delay: number, total: number }} `total` es la duración estimada en ms
 */
export function typingPlan(len, { cps = 45, maxMs = 2600 } = {}) {
  const n = Math.max(0, Math.floor(len));
  const delay = Math.max(MIN_DELAY_MS, Math.round(1000 / Math.max(1, cps)));
  const natural = n * delay;
  const step = natural > maxMs ? Math.ceil(natural / maxMs) : 1;
  return { step, delay, total: Math.ceil(n / step) * delay };
}

/**
 * Escribe `text` en `el.textContent` poco a poco. Mientras escribe, `el` lleva la clase `is-typing`
 * (para dibujar el cursor desde CSS).
 * - `onDone(completed)`: `true` al terminar (también con `skip()`); `false` si se abortó porque `el` salió del
 *   documento (p. ej. se reinició la bitácora). `cancel()` no llama a `onDone`.
 * - Con `reduce` (por defecto, prefers-reduced-motion) escribe todo de una vez y llama a `onDone` en el acto.
 * - `schedule` / `unschedule` se pueden inyectar para probar sin esperar.
 * @returns {{ skip(): void, cancel(): void, readonly finished: boolean }}
 */
export function typeInto(el, text, { cps = 45, maxMs = 2600, reduce = prefersReducedMotion(), onDone, schedule = setTimeout, unschedule = clearTimeout } = {}) {
  const chars = graphemes(text);
  const full = chars.join('');
  let shown = 0;
  let timer = null;
  let finished = false;

  /** `completed`: true/false avisan a onDone; null (cancel) no avisa. */
  const end = (completed) => {
    if (finished) return;
    finished = true;
    if (timer !== null) { unschedule(timer); timer = null; }
    el.classList?.remove('is-typing');
    if (completed !== null) onDone?.(completed);
  };
  const handle = {
    get finished() { return finished; },
    skip() { if (finished) return; el.textContent = full; end(true); },
    cancel() { end(null); },
  };

  if (reduce || chars.length === 0) {
    el.textContent = full;
    finished = true;
    onDone?.(true);
    return handle;
  }

  const { step, delay } = typingPlan(chars.length, { cps, maxMs });
  el.classList?.add('is-typing');
  const tick = () => {
    timer = null;
    if (finished) return;
    if (el.isConnected === false) { end(false); return; }
    shown = Math.min(chars.length, shown + step);
    el.textContent = chars.slice(0, shown).join('');
    if (shown < chars.length) timer = schedule(tick, delay);
    else end(true);
  };
  tick();
  return handle;
}

/**
 * Cola de escritura: una línea a la vez y en orden, como la bitácora de una consola.
 * - `push(el, text, { onDone, ...opciones })` encola una línea (las opciones son las de `typeInto`).
 * - `skipCurrent()` termina la línea actual y sigue con la siguiente.
 * - `flush()` escribe de golpe la actual y todo lo pendiente.
 * - `clear()` detiene la actual y descarta lo pendiente (sin escribirlo).
 * - `busy` es true mientras haya algo escribiéndose o esperando.
 */
export function createTypeQueue(base = {}) {
  const jobs = [];
  let current = null;

  function pump() {
    while (current === null && jobs.length) {
      const job = jobs.shift();
      let sync = true;
      let doneNow = false;
      const handle = typeInto(job.el, job.text, {
        ...base,
        ...job.opts,
        onDone: (completed) => {
          job.onDone?.(completed);
          if (sync) { doneNow = true; return; } // terminó dentro de typeInto: el while sigue con la siguiente
          current = null;
          pump();
        },
      });
      sync = false;
      if (!doneNow) current = handle;
    }
  }

  return {
    push(el, text, opts = {}) {
      const { onDone, ...rest } = opts;
      jobs.push({ el, text, onDone, opts: rest });
      pump();
    },
    skipCurrent() { current?.skip(); },
    flush() {
      const pending = jobs.splice(0);
      current?.skip();
      for (const job of pending) { job.el.textContent = job.text; job.onDone?.(true); }
    },
    clear() {
      jobs.length = 0;
      current?.cancel();
      current = null;
    },
    get busy() { return current !== null || jobs.length > 0; },
  };
}

/**
 * Fila accesible para una línea que se escribe: el texto completo en `.sr-only` y la copia visible con
 * `aria-hidden`. Se escribe en `visible` con `typeInto` o con la cola. → `{ root, visible, sr }`.
 */
export function accessibleLine(text, { tag = 'li', cls = '', visibleCls = 'eo-tw', doc = globalThis.document } = {}) {
  const root = doc.createElement(tag);
  if (cls) root.className = cls;
  const sr = doc.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const visible = doc.createElement('span');
  visible.className = visibleCls;
  visible.setAttribute('aria-hidden', 'true');
  root.append(sr, visible);
  return { root, visible, sr };
}
