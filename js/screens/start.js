// OWNER: Rol 1 — Pantalla de inicio.
import { mountStarryBackground } from '../canvas/starry-bg.js';
import { totalStars, MAX_STARS } from '../campaign.js';

const RESOURCES = ['Design and Develop Science Missions', 'CubeSat 101', 'GMAT / NASA Mission Viz', 'Concept Maturity Levels'];

let stopBackground = null;

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
      <button class="btn btn-primary btn-xl" type="button">${t('menu.start.play')}</button>
      ${totalStars() ? `<p class="start-stars">${t('menu.start.stars', { n: totalStars(), max: MAX_STARS })}</p>` : ''}
      <p class="muted start-resources-title">${t('menu.start.resourcesTitle')}</p>
      <ul class="start-resources">${RESOURCES.map((r) => `<li>${r}</li>`).join('')}</ul>`;
    const play = wrap.querySelector('button');
    play.addEventListener('click', () => ctx.goTo('mission')); // directo al Nivel 1; el selector sigue en «☰ Niveles»
    container.append(wrap);
    play.focus();
  },
  unmount() {
    stopBackground?.();
    stopBackground = null;
  },
};
