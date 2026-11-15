// OWNER: Rol 3 — Nivel 2 · prueba en tierra animada.
// Recorre fases ligadas a las verificaciones de physics.validateDesign: cada fase anima el banco
// (vibración, despliegue, eclipse, encendido, enlace) y se detiene en la primera que falla.
import { sfx, motorStart, motorStop } from './sonido.js';

const PASO_MS = 1100;

/**
 * @param {object} o
 * @param {HTMLElement} o.host   contenedor del SVG del banco (recibe la clase `test-<fase>`)
 * @param {HTMLElement} o.lista  <ol> donde se escribe la bitácora de la prueba
 * @param {Array<{id:string, icon:string, label:string, ok:boolean, detail:string, bar?:{from:number,to:number}}>} o.fases
 * @param {boolean} o.reduce     sin animación (prefers-reduced-motion)
 * @param {(ok:boolean, fallida:object|null) => void} o.onFin
 * @returns {{ saltar: () => void }}
 */
export function correrPrueba({ host, lista, fases, reduce, onFin }) {
  let i = 0;
  let timer = null;
  let terminado = false;
  lista.replaceChildren();
  const ms = reduce ? 120 : PASO_MS;

  const limpiar = () => {
    host.classList.forEach((c) => { if (c.startsWith('test-')) host.classList.remove(c); });
    motorStop();
  };

  const fin = (ok, fallida) => {
    if (terminado) return;
    terminado = true;
    clearTimeout(timer);
    limpiar();
    if (fallida) host.classList.add('test-fail');
    sfx(ok ? 'exito' : 'fallo');
    onFin(ok, fallida);
  };

  const pintar = (li, f, estado) => {
    li.className = `n2-test-${estado}`;
    const mark = estado === 'run' ? '⏳' : estado === 'ok' ? '✔' : '✘';
    li.innerHTML = `<span class="n2-test-mark" aria-hidden="true">${mark}</span><span>${f.icon} ${f.label}${estado !== 'run' && f.detail ? `<small>${f.detail}</small>` : ''}</span>`;
    if (f.bar) {
      const pct = estado === 'run' ? f.bar.from : f.bar.to;
      li.insertAdjacentHTML('beforeend', `<span class="n2-test-bar"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>`);
      if (estado === 'run') requestAnimationFrame(() => { const bar = li.querySelector('.n2-test-bar i'); if (bar) bar.style.width = `${Math.max(0, Math.min(100, f.bar.to))}%`; });
    }
  };

  const paso = () => {
    if (terminado) return;
    if (i >= fases.length) return fin(true, null);
    const f = fases[i];
    limpiar();
    host.classList.add(`test-${f.id}`);
    if (f.id === 'burn') motorStart();
    else if (f.id === 'link') sfx('ping');
    else sfx('paso');
    const li = document.createElement('li');
    pintar(li, f, 'run');
    lista.append(li);
    timer = setTimeout(() => {
      pintar(li, f, f.ok ? 'ok' : 'bad');
      if (!f.ok) return fin(false, f);
      i += 1;
      paso();
    }, ms);
  };

  host.classList.remove('test-fail');
  paso();
  return {
    // Saltar: muestra el resultado de todas las fases que faltan al instante
    saltar() {
      if (terminado) return;
      clearTimeout(timer);
      const last = lista.lastElementChild;
      for (; i < fases.length; i++) {
        const f = fases[i];
        let li = last;
        if (!li || li.dataset.done) { li = document.createElement('li'); lista.append(li); }
        li.dataset.done = '1';
        pintar(li, f, f.ok ? 'ok' : 'bad');
        if (!f.ok) return fin(false, f);
      }
      fin(true, null);
    },
  };
}
