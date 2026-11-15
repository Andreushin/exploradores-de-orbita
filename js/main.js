// OWNER: Rol 1 — Bootstrap y router de pantallas.
// Flujo: Inicio → Niveles → (cada nivel se descarga al seleccionarlo, ver js/levels.js).
import { getState, update, subscribe, reset } from './state.js';
import { loadTranslations, getSavedLang, setLang, t, tx, applyStatic } from './i18n.js';
import * as physics from './physics.js';
import { LEVELS, levelStatus } from './levels.js';
import { loadMission, saveMission, clearMission, pickSections, levelUrl } from './mision-store.js';
import startScreen from './screens/start.js';
import levelsScreen from './screens/levels.js';

// CONTRATO de pantalla: { id, mount(container, ctx), unmount() }
const MENUS = { start: startScreen, levels: levelsScreen };
const DATA_FILES = ['missions', 'rockets', 'pieces', 'events', 'segments'];

const data = {};
const loaded = new Map(); // id de nivel → módulo de pantalla ya descargado
let active = null;
let navToken = 0;
let colibriApp = null; // Colibrí (js/colibri-app.js): un extra que se carga aparte; si falla, el juego sigue igual

async function loadData() {
  await Promise.all(DATA_FILES.map(async (name) => {
    const res = await fetch(`data/${name}.json`);
    if (!res.ok) throw new Error(`No se pudo cargar data/${name}.json`);
    data[name] = await res.json();
  }));
}

/** Inserta una hoja de estilos una sola vez y espera a que cargue (evita ver el nivel sin estilos). */
function loadCss(href) {
  const existing = document.querySelector(`link[data-level-css="${href}"]`);
  if (existing) return existing.ready;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.levelCss = href;
  link.ready = new Promise((resolve, reject) => {
    link.onload = resolve;
    link.onerror = () => reject(new Error(`No se pudo cargar ${href}`));
  });
  document.head.append(link);
  return link.ready;
}

/** Devuelve la pantalla; si es un nivel, descarga su JS y CSS la primera vez. */
async function resolveScreen(screenId) {
  if (MENUS[screenId]) return MENUS[screenId];
  if (loaded.has(screenId)) return loaded.get(screenId);
  const level = LEVELS.find((l) => l.id === screenId);
  if (!level) throw new Error(`Pantalla desconocida: ${screenId}`);
  const [mod] = await Promise.all([level.load(), ...level.css.map(loadCss)]);
  loaded.set(screenId, mod.default);
  return mod.default;
}

/** Contexto que recibe cada pantalla en mount(). */
function makeCtx() {
  return {
    get state() { return getState(); },
    update,
    subscribe,
    // Reiniciar también borra lo guardado: saveMission() mezcla por sección, así que sin esto quedarían claves
    // viejas (p. ej. satellite.validated) que al recargar dan por hechos niveles de una partida anterior.
    reset: () => { clearMission(); reset(); colibriApp?.forget(); },
    data,
    physics,
    t,
    tx,
    goTo,
  };
}

/** Navega a una pantalla. Nunca rechaza: los errores de carga se muestran en pantalla. */
/** Mueve el foco al título de la pantalla nueva: quien navega con teclado o lector de pantalla no se queda en el vacío. */
function focusScreen(container) {
  const target = container.querySelector('h1, h2');
  if (!target || container.contains(document.activeElement)) return; // si la pantalla ya enfocó algo, se respeta
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

let booted = false; // la primera pantalla no roba el foco: el primer Tab debe caer en «Saltar al contenido»

async function goTo(screenId, { fromHistory = false } = {}) {
  // Niveles en carpeta propia (nivelN/): guardar la misión y redirigir (docs/contrato-niveles.md)
  const folder = LEVELS.find((l) => l.id === screenId)?.folder;
  if (folder) {
    saveMission(pickSections(getState()));
    location.href = levelUrl(folder);
    return;
  }
  const token = ++navToken;
  const app = document.getElementById('app');
  app.setAttribute('aria-busy', 'true');
  try {
    const next = await resolveScreen(screenId);
    if (token !== navToken) return; // llegó otra navegación mientras cargaba
    if (active) {
      active.unmount?.();
      const old = document.getElementById(`screen-${active.id}`);
      old.hidden = true;
      old.replaceChildren();
    }
    const changed = !active || active.id !== screenId; // re-montar la misma pantalla (cambio de idioma) no es navegar
    active = next;
    update({ screen: screenId });
    const container = document.getElementById(`screen-${screenId}`);
    container.hidden = false;
    next.mount(container, makeCtx());
    document.getElementById('app-error').hidden = true;
    renderChrome();
    colibriApp?.onScreen(screenId);
    window.scrollTo(0, 0);
    // El botón «Atrás» del navegador vuelve a la pantalla anterior en vez de salir del juego
    if (changed) {
      if (!fromHistory) history.pushState({ screen: screenId }, '', location.pathname);
      if (booted) focusScreen(container);
    }
    booted = true;
  } catch (err) {
    console.error(err);
    if (token === navToken) showError(err);
  } finally {
    if (token === navToken) app.removeAttribute('aria-busy');
  }
}

function showError(err) {
  const box = document.getElementById('app-error');
  box.hidden = false;
  box.textContent = t('menu.loadError', { msg: err.message });
}

function renderChrome() {
  const s = getState();
  applyStatic();
  const inLevel = LEVELS.some((l) => l.id === s.screen);
  // Título por pantalla: el historial y las pestañas muestran dónde está el jugador
  document.title = inLevel ? `${t(`common.steps.${s.screen}`)} · ${t('common.appName')}` : t('common.appName');
  const toggle = document.getElementById('lang-toggle');
  toggle.textContent = s.lang === 'es' ? 'EN' : 'ES';
  toggle.setAttribute('aria-label', t('common.switchLang'));
  document.getElementById('nav-levels').hidden = !inLevel;

  // Presupuesto: etiqueta y cifras por separado; en pantallas angostas solo se ven las cifras.
  const hud = document.getElementById('hud-budget');
  hud.hidden = !inLevel;
  const b = s.budget;
  const spent = b.launch + b.space + b.ground + b.user;
  hud.innerHTML = `<span class="pill-label">${t('common.budgetLabel')}:</span> $${spent}M / $${b.total}M`;
  hud.setAttribute('aria-label', t('common.budgetHud', { spent, total: b.total }));
  hud.classList.toggle('is-over', spent > b.total);

  // Niveles: completados en verde, el actual resaltado.
  const steps = document.getElementById('steps');
  steps.hidden = !inLevel;
  steps.replaceChildren(...levelStatus(s).map((lv) => {
    const el = document.createElement('span');
    el.className = 'step' + (lv.done ? ' is-done' : '') + (lv.id === s.screen ? ' is-active' : '');
    el.textContent = `${lv.done ? '✓' : `${lv.num}.`} ${t(`common.steps.${lv.id}`)}`;
    return el;
  }));
}

function toggleLang() {
  const lang = getState().lang === 'es' ? 'en' : 'es';
  setLang(lang);
  update({ lang });
  // Re-montar la pantalla activa para que re-renderice en el nuevo idioma.
  if (active) void goTo(active.id);
}

async function boot() {
  try {
    await Promise.all([loadData(), loadTranslations()]);
  } catch (err) {
    // Las traducciones pueden no haber cargado: mensaje bilingüe fijo.
    document.getElementById('app').innerHTML = getSavedLang() === 'es'
      ? `<p class="error">Error cargando datos: ${err.message}.<br>
         Si abriste el archivo directamente, ejecuta <code>python3 -m http.server</code> y entra a http://localhost:8000</p>`
      : `<p class="error">Error loading data: ${err.message}.<br>
         If you opened the file directly, run <code>python3 -m http.server</code> and open http://localhost:8000</p>`;
    throw err;
  }
  const lang = getSavedLang();
  setLang(lang);
  update({ lang });
  // Contrato entre niveles (docs/contrato-niveles.md): retoma la misión guardada y guarda cada cambio.
  const saved = loadMission();
  if (saved) update(pickSections(saved));
  subscribe((st) => saveMission(pickSections(st)));
  subscribe(renderChrome);
  document.getElementById('lang-toggle').addEventListener('click', toggleLang);
  document.getElementById('nav-levels').addEventListener('click', () => void goTo('levels'));
  document.querySelector('.brand').addEventListener('click', () => void goTo('start'));
  // Enlace directo a un nivel (#workshop, #report…): lo usan los niveles en carpeta (nivelN/)
  // para volver a una pantalla de la app. Solo si ese nivel ya está desbloqueado.
  const wanted = location.hash.slice(1);
  const target = levelStatus(getState()).find((l) => l.id === wanted && l.unlocked);
  const first = target ? target.id : 'start';
  history.replaceState({ screen: first }, '', location.pathname);
  window.addEventListener('popstate', (e) => { if (e.state?.screen) void goTo(e.state.screen, { fromHistory: true }); });
  void goTo(first, { fromHistory: true });
  void startColibri();
}

/** Colibrí se carga aparte (import dinámico): un fallo suyo nunca debe impedir jugar. */
async function startColibri() {
  try {
    const { startColibriApp } = await import('./colibri-app.js');
    colibriApp = startColibriApp({ getState, subscribe, data, t, tx });
    if (active) colibriApp.onScreen(active.id); // la primera pantalla ya se montó mientras cargaba
  } catch (err) {
    console.warn('Colibrí no disponible:', err);
  }
}

boot();
