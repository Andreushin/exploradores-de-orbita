// OWNER: Rol 1 — Bootstrap y router de pantallas.
import { getState, update, subscribe, reset } from './state.js';
import { loadTranslations, getSavedLang, setLang, t, tx, applyStatic } from './i18n.js';
import * as physics from './physics.js';
import missionScreen from './screens/mission.js';
import workshopScreen from './screens/workshop.js';
import journeyScreen from './screens/journey.js';
import reportScreen from './screens/report.js';

// CONTRATO de pantalla: { id, mount(container, ctx), unmount() }
const SCREENS = [missionScreen, workshopScreen, journeyScreen, reportScreen];
const DATA_FILES = ['missions', 'rockets', 'pieces', 'events'];

const data = {};
let active = null;

async function loadData() {
  await Promise.all(DATA_FILES.map(async (name) => {
    const res = await fetch(`data/${name}.json`);
    if (!res.ok) throw new Error(`No se pudo cargar data/${name}.json`);
    data[name] = await res.json();
  }));
}

/** Contexto que recibe cada pantalla en mount(). */
function makeCtx() {
  return {
    get state() { return getState(); },
    update,
    subscribe,
    reset,
    data,
    physics,
    t,
    tx,
    goTo,
  };
}

function goTo(screenId) {
  const next = SCREENS.find((s) => s.id === screenId);
  if (!next) throw new Error(`Pantalla desconocida: ${screenId}`);
  if (active) {
    active.unmount?.();
    const old = document.getElementById(`screen-${active.id}`);
    old.hidden = true;
    old.replaceChildren();
  }
  active = next;
  update({ screen: screenId });
  const container = document.getElementById(`screen-${screenId}`);
  container.hidden = false;
  next.mount(container, makeCtx());
  renderChrome();
  window.scrollTo(0, 0);
}

function renderChrome() {
  const s = getState();
  applyStatic();
  document.getElementById('lang-toggle').textContent = s.lang === 'es' ? 'EN' : 'ES';
  const b = s.budget;
  const spent = b.launch + b.space + b.ground + b.user;
  document.getElementById('hud-budget').textContent = t('common.budgetHud', { spent, total: b.total });
  const steps = document.getElementById('steps');
  steps.replaceChildren(...SCREENS.map((sc, i) => {
    const el = document.createElement('span');
    el.className = 'step' + (sc.id === s.screen ? ' is-active' : '');
    el.textContent = `${i + 1}. ${t(`common.steps.${sc.id}`)}`;
    return el;
  }));
}

function toggleLang() {
  const lang = getState().lang === 'es' ? 'en' : 'es';
  setLang(lang);
  update({ lang });
  // Re-montar la pantalla activa para que re-renderice en el nuevo idioma.
  if (active) goTo(active.id);
}

async function boot() {
  try {
    await Promise.all([loadData(), loadTranslations()]);
  } catch (err) {
    document.getElementById('app').innerHTML =
      `<p class="error">Error cargando datos: ${err.message}.<br>
       Si abriste el archivo directamente, ejecuta <code>python3 -m http.server</code> y entra a http://localhost:8000</p>`;
    throw err;
  }
  const lang = getSavedLang();
  setLang(lang);
  update({ lang });
  subscribe(renderChrome);
  document.getElementById('lang-toggle').addEventListener('click', toggleLang);
  goTo('mission');
}

boot();
