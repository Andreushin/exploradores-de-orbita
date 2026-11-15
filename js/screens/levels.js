// OWNER: Rol 1 — Selector de niveles. Cada nivel se carga al seleccionarlo (ver js/levels.js).
import { levelStatus } from '../levels.js';
import { ORDER, isUnlocked, bestStars, totalStars, MAX_STARS } from '../campaign.js';
import { starLine } from '../game-ui.js';

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export default {
  id: 'levels',
  mount(container, ctx) {
    const { state, t } = ctx;
    const levels = levelStatus(state);

    container.append(el('h1', null, t('menu.levels.title')), el('p', 'lead', t('menu.levels.intro')));
    if (state.plan.projectName.trim()) {
      const name = el('p', 'levels-project');
      name.textContent = t('menu.levels.missionName', { name: state.plan.projectName.trim() }); // texto del jugador
      container.append(name);
    }

    // Campaña: destinos en orden, con candado y estrellas (js/campaign.js)
    const camp = el('section', 'campaign');
    camp.append(el('h2', null, t('menu.levels.campaignTitle', { n: totalStars(), max: MAX_STARS })));
    const route = el('ol', 'campaign-route');
    for (const id of ORDER) {
      const m = ctx.data.missions.find((x) => x.id === id);
      const open = isUnlocked(id);
      const got = Object.values(bestStars(id)).reduce((a, n) => a + n, 0);
      const li = el('li', `campaign-dest${open ? '' : ' is-locked'}${id === state.missionId ? ' is-current' : ''}`, `
        <span class="planet-dot" style="--c:${m.color}" aria-hidden="true"></span>
        <b>${ctx.tx(m.name)}</b>
        <small>${open ? t('menu.levels.destStars', { n: got }) : `🔒 ${t('menu.levels.destLocked')}`}</small>`);
      route.append(li);
    }
    camp.append(route);
    container.append(camp);

    const best = state.missionId ? bestStars(state.missionId) : null;
    const grid = el('div', 'levels-grid');
    for (const lv of levels) {
      let statusKey = 'locked';
      if (lv.done) statusKey = 'done';
      else if (lv.unlocked) statusKey = 'available';
      const card = el('button', `card level-card is-${statusKey}`);
      card.type = 'button';
      card.disabled = !lv.unlocked;
      card.innerHTML = `
        <span class="level-head">
          <span class="level-num">${t('menu.levels.level', { n: lv.num })}</span>
          <span class="level-status">${t(`menu.levels.status.${statusKey}`)}</span>
        </span>
        <span class="level-icon" aria-hidden="true">${lv.unlocked ? lv.icon : '🔒'}</span>
        <h3>${t(`menu.levels.items.${lv.id}.title`)}</h3>
        <p class="muted">${t(`menu.levels.items.${lv.id}.desc`)}</p>
        ${best ? `<span class="level-stars">${starLine(best[lv.num])}</span>` : ''}
        <small class="level-resource">${t('menu.levels.basedOn', { res: lv.resource })}</small>
        ${lv.unlocked ? '' : `<small class="warn">${t('menu.levels.lockedHint', { n: lv.num - 1 })}</small>`}`;
      card.addEventListener('click', () => ctx.goTo(lv.id));
      grid.append(card);
    }
    container.append(grid);

    const footer = el('div', 'screen-footer');
    const back = el('button', 'btn btn-ghost', t('menu.levels.back'));
    back.type = 'button';
    back.addEventListener('click', () => ctx.goTo('start'));
    footer.append(back);
    if (levels.some((lv) => lv.done) || state.missionId) {
      const reset = el('button', 'btn btn-ghost', t('menu.levels.reset'));
      reset.type = 'button';
      reset.addEventListener('click', () => {
        ctx.reset();
        ctx.goTo('levels');
      });
      footer.append(reset);
    }
    container.append(footer);
    // Foco en el siguiente nivel pendiente (o el primero disponible si todo está completo).
    (grid.querySelector('.is-available') ?? grid.querySelector('.level-card:not(:disabled)'))?.focus();
  },
  unmount() {},
};
