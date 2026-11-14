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
  document.title = t('common.appName');
  const toggle = document.getElementById('lang-toggle');
  toggle.textContent = s.lang === 'es' ? 'EN' : 'ES';
  toggle.setAttribute('aria-label', t('common.switchLang'));
  const b = s.budget;
  const spent = b.launch + b.space + b.ground + b.user;
  document.getElementById('hud-budget').textContent = t('common.budgetHud', { spent, total: b.total });
  renderSteps(s);
}

/**
 * Indicador de progreso: pasos completados (clicables para volver), activo y bloqueados.
 * Reglas: no se salta hacia adelante; no se puede volver a "Travesía" (reiniciaría el vuelo)
 * ni salir de ella mientras el vuelo está en curso.
 */
function renderSteps(s) {
  const current = SCREENS.findIndex((sc) => sc.id === s.screen);
  const inFlight = s.screen === 'journey' && !s.journey.outcome;
  const nav = document.getElementById('steps');
  nav.setAttribute('aria-label', t('common.stepsLabel'));
  nav.replaceChildren(...SCREENS.map((sc, i) => {
    const state = i < current ? 'done' : i === current ? 'active' : 'locked';
    const canGo = state === 'done' && sc.id !== 'journey' && !inFlight;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `step is-${state}`;
    btn.innerHTML = `<span class="step-num" aria-hidden="true">${state === 'done' ? '✓' : i + 1}</span>
      <span class="step-label">${t(`common.steps.${sc.id}`)}</span>`;
    if (state === 'active') btn.setAttribute('aria-current', 'step');
    if (canGo) {
      btn.title = t('common.stepGoBack');
      btn.addEventListener('click', () => goTo(sc.id));
    } else {
      btn.setAttribute('aria-disabled', 'true');
      if (state === 'locked') btn.title = t('common.stepLocked');
      else if (inFlight) btn.title = t('common.stepInFlight');
      else if (sc.id === 'journey' && state === 'done') btn.title = t('common.stepNoRefly');
    }
    return btn;
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
    // Las traducciones pueden no haber cargado: mensaje bilingüe fijo.
    const es = getSavedLang() === 'es';
    document.getElementById('app').innerHTML = es
      ? `<p class="error">Error cargando datos: ${err.message}.<br>
         Si abriste el archivo directamente, ejecuta <code>python3 -m http.server</code> y entra a http://localhost:8000</p>`
      : `<p class="error">Error loading data: ${err.message}.<br>
         If you opened the file directly, run <code>python3 -m http.server</code> and open http://localhost:8000</p>`;
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
