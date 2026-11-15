// OWNER: Rol 1 — Tarjetas de aprendizaje "¿Sabías que…?". Aparecen cuando el jugador vive el concepto
// (su primer empuje, su primer periapsis…), no antes. Cada tarjeta sale una sola vez por partida.
// Trae sus estilos (prefijo eo-) y sus etiquetas ES/EN; el texto de cada tarjeta lo pone el nivel.

const LANG_KEY = 'srl-lang';
const lang = () => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es'; } catch { return 'es'; } };
const LABEL = { es: { tip: 'Lo que acaba de pasar', close: 'Cerrar' }, en: { tip: 'What just happened', close: 'Close' } };

function injectStyles() {
  if (document.getElementById('eo-tips')) return;
  const s = document.createElement('style');
  s.id = 'eo-tips';
  s.textContent = `
    .eo-tips { display: grid; gap: 6px; justify-items: start; pointer-events: none; padding: 8px; }
    .eo-tip { pointer-events: auto; max-width: min(430px, 100%); display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: start; padding: 8px 10px 9px 12px; border-radius: 12px; border: 1px solid #263362; border-left: 3px solid #4fc3f7; background: rgba(14, 21, 48, .94); color: #eef2ff; font: 400 .88rem/1.35 "Space Grotesk", system-ui, sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,.4); animation: eo-tip-in .3s ease; }
    .eo-tip-kicker { font: 500 .66rem "JetBrains Mono", monospace; letter-spacing: .08em; text-transform: uppercase; color: #4fc3f7; }
    .eo-tip-text { grid-column: 1; }
    .eo-tip-close { grid-row: 1 / span 2; grid-column: 2; font: inherit; line-height: 1; min-width: 28px; min-height: 28px; border: 0; border-radius: 8px; background: transparent; color: #9aa6cf; cursor: pointer; }
    .eo-tip-close:hover { background: #263362; color: #eef2ff; }
    .eo-tip-close:focus-visible { outline: 2px solid #4fc3f7; }
    @keyframes eo-tip-in { from { opacity: 0; transform: translateY(-6px); } }
    @media (prefers-reduced-motion: reduce) { .eo-tip { animation: none; } }`;
  document.head.append(s);
}

/**
 * @param {HTMLElement} host  contenedor donde se apilan las tarjetas (el nivel decide su posición)
 * @param {{ max?: number }} [o] cuántas tarjetas pueden verse a la vez
 * @returns {{ show: (id: string, text: string, ms?: number) => boolean, reset: Function, clear: Function }}
 */
export function createTips(host, { max = 2 } = {}) {
  injectStyles();
  host.classList.add('eo-tips');
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  const seen = new Set();

  /** Muestra la tarjeta `id` si no ha salido en esta partida. Devuelve true si la mostró. */
  function show(id, text, ms = 9000) {
    if (seen.has(id)) return false;
    seen.add(id);
    const el = document.createElement('div');
    el.className = 'eo-tip';
    const L = LABEL[lang()];
    el.innerHTML = `<span class="eo-tip-kicker">💡 ${L.tip}</span><button class="eo-tip-close" type="button" tabindex="-1" aria-label="${L.close}">✕</button><span class="eo-tip-text"></span>`;
    el.querySelector('.eo-tip-text').textContent = text;
    el.querySelector('.eo-tip-close').addEventListener('click', () => el.remove());
    host.append(el);
    while (host.children.length > max) host.firstElementChild.remove();
    if (ms > 0) setTimeout(() => el.remove(), ms);
    return true;
  }

  return {
    show,
    /** Partida nueva: las tarjetas pueden volver a salir. */
    reset() { seen.clear(); host.replaceChildren(); },
    clear() { host.replaceChildren(); },
  };
}
