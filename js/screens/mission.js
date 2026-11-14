// OWNER: Rol 3 — Pantalla 1 (Nivel 1): requerimientos científicos + tarjetas de los 4 segmentos DDSM.
// El jugador mueve tarjetas del banco (izquierda) a la misión configurada (derecha) por arrastre o clic.
// Estado que escribe: missionId, rocketId, budget.{total,launch,space,ground,user},
//   plan.{projectName,scienceTargetIdx,cards,maturity,penalty,cmlCap,validated}
// Reglas: js/budget.js · Documentación: docs/levelOne.md
import { SEGMENTS, cardCatalog, requiredLevels, evaluatePlan } from '../budget.js';

let ctx;
let root;
let live = null;     // nodos que se re-renderizan al mover tarjetas
let catalog = null;  // tarjetas por segmento
let dragging = null; // { seg, id, placed } durante un arrastre
let onResize = null;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

const STATUS_ICON = { empty: '○', insufficient: '✘', optimal: '✔', margin: '✔', oversized: '▲' };
const FLAG_ORDER = { insufficient: 0, overBudget: 1, oversized: 2 };

const segName = (k) => ctx.t(`mission.segments.${k}.name`);
const currentMission = () => ctx.data.missions.find((m) => m.id === ctx.state.missionId);
/** $100,000,000 (montos del juego en millones). */
const usd = (millions) => {
  const n = Math.abs(millions) * 1e6;
  return `${millions < 0 ? '−' : ''}$${n.toLocaleString(ctx.state.lang === 'es' ? 'es-MX' : 'en-US')}`;
};

// --- Estado -------------------------------------------------------------------
/** Coloca (id) o quita (null) la tarjeta de un segmento y recalcula el presupuesto. */
function placeCard(seg, id) {
  const previous = ctx.state.plan.cards[seg];
  const cards = { ...ctx.state.plan.cards, [seg]: id };
  const cost = (k) => catalog[k].find((c) => c.id === cards[k])?.cost ?? 0;
  const patch = {
    plan: { cards },
    budget: { launch: cost('launch'), space: cost('space'), ground: cost('ground'), user: cost('user') },
  };
  if (seg === 'launch') patch.rocketId = id;
  ctx.update(patch);
  // Foco: a la tarjeta colocada (ahora en su ranura) o a la que volvió al banco.
  renderLive({ seg, id: id ?? previous }, true);
}

/**
 * Guarda madurez/penalización en plan.
 * @param {boolean} edited el jugador cambió algo → la misión deja de estar validada.
 */
function commitPlan(ev, edited) {
  const p = ctx.state.plan;
  const validated = p.validated && !edited;
  if (p.maturity !== ev.maturity || p.penalty !== ev.penalty || p.cmlCap !== ev.cmlCap || p.validated !== validated) {
    ctx.update({ plan: { maturity: ev.maturity, penalty: ev.penalty, cmlCap: ev.cmlCap, validated } });
  }
}

// --- 1. Requerimientos científicos ----------------------------------------------
function nameField() {
  const { state, t } = ctx;
  const field = el('label', 'lvl-field');
  field.append(el('span', null, t('mission.projectLabel')));
  const input = el('input');
  input.type = 'text';
  input.maxLength = 40;
  input.autocomplete = 'off';
  input.placeholder = t('mission.projectPlaceholder');
  input.value = state.plan.projectName;
  input.addEventListener('input', () => {
    ctx.update({ plan: { projectName: input.value } });
    renderLive(null, true);
  });
  field.append(input);
  return field;
}

function destinationGrid() {
  const { state, data, t, tx } = ctx;
  const grid = el('div', 'card-grid lvl-dest');
  for (const m of data.missions) {
    const on = m.id === state.missionId;
    const card = el('button', 'card mission-card' + (on ? ' is-selected' : ''));
    card.type = 'button';
    card.setAttribute('aria-pressed', String(on));
    card.innerHTML = `
      <span class="planet-dot" style="--c:${m.color}"></span>
      <h3>${tx(m.name)}</h3>
      <p class="muted">${tx(m.desc)}</p>
      <ul class="stats">
        <li>${t('mission.difficulty')}: ${'★'.repeat(m.difficulty)}</li>
        <li>${t('mission.maxBudget')}: $${m.budget}M</li>
      </ul>`;
    card.addEventListener('click', () => selectMission(m));
    grid.append(card);
  }
  return grid;
}

function scienceTargets(mission) {
  const { state, tx, t } = ctx;
  const set = el('fieldset', 'lvl-chips');
  set.append(el('legend', null, t('mission.targetTitle')));
  mission.scienceTargets.forEach((tg, i) => {
    const chip = el('label', 'chip');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'science-target';
    radio.checked = state.plan.scienceTargetIdx === i;
    radio.addEventListener('change', () => {
      ctx.update({ plan: { scienceTargetIdx: i } });
      renderLive(null, true);
    });
    chip.append(radio, el('span', null, tx(tg)));
    set.append(chip);
  });
  return set;
}

/** La ciencia dicta la ingeniería: qué exige el destino a cada segmento. */
function requirementsPanel(mission) {
  const { data, t, tx, physics } = ctx;
  const req = requiredLevels(mission, data, catalog);
  const dest = tx(mission.name);
  const levelName = (k) => tx(catalog[k].find((c) => c.level === req[k])?.name);
  const sunPct = Math.round((physics.SOLAR_AT_1AU / mission.distanceAU ** 2) * 100);
  const box = el('div', 'lvl-reqs');
  box.innerHTML = `
    <h3>${t('mission.reqTitle', { dest })}</h3>
    <ul class="lvl-req-list">
      <li>${t('mission.req.dv', { dv: mission.dvRequired })}</li>
      <li>${t('mission.req.sun', { pct: sunPct })}</li>
      <li>${t('mission.req.power', { w: mission.minPowerW })}</li>
      <li>${t('mission.req.travel', { days: mission.travelDays })}</li>
    </ul>
    <ul class="lvl-seg-reqs">
      <li><b>${segName('launch')}:</b> ${t('mission.segReq.launch', { dest })}</li>
      <li><b>${segName('space')}:</b> ${t('mission.segReq.atLeast', { name: levelName('space') })}</li>
      <li><b>${segName('ground')}:</b> ${t('mission.segReq.atLeast', { name: levelName('ground') })}</li>
      <li><b>${segName('user')}:</b> ${t('mission.segReq.user')}</li>
    </ul>
    <p class="muted">${t('mission.reqHelp')}</p>`;
  return box;
}

function requirementsSection(mission) {
  const { t } = ctx;
  const s = el('section', 'lvl-section');
  s.append(
    el('h2', null, `<span class="lvl-num">1</span>${t('mission.sections.objective.title')}`),
    el('p', 'lvl-question', t('mission.sections.objective.question')),
    nameField(),
    destinationGrid(),
  );
  if (mission) s.append(scienceTargets(mission), requirementsPanel(mission));
  return s;
}

// --- 2. Barra de presupuesto fija -------------------------------------------------
function budgetBar() {
  const { t } = ctx;
  const bar = el('div', 'budget-bar');
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', t('mission.bar.label'));
  bar.innerHTML = `
    <dl class="bb-nums">
      <div><dt>${t('mission.bar.total')}</dt><dd class="bb-total"></dd></div>
      <div><dt>${t('mission.bar.spent')}</dt><dd class="bb-spent"></dd></div>
      <div><dt>${t('mission.bar.available')}</dt><dd class="bb-avail"></dd></div>
      <div><dt>${t('mission.bar.cml')}</dt><dd class="bb-cml"></dd></div>
    </dl>
    <div class="bb-track" aria-hidden="true"></div>`;
  return bar;
}

function renderBar(ev) {
  const q = (s) => live.bar.querySelector(s);
  q('.bb-total').textContent = `${usd(ev.total)} USD`;
  q('.bb-spent').textContent = usd(ev.spent);
  const avail = q('.bb-avail');
  avail.textContent = usd(ev.available);
  avail.classList.toggle('error', ev.available < 0);
  const cml = q('.bb-cml');
  cml.textContent = ctx.t('mission.bar.cmlValue', { cml: ev.cmlCap, maturity: ev.maturity });
  cml.className = `bb-cml cml-${ev.cmlCap}`;

  const scale = Math.max(ev.total, ev.spent) || 1;
  const track = q('.bb-track');
  track.replaceChildren(...SEGMENTS.filter((k) => ev.segments[k].cost > 0).map((k) => {
    const part = el('span', `sw-${k}`);
    part.style.width = `${(ev.segments[k].cost / scale) * 100}%`;
    part.title = `${segName(k)}: $${ev.segments[k].cost}M`;
    return part;
  }));
  if (ev.spent > ev.total) {
    const limit = el('span', 'bb-limit');
    limit.style.left = `${(ev.total / scale) * 100}%`;
    track.append(limit);
  }
}

// --- 3. Tablero de tarjetas ---------------------------------------------------------
function capability(card) {
  const { t, tx, data } = ctx;
  if (card.segment !== 'launch') return t(`mission.cap.${card.segment}`, { lvl: card.level });
  const dests = card.rocket.destinations.map((id) => tx(data.missions.find((m) => m.id === id)?.name)).join(', ');
  return t('mission.cap.launch', { dests, kg: card.rocket.maxPayloadKg });
}

const popId = (card) => `info-${card.segment}-${card.id}`;

/** Ventana de información de una tarjeta (popover nativo: Esc o clic afuera la cierra). */
function infoPopover(card) {
  const { t, tx } = ctx;
  const pop = el('div', 'opt-pop');
  pop.id = popId(card);
  pop.setAttribute('popover', '');
  pop.innerHTML = `
    <h3><span aria-hidden="true">${card.icon}</span> ${tx(card.name)}</h3>
    <p class="muted">${segName(card.segment)} · $${card.cost}M · ${capability(card)}</p>
    <h4 class="ok">✔ ${t('mission.info.considerTitle')}</h4>
    <p>${t(`mission.info.${card.segment}.consider`)}</p>
    <h4 class="warn">✘ ${t('mission.info.avoidTitle')}</h4>
    <p>${t(`mission.info.${card.segment}.avoid`)}</p>
    <button type="button" class="btn btn-primary" popovertarget="${pop.id}" popovertargetaction="hide">${t('mission.info.close')}</button>`;
  return pop;
}

function cardEl(card, placed) {
  const { t, tx } = ctx;
  const art = el('article', 'opt');
  art.draggable = true;
  art.dataset.seg = card.segment;
  art.dataset.id = card.id;
  art.innerHTML = `
    <div class="opt-head">
      <span class="opt-icon" aria-hidden="true">${card.icon}</span>
      <h4>${tx(card.name)}</h4>
      <button type="button" class="opt-info" popovertarget="${popId(card)}" aria-label="${t('mission.info.open', { name: tx(card.name) })}">?</button>
    </div>
    <p class="opt-desc">${tx(card.desc)}</p>
    <p class="opt-cap">${capability(card)}</p>
    <div class="opt-foot">
      <b class="opt-cost">$${card.cost}M</b>
      <button type="button" class="btn opt-move">${placed ? t('mission.remove') : t('mission.add')}</button>
    </div>`;
  art.querySelector('.opt-move').addEventListener('click', () => placeCard(card.segment, placed ? null : card.id));
  art.addEventListener('dragstart', (e) => {
    dragging = { seg: card.segment, id: card.id, placed };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
    art.classList.add('is-dragging');
    live.board.classList.add(placed ? 'is-dragging-placed' : 'is-dragging-bank');
    live.board.querySelector(`.slot[data-seg="${card.segment}"]`)?.classList.add('is-target');
  });
  art.addEventListener('dragend', endDrag);
  return art;
}

function endDrag() {
  dragging = null;
  if (!live?.board) return;
  live.board.classList.remove('is-dragging-placed', 'is-dragging-bank');
  live.board.querySelectorAll('.is-target, .is-over, .is-dragging').forEach((n) => n.classList.remove('is-target', 'is-over', 'is-dragging'));
}

/** Zona que acepta tarjetas arrastradas. */
function dropZone(zone, accepts, onDrop) {
  zone.addEventListener('dragover', (e) => {
    if (!dragging || !accepts(dragging)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', (e) => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('is-over');
  });
  zone.addEventListener('drop', (e) => {
    if (!dragging || !accepts(dragging)) return;
    e.preventDefault();
    const d = dragging;
    endDrag(); // el nodo arrastrado desaparece al re-renderizar: dragend podría no llegar
    onDrop(d);
  });
}

function renderBoard(ev) {
  const { t } = ctx;
  const plan = ctx.state.plan;

  const bank = el('section', 'bank');
  bank.setAttribute('aria-labelledby', 'bank-title');
  bank.append(el('h2', null, t('mission.bank.title')), el('p', 'muted', t('mission.bank.help')));
  bank.firstChild.id = 'bank-title';
  for (const k of SEGMENTS) {
    const group = el('div', 'bank-group');
    group.append(el('h3', null, segName(k)), el('p', 'bank-q', t(`mission.sections.${k}.question`)));
    const list = el('div', 'bank-list');
    for (const card of catalog[k].filter((c) => c.id !== plan.cards[k])) list.append(cardEl(card, false));
    group.append(list);
    bank.append(group);
  }
  dropZone(bank, (d) => d.placed, (d) => placeCard(d.seg, null));

  const config = el('section', 'config');
  config.setAttribute('aria-labelledby', 'config-title');
  config.append(el('h2', null, t('mission.config.title')), el('p', 'muted', t('mission.config.help')));
  config.firstChild.id = 'config-title';
  SEGMENTS.forEach((k, i) => {
    const s = ev.segments[k];
    const slot = el('div', `slot is-${s.status}`);
    slot.dataset.seg = k;
    slot.innerHTML = `
      <div class="slot-head">
        <span class="slot-num">${i + 1}</span>
        <b>${segName(k)}</b>
        <span class="slot-status">${STATUS_ICON[s.status]} ${t(`mission.status.${s.status}`)}</span>
      </div>`;
    slot.append(s.card ? cardEl(s.card, true) : el('p', 'slot-empty', t('mission.config.empty', { seg: segName(k) })));
    config.append(slot);
  });
  dropZone(config, (d) => !d.placed, (d) => placeCard(d.seg, d.id));

  live.board.replaceChildren(bank, config);
}

// --- 4. Revisión: alertas pedagógicas y validación ------------------------------------
function flagText(f) {
  const { t, tx } = ctx;
  const mission = currentMission();
  const options = f.segment ? catalog[f.segment] : [];
  const card = options.find((c) => c.id === ctx.state.plan.cards[f.segment]);
  const req = options.find((c) => c.level === f.required);
  const key = f.segment ? `mission.flags.${f.kind}.${f.segment}` : `mission.flags.${f.kind}`;
  return t(key, {
    dest: tx(mission?.name),
    name: tx(card?.name),
    required: tx(req?.name),
    lvl: f.level,
    req: f.required,
    extra: f.extra,
    over: f.over,
    spent: f.spent,
    total: f.total,
  });
}

/** Alertas pedagógicas: primero lo que bloquea, luego lo que resta madurez. */
function flagList(ev) {
  const { t } = ctx;
  const list = el('ul', 'lvl-flags');
  const flags = [...ev.flags].sort((a, b) => FLAG_ORDER[a.kind] - FLAG_ORDER[b.kind] || b.points - a.points);
  for (const f of flags) {
    const li = el('li', `lvl-flag is-${f.kind}`);
    const prefix = f.segment ? `${segName(f.segment)} · ` : '';
    li.innerHTML = `
      <span class="flag-icon" aria-hidden="true">${f.kind === 'oversized' ? '▲' : '✘'}</span>
      <span><b>${prefix}${t(`mission.flagTitle.${f.kind}`)}.</b> ${flagText(f)}</span>
      ${f.points ? `<b class="flag-pts">−${f.points} CML</b>` : ''}`;
    list.append(li);
  }
  if (!flags.length) {
    const allPlaced = SEGMENTS.every((k) => ev.segments[k].card);
    list.append(el('li', `lvl-flag ${allPlaced ? 'is-clean' : 'is-hint'}`,
      `<span class="flag-icon" aria-hidden="true">${allPlaced ? '✔' : 'ℹ'}</span><span>${t(allPlaced ? 'mission.review.clean' : 'mission.review.start')}</span>`));
  }
  return list;
}

/** Lo que falta para validar, o el mensaje de listo. */
function validationStatus(ev) {
  const { t } = ctx;
  const status = el('div', 'lvl-blockers');
  status.setAttribute('aria-live', 'polite');
  if (ev.ready) {
    const msg = el('p', 'ok');
    msg.textContent = t('mission.ready', { name: ctx.state.plan.projectName.trim(), cml: ev.cmlCap }); // texto del jugador: nunca innerHTML
    status.append(msg);
  } else {
    const ul = el('ul', 'lvl-blocker-list');
    for (const b of ev.blockers) {
      ul.append(el('li', 'warn', `✘ ${t(`mission.blockers.${b.id}`, { ...b, seg: b.segment ? segName(b.segment) : '' })}`));
    }
    status.append(el('p', 'muted', t('mission.blockersTitle')), ul);
  }
  return status;
}

function renderReview(ev) {
  const { t } = ctx;
  const footer = el('div', 'screen-footer lvl-footer');
  const next = el('button', 'btn btn-primary', t('mission.validate'));
  next.type = 'button';
  next.disabled = !ev.ready;
  next.addEventListener('click', validateAndContinue);
  footer.append(validationStatus(ev), next);
  live.review.replaceChildren(el('h2', null, t('mission.review.title')), flagList(ev), footer);
}

/** Recalcula todo lo que depende de las tarjetas. `focus` devuelve el foco a la tarjeta movida. */
function renderLive(focus = null, edited = false) {
  const ev = evaluatePlan(ctx.state, ctx.data);
  commitPlan(ev, edited);
  if (!live.board) return; // sin destino aún: solo existe el formulario inicial
  renderBar(ev);
  renderBoard(ev);
  renderReview(ev);
  if (focus?.id) live.board.querySelector(`.opt[data-seg="${focus.seg}"][data-id="${focus.id}"] .opt-move`)?.focus();
}

function validateAndContinue() {
  const ev = evaluatePlan(ctx.state, ctx.data);
  if (!ev.ready) return;
  ctx.update({
    plan: { projectName: ctx.state.plan.projectName.trim(), maturity: ev.maturity, penalty: ev.penalty, cmlCap: ev.cmlCap, validated: true },
  });
  ctx.goTo('workshop');
}

function selectMission(m) {
  if (m.id === ctx.state.missionId) return; // re-elegir el mismo destino no borra el progreso
  // Las tarjetas se conservan: se re-evalúan contra el nuevo destino (puede que ya no sirvan).
  ctx.update({ missionId: m.id, budget: { total: m.budget }, plan: { scienceTargetIdx: null, validated: false } });
  build();
}

function build() {
  const { t } = ctx;
  const mission = currentMission();
  catalog = cardCatalog(ctx.data);
  live = {};
  root.replaceChildren(el('h1', null, t('mission.title')), el('p', 'lead', t('mission.intro')), requirementsSection(mission));
  if (!mission) {
    root.append(el('p', 'muted lvl-hint', t('mission.pickMission')));
  } else {
    live.bar = budgetBar();
    live.board = el('div', 'board');
    live.review = el('section', 'lvl-review');
    const pops = el('div', 'opt-pops');
    for (const k of SEGMENTS) catalog[k].forEach((c) => pops.append(infoPopover(c)));
    const s2 = el('section', 'lvl-section');
    s2.append(
      el('h2', null, `<span class="lvl-num">2</span>${t('mission.sections.segments.title')}`),
      el('p', 'lvl-question', t('mission.sections.segments.question')),
    );
    root.append(s2, live.bar, live.board, live.review, pops);
  }
  renderLive();
}

/** La barra de presupuesto se pega justo debajo del encabezado (cuya altura cambia en móvil). */
function syncHeaderHeight() {
  const h = document.querySelector('.app-header')?.offsetHeight ?? 64;
  root.style.setProperty('--header-h', `${h}px`);
}

export default {
  id: 'mission',
  mount(container, context) {
    ctx = context;
    root = container;
    syncHeaderHeight();
    onResize = syncHeaderHeight;
    window.addEventListener('resize', onResize);
    build();
  },
  unmount() {
    window.removeEventListener('resize', onResize);
    document.querySelectorAll('.opt-pop:popover-open').forEach((p) => p.hidePopover());
    live = null;
    dragging = null;
  },
};
