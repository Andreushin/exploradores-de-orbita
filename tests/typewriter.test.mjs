// Pruebas de js/typewriter.js:  node tests/typewriter.test.mjs
// Reloj y elementos simulados: no hace falta navegador ni esperar.
import { typingPlan, typeInto, createTypeQueue, accessibleLine, graphemes } from '../js/typewriter.js';

let fallos = 0;
const check = (n, ok, d = '') => { if (!ok) fallos++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  (${d})` : ''}`); };

/** Reloj falso: schedule/unschedule inyectables y advance(ms) para correr el tiempo. */
function fakeClock() {
  let now = 0; let id = 0;
  const q = new Map();
  return {
    schedule(fn, ms) { const k = ++id; q.set(k, { at: now + ms, fn }); return k; },
    unschedule(k) { q.delete(k); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const [k, v] of q) if (v.at <= end && (!next || v.at < next.v.at)) next = { k, v };
        if (!next) break;
        now = next.v.at; q.delete(next.k); next.v.fn();
      }
      now = end;
    },
    get pending() { return q.size; },
  };
}
/** Elemento mínimo: textContent, isConnected y classList. */
function fakeEl(connected = true) {
  const s = new Set();
  return { textContent: '', isConnected: connected, classList: { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c) } };
}
const loneSurrogate = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

// 1) Plan de tiempos
{
  const corto = typingPlan(110, { cps: 45 });
  check('110 caracteres a 45 cps: de uno en uno y menos de 2,6 s', corto.step === 1 && corto.total <= 2600, `${corto.total} ms`);
  const largo = typingPlan(400, { cps: 45 });
  check('400 caracteres: escribe de a varios y no pasa de 2,6 s', largo.step > 1 && largo.total <= 2600, `step ${largo.step}, ${largo.total} ms`);
  check('texto vacío: sin pasos ni tiempo', typingPlan(0).total === 0);
  check('nunca baja de un cuadro por paso (16 ms)', typingPlan(10, { cps: 1000 }).delay >= 16);
}

// 2) typeInto: escribe poco a poco y termina completo
{
  const c = fakeClock(); const el = fakeEl(); const hechos = [];
  const h = typeInto(el, 'Hola, órbita', { reduce: false, cps: 50, schedule: c.schedule, unschedule: c.unschedule, onDone: (ok) => hechos.push(ok) });
  check('el primer trozo aparece al instante y lleva el cursor (.is-typing)', el.textContent.length > 0 && el.textContent.length < 12 && el.classList.contains('is-typing'));
  c.advance(60);
  const parcial = el.textContent;
  check('a mitad de camino hay texto parcial', parcial.length > 0 && parcial.length < 12, parcial);
  c.advance(2000);
  check('termina con el texto completo', el.textContent === 'Hola, órbita');
  check('quita el cursor al terminar', !el.classList.contains('is-typing'));
  check('onDone(true) una sola vez', hechos.length === 1 && hechos[0] === true);
  check('el handle queda terminado y sin temporizadores', h.finished && c.pending === 0);
}

// 3) skip, cancel, elemento desconectado y reduce-motion
{
  const c = fakeClock(); const el = fakeEl(); const hechos = [];
  const h = typeInto(el, 'Saltar esta línea larga', { reduce: false, schedule: c.schedule, unschedule: c.unschedule, onDone: (ok) => hechos.push(ok) });
  c.advance(30);
  h.skip();
  check('skip() deja el texto completo y llama a onDone(true)', el.textContent === 'Saltar esta línea larga' && hechos.join() === 'true');
  check('skip() no deja temporizadores', c.pending === 0);
  h.skip();
  check('skip() repetido no vuelve a avisar', hechos.length === 1);
}
{
  const c = fakeClock(); const el = fakeEl(); const hechos = [];
  const h = typeInto(el, 'Cancelar a medias', { reduce: false, schedule: c.schedule, unschedule: c.unschedule, onDone: (ok) => hechos.push(ok) });
  c.advance(40);
  const antes = el.textContent;
  h.cancel();
  c.advance(2000);
  check('cancel() detiene el texto donde iba y no avisa', el.textContent === antes && antes.length < 'Cancelar a medias'.length && hechos.length === 0);
  check('cancel() quita el cursor y los temporizadores', !el.classList.contains('is-typing') && c.pending === 0);
}
{
  const c = fakeClock(); const el = fakeEl(); const hechos = [];
  typeInto(el, 'Línea de una bitácora que se reinició', { reduce: false, schedule: c.schedule, unschedule: c.unschedule, onDone: (ok) => hechos.push(ok) });
  el.isConnected = false;
  c.advance(500);
  check('si el elemento sale del documento se aborta con onDone(false)', hechos.join() === 'false' && c.pending === 0);
}
{
  const c = fakeClock(); const el = fakeEl(); const hechos = [];
  typeInto(el, 'Sin animación', { reduce: true, schedule: c.schedule, unschedule: c.unschedule, onDone: (ok) => hechos.push(ok) });
  check('con reduce-motion escribe todo en el acto, sin temporizadores', el.textContent === 'Sin animación' && c.pending === 0 && hechos.join() === 'true');
}

// 4) Un emoji o una letra con tilde nunca se parte a la mitad
{
  const c = fakeClock(); const el = fakeEl(); const vistos = new Set();
  const texto = '🚀 Órbita 🛰️ lista ✅';
  typeInto(el, texto, { reduce: false, cps: 60, schedule: c.schedule, unschedule: c.unschedule });
  vistos.add(el.textContent);
  for (let i = 0; i < 60; i++) { c.advance(17); vistos.add(el.textContent); }
  check('termina completo', el.textContent === texto);
  check('ningún paso intermedio deja medio emoji', [...vistos].every((s) => !loneSurrogate.test(s)));
  check('graphemes() cuenta 🛰️ (con selector de variación) como un solo carácter', graphemes('🛰️').length === 1);
}

// 5) Cola: una línea a la vez y en orden
{
  const c = fakeClock(); const a = fakeEl(); const b = fakeEl(); const d = fakeEl(); const orden = [];
  const q = createTypeQueue({ reduce: false, schedule: c.schedule, unschedule: c.unschedule });
  q.push(a, 'Primera línea', { onDone: () => orden.push('a') });
  q.push(b, 'Segunda línea', { onDone: () => orden.push('b') });
  q.push(d, 'Tercera línea', { onDone: () => orden.push('c') });
  check('mientras escribe la primera, las otras esperan vacías', a.textContent.length > 0 && b.textContent === '' && d.textContent === '' && q.busy);
  c.advance(5000);
  check('escriben completas y en orden', a.textContent === 'Primera línea' && b.textContent === 'Segunda línea' && d.textContent === 'Tercera línea' && orden.join('') === 'abc');
  check('la cola queda libre', !q.busy && c.pending === 0);
}
{
  const c = fakeClock(); const a = fakeEl(); const b = fakeEl();
  const q = createTypeQueue({ reduce: false, schedule: c.schedule, unschedule: c.unschedule });
  q.push(a, 'Una línea larga que el jugador quiere saltar'); q.push(b, 'Siguiente');
  q.skipCurrent();
  check('skipCurrent() completa la actual y arranca la siguiente', a.textContent === 'Una línea larga que el jugador quiere saltar' && b.textContent.length > 0);
}
{
  const c = fakeClock(); const a = fakeEl(); const b = fakeEl(); const d = fakeEl(); const hechos = [];
  const q = createTypeQueue({ reduce: false, schedule: c.schedule, unschedule: c.unschedule });
  q.push(a, 'Línea uno'); q.push(b, 'Línea dos', { onDone: () => hechos.push('b') }); q.push(d, 'Línea tres', { onDone: () => hechos.push('d') });
  q.flush();
  check('flush() deja todo escrito de golpe', a.textContent === 'Línea uno' && b.textContent === 'Línea dos' && d.textContent === 'Línea tres' && hechos.join('') === 'bd');
  check('flush() deja la cola libre y sin temporizadores', !q.busy && c.pending === 0);
}
{
  const c = fakeClock(); const a = fakeEl(); const b = fakeEl(); const hechos = [];
  const q = createTypeQueue({ reduce: false, schedule: c.schedule, unschedule: c.unschedule });
  q.push(a, 'Se detiene a medias'); q.push(b, 'No debe escribirse', { onDone: () => hechos.push('b') });
  c.advance(30);
  q.clear();
  c.advance(5000);
  check('clear() detiene la actual y descarta la pendiente', a.textContent.length < 'Se detiene a medias'.length && b.textContent === '' && hechos.length === 0 && !q.busy);
}
{
  const c = fakeClock(); const a = fakeEl(); const muerta = fakeEl(false); const z = fakeEl();
  const q = createTypeQueue({ reduce: false, schedule: c.schedule, unschedule: c.unschedule });
  q.push(a, 'Antes'); q.push(muerta, 'Esta línea ya no está en el documento'); q.push(z, 'Después');
  c.advance(5000);
  check('una línea desconectada no atasca la cola', a.textContent === 'Antes' && muerta.textContent === '' && z.textContent === 'Después' && !q.busy);
}
{
  const a = fakeEl(); const b = fakeEl(); const z = fakeEl();
  const q = createTypeQueue({ reduce: true });
  q.push(a, 'Uno'); q.push(b, 'Dos'); q.push(z, 'Tres');
  check('con reduce-motion todas las líneas salen en el acto y en orden', a.textContent === 'Uno' && b.textContent === 'Dos' && z.textContent === 'Tres' && !q.busy);
}

// 6) accessibleLine: texto completo para lectores de pantalla + copia visible aria-hidden
{
  const doc = {
    createElement: (tag) => ({
      tag, className: '', textContent: '', attrs: {}, children: [],
      setAttribute(k, v) { this.attrs[k] = v; },
      append(...c) { this.children.push(...c); },
    }),
  };
  const { root, visible, sr } = accessibleLine('Órbita lograda', { tag: 'li', cls: 'n3-good', doc });
  check('la fila usa la etiqueta y la clase pedidas', root.tag === 'li' && root.className === 'n3-good');
  check('el texto completo va en .sr-only', sr.className === 'sr-only' && sr.textContent === 'Órbita lograda');
  check('la copia visible es aria-hidden y empieza vacía', visible.attrs['aria-hidden'] === 'true' && visible.textContent === '' && visible.className === 'eo-tw');
  check('la fila contiene ambos, primero el de lectores', root.children[0] === sr && root.children[1] === visible);
}

console.log(fallos ? `\n${fallos} FALLAS` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
