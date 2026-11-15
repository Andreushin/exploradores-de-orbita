// OWNER: Rol 1 — Colibrí, el holograma que cuenta la historia del juego (docs/colibri.md).
// Componente autónomo: inyecta su propio SVG y su CSS (css/colibri.css), así que lo puede usar la app principal,
// nivel2/ y nivel3/ con unas pocas líneas. Todo SVG + CSS: sin Canvas.
//
//   const colibri = createColibri({ getLang: () => lang });
//   colibri.float({ tam: 'grande' });            // flotante abajo a la izquierda…
//   colibri.dock(document.getElementById('x'));  // …o acoplado dentro de un contenedor
//   colibri.say('inicio.hola');                  // dice una línea del guion (js/colibri-guion.js)
//   colibri.setGoal('n1.project');               // «AHORA / LUEGO» fijo, aunque se le silencie
//
// Dos capas: createVoice() es la política (cola, prioridades, «una vez por partida», silencio) y no toca el DOM, así
// que se prueba en Node (tests/colibri.test.mjs); createColibri() le pone la vista (DOM) y la devuelve lista.
import { typeInto } from './typewriter.js';
import { GUION, OBJETIVOS } from './colibri-guion.js';

export const PRIO = { baja: 0, normal: 1, alta: 2 };
export const MOODS = ['neutral', 'feliz', 'asombro', 'alerta'];
export const STORE_KEY = 'eo-colibri'; // aparte de eo-mision: lo «ya visto» no es parte de la partida compartida entre niveles
const STORE_VERSION = 1;
const MAX_QUEUE = 3;            // lo que sobre se descarta (lo de menor prioridad y lo más reciente)
const GAP_MS = 400;             // respiro entre una línea y la siguiente
const REACT_COOLDOWN_MS = 20000;

// ── Textos puros ─────────────────────────────────────────────────────────────────

/** Reemplaza {nombre} por vars.nombre; si falta la variable, deja {nombre} a la vista. */
export const interpolate = (text, vars = {}) => String(text).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));

/** Páginas de un id en el idioma pedido (con respaldo en español). → { id, entry, pages } o null si no existe. */
export function resolveLine(script, id, lang, vars = {}) {
  const entry = script[id];
  const pages = (entry?.[lang] ?? entry?.es ?? []).map((p) => interpolate(p, vars));
  return pages.length ? { id, entry, pages } : null;
}

/** «AHORA / LUEGO»: acepta una clave de OBJETIVOS o un { ahora, luego } propio ({es, en} o texto). */
export function resolveGoal(goals, spec, lang, vars = {}) {
  const g = typeof spec === 'string' ? goals[spec] : spec;
  if (!g) return null;
  const pick = (v) => interpolate(v && typeof v === 'object' ? (v[lang] ?? v.es ?? '') : (v ?? ''), vars);
  return { ahora: pick(g.ahora), luego: pick(g.luego) };
}

/** Pausa de lectura tras escribirse una página, antes de pasar a la siguiente (mientras se escribe ya se va leyendo). */
export const holdMs = (text) => Math.min(7000, Math.max(2000, 1200 + String(text).length * 25));

// ── Memoria de «ya visto» (localStorage, clave propia) ──────────────────────────────

const safeStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/** Lo ya dicho y las preferencias (silencio, minimizado). Sin almacenamiento disponible sigue en memoria. */
export function createStore(storage = safeStorage(), key = STORE_KEY) {
  let memory = { v: STORE_VERSION, mudo: false, min: false, vistos: {} };
  const read = () => {
    try {
      const raw = storage?.getItem(key);
      const d = raw ? JSON.parse(raw) : null;
      if (d?.v === STORE_VERSION && d.vistos && typeof d.vistos === 'object') return d;
    } catch { /* datos corruptos: se ignoran */ }
    return memory;
  };
  const write = (d) => { memory = d; try { storage?.setItem(key, JSON.stringify(d)); } catch { /* sin almacenamiento */ } };
  return {
    get mudo() { return Boolean(read().mudo); },
    get min() { return Boolean(read().min); },
    seen: (id) => Boolean(read().vistos[id]),
    markSeen: (id) => { const d = read(); write({ ...d, vistos: { ...d.vistos, [id]: 1 } }); },
    set: (name, value) => write({ ...read(), [name]: Boolean(value) }),
    /** Nueva partida: se olvidan las líneas vistas; el silencio y el minimizado son preferencias y se conservan. */
    forget: () => write({ ...read(), vistos: {} }),
  };
}

/** Para «Reiniciar» / «Nueva misión»: Colibrí vuelve a contar la historia desde el principio. */
export const forgetColibri = (storage, key) => createStore(storage, key).forget();

// ── Voz: la política, sin DOM ─────────────────────────────────────────────────────────────

/**
 * @param {object} o
 * @param {object} o.script GUION · o.goals OBJETIVOS · o.getLang → 'es' | 'en'
 * @param {ReturnType<typeof createStore>} o.store
 * @param {object} o.view  page({ text, mood, onTyped }) → { skip(), cancel() } · retext(text) · idle() · hideBubble() ·
 *   goal({ ahora, luego } | null) · setMuted(b) · setMin(b) · paused() → bool (puntero o foco encima: no se retira)
 */
export function createVoice({ script, goals = {}, getLang = () => 'es', store, view, now = () => Date.now(), schedule = setTimeout, unschedule = clearTimeout }) {
  const session = new Set();   // once: 'sesion'
  const lastSaid = new Map();  // id → instante (para el enfriamiento de las reacciones)
  let queue = [];
  let current = null;          // { item, line, page, handle, timer, typed }
  let gap = null;
  let goal = null;             // { spec, vars }
  let muted = store.mudo;
  let minimized = store.min;

  const isSeen = (id, once) => (once === 'sesion' ? session.has(id) : store.seen(id));
  const markSeen = (item) => { if (item.once === 'sesion') session.add(item.id); else if (item.once) store.markSeen(item.id); };
  const silent = () => muted || minimized;

  function next() {
    if (current || gap !== null || !queue.length || silent()) return;
    const item = queue.shift();
    const line = resolveLine(script, item.id, getLang(), item.vars);
    if (!line) { next(); return; }
    current = { item, line, page: 0, handle: null, timer: null, typed: false };
    lastSaid.set(item.id, now());
    runPage();
  }

  function runPage() {
    const c = current;
    if (c.page === c.line.pages.length - 1) markSeen(c.item); // en la última página: si lo interrumpen antes, se vuelve a contar
    c.typed = false;
    c.handle = view.page({ text: c.line.pages[c.page], mood: c.line.entry.mood ?? 'neutral', onTyped: () => onTyped(c) });
  }

  function onTyped(c) {
    if (current !== c) return;
    c.typed = true;
    const fire = () => {
      c.timer = null;
      if (current !== c) return;
      if (view.paused?.()) { c.timer = schedule(fire, 1000); return; } // con el puntero o el foco encima, no se va
      advance(c);
    };
    c.timer = schedule(fire, holdMs(c.line.pages[c.page]));
  }

  function advance(c) {
    if (current !== c) return;
    if (c.timer !== null) { unschedule(c.timer); c.timer = null; }
    if (c.page < c.line.pages.length - 1) { c.page += 1; runPage(); return; }
    current = null;
    view.idle();
    gap = schedule(() => { gap = null; next(); }, GAP_MS);
  }

  function stopCurrent() {
    if (!current) return;
    current.handle?.cancel();
    if (current.timer !== null) unschedule(current.timer);
    current = null;
  }

  function enqueue(item) {
    if (current && PRIO[item.prio] > PRIO[current.item.prio]) { // lo importante interrumpe lo que se está diciendo
      stopCurrent();
      queue.unshift(item);
      next();
      return true;
    }
    if (item.prio === 'baja' && (current || gap !== null || queue.length)) return false; // las anécdotas no hacen cola
    queue.push(item);
    queue.sort((a, b) => PRIO[b.prio] - PRIO[a.prio]); // estable: dentro de una misma prioridad, por orden de llegada
    queue.splice(MAX_QUEUE);
    next();
    return true;
  }

  const renderGoal = () => view.goal(goal ? resolveGoal(goals, goal.spec, getLang(), goal.vars) : null);

  const api = {
    /** Dice una línea del guion. false si está silenciado, no existe, ya se vio (`once`), ya está en curso o no hace cola. */
    say(id, vars = {}, opts = {}) {
      if (silent()) return false;
      const line = resolveLine(script, id, getLang(), vars);
      if (!line) return false;
      const once = opts.once ?? line.entry.once ?? false;
      if (!opts.force && once && isSeen(id, once)) return false;
      if (!opts.force && (current?.item.id === id || queue.some((q) => q.id === id))) return false;
      if (opts.cooldownMs && now() - (lastSaid.get(id) ?? -Infinity) < opts.cooldownMs) return false;
      return enqueue({ id, vars, once, prio: opts.prio ?? line.entry.prio ?? 'normal' });
    },
    /** Reacción a lo que acaba de hacer el jugador: se puede repetir, pero no antes de 20 s. Su prioridad es la de la línea (los errores son `alta`). */
    react(id, vars = {}) { return api.say(id, vars, { once: false, cooldownMs: REACT_COOLDOWN_MS }); },
    /** «AHORA / LUEGO» fijo. `spec` es una clave de OBJETIVOS o un { ahora, luego }; null lo quita. */
    setGoal(spec, vars = {}) { goal = spec ? { spec, vars } : null; renderGoal(); },
    /** Repinta lo visible en el idioma actual. La línea en curso sale completa en el idioma nuevo, sin volver a escribirse. */
    refresh() {
      renderGoal();
      if (!current) return;
      const line = resolveLine(script, current.item.id, getLang(), current.item.vars);
      const text = line?.pages[current.page];
      if (text == null) return;
      current.line = line;
      const wasTyping = !current.typed;
      current.handle?.cancel();
      view.retext(text);
      if (wasTyping) onTyped(current);
    },
    /** Primer toque: completa el texto que se escribe. Segundo toque: pasa a la siguiente página o termina la línea. */
    skip() {
      if (!current) return;
      if (!current.typed) current.handle?.skip();
      else advance(current);
    },
    /** Cambio de pantalla o de fase: se calla lo que se decía y lo que esperaba turno. */
    clear() {
      queue = [];
      stopCurrent();
      if (gap !== null) { unschedule(gap); gap = null; }
      view.hideBubble();
    },
    mute(b) { muted = Boolean(b); store.set('mudo', muted); if (muted) api.clear(); view.setMuted(muted); },
    minimize(b) { minimized = Boolean(b); store.set('min', minimized); if (minimized) api.clear(); view.setMin(minimized); },
    state: () => ({ speaking: Boolean(current), queued: queue.length, muted, minimized, goal }),
  };
  view.setMuted(muted);
  view.setMin(minimized);
  return api;
}

// ── Vista (DOM) ────────────────────────────────────────────────────────────────────────

const UI = {
  es: { aside: 'Colibrí, guía de la misión', name: 'Colibrí', now: 'AHORA', next: 'LUEGO', skip: 'Saltar', mute: 'Silenciar', min: 'Minimizar', expand: 'Mostrar a Colibrí' },
  en: { aside: 'Colibrí, mission guide', name: 'Colibrí', now: 'NOW', next: 'NEXT', skip: 'Skip', mute: 'Mute', min: 'Minimize', expand: 'Show Colibrí' },
};

// Iconos de los botones: trazos como el holograma. Su nombre accesible va en aria-label/title (paintLabels).
const ico = (d) => `<svg class="eo-col-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${d}</svg>`;
const ICON = {
  skip: ico('<path d="M3 3l5 5-5 5M8 3l5 5-5 5"/>'),
  mute: ico('<path d="M2 6h3l4-3v10l-4-3H2z"/><path class="ico-ondas" d="M11.5 5.5a3.5 3.5 0 0 1 0 5"/><path class="ico-x" d="M11.5 6l3.5 4M15 6l-3.5 4"/>'),
  min: ico('<path d="M3 6l5 5 5-5"/>'),
  expand: ico('<path d="M3 10l5-5 5 5"/>'),
};

// Holograma: solo trazos (fill="none"), color = currentColor (→ --n3-info). El aleteo y las ondas son CSS (css/colibri.css).
// aria-hidden: es decoración; lo que dice va a la región .sr-only. Cuerpo, cabeza, pico, 4 ojos (uno por ánimo), 2 alas y 7 barras.
const SVG = `<svg class="eo-col-svg" viewBox="0 0 120 124" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
  <g class="col-ala col-ala-b"><path d="M74 52C66 30 56 14 42 6C46 24 58 42 74 52Z"/></g>
  <g class="col-cuerpo">
    <path d="M72 47C56 54 44 72 47 91C70 90 92 72 87 48"/>
    <path d="M76 58C80 66 76 74 68 80"/>
    <path d="M47 91L34 104M47 91L43 108M47 91L53 107"/>
  </g>
  <circle class="col-cabeza" cx="80" cy="38" r="12"/>
  <path class="col-pico" d="M91 34L118 29M91.5 40L118 29"/>
  <g class="col-ojo">
    <circle class="ojo-neutral" cx="83" cy="35" r="2.2"/>
    <path class="ojo-feliz" d="M80.5 36.5Q83 32.5 85.5 36.5"/>
    <g class="ojo-asombro"><circle cx="83" cy="35" r="3.6"/><circle cx="83" cy="35" r=".7"/><path d="M96 16V22M93 19H99M66 18V22M64 20H68"/></g>
    <g class="ojo-alerta"><circle cx="83" cy="36" r="2.4"/><path d="M77 31L87 33.5"/></g>
  </g>
  <g class="col-ala col-ala-a"><path d="M70 56C56 36 34 26 14 28C30 42 50 56 70 56Z"/></g>
  <g class="col-ondas">
    <line x1="36" y1="120" x2="36" y2="112"/><line x1="44" y1="120" x2="44" y2="106"/><line x1="52" y1="120" x2="52" y2="110"/>
    <line x1="60" y1="120" x2="60" y2="104"/><line x1="68" y1="120" x2="68" y2="110"/><line x1="76" y1="120" x2="76" y2="106"/>
    <line x1="84" y1="120" x2="84" y2="112"/>
  </g>
</svg>`;

/** Enlaza css/colibri.css y css/a11y.css (resueltas desde este archivo: sirve también en subrutas como GitHub Pages). */
function ensureCss(doc) {
  const loads = [];
  for (const [key, file] of [['colibri', 'colibri.css'], ['a11y', 'a11y.css']]) {
    if (doc.querySelector(`link[rel="stylesheet"][href$="css/${file}"]`)) continue; // la página ya la enlaza
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(`../css/${file}`, import.meta.url).href;
    link.dataset.eoCss = key;
    loads.push(new Promise((resolve) => { link.onload = () => resolve(true); link.onerror = () => resolve(key !== 'colibri'); }));
    doc.head.append(link);
  }
  return Promise.all(loads).then((r) => r.every(Boolean));
}

/**
 * Crea a Colibrí. Queda oculto hasta que se le da un lugar con float() o dock() y carga su CSS. Si algo falla (el CSS,
 * el almacenamiento) el juego sigue sin él.
 */
export function createColibri({ script = GUION, objectives = OBJETIVOS, getLang = () => 'es', host, storage, storageKey = STORE_KEY } = {}) {
  const hostEl = host ?? document.body;
  const doc = hostEl.ownerDocument;
  let langOverride = null;
  const lang = () => langOverride ?? getLang();
  const ui = () => UI[lang()] ?? UI.es;

  const root = doc.createElement('aside');
  root.className = 'eo-colibri';
  Object.assign(root.dataset, { modo: 'flotante', estado: 'callado', mood: 'neutral', tam: 'normal', mudo: '0', min: '0' });
  root.hidden = true;
  root.innerHTML = `
    <div class="eo-col-avatar" aria-hidden="true">${SVG}</div>
    <div class="eo-col-caja">
      <div class="eo-col-burbuja" hidden>
        <span class="eo-col-nombre" aria-hidden="true"></span>
        <span class="eo-col-linea"><span class="eo-col-fantasma" aria-hidden="true"></span><span class="eo-col-texto" aria-hidden="true"></span></span>
      </div>
      <p class="eo-col-objetivo" hidden><span class="eo-col-ahora"><b></b> <span></span></span><span class="eo-col-luego"><b></b> <span></span></span></p>
      <div class="eo-col-botones">
        <button type="button" class="eo-col-btn" data-act="skip" hidden>${ICON.skip}</button>
        <button type="button" class="eo-col-btn" data-act="mute" aria-pressed="false">${ICON.mute}</button>
        <button type="button" class="eo-col-btn" data-act="min" aria-expanded="true">${ICON.min}</button>
        <button type="button" class="eo-col-btn" data-act="expand" hidden>${ICON.expand}</button>
      </div>
    </div>
    <p class="sr-only" role="status" aria-live="polite"></p>`;
  const $ = (sel) => root.querySelector(sel);
  const bubble = $('.eo-col-burbuja');
  const typed = $('.eo-col-texto');
  const ghost = $('.eo-col-fantasma');
  const goalBox = $('.eo-col-objetivo');
  const live = $('[role="status"]');
  const btn = (act) => $(`[data-act="${act}"]`);
  let ready = false;
  let placed = false;
  let hovered = false;

  const paintLabels = () => {
    const u = ui();
    root.setAttribute('aria-label', u.aside);
    $('.eo-col-nombre').textContent = u.name;
    goalBox.querySelector('.eo-col-ahora b').textContent = u.now;
    goalBox.querySelector('.eo-col-luego b').textContent = u.next;
    for (const act of ['skip', 'mute', 'min', 'expand']) { btn(act).setAttribute('aria-label', u[act]); btn(act).title = u[act]; }
  };
  const show = () => { root.hidden = !(ready && placed); };

  const view = {
    page({ text, mood, onTyped }) {
      root.dataset.mood = MOODS.includes(mood) ? mood : 'neutral';
      root.dataset.estado = 'hablando';
      bubble.hidden = false;
      btn('skip').hidden = false;
      ghost.textContent = text; // el texto completo, invisible, reserva la altura: la burbuja no «salta» al escribir
      typed.textContent = '';
      live.textContent = text;  // lectores de pantalla: la página completa de una vez (la copia visible es aria-hidden)
      return typeInto(typed, text, { cps: 45, maxMs: 2600, onDone: () => { root.dataset.estado = 'callado'; onTyped(); } });
    },
    retext(text) { ghost.textContent = text; typed.textContent = text; typed.classList.remove('is-typing'); root.dataset.estado = 'callado'; },
    idle() {
      root.dataset.estado = 'callado';
      root.dataset.mood = 'neutral';
      btn('skip').hidden = true;
      if (root.dataset.modo !== 'acoplado') bubble.hidden = true; // acoplado a la consola, la última línea se queda a la vista
    },
    hideBubble() { bubble.hidden = true; btn('skip').hidden = true; root.dataset.estado = 'callado'; root.dataset.mood = 'neutral'; },
    goal(g) {
      goalBox.hidden = !g || (!g.ahora && !g.luego);
      if (!g) return;
      goalBox.querySelector('.eo-col-ahora span').textContent = g.ahora;
      goalBox.querySelector('.eo-col-luego span').textContent = g.luego;
      goalBox.querySelector('.eo-col-luego').hidden = !g.luego;
    },
    setMuted(b) { root.dataset.mudo = b ? '1' : '0'; btn('mute').setAttribute('aria-pressed', String(b)); },
    setMin(b) { root.dataset.min = b ? '1' : '0'; btn('min').setAttribute('aria-expanded', String(!b)); btn('expand').hidden = !b; },
    paused: () => hovered || root.contains(doc.activeElement),
  };

  const voice = createVoice({ script, goals: objectives, getLang: lang, store: createStore(storage, storageKey), view });
  paintLabels();

  // El teclado de la página (Espacio en el frenado, C/Esc en los simuladores) no debe oír las teclas de Colibrí.
  for (const type of ['keydown', 'keyup']) root.addEventListener(type, (e) => e.stopPropagation());
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') voice.clear(); });
  root.addEventListener('pointerenter', () => { hovered = true; });
  root.addEventListener('pointerleave', () => { hovered = false; });
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'skip') voice.skip();
    else if (act === 'mute') voice.mute(!voice.state().muted);
    else if (act === 'min') voice.minimize(true);
    else if (act === 'expand') voice.minimize(false);
  });
  const onVisibility = () => root.classList.toggle('is-pausado', doc.hidden); // pestaña oculta: el aleteo se detiene
  doc.addEventListener('visibilitychange', onVisibility);

  ensureCss(doc).then((ok) => { ready = ok; show(); });

  const place = (modo, tam) => {
    root.dataset.modo = modo;
    if (tam) root.dataset.tam = tam;
    placed = true;
    show();
  };

  return {
    ...voice,
    /** Acopla a Colibrí dentro de un contenedor (p. ej. la consola del Nivel 3). La última línea se queda a la vista. */
    dock(el, { tam } = {}) {
      el.append(root);
      for (const name of ['--col-x', '--col-y', '--col-z']) root.style.removeProperty(name);
      place('acoplado', tam);
    },
    /** Lo deja flotando sobre la página. x / y: distancia a la esquina inferior izquierda; z: capa; tam: 'mini' | 'normal' | 'grande'. */
    float({ x, y, z, tam } = {}) {
      hostEl.append(root);
      for (const [name, v] of [['--col-x', x], ['--col-y', y], ['--col-z', z]]) {
        if (v != null) root.style.setProperty(name, v); else root.style.removeProperty(name);
      }
      place('flotante', tam);
    },
    /** Cambia el idioma: repinta las etiquetas, el «AHORA / LUEGO» y la línea en curso. */
    setLang(l) { langOverride = l ?? null; paintLabels(); voice.refresh(); },
    destroy() { voice.clear(); doc.removeEventListener('visibilitychange', onVisibility); root.remove(); },
    get element() { return root; },
  };
}
