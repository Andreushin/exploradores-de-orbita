// Pruebas de Colibrí:  node tests/colibri.test.mjs
// 1) guion (paridad ES/EN, longitudes, variables) · 2) textos y memoria · 3) política de voz con vista y reloj simulados
// 4) adaptador de la app principal (funciones puras) contra los datos reales del juego.
import { readFileSync } from 'node:fs';
import { GUION, OBJETIVOS } from '../js/colibri-guion.js';
import { PRIO, MOODS, interpolate, resolveLine, resolveGoal, holdMs, createStore, forgetColibri, createVoice } from '../js/colibri.js';
import { snapshot, enterScreen, changes } from '../js/colibri-app.js';
import { STEPS, SEGMENTS, cardCatalog } from '../js/budget.js';
import { getState } from '../js/state.js';

let fallos = 0;
const check = (n, ok, d = '') => { if (!ok) fallos++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  (${d})` : ''}`); };
const json = (f) => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url)));
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const MAX_PAGE = 110;

// ── 1) Guion ───────────────────────────────────────────────────────────────────────
{
  const ids = Object.keys(GUION);
  const malas = [];
  for (const id of ids) {
    const e = GUION[id];
    const es = e.es; const en = e.en;
    if (!Array.isArray(es) || !Array.isArray(en) || es.length === 0) malas.push(`${id}: es/en deben ser listas no vacías`);
    else if (es.length !== en.length) malas.push(`${id}: ${es.length} páginas en ES y ${en.length} en EN`);
    else es.forEach((p, i) => { if (placeholders(p) !== placeholders(en[i])) malas.push(`${id}[${i}]: variables distintas en ES y EN`); });
  }
  check(`las ${ids.length} líneas tienen las mismas páginas y variables en ES y EN`, malas.length === 0, malas.slice(0, 3).join(' | '));

  const largas = ids.flatMap((id) => ['es', 'en'].flatMap((l) => (GUION[id][l] || []).map((p, i) => [id, l, i, p.length])).filter(([, , , n]) => n > MAX_PAGE));
  largas.forEach(([id, l, i, n]) => console.log(`   · ${id} (${l}, página ${i + 1}): ${n} caracteres`));
  check(`ninguna página pasa de ${MAX_PAGE} caracteres`, largas.length === 0, `${largas.length} largas`);

  const vacias = ids.filter((id) => ['es', 'en'].some((l) => (GUION[id][l] || []).some((p) => !String(p).trim())));
  check('ninguna página está vacía', vacias.length === 0, vacias.join(', '));

  const sinDeclarar = ids.filter((id) => {
    const usadas = new Set(['es', 'en'].flatMap((l) => GUION[id][l].flatMap((p) => placeholders(p).split(',').filter(Boolean))));
    const decl = new Set(GUION[id].vars || []);
    return [...usadas].some((v) => !decl.has(v)) || [...decl].some((v) => !usadas.has(v));
  });
  check('las variables de cada texto coinciden con su lista `vars`', sinDeclarar.length === 0, sinDeclarar.join(', '));

  check('prioridades válidas', ids.every((id) => GUION[id].prio in PRIO), ids.filter((id) => !(GUION[id].prio in PRIO)).join(', '));
  check('ánimos válidos', ids.every((id) => MOODS.includes(GUION[id].mood)), ids.filter((id) => !MOODS.includes(GUION[id].mood)).join(', '));
  check('`once` es true, \'sesion\' o no está', ids.every((id) => [undefined, true, 'sesion'].includes(GUION[id].once)));
  const reacciones = ['n1.sobregasto', 'n1.insuficiente'];
  check('las reacciones a errores del jugador interrumpen (alta) y se pueden repetir (sin `once`)', reacciones.every((id) => GUION[id].prio === 'alta' && GUION[id].once === undefined));

  const obj = Object.entries(OBJETIVOS);
  const objMalos = obj.filter(([, o]) => !['ahora', 'luego'].every((k) => ['es', 'en'].every((l) => typeof o[k]?.[l] === 'string' && o[k][l].length > 0 && o[k][l].length <= 70)));
  check(`los ${obj.length} «AHORA / LUEGO» tienen ES y EN de hasta 70 caracteres`, objMalos.length === 0, objMalos.map(([k]) => k).join(', '));
}

// ── 2) Textos y memoria ────────────────────────────────────────────────────────────────
{
  check('interpolate reemplaza {nombre}', interpolate('Hola {a} y {b}', { a: 'X', b: 2 }) === 'Hola X y 2');
  check('interpolate deja visible la variable que falta', interpolate('Hola {a}', {}) === 'Hola {a}');
  const script = { x: { es: ['uno'], en: ['one'] }, solo: { es: ['solo es'] } };
  check('resolveLine usa el idioma pedido', resolveLine(script, 'x', 'en').pages[0] === 'one');
  check('resolveLine cae al español si falta el idioma', resolveLine(script, 'solo', 'en').pages[0] === 'solo es');
  check('resolveLine devuelve null si el id no existe', resolveLine(script, 'nope', 'es') === null);
  const g = resolveGoal({ k: { ahora: { es: 'A {n}', en: 'N {n}' }, luego: { es: 'B', en: 'T' } } }, 'k', 'en', { n: 3 });
  check('resolveGoal traduce e interpola', g.ahora === 'N 3' && g.luego === 'T');
  check('resolveGoal con una clave inexistente → null', resolveGoal({}, 'nada', 'es') === null);
  check('holdMs está entre 2 y 7 s', holdMs('x') === 2000 && holdMs('x'.repeat(500)) === 7000 && holdMs('x'.repeat(100)) === 3700);

  const mem = () => { const d = {}; return { d, getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } }; };
  const st = mem();
  const a = createStore(st);
  a.markSeen('x'); a.set('mudo', true);
  const b = createStore(st);
  check('lo ya visto y el silencio se guardan en la clave eo-colibri', b.seen('x') && b.mudo && JSON.parse(st.d['eo-colibri']).vistos.x === 1);
  forgetColibri(st);
  const c = createStore(st);
  check('forget() borra lo visto pero conserva el silencio', !c.seen('x') && c.mudo);
  const roto = { getItem: () => '{no es json', setItem: () => { throw new Error('lleno'); } };
  const d = createStore(roto);
  d.markSeen('y');
  check('con datos corruptos o sin almacenamiento sigue funcionando en memoria', d.seen('y') && !d.mudo);
  const bloqueado = createStore(null);
  bloqueado.set('min', true);
  check('sin localStorage guarda en memoria', bloqueado.min === true);
}

// ── 3) Política de voz (vista y reloj simulados) ───────────────────────────────────────────
function fakeClock() {
  let t = 0; let id = 0; const q = new Map();
  return {
    now: () => t,
    schedule(fn, ms) { const k = ++id; q.set(k, { at: t + ms, fn }); return k; },
    unschedule(k) { q.delete(k); },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        let nx = null;
        for (const [k, v] of q) if (v.at <= end && (!nx || v.at < nx.v.at)) nx = { k, v };
        if (!nx) break;
        t = nx.v.at; q.delete(nx.k); nx.v.fn();
      }
      t = end;
    },
  };
}
function fakeView() {
  const v = {
    pages: [], calls: [], paused: () => false, goalNow: undefined, last: null,
    page({ text, mood, onTyped }) {
      const h = { text, mood, onTyped, skipped: false, cancelled: false, skip() { this.skipped = true; onTyped(); }, cancel() { this.cancelled = true; } };
      v.pages.push(text); v.last = h; return h;
    },
    retext(t) { v.calls.push(['retext', t]); },
    idle() { v.calls.push(['idle']); },
    hideBubble() { v.calls.push(['hide']); },
    goal(g) { v.goalNow = g; },
    setMuted(b) { v.calls.push(['muted', b]); },
    setMin(b) { v.calls.push(['min', b]); },
  };
  return v;
}
const mem = () => { const d = {}; return { d, getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } }; };
const P = (prio, { es = 'texto', en = 'text', ...resto } = {}) => ({ prio, mood: 'neutral', ...resto, es: [es], en: [en] });
function mk(script, { lang = 'es', storage = mem() } = {}) {
  const clock = fakeClock(); const view = fakeView(); let l = lang;
  const voice = createVoice({ script, goals: { g: { ahora: { es: 'A', en: 'N' }, luego: { es: 'B', en: 'T' } } }, getLang: () => l, store: createStore(storage), view, now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule });
  return { voice, view, clock, storage, setLang: (x) => { l = x; } };
}
const typed = (m) => m.view.last.onTyped(); // «terminó de escribirse»

{
  const m = mk({ a: P('normal', { es: 'Uno', en: 'One' }) });
  check('say() de un id que no existe devuelve false', m.voice.say('nope') === false);
  check('say() de un id del guion devuelve true y muestra la primera página', m.voice.say('a') === true && m.view.pages[0] === 'Uno' && m.voice.state().speaking);
}
{
  const m = mk({ multi: { prio: 'normal', mood: 'feliz', es: ['P1', 'P2', 'P3'], en: ['Q1', 'Q2', 'Q3'] }, sig: P('normal', { es: 'Siguiente' }) });
  m.voice.say('multi'); m.voice.say('sig');
  typed(m);
  check('una línea de varias páginas avanza sola tras leerse', (m.clock.advance(holdMs('P1') + 10), m.view.pages.join() === 'P1,P2'));
  typed(m); m.clock.advance(holdMs('P2') + 10); typed(m);
  check('muestra las 3 páginas en orden', m.view.pages.join() === 'P1,P2,P3');
  m.clock.advance(holdMs('P3') + 10);
  check('al terminar la última queda inactiva (idle)', m.view.calls.some((c) => c[0] === 'idle') && !m.voice.state().speaking);
  m.clock.advance(500);
  check('y tras un respiro empieza la siguiente de la cola', m.view.pages.at(-1) === 'Siguiente');
}
{
  const st = mem();
  const m = mk({ o: { ...P('normal', { once: true }), es: ['A', 'B'], en: ['A', 'B'] } }, { storage: st });
  m.voice.say('o');
  check('una línea `once` se marca como vista al llegar a su última página, no antes', !createStore(st).seen('o'));
  typed(m); m.clock.advance(holdMs('A') + 10);
  check('…y ya consta como vista al empezar la última', createStore(st).seen('o'));
  typed(m); m.clock.advance(holdMs('B') + 600);
  check('decirla otra vez devuelve false (aunque se reinicie la página: está en localStorage)', m.voice.say('o') === false && mk({ o: P('normal', { once: true }) }, { storage: st }).voice.say('o') === false);
  check('con force sí se repite', m.voice.say('o', {}, { force: true }) === true);
  forgetColibri(st);
  const n = mk({ o: P('normal', { once: true }) }, { storage: st });
  check('tras forgetColibri() vuelve a contarse', n.voice.say('o') === true);
}
{
  const m = mk({ s: P('normal', { once: 'sesion' }) });
  m.voice.say('s'); typed(m); m.clock.advance(holdMs('texto') + 600);
  check('`once: sesion` no se repite en esta carga…', m.voice.say('s') === false);
  check('…pero no deja nada en localStorage', !('eo-colibri' in m.storage.d) || !JSON.parse(m.storage.d['eo-colibri']).vistos.s);
}
{
  const m = mk({ a: P('normal'), b: P('normal') });
  m.voice.say('a');
  check('la misma línea no se encola dos veces mientras se dice', m.voice.say('a') === false && m.voice.state().queued === 0);
}
{
  const m = mk({ n1: P('normal', { es: 'N1' }), n2: P('normal', { es: 'N2' }), n3: P('normal', { es: 'N3' }), n4: P('normal', { es: 'N4' }), n5: P('normal', { es: 'N5' }), al: P('alta', { es: 'ALTA' }), ba: P('baja', { es: 'BAJA' }) });
  m.voice.say('n1');
  check('una anécdota (baja) no hace cola si ya se está diciendo algo', m.voice.say('ba') === false);
  m.voice.say('n2'); m.voice.say('n3'); m.voice.say('n4'); m.voice.say('n5');
  check('la cola guarda como máximo 3 en espera', m.voice.state().queued === 3, `en cola: ${m.voice.state().queued}`);
  const h1 = m.view.last;
  m.voice.say('al');
  check('una línea de prioridad alta interrumpe a la que se estaba diciendo', h1.cancelled && m.view.pages.at(-1) === 'ALTA');
  typed(m); m.clock.advance(holdMs('ALTA') + 600);
  check('después sigue la cola en orden de llegada', m.view.pages.at(-1) === 'N2', m.view.pages.join());
}
{
  const m = mk({ guia: P('normal', { es: 'G' }), err: P('alta', { es: 'E' }) });
  m.voice.say('guia');
  const guia = m.view.last;
  check('una reacción de prioridad alta interrumpe la línea de guía que se estaba diciendo', m.voice.react('err') === true && guia.cancelled && m.view.pages.at(-1) === 'E');
}
{
  const m = mk({ r: P('baja', { es: 'R' }), x: P('normal') });
  check('una reacción se dice si no hay nada en curso', m.voice.react('r') === true);
  typed(m); m.clock.advance(holdMs('R') + 600);
  m.clock.advance(10000);
  check('no se repite en menos de 20 s…', m.voice.react('r') === false);
  m.clock.advance(11000);
  check('…y sí después', m.voice.react('r') === true);
}
{
  const st = mem();
  const m = mk({ a: P('normal'), b: P('normal') }, { storage: st });
  m.voice.say('a'); m.voice.say('b');
  m.voice.mute(true);
  check('mute() calla lo que se decía, vacía la cola y persiste', m.view.last.cancelled && m.voice.state().queued === 0 && createStore(st).mudo);
  check('en silencio say() devuelve false', m.voice.say('a') === false);
  check('el silencio se conserva al volver a abrir el juego', mk({ a: P('normal') }, { storage: st }).voice.say('a') === false);
  m.voice.mute(false);
  check('mute(false) vuelve a hablar', m.voice.say('a') === true);
  m.voice.minimize(true);
  check('minimizado tampoco habla', m.voice.say('b') === false && createStore(st).min);
}
{
  const m = mk({ multi: { prio: 'normal', es: ['P1', 'P2'], en: ['Q1', 'Q2'] } });
  m.voice.say('multi');
  m.voice.skip();
  check('Saltar mientras escribe completa el texto sin pasar de página', m.view.last.skipped && m.view.pages.length === 1);
  m.voice.skip();
  check('Saltar con el texto completo pasa a la siguiente página', m.view.pages.join() === 'P1,P2');
}
{
  const m = mk({ a: P('normal'), b: P('normal') });
  m.voice.say('a'); m.voice.say('b');
  m.voice.clear();
  check('clear() detiene lo actual, vacía la cola y oculta la burbuja', m.view.last.cancelled && m.voice.state().queued === 0 && !m.voice.state().speaking && m.view.calls.some((c) => c[0] === 'hide'));
  m.clock.advance(5000);
  check('y después no sigue diciendo nada', m.view.pages.length === 1);
}
{
  const m = mk({ a: P('normal', { es: 'Hola {n}', en: 'Hi {n}' }) });
  m.voice.say('a', { n: 7 });
  check('say() interpola las variables', m.view.pages[0] === 'Hola 7');
  m.voice.setGoal('g');
  check('setGoal() pinta «AHORA / LUEGO»', m.view.goalNow.ahora === 'A' && m.view.goalNow.luego === 'B');
  m.setLang('en'); m.voice.refresh();
  check('refresh() repinta el objetivo y la línea en el idioma nuevo', m.view.goalNow.ahora === 'N' && m.view.calls.some((c) => c[0] === 'retext' && c[1] === 'Hi 7'));
  check('y cancela la escritura que iba a medias', m.view.last.cancelled);
  m.clock.advance(holdMs('Hi 7') + 10);
  check('la línea sigue su curso y termina', m.view.calls.some((c) => c[0] === 'idle'));
  m.voice.setGoal(null);
  check('setGoal(null) quita el objetivo', m.view.goalNow === null);
}
{
  const m = mk({ multi: { prio: 'normal', es: ['P1', 'P2'], en: ['Q1', 'Q2'] } });
  let encima = true; m.view.paused = () => encima;
  m.voice.say('multi'); typed(m);
  m.clock.advance(holdMs('P1') + 3000);
  check('con el puntero o el foco encima, la página no se va', m.view.pages.join() === 'P1');
  encima = false;
  m.clock.advance(1500);
  check('al soltarlo, sigue', m.view.pages.join() === 'P1,P2');
}

// ── 4) Adaptador de la app principal ───────────────────────────────────────────────────────
{
  const data = { missions: json('missions'), rockets: json('rockets'), segments: json('segments') };
  const t = (k) => k; const tx = (o) => o?.es ?? '';
  const base = getState();
  const cat = cardCatalog(data);
  const priciest = (seg) => [...cat[seg]].sort((a, b) => b.cost - a.cost)[0].id;
  const cheapest = (seg) => [...cat[seg]].sort((a, b) => a.cost - b.cost)[0].id;
  const mk1 = (over = {}) => ({ ...base, screen: 'mission', missionId: 'moon', ...over, plan: { ...base.plan, projectName: 'Colibrí Lunar', scienceTargetIdx: 0, ...(over.plan || {}) } });

  const nuevo = snapshot({ ...base, screen: 'start' }, { data, t, tx });
  check('sin partida, el Inicio dice la bienvenida', enterScreen(nuevo).say[0][0] === 'inicio.hola' && enterScreen(nuevo).tam === 'grande');
  const conPartida = snapshot(mk1({ screen: 'start' }), { data, t, tx });
  const reg = enterScreen(conPartida).say[0];
  check('con partida, el Inicio da la bienvenida de regreso con el nivel donde se retoma', reg[0] === 'inicio.regreso' && reg[1].n === 1 && reg[1].title === 'menu.levels.items.mission.title', JSON.stringify(reg));
  check('el selector de niveles tiene su línea', enterScreen(snapshot({ ...base, screen: 'levels' }, { data, t, tx })).say[0][0] === 'levels.hola');

  check('cada paso del Nivel 1 tiene su línea y su «AHORA / LUEGO»', STEPS.every((id) => `n1.${id}` in GUION && `n1.${id}` in OBJETIVOS));
  const paso = snapshot(mk1({ plan: { step: 2 } }), { data, t, tx });
  const ent = enterScreen(paso);
  check('en el Nivel 1 habla del paso actual (plan.step)', paso.step === 'space' && ent.say[0][0] === 'n1.space' && ent.goal === 'n1.space');

  const outcomes = ['orbit', 'eccentric', 'flyby', 'crash', 'no-fuel'];
  check('el Reporte tiene su línea para cada resultado de la travesía', outcomes.every((o) => `n4.hola.${o}` in GUION));
  check('y para cada CML (1–4)', [1, 2, 3, 4].every((n) => `n4.cml.${n}` in GUION));
  const rep = enterScreen(snapshot({ ...base, screen: 'report', missionId: 'moon', journey: { ...base.journey, outcome: 'orbit' }, report: { ...base.report, cml: 3 } }, { data, t, tx }));
  check('el Reporte dice el resultado, el CML y qué mejorar, en ese orden', rep.say.map((x) => x[0]).join() === 'n4.hola.orbit,n4.cml.3,n4.mejorar' && rep.say[0][1].dest === 'Luna', rep.say.map((x) => x[0]).join());
  const rep4 = enterScreen(snapshot({ ...base, screen: 'report', missionId: 'moon', journey: { ...base.journey, outcome: 'orbit' }, report: { ...base.report, cml: 4 } }, { data, t, tx }));
  check('con CML 4 cierra con el agradecimiento en vez de pedir mejoras', rep4.say.at(-1)[0] === 'n4.cierre');

  const todos = [...enterScreen(nuevo).say, ...enterScreen(conPartida).say, ...rep.say, ...rep4.say, ...STEPS.map((s) => [`n1.${s}`])];
  check('todo id que el adaptador pide existe en el guion', todos.every(([id]) => id in GUION), todos.filter(([id]) => !(id in GUION)).join());

  // Reacciones dentro de la misma pantalla
  const gasto = mk1({ plan: { step: 1, cards: { launch: priciest('launch'), space: priciest('space'), ground: priciest('ground'), user: priciest('user') } } });
  const sGasto = snapshot(gasto, { data, t, tx });
  const sBarato = snapshot(mk1({ plan: { step: 1, cards: { launch: cheapest('launch'), space: cheapest('space'), ground: cheapest('ground'), user: cheapest('user') } } }), { data, t, tx });
  check('snapshot detecta que el plan se pasó del presupuesto', sGasto.over === true && sBarato.over === false, `${sGasto.over}/${sBarato.over}`);
  const reaccion = changes(sBarato, sGasto);
  check('pasarse del presupuesto dispara la reacción, una sola vez', reaccion.react.some(([id]) => id === 'n1.sobregasto') && changes(sGasto, sGasto).react.length === 0);
  const corto = snapshot(mk1({ missionId: 'mars', plan: { step: 1, cards: { launch: cheapest('launch') } } }), { data, t, tx });
  check('un cohete que no llega al destino se detecta como insuficiente', corto.insufficient.includes('launch'), JSON.stringify(corto.insufficient));
  const rInsuf = changes({ ...corto, insufficient: [] }, corto);
  check('…y Colibrí lo comenta con el nombre del segmento', rInsuf.react[0]?.[0] === 'n1.insuficiente' && rInsuf.react[0][1].seg === 'mission.sections.launch.title');
  const avance = changes({ ...paso, step: 'launch' }, paso);
  check('al cambiar de paso dice la línea del nuevo, actualiza el objetivo y vacía lo del paso anterior', avance.say[0][0] === 'n1.space' && avance.goal === 'n1.space' && avance.clear === true);
  check('si cambió la pantalla, changes() no dice nada (lo hace enterScreen)', changes({ ...paso, screen: 'levels' }, paso).say.length === 0);
  check('los segmentos de budget.js son los que el adaptador conoce', SEGMENTS.length === 4 && Object.keys(sGasto.segLabels).length === 4);
}

console.log(fallos ? `\n${fallos} FALLAS` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
