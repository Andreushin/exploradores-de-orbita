// Pruebas del modo incrustado (Nivel 3) y del cohete de cada misión:  node simulador/tests/embed.test.mjs
import { readFileSync } from 'node:fs';
import { leerParametros, mensajeFin, SIM_DONE, leerParametrosPilotaje, mensajePilotaje, PIL_DONE } from '../embed.js';
import { simular } from '../ascenso.js';
import { DESTINOS } from '../pilotaje/destinos.js';
import * as M from '../pilotaje/mision.js';

const datos = JSON.parse(readFileSync(new URL('../cohetes.json', import.meta.url)));
const misiones = JSON.parse(readFileSync(new URL('../../data/missions.json', import.meta.url)));
const ids = datos.cohetes.map((c) => c.id);

let pass = 0; let fail = 0;
function check(nombre, cond, info = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${nombre}${info ? `  (${info})` : ''}`);
}

// 1) Parámetros de la URL
const p = leerParametros('?rocket=atlas-agena-d&lock=1&embed=1', datos.cohetes);
check('cohete válido + lock + embed', p.rocketId === 'atlas-agena-d' && p.lock && p.embed, JSON.stringify(p));
const sinNada = leerParametros('', datos.cohetes);
check('sin parámetros: página suelta de siempre', sinNada.rocketId === null && !sinNada.lock && !sinNada.embed);
const malo = leerParametros('?rocket=no-existe&lock=1', datos.cohetes);
check('cohete inexistente: se ignora y no bloquea', malo.rocketId === null && !malo.lock);
const sinLock = leerParametros('?rocket=falcon-heavy', datos.cohetes);
check('cohete sin lock: se puede cambiar', sinLock.rocketId === 'falcon-heavy' && !sinLock.lock && !sinLock.embed);
check('lock distinto de 1 no bloquea', !leerParametros('?rocket=saturno-v&lock=true', datos.cohetes).lock);

// 2) Cada misión del juego despega en un cohete del simulador que existe
for (const m of misiones) {
  check(`${m.id}: tiene simRocket con id y nombre ES/EN`, Boolean(m.simRocket?.id && m.simRocket.name?.es && m.simRocket.name?.en));
  check(`${m.id}: ${m.simRocket?.id} existe en cohetes.json`, ids.includes(m.simRocket?.id));
}
check('Luna → Saturno V', misiones.find((m) => m.id === 'moon')?.simRocket?.id === 'saturno-v');
check('Marte → Atlas-Agena D', misiones.find((m) => m.id === 'mars')?.simRocket?.id === 'atlas-agena-d');
check('Europa → Falcon Heavy', misiones.find((m) => m.id === 'europa')?.simRocket?.id === 'falcon-heavy');

// 3) Mensaje de fin con un vuelo real que llega a órbita (carga histórica)
for (const c of datos.cohetes) {
  const sim = simular(c, datos, { masaNave: c.mision.masaNave, muestreo: 1 });
  const msg = mensajeFin(sim, c);
  check(`${c.id}: con la carga real llega a órbita`, sim.ok, sim.motivo || '');
  check(`${c.id}: mensaje de fin completo`, msg.type === SIM_DONE && msg.rocketId === c.id && msg.ok
    && [msg.perigeoKm, msg.apogeoKm, msg.tiempoS, msg.propRestanteKg].every(Number.isFinite), JSON.stringify(msg));
  check(`${c.id}: el mensaje se puede clonar (postMessage)`, JSON.stringify(structuredClone(msg)) === JSON.stringify(msg));
}

// 4) Pilotaje: parámetros, destino de cada misión con su mismo cohete y mensaje de fin
const idsPil = Object.keys(DESTINOS);
const pp = leerParametrosPilotaje('?destino=marte&lock=1&embed=1', idsPil);
check('pilotaje: destino válido + lock + embed', pp.destino === 'marte' && pp.lock && pp.embed, JSON.stringify(pp));
const ppMalo = leerParametrosPilotaje('?destino=pluton&lock=1&embed=1', idsPil);
check('pilotaje: destino inexistente se ignora y no bloquea', ppMalo.destino === null && !ppMalo.lock && ppMalo.embed);
check('pilotaje: sin parámetros, página suelta', JSON.stringify(leerParametrosPilotaje('', idsPil)) === JSON.stringify({ destino: null, lock: false, embed: false }));
check('pilotaje: destino sin lock se puede cambiar', !leerParametrosPilotaje('?destino=europa', idsPil).lock);
for (const m of misiones) {
  const d = m.simRocket?.destino;
  check(`${m.id}: pilotaje ${d} existe`, Boolean(DESTINOS[d]));
  check(`${m.id}: el pilotaje de ${d} usa el mismo cohete (${m.simRocket?.id})`, DESTINOS[d]?.cohete === m.simRocket?.id, DESTINOS[d]?.cohete);
}
for (const id of idsPil) {
  const mis = M.crearMision(id);
  M.terminar(mis);
  const msg = mensajePilotaje(M.evaluar(mis), id);
  check(`${id}: mensaje del pilotaje completo`, msg.type === PIL_DONE && msg.destino === id && msg.fin === 'terminada'
    && typeof msg.orbita === 'boolean' && Number.isFinite(msg.estrellas) && Number.isFinite(msg.lugares)
    && Number.isFinite(msg.dvUsado) && Number.isFinite(msg.tiempoS), JSON.stringify(msg));
  check(`${id}: el mensaje del pilotaje se puede clonar`, JSON.stringify(structuredClone(msg)) === JSON.stringify(msg));
}

console.log(`\n${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
