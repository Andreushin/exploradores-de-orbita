// OWNER: Rol 1 — Entrada compartida para los niveles que se juegan con control directo.
// Une teclado y botones táctiles en un solo estado ({ left: true, thrust: false, … }) y trae sus
// propios estilos (prefijo eo-), así funciona igual en la app principal y en las carpetas nivelN/.

function injectStyles() {
  if (document.getElementById('eo-input')) return;
  const s = document.createElement('style');
  s.id = 'eo-input';
  s.textContent = `
    .eo-pad { display: flex; gap: 8px; align-items: flex-end; justify-content: space-between; padding: 8px; pointer-events: none; }
    .eo-pad-group { display: flex; gap: 8px; pointer-events: auto; }
    .eo-pad-btn { font: 600 1.25rem/1 "Space Grotesk", system-ui, sans-serif; min-width: 52px; min-height: 52px; padding: 6px 10px; border-radius: 14px; border: 1px solid #263362; background: rgba(14, 21, 48, .82); color: #eef2ff; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
    .eo-pad-btn small { display: block; margin-top: 3px; font: 500 .62rem "JetBrains Mono", monospace; color: #9aa6cf; }
    .eo-pad-btn.is-down, .eo-pad-btn[aria-pressed="true"] { background: #263362; border-color: #4fc3f7; }
    .eo-pad-btn.eo-pad-main { min-width: 76px; background: #ff6b35; border-color: #ff6b35; color: #0a0f22; }
    .eo-pad-btn.eo-pad-main small { color: #0a0f22; }
    .eo-pad-btn.eo-pad-main.is-down { background: #ff8a5c; }
    .eo-pad-btn:focus-visible { outline: 2px solid #4fc3f7; outline-offset: 2px; }`;
  document.head.append(s);
}

const TYPING = ['INPUT', 'TEXTAREA', 'SELECT'];

/**
 * @param {object} o
 * @param {Record<string, string[]>} o.actions  acción → códigos de tecla (KeyboardEvent.code)
 * @param {(action: string) => void} [o.onPress] se llama una vez al presionar (tecla o botón)
 * @param {() => boolean} [o.isActive]          si devuelve false, el teclado se ignora (menús, diálogos)
 * @returns {{ state: Record<string, boolean>, pad: Function, release: Function, destroy: Function }}
 */
export function createInput({ actions, onPress = () => {}, isActive = () => true }) {
  const state = Object.fromEntries(Object.keys(actions).map((a) => [a, false]));
  const byCode = {};
  for (const [a, codes] of Object.entries(actions)) for (const c of codes) byCode[c] = a;
  const buttons = [];

  const paint = (a) => { for (const b of buttons) if (b.dataset.action === a && b.dataset.hold) b.classList.toggle('is-down', state[a]); };
  const set = (a, down) => { if (state[a] !== down) { state[a] = down; paint(a); } };
  const release = () => { for (const a of Object.keys(state)) set(a, false); };

  const onKey = (e) => {
    const a = byCode[e.code];
    if (!a || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.type === 'keyup') { if (state[a]) { e.preventDefault(); set(a, false); } return; }
    if (!isActive() || TYPING.includes(e.target?.tagName)) return;
    // Enter sobre un botón enfocado sigue activando ese botón
    if (e.code === 'Enter' && e.target?.tagName === 'BUTTON') return;
    e.preventDefault(); // las flechas y la barra espaciadora no desplazan la página
    if (e.repeat) return;
    set(a, true);
    onPress(a);
  };
  const onHide = () => release();
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  addEventListener('blur', onHide);
  document.addEventListener('visibilitychange', onHide);

  /**
   * Botones en pantalla. `groups` es una lista de grupos (izquierda → derecha); cada botón:
   * { action, label, hint?, aria, hold? (true = mantener; false = un toque), main? }
   */
  function pad(groups) {
    injectStyles();
    const root = document.createElement('div');
    root.className = 'eo-pad';
    for (const group of groups) {
      const g = document.createElement('div');
      g.className = 'eo-pad-group';
      for (const def of group) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `eo-pad-btn${def.main ? ' eo-pad-main' : ''}`;
        b.dataset.action = def.action;
        if (def.hold !== false) b.dataset.hold = '1';
        b.innerHTML = `${def.label}${def.hint ? `<small>${def.hint}</small>` : ''}`;
        b.setAttribute('aria-label', def.aria);
        b.tabIndex = -1; // el teclado ya tiene sus teclas; así el foco no se queda en el botón
        if (def.hold === false) {
          b.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(def.action); });
        } else {
          const up = () => set(def.action, false);
          b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); set(def.action, true); onPress(def.action); });
          b.addEventListener('pointerup', up);
          b.addEventListener('pointercancel', up);
          b.addEventListener('lostpointercapture', up);
        }
        b.addEventListener('contextmenu', (e) => e.preventDefault());
        buttons.push(b);
        g.append(b);
      }
      root.append(g);
    }
    return root;
  }

  function destroy() {
    removeEventListener('keydown', onKey);
    removeEventListener('keyup', onKey);
    removeEventListener('blur', onHide);
    document.removeEventListener('visibilitychange', onHide);
    buttons.length = 0;
  }

  return { state, pad, release, destroy };
}
