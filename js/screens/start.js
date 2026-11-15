// OWNER: Rol 1 — Pantalla de inicio.
import { mountStarryBackground } from '../canvas/starry-bg.js';
import { hasProgress, resumeLevel } from '../levels.js';

const RESOURCES = ['Design and Develop Science Missions', 'CubeSat 101', 'GMAT / NASA Mission Viz', 'Concept Maturity Levels'];

let stopBackground = null;

/** Botones y avisos según haya o no una partida guardada: Comenzar, o Continuar + Reiniciar. */
function actions(ctx) {
  const { state, t } = ctx;
  const box = document.createElement('div');
  box.className = 'start-actions';
  const button = (cls, text, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  };

  if (!hasProgress(state)) {
    const play = button('btn btn-primary btn-xl', t('menu.start.play'), () => ctx.goTo('mission')); // directo al Nivel 1; el selector sigue en «☰ Niveles»
    box.append(play);
    return { box, primary: play };
  }

  const next = resumeLevel(state);
  const resume = button('btn btn-primary btn-xl', t('menu.start.continue'), () => ctx.goTo(next ? next.id : 'levels'));
  const reset = button('btn btn-ghost', t('menu.start.reset'), () => {
    ctx.reset(); // borra el estado y lo guardado (js/main.js)
    ctx.goTo('start'); // vuelve a dibujar el inicio ya sin partida: solo "Comenzar"
  });
  const info = document.createElement('p');
  info.className = 'start-saved';
  const where = next
    ? t('menu.start.resumeAt', { n: next.num, title: t(`menu.levels.items.${next.id}.title`) })
    : t('menu.start.allDone');
  const name = state.plan?.projectName?.trim();
  // El nombre lo escribe el jugador: va como texto, nunca como HTML.
  info.textContent = name ? `${t('menu.levels.missionName', { name })} · ${where}` : where;
  box.append(resume, reset, info);
  return { box, primary: resume };
}

export default {
  id: 'start',
  mount(container, ctx) {
    const { t } = ctx;
    stopBackground?.();
    stopBackground = mountStarryBackground(); // fondo solo del inicio; cada nivel define el suyo
    const wrap = document.createElement('div');
    wrap.className = 'start';
    wrap.innerHTML = `
      <div class="start-orbit" aria-hidden="true"><span class="start-planet"></span><span class="start-sat"></span></div>
      <p class="start-kicker">${t('menu.start.kicker')}</p>
      <h1 class="start-title">${t('common.appName')}</h1>
      <p class="lead start-tagline">${t('menu.start.tagline')}</p>
      <p class="muted start-resources-title">${t('menu.start.resourcesTitle')}</p>
      <ul class="start-resources">${RESOURCES.map((r) => `<li>${r}</li>`).join('')}</ul>`;
    const { box, primary } = actions(ctx);
    wrap.querySelector('.start-tagline').after(box);
    container.append(wrap);
    primary.focus();
  },
  unmount() {
    stopBackground?.();
    stopBackground = null;
  },
};
