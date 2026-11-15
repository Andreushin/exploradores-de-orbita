// OWNER: Rol 3 — Pantalla 1 (Nivel 1): asistente por pasos.
//   Proyecto → Lanzamiento → Espacio → Tierra → Usuario → Revisión
// En cada paso de segmento el jugador mueve una tarjeta del banco a la misión (arrastre o clic) y el
// fondo (js/screens/mission-scenes.js) reacciona a su elección.
// Estado que escribe: missionId, rocketId, budget.{total,launch,space,ground,user},
//   plan.{step,projectName,scienceTargetIdx,cards,maturity,penalty,cmlCap,validated}
// Reglas: js/budget.js · Documentación: docs/niveles/nivel-1.md
import { SEGMENTS, STEPS, cardCatalog, requiredLevels, evaluatePlan, stepStatus, validProjectName } from '../budget.js';
import { createScenes } from './mission-scenes.js';

let ctx;
let root;
let live = null;     // nodos que se actualizan sin reconstruir la pantalla
let catalog = null;  // tarjetas por segmento
let scenes = null;   // fondo animado
let dragging = null; // { seg, id, placed } durante un arrastre
let onResize = null;
let onScroll = null;
let onDockPointer = null;
let hudObserver = null;
let dockOpen = true; // panel «Misión configurada»: se recuerda entre pasos, pero cada entrada a la pantalla lo abre (mount)
let dockHinted = null; // ¿ya se le avisó al jugador dónde queda la pestaña? (se guarda en el navegador: solo la primera vez)
const DOCK_HINT_KEY = 'eo-dock-hint';

function dockHintDone() {
  if (dockHinted === null) {
    try { dockHinted = localStorage.getItem(DOCK_HINT_KEY) === '1'; } catch { dockHinted = false; }
  }
  return dockHinted;
}

function markDockHinted() {
  dockHinted = true;
  try { localStorage.setItem(DOCK_HINT_KEY, '1'); } catch { /* sin almacenamiento: el aviso solo dura esta sesión */ }
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

const STEP_ICON = { project: '🪐', launch: '🚀', space: '🛰️', ground: '📡', user: '🧪', review: '✅' };
const STATUS_ICON = { empty: '○', insufficient: '✘', optimal: '✔', margin: '✔', oversized: '▲' };
const SCENE_STATUS = { insufficient: 'insufficient', oversized: 'oversized', optimal: 'ok', margin: 'ok' };
const FLAG_ORDER = { insufficient: 0, overBudget: 1, oversized: 2 };

const segName = (k) => ctx.t(`mission.segments.${k}.name`);
const currentMission = () => ctx.data.missions.find((m) => m.id === ctx.state.missionId);
const stepIndex = () => Math.min(Math.max(ctx.state.plan.step ?? 0, 0), STEPS.length - 1);
const stepId = () => STEPS[stepIndex()];
const isSegment = (id) => SEGMENTS.includes(id);
/** $100,000,000 (los montos del juego están en millones). */
const usd = (millions) => {
  const n = Math.abs(millions) * 1e6;
  return `${millions < 0 ? '−' : ''}$${n.toLocaleString(ctx.state.lang === 'es' ? 'es-MX' : 'en-US')}`;
};

// --- Estado ---------------------------------------------------------------------
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

function goStep(i) {
  const steps = stepStatus(ctx.state, evaluatePlan(ctx.state, ctx.data));
  if (!steps[i]?.unlocked) return;
  ctx.update({ plan: { step: i } });
  renderStage();
  renderLive();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  live.stage.querySelector('h2')?.focus({ preventScroll: true });
}

// --- Encabezado fijo: barra de pasos + presupuesto ------------------------------------
function renderStepper(steps) {
  const { t } = ctx;
  const current = stepIndex();
  live.stepper.replaceChildren(...steps.map((s, i) => {
    const li = el('li', `stp is-${s.done ? 'done' : 'todo'}${i === current ? ' is-current' : ''}`);
    const b = el('button', null, `
      <span class="stp-dot" aria-hidden="true">${s.done && i !== current ? '✔' : STEP_ICON[s.id]}</span>
      <span class="stp-label"><small>${t('mission.stepOf', { n: i + 1, total: STEPS.length })}</small>${t(`mission.steps.${s.id}`)}</span>`);
    b.type = 'button';
    b.disabled = !s.unlocked;
    if (i === current) b.setAttribute('aria-current', 'step');
    b.addEventListener('click', () => goStep(i));
    li.append(b);
    return li;
  }));
}

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
  live.bar.hidden = !currentMission();
  if (live.bar.hidden) return;
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

// --- Paso 1: proyecto ---------------------------------------------------------------
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
  // Aviso bajo el campo: neutro mientras está vacío, de error cuando hay texto que no vale (p. ej. «123»).
  const hint = el('small', 'lvl-field-hint', t('mission.projectHint'));
  hint.id = 'project-name-hint';
  input.setAttribute('aria-describedby', hint.id);
  const syncHint = () => {
    const bad = input.value.trim() !== '' && !validProjectName(input.value);
    hint.classList.toggle('is-error', bad);
    input.setAttribute('aria-invalid', String(bad));
  };
  syncHint();
  input.addEventListener('input', () => {
    syncHint();
    ctx.update({ plan: { projectName: input.value } });
    renderLive(null, true);
  });
  field.append(input, hint);
  return field;
}

/** Slider de destinos: una tarjeta por vista, con flechas que solo aparecen si hay hacia dónde moverse. */
function destinationGrid() {
  const { state, data, t, tx } = ctx;
  const grid = el('div', 'lvl-dest');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', t('mission.slider.label'));
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
  return destinationSlider(grid);
}

function destinationSlider(track) {
  const { t } = ctx;
  const arrow = (dir, glyph) => {
    const b = el('button', `lvl-arrow lvl-arrow-${dir}`, glyph);
    b.type = 'button';
    b.setAttribute('aria-label', t(`mission.slider.${dir}`));
    return b;
  };
  const prev = arrow('prev', '‹');
  const next = arrow('next', '›');
  const slider = el('div', 'lvl-slider');
  slider.append(track, prev, next);

  const cards = [...track.children];
  const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = (dir) => track.scrollBy({ left: dir * step(), behavior: reduced() ? 'auto' : 'smooth' });

  /** Oculta cada flecha en su extremo; si tenía el foco, lo pasa a la otra para no perderlo. */
  const sync = () => {
    const atStart = track.scrollLeft <= 1;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
    for (const [btn, hide, other] of [[prev, atStart, next], [next, atEnd, prev]]) {
      const focused = document.activeElement === btn;
      btn.hidden = hide;
      if (hide && focused && !other.hidden) other.focus({ preventScroll: true });
    }
  };
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  track.addEventListener('scroll', sync, { passive: true });

  // Al construirse (o reconstruirse tras elegir) se muestra la tarjeta elegida, sin animar.
  if (typeof ResizeObserver === 'function') {
    let placed = false;
    const ro = new ResizeObserver(() => {
      if (!track.isConnected) { ro.disconnect(); return; }
      if (!placed) {
        placed = true;
        const on = track.querySelector('.is-selected');
        if (on) track.scrollTo({ left: on.offsetLeft, behavior: 'instant' });
      }
      sync();
    });
    ro.observe(track);
  }
  sync();
  return slider;
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

/** Lo que exige el destino a un segmento (texto corto). */
function segmentRequirement(k, mission) {
  const { t, tx, data } = ctx;
  const req = requiredLevels(mission, data, catalog);
  if (k === 'launch') return t('mission.segReq.launch', { dest: tx(mission.name) });
  if (k === 'user') return t('mission.segReq.user');
  return t('mission.segReq.atLeast', { name: tx(catalog[k].find((c) => c.level === req[k])?.name) });
}

/** La ciencia dicta la ingeniería: qué exige el destino. */
function requirementsPanel(mission) {
  const { t, tx, physics } = ctx;
  const sunPct = Math.round((physics.SOLAR_AT_1AU / mission.distanceAU ** 2) * 100);
  const box = el('div', 'lvl-reqs');
  box.innerHTML = `
    <h3>${t('mission.reqTitle', { dest: tx(mission.name) })}</h3>
    <ul class="lvl-req-list">
      <li>${t('mission.req.dv', { dv: mission.dvRequired })}</li>
      <li>${t('mission.req.sun', { pct: sunPct })}</li>
      <li>${t('mission.req.power', { w: mission.minPowerW })}</li>
      <li>${t('mission.req.travel', { days: mission.travelDays })}</li>
    </ul>
    <ul class="lvl-seg-reqs">${SEGMENTS.map((k) => `<li><b>${segName(k)}:</b> ${segmentRequirement(k, mission)}</li>`).join('')}</ul>
    <p class="muted">${t('mission.reqHelp')}</p>`;
  return box;
}

function stepHeader(id) {
  const { t } = ctx;
  const head = el('header', 'step-head');
  head.append(
    el('p', 'step-kicker', `${STEP_ICON[id]} ${t('mission.stepOf', { n: stepIndex() + 1, total: STEPS.length })}`),
    el('h2', null, t(`mission.sections.${id}.title`)),
    el('p', 'lvl-question', t(`mission.sections.${id}.question`)),
  );
  head.querySelector('h2').tabIndex = -1;
  return head;
}

function projectStage() {
  const mission = currentMission();
  const panel = el('div', 'step-card');
  panel.append(nameField(), destinationGrid());
  if (mission) panel.append(scienceTargets(mission), requirementsPanel(mission));
  else panel.append(el('p', 'muted lvl-hint', ctx.t('mission.pickMission')));
  return [stepHeader('project'), panel];
}

// --- Pasos 2–5: un segmento ------------------------------------------------------------
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
      ${placed ? `<button type="button" class="btn opt-move">${t('mission.remove')}</button>` : ''}
    </div>`;
  if (placed) {
    art.querySelector('.opt-move').addEventListener('click', () => placeCard(card.segment, null));
  } else {
    // Tarjeta del banco: sin botón; todo el área la añade (solo «?» abre la info).
    // Con teclado: Tab hasta la tarjeta y Enter o Espacio.
    art.classList.add('is-pickable');
    art.tabIndex = 0;
    art.setAttribute('aria-label', t('mission.addCard', { name: tx(card.name) }));
    art.addEventListener('click', (e) => {
      if (e.target.closest('.opt-info')) return;
      placeCard(card.segment, card.id);
    });
    art.addEventListener('keydown', (e) => {
      if (e.target !== art || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      placeCard(card.segment, card.id);
    });
  }
  art.addEventListener('dragstart', (e) => {
    dragging = { seg: card.segment, id: card.id, placed };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
    art.classList.add('is-dragging');
    const mode = placed ? 'is-dragging-placed' : 'is-dragging-bank';
    live.stage.classList.add(mode);
    live.dock.root.classList.add(mode);
    if (!placed) setDock(true); // el panel es el destino del arrastre: tiene que estar a la vista
  });
  art.addEventListener('dragend', endDrag);
  return art;
}

function endDrag() {
  dragging = null;
  if (!live?.stage) return;
  for (const box of [live.stage, live.dock.root]) {
    box.classList.remove('is-dragging-placed', 'is-dragging-bank');
    box.querySelectorAll('.is-over, .is-dragging').forEach((n) => n.classList.remove('is-over', 'is-dragging'));
  }
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

function flagText(f) {
  const { t, tx } = ctx;
  const options = f.segment ? catalog[f.segment] : [];
  const card = options.find((c) => c.id === ctx.state.plan.cards[f.segment]);
  const req = options.find((c) => c.level === f.required);
  const key = f.segment ? `mission.flags.${f.kind}.${f.segment}` : `mission.flags.${f.kind}`;
  return t(key, {
    dest: tx(currentMission()?.name),
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

function flagItem(f) {
  const { t } = ctx;
  const li = el('li', `lvl-flag is-${f.kind}`);
  const prefix = f.segment ? `${segName(f.segment)} · ` : '';
  li.innerHTML = `
    <span class="flag-icon" aria-hidden="true">${f.kind === 'oversized' ? '▲' : '✘'}</span>
    <span><b>${prefix}${t(`mission.flagTitle.${f.kind}`)}.</b> ${flagText(f)}</span>
    ${f.points ? `<b class="flag-pts">−${f.points} CML</b>` : ''}`;
  return li;
}

/** Retroalimentación inmediata del segmento del paso (bien, sobra, no alcanza). */
function segmentFeedback(k, ev) {
  const { t, tx } = ctx;
  const list = el('ul', 'lvl-flags');
  list.setAttribute('aria-live', 'polite');
  const flag = ev.flags.find((f) => f.segment === k);
  const status = ev.segments[k].status;
  if (flag) list.append(flagItem(flag));
  else if (status === 'optimal' || status === 'margin') {
    list.append(el('li', 'lvl-flag is-clean', `<span class="flag-icon" aria-hidden="true">✔</span><span>${t(`mission.feedback.${status}`, { dest: tx(currentMission()?.name) })}</span>`));
  }
  const over = ev.flags.find((f) => f.kind === 'overBudget');
  if (over) list.append(flagItem(over));
  return list;
}

/** Mini resumen de la misión armada hasta ahora; cada fila lleva a su paso. */
function missionSummary(ev, current) {
  const { tx } = ctx;
  const ul = el('ul', 'mini-summary');
  SEGMENTS.forEach((k) => {
    const s = ev.segments[k];
    const li = el('li', `is-${s.status}${k === current ? ' is-current' : ''}`);
    const b = el('button', null, `<span aria-hidden="true">${STEP_ICON[k]}</span><b>${segName(k)}</b><span>${s.card ? tx(s.card.name) : '—'}</span><span class="mini-st">${STATUS_ICON[s.status]}</span>`);
    b.type = 'button';
    b.disabled = k === current;
    b.addEventListener('click', () => goStep(STEPS.indexOf(k)));
    li.append(b);
    ul.append(li);
  });
  return ul;
}

function renderSegmentBody(k, ev) {
  const { t } = ctx;
  const plan = ctx.state.plan;

  const bank = el('section', 'bank');
  bank.append(el('h3', null, t('mission.bank.title')), el('p', 'muted', t('mission.bank.help')));
  const list = el('div', 'bank-list');
  for (const card of catalog[k].filter((c) => c.id !== plan.cards[k])) list.append(cardEl(card, false));
  bank.append(list);
  // Los cohetes de las tarjetas son del juego; el simulador muestra los reales. Se abre en otra pestaña para no perder el paso.
  if (k === 'launch') bank.append(el('p', 'muted sim-hint', `${t('mission.simHint')} <a href="simulador/" target="_blank" rel="noopener">${t('mission.simLink')}</a>`));
  dropZone(bank, (d) => d.placed, (d) => placeCard(d.seg, null));

  const board = el('div', 'board');
  board.append(bank);
  live.body.replaceChildren(board);
  renderDock(k, ev);
}

/** Contenido del panel «Misión configurada»: ranura del segmento, retroalimentación y mini resumen. */
function renderDock(k, ev) {
  const { t } = ctx;
  const s = ev.segments[k];
  const slot = el('div', `slot is-${s.status}`);
  slot.innerHTML = `
    <div class="slot-head">
      <b>${STEP_ICON[k]} ${segName(k)}</b>
      <span class="slot-status">${STATUS_ICON[s.status]} ${t(`mission.status.${s.status}`)}</span>
    </div>`;
  slot.append(s.card ? cardEl(s.card, true) : el('p', 'slot-empty', t('mission.config.empty', { seg: segName(k) })));
  live.dock.body.replaceChildren(slot, segmentFeedback(k, ev), missionSummary(ev, k));
  const { badge, tab } = live.dock;
  const text = `$${ev.spent}M ${t('mission.bar.spent')}`;
  if (badge.textContent && badge.textContent !== text && !tab.hidden) {
    badge.classList.remove('is-bump'); // el panel está recogido y lo asignado cambió: destello en la pestaña
    badge.getBoundingClientRect(); // fuerza el reflow para reiniciar la animación aunque se repita seguida
    badge.classList.add('is-bump');
  }
  badge.textContent = text;
}

// --- Panel lateral «Misión configurada» ------------------------------------------------
/** Abre o recoge el panel. Recogido queda una pestaña en el borde derecho con lo asignado. */
function setDock(open, focus = false) {
  dockOpen = open;
  const d = live.dock;
  d.root.classList.toggle('is-open', open);
  d.panel.inert = !open;
  d.tab.hidden = open;
  d.tab.setAttribute('aria-expanded', String(open));
  if (open) {
    d.tab.classList.remove('is-hint'); // si se reabre a medio aviso, no se repite al volver a recogerlo
    d.badge.classList.remove('is-bump');
  } else if (!dockHintDone()) {
    d.tab.classList.add('is-hint'); // primera vez que se recoge: la pestaña pulsa para que se vea dónde quedó
    markDockHinted();
  }
  if (focus) (open ? d.close : d.tab).focus({ preventScroll: true });
}

/** El panel nace justo debajo del bloque fijo (o del encabezado) para no taparlo. */
function syncDockTop() {
  if (!live?.hud) return;
  const header = document.querySelector('.app-header')?.offsetHeight ?? 64;
  const top = Math.max(header, live.hud.getBoundingClientRect().bottom) + 8;
  live.dock.root.style.setProperty('--dock-top', `${Math.round(top)}px`);
}

function buildDock() {
  const { t } = ctx;
  const title = t('mission.config.title');
  const root = el('aside', 'dock');
  root.setAttribute('aria-label', title);

  const tab = el('button', 'dock-tab', `
    <span class="dock-chev" aria-hidden="true">‹</span>
    <span class="dock-tab-title">${title}</span>
    <span class="dock-badge"></span>`);
  tab.type = 'button';
  tab.setAttribute('aria-controls', 'dock-panel');

  const panel = el('section', 'dock-panel', `
    <header class="dock-head">
      <div><h3 id="dock-title">${title}</h3><p class="muted">${t('mission.config.help')}</p></div>
      <button type="button" class="btn dock-close">${t('mission.dock.collapse')} <span aria-hidden="true">›</span></button>
    </header>
    <div class="dock-body"></div>`);
  panel.id = 'dock-panel';
  panel.setAttribute('aria-labelledby', 'dock-title');

  root.append(panel, tab);
  const dock = {
    root, tab, panel,
    body: panel.querySelector('.dock-body'),
    close: panel.querySelector('.dock-close'),
    badge: tab.querySelector('.dock-badge'),
  };
  // Los avisos son de una sola vez: al terminar se quitan las clases (y al reabrir el panel, en setDock).
  tab.addEventListener('animationend', (e) => {
    if (e.animationName === 'dock-pulse') tab.classList.remove('is-hint');
    if (e.animationName === 'dock-bump') dock.badge.classList.remove('is-bump');
  });
  tab.addEventListener('click', () => setDock(true, true));
  dock.close.addEventListener('click', () => setDock(false, true));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setDock(false, true);
  });
  return dock;
}

function segmentStage(k) {
  const mission = currentMission();
  const head = stepHeader(k);
  head.append(el('p', 'step-req', `<b>${ctx.t('mission.reqShort', { dest: ctx.tx(mission.name) })}</b> ${segmentRequirement(k, mission)}`));
  live.body = el('div', 'step-body');
  return [head, live.body];
}

// --- Paso 6: revisión -----------------------------------------------------------------
function renderReviewBody(ev) {
  const { t, tx } = ctx;
  const grid = el('div', 'review-grid');
  for (const k of SEGMENTS) {
    const s = ev.segments[k];
    const card = el('div', `review-item slot is-${s.status}`);
    card.innerHTML = `
      <div class="slot-head"><b>${STEP_ICON[k]} ${segName(k)}</b><span class="slot-status">${STATUS_ICON[s.status]} ${t(`mission.status.${s.status}`)}</span></div>
      <p class="review-card">${s.card ? `${tx(s.card.name)} · <b>$${s.card.cost}M</b>` : '—'}</p>`;
    const change = el('button', 'btn btn-ghost', t('mission.review.change'));
    change.type = 'button';
    change.addEventListener('click', () => goStep(STEPS.indexOf(k)));
    card.append(change);
    grid.append(card);
  }

  const flags = el('ul', 'lvl-flags');
  flags.setAttribute('aria-live', 'polite');
  [...ev.flags].sort((a, b) => FLAG_ORDER[a.kind] - FLAG_ORDER[b.kind] || b.points - a.points).forEach((f) => flags.append(flagItem(f)));
  if (!ev.flags.length) {
    flags.append(el('li', 'lvl-flag is-clean', `<span class="flag-icon" aria-hidden="true">✔</span><span>${t('mission.review.clean')}</span>`));
  }
  live.body.replaceChildren(grid, flags);
}

function reviewStage() {
  live.body = el('div', 'step-body');
  return [stepHeader('review'), live.body];
}

// --- Navegación inferior ---------------------------------------------------------------
/** Por qué no se puede avanzar desde el paso actual (texto corto), o '' si se puede. */
function blockedReason(id, ev) {
  const { t, tx } = ctx;
  if (id === 'project') {
    const missing = ev.blockers.filter((b) => ['name', 'mission', 'science'].includes(b.id));
    return missing.map((b) => t(`mission.blockers.${b.id}`)).join(' ');
  }
  if (isSegment(id)) {
    const status = ev.segments[id].status;
    if (status === 'empty') return t('mission.nav.needCard', { seg: segName(id) });
    if (status === 'insufficient') return t('mission.nav.needBetter', { seg: segName(id), dest: tx(currentMission()?.name) });
    return '';
  }
  return ev.blockers.map((b) => t(`mission.blockers.${b.id}`, { ...b, seg: b.segment ? segName(b.segment) : '' })).join(' ');
}

function renderNav(ev, steps) {
  const { t } = ctx;
  const i = stepIndex();
  const id = STEPS[i];
  const last = i === STEPS.length - 1;
  const nav = el('div', 'screen-footer lvl-nav');

  const prev = el('button', 'btn btn-ghost', t('mission.nav.prev'));
  prev.type = 'button';
  prev.hidden = i === 0;
  prev.addEventListener('click', () => goStep(i - 1));

  const reason = blockedReason(id, ev);
  const status = el('p', reason ? 'warn lvl-nav-hint' : 'ok lvl-nav-hint');
  status.setAttribute('aria-live', 'polite');
  status.textContent = reason || (last ? t('mission.ready', { name: ctx.state.plan.projectName.trim(), cml: ev.cmlCap }) : '');

  const nextLabel = last ? t('mission.validate') : t('mission.nav.next', { step: t(`mission.steps.${STEPS[i + 1]}`) });
  const next = el('button', 'btn btn-primary', nextLabel);
  next.type = 'button';
  // Avanzar exige que el paso actual esté resuelto (y que el siguiente esté abierto).
  next.disabled = !steps[i].done || (!last && !steps[i + 1].unlocked);
  next.addEventListener('click', () => (last ? validateAndContinue() : goStep(i + 1)));

  nav.append(prev, status, next);
  live.nav.replaceChildren(nav);
}

// --- Render ---------------------------------------------------------------------------
/** Construye el contenido del paso actual (estructura estable del paso). */
function renderStage() {
  const id = stepId();
  live.body = null;
  let content;
  if (id === 'project') content = projectStage();
  else if (isSegment(id)) content = segmentStage(id);
  else content = reviewStage();
  live.stage.className = `step-stage step-${id}`;
  live.stage.replaceChildren(...content);
}

function updateScene(ev) {
  const id = stepId();
  const mission = currentMission();
  let level = 0;
  let status = '';
  if (isSegment(id)) {
    level = ev.segments[id].card?.level ?? 0;
    status = SCENE_STATUS[ev.segments[id].status] ?? '';
  } else if (id === 'review') {
    const blocking = ev.flags.some((f) => f.kind === 'insufficient' || f.kind === 'overBudget');
    if (ev.ready) status = 'ok';
    else if (blocking) status = 'insufficient';
  }
  scenes.update({ step: id, planet: mission?.color ?? '#3a4470', level, status });
}

/** Recalcula todo lo que depende del estado. `focus` devuelve el foco a la tarjeta movida. */
function renderLive(focus = null, edited = false) {
  const ev = evaluatePlan(ctx.state, ctx.data);
  commitPlan(ev, edited);
  const steps = stepStatus(ctx.state, ev);
  const id = stepId();
  renderStepper(steps);
  renderBar(ev);
  if (isSegment(id)) renderSegmentBody(id, ev);
  else if (id === 'review') renderReviewBody(ev);
  renderNav(ev, steps);
  updateScene(ev);
  live.dock.root.hidden = !isSegment(id);
  syncDockTop();
  if (focus?.id) {
    // La tarjeta movida puede estar en el panel; si está recogido, el foco va a su pestaña.
    // Colocada → su botón «Quitar»; devuelta al banco → la propia tarjeta (no tiene botón).
    const sel = `.opt[data-seg="${focus.seg}"][data-id="${focus.id}"]`;
    const card = live.stage.querySelector(sel) ?? live.dock.body.querySelector(sel);
    const target = card?.querySelector('.opt-move') ?? card;
    (target && !target.closest('[inert]') ? target : live.dock.tab).focus();
  }
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
  ctx.update({ missionId: m.id, budget: { total: m.budget }, plan: { scienceTargetIdx: null } });
  renderStage();
  renderLive(null, true);
}

function build() {
  const { t } = ctx;
  catalog = cardCatalog(ctx.data);
  live = {
    stepper: el('ol', 'stepper'),
    bar: budgetBar(),
    stage: el('div', 'step-stage'),
    nav: el('div'),
  };
  live.stepper.setAttribute('aria-label', t('mission.stepsLabel'));
  const hud = el('div', 'lvl-hud');
  hud.append(live.stepper, live.bar);
  live.hud = hud;
  live.dock = buildDock();
  document.body.append(live.dock.root); // fuera de la pantalla: su animación de entrada rompería el `position: fixed`
  dropZone(live.dock.panel, (d) => !d.placed && d.seg === stepId(), (d) => placeCard(d.seg, d.id));
  setDock(dockOpen);
  if (typeof ResizeObserver === 'function') {
    hudObserver = new ResizeObserver(syncDockTop);
    hudObserver.observe(hud);
  }
  const pops = el('div', 'opt-pops');
  for (const k of SEGMENTS) catalog[k].forEach((c) => pops.append(infoPopover(c)));
  root.replaceChildren(el('h1', null, t('mission.title')), el('p', 'lead', t('mission.intro')), hud, live.stage, live.nav, pops);
  renderStage();
  renderLive();
  syncCompact();
}

// Al bajar, el bloque fijo se adelgaza para dejar ver la escena de fondo. Histéresis (80/20 px) y margen
// compensado: así el alto de la página no cambia y no entra en bucle justo en el umbral.
const COMPACT_ON = 80;
const COMPACT_OFF = 20;

function setCompact(on) {
  const hud = live.hud;
  if (hud.classList.contains('is-compact') === on) return;
  const full = hud.offsetHeight;
  hud.classList.toggle('is-compact', on);
  hud.style.marginBottom = on ? `${Math.max(0, full - hud.offsetHeight)}px` : '';
}

function syncCompact() {
  if (!live?.hud) return;
  const compact = live.hud.classList.contains('is-compact');
  if (!compact && window.scrollY > COMPACT_ON) setCompact(true);
  else if (compact && window.scrollY < COMPACT_OFF) setCompact(false);
}

/** El bloque fijo (pasos + presupuesto) se pega justo debajo del encabezado, cuya altura cambia en móvil. */
function syncHeaderHeight() {
  const h = document.querySelector('.app-header')?.offsetHeight ?? 64;
  root.style.setProperty('--header-h', `${h}px`);
}

export default {
  id: 'mission',
  mount(container, context) {
    ctx = context;
    root = container;
    dockOpen = true; // al entrar (primera vez, Continuar o tras Reiniciar) el panel siempre empieza abierto
    scenes = createScenes();
    syncHeaderHeight();
    onResize = () => {
      syncHeaderHeight();
      setCompact(false); // el alto compensado depende del ancho: se vuelve a medir
      syncCompact();
      syncDockTop();
    };
    onScroll = () => {
      syncCompact();
      syncDockTop();
    };
    // Un clic fuera del panel lo recoge (menos el cuerpo de una tarjeta: ahí empieza un arrastre hacia el panel).
    onDockPointer = (e) => {
      if (!live?.dock || !dockOpen || live.dock.root.hidden || live.dock.root.contains(e.target)) return;
      if (e.target.closest('.opt') && !e.target.closest('button')) return;
      setDock(false);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('pointerdown', onDockPointer);
    build();
  },
  unmount() {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('pointerdown', onDockPointer);
    hudObserver?.disconnect();
    hudObserver = null;
    live?.dock.root.remove();
    document.querySelectorAll('.opt-pop:popover-open').forEach((p) => p.hidePopover());
    scenes?.destroy();
    scenes = null;
    live = null;
    dragging = null;
  },
};
