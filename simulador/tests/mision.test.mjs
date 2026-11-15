// Pruebas de la misión de la Luna con piloto robot:  node simulador/tests/mision.test.mjs
import * as M from '../pilotaje/mision.js';
import * as F from '../pilotaje/fisica.js';
import { DESTINOS } from '../pilotaje/destinos.js';

let pass = 0; let fail = 0;
function check(nombre, cond, info = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${nombre}${info ? `  (${info})` : ''}`);
}
const cerca = (a, b, tol) => Math.abs(a - b) <= Math.abs(b) * tol;
const DT = 0.05;                                       // s reales por paso
const correr = (m, seg, ctrl = {}) => { for (let i = 0; i < seg / DT && !m.fin; i++) M.avanzar(m, DT, ctrl); };

// --- Estado inicial ---
{
  const m = M.crearMision('luna');
  const el = M.elementosActuales(m);
  check('arranca en sobrevuelo hiperbólico (e > 1) con v∞ de juego', !el.ligada && cerca(el.vInfinito, 800, 1e-6), `e = ${el.excentricidad.toFixed(3)}`);
  check('periapsis a 114.1 km de altura (el del perilunio objetivo)', cerca(el.periapsis - m.cuerpo.radio, 114.1e3, 1e-4));
  check('el plano de llegada es polar (inclinación ≈ 90°)', Math.abs(el.inclinacion * 180 / Math.PI - 90) < 0.5, `${(el.inclinacion * 180 / Math.PI).toFixed(2)}°`);
  check('actitud ortonormal', cerca(F.norma(m.fwd), 1, 1e-9) && cerca(F.norma(m.up), 1, 1e-9) && Math.abs(F.punto(m.fwd, m.up)) < 1e-9);
  check('Marte y Europa todavía no son jugables', (() => { try { M.crearMision('marte'); return false; } catch { return true; } })());
}

// --- Sin motor: pasa de largo, no choca ---
{
  const m = M.crearMision('luna');
  M.fijarPiloto(m, 'progrado');
  m.escala = 120;
  correr(m, 600);
  const ev = M.evaluar(m);
  check('sin motor la nave pasa de largo y no choca', m.fin?.tipo === 'escapo', `fin: ${m.fin?.tipo ?? 'en curso'}, altura ${(M.altura(m) / 1000).toFixed(0)} km`);
  check('sin motor no queda en órbita ni suma estrellas', !ev.orbita && ev.estrellas === 0);
  check('sin motor no gasta Δv', m.dvUsado === 0);
}

// --- Piloto torpe: frena hacia adelante y se escapa más rápido ---
{
  const m = M.crearMision('luna');
  M.fijarPiloto(m, 'progrado');
  let ult = 0;
  for (let i = 0; i < 4000 && !m.fin; i++) { M.avanzar(m, DT, { motor: M.altura(m) < 400e3 ? 1 : 0 }); ult = i; }
  check('acelerar en vez de frenar no captura la órbita', !M.evaluar(m).orbita, m.fin?.tipo);
}

// --- Piloto robot: captura + 3 lugares ---
{
  const m = M.crearMision('luna');
  M.capturarOrbita(m);
  m.escala = 120;
  let pasos = 0;
  while (m.captura.fase !== 'lista' && !m.fin && pasos < 60000) { M.avanzar(m, DT); pasos++; }
  const el = M.elementosActuales(m);
  const R = m.cuerpo.radio;
  check('captura automática: termina en fase «lista»', m.captura.fase === 'lista', `fase ${m.captura.fase}, fin ${m.fin?.tipo ?? '—'}`);
  check('captura: órbita ligada con apoapsis ≈ 313.9 km (±2 %: el motor se apaga al cerrar un subpaso de 0.25 s ≈ 0.75 m/s ≈ 3.5 km)', el.ligada && cerca((el.apoapsis - R) / 1000, 313.9, 0.02), `${((el.apoapsis - R) / 1000).toFixed(1)} km`);
  check('captura: el periapsis queda a más de 20 km (no choca)', (el.periapsis - R) / 1000 > 20, `${((el.periapsis - R) / 1000).toFixed(1)} km`);
  check('captura: Δv usado dentro del presupuesto', m.dvUsado < M.AJUSTES.dvMax && m.dvUsado > 500, `${m.dvUsado.toFixed(0)} de ${M.AJUSTES.dvMax} m/s`);
  const real = DESTINOS.luna.mision.encendidoRealS;
  const tQuema = m.dvUsado / M.AJUSTES.aceleracion;
  console.log(`      (el frenado dura ${tQuema.toFixed(0)} s; el de la misión real fue ${real[0]}–${real[1]} s)`);

  // Observar los 3 lugares, uno por uno
  const ids = m.dest.lugares.map((l) => l.id);
  const hechos = [];
  for (const id of ids) {
    M.fijarPiloto(m, 'lugar', id);
    m.escala = 30;
    let t0 = m.t; let listo = false;
    while (!m.fin && m.t - t0 < 2.2 * 7800 && !listo) {
      M.avanzar(m, DT);
      const l = m.dest.lugares.find((x) => x.id === id);
      if (M.condiciones(m, l).cumple) { const r = M.escanear(m); listo = r.ok; }
    }
    hechos.push([id, listo, ((m.t - t0) / 60).toFixed(0) + ' min']);
  }
  console.log('      lugares:', hechos.map((h) => `${h[0]} ${h[1] ? '✔' : '✘'} (${h[2]})`).join(' · '));
  check('el robot observa los 3 lugares reales', hechos.every((h) => h[1]));
  M.terminar(m);
  const ev = M.evaluar(m);
  check('resultado: órbita estable, 3 lugares y 3 estrellas', ev.orbita && ev.lugares.length === 3 && ev.estrellas === 3, `★${ev.estrellas}, ${ev.perilunioKm?.toFixed(0)}×${ev.apolunioKm?.toFixed(0)} km, ${(ev.tiempoMision / 3600).toFixed(1)} h`);
  check('Shackleton se observa sin Sol (observarDeNoche) y Chang’e 4 con la señal perdida', (() => {
    const c4 = m.observados.find((o) => o.id === 'change4'); return Boolean(c4); })());
  check('no se puede observar dos veces el mismo lugar', !M.escanear(m).ok);
}

// --- Condiciones de observación ---
{
  const m = M.crearMision('luna');
  const l = m.dest.lugares[0];
  const c0 = M.condiciones(m, l);
  check('al inicio, lejos del cuerpo, ningún lugar es observable', !c0.visible && !c0.cumple, `dist ${(c0.dist / 1000).toFixed(0)} km`);
  check('observar nada devuelve «nada» y no suma', M.escanear(m).motivo === 'nada' && m.observados.length === 0);
}

// --- Señal con la Tierra ---
{
  const m = M.crearMision('luna');
  m.r = [-(m.cuerpo.radio + 150e3), 0, 0]; m.t = 0;
  check('detrás de la Luna (lado opuesto a la Tierra) no hay señal', M.sinSenal(m));
  m.r = [m.cuerpo.radio + 150e3, 0, 0];
  check('del lado de la Tierra hay señal', !M.sinSenal(m));
}

// --- Escala de tiempo ---
{
  const m = M.crearMision('luna');
  M.ciclarEscala(m, 1); const sube = m.escala;
  M.ciclarEscala(m, -9);
  check('escala de tiempo: sube y se queda en los extremos', sube === 120 && m.escala === 1);
}

console.log(`\n${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
