// Pruebas del simulador:  node simulador/tests/simulador.test.mjs
import { readFileSync } from 'node:fs';
import * as A from '../ascenso.js';

const datos = JSON.parse(readFileSync(new URL('../cohetes.json', import.meta.url)));
const C = datos.constantes;
const cohete = (id) => datos.cohetes.find((c) => c.id === id);
let pass = 0; let fail = 0;
function check(nombre, cond, info = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${nombre}${info ? `  (${info})` : ''}`);
}
const dif = (a, b) => (100 * (a - b)) / b;
const pct = (a, b, tol) => Math.abs(dif(a, b)) <= tol;

// --- Física base ---
check('densidad a nivel del mar ≈ 1.225 kg/m³ (NASA Glenn)', pct(A.atmosfera(0).rho, 1.225, 1), A.atmosfera(0).rho.toFixed(4));
check('la densidad baja con la altura', A.atmosfera(10000).rho < A.atmosfera(1000).rho && A.atmosfera(80000).rho < A.atmosfera(40000).rho);
const f1 = cohete('saturno-v').fases[0].motores[0];
check('F-1: empuje al nivel del mar ≈ 6.7 MN', pct(A.gastoMotor(f1) * A.ispA(f1, 101.29) * A.G0, 6.7e6, 3));
check('C3 a la Luna (Hohmann) ≈ −2.0 km²/s²', pct(A.c3Requerido(datos.destinos.luna, C, C.radioTierra + 185e3), -2.04, 3));
check('C3 a Marte (Hohmann) ≈ 8.7 km²/s²', pct(A.c3Requerido(datos.destinos.marte, C, 0), 8.7, 3));
check('C3 a Júpiter (Hohmann) ≈ 77 km²/s²', pct(A.c3Requerido(datos.destinos.jupiter, C, 0), 77.3, 3));
// Órbita circular estable sin empuje
const r0 = C.radioTierra + 185e3; const v0 = Math.sqrt(C.muTierra / r0);
const orb = A.propagarOrbita({ x: 0, y: r0, vx: v0, vy: 0 }, C.muTierra, { dt: 0.5, pasos: 32000 }); // ~3 vueltas
const radios = orb.map((p) => Math.hypot(p.x, p.y));
const vuelta = Math.round((2 * Math.PI * r0) / v0 / 0.5);
const rango = (a) => Math.max(...a) - Math.min(...a);
check('órbita circular: oscilación < 0.1 % del radio', rango(radios) / r0 < 1e-3, `${(rango(radios) / 1000).toFixed(2)} km de ${(r0 / 1000).toFixed(0)}`);
check('órbita circular: sin deriva entre la 1.ª y la 3.ª vuelta', Math.abs(rango(radios.slice(0, vuelta)) - rango(radios.slice(2 * vuelta, 3 * vuelta))) < 100);

// --- Calibración con la historia ---
const tEv = (s, pref) => s.eventos.find((e) => e.texto.startsWith(pref))?.t;
const sat = A.simular(cohete('saturno-v'), datos);
check('Saturno V llega a órbita', sat.ok);
check('Saturno V: separación S-IC vs T+161.6 s (±5 %)', pct(tEv(sat, 'Separación de la S-IC'), 161.63, 5), `${tEv(sat, 'Separación de la S-IC').toFixed(0)} s`);
check('Saturno V: separación S-II vs T+548.2 s (±5 %)', pct(tEv(sat, 'Separación de la S-II'), 548.22, 5), `${tEv(sat, 'Separación de la S-II').toFixed(0)} s`);
check('Saturno V: órbita vs T+709.3 s (±5 %)', pct(sat.insercion.t, 709.34, 5), `${sat.insercion.t.toFixed(0)} s`);
check('Saturno V: órbita de ~185 km (histórica 183.8 × 186.5)', sat.insercion.perigeoKm > 160 && sat.insercion.apogeoKm < 210, `${sat.insercion.perigeoKm.toFixed(0)} × ${sat.insercion.apogeoKm.toFixed(0)} km`);
check('Apolo 11 llega a la Luna con su carga real', sat.salida.llegaDirecto, `C3 ${sat.salida.c3.toFixed(1)}`);

const atl = A.simular(cohete('atlas-agena-d'), datos);
const agena1 = atl.insercion.t - tEv(atl, 'Encendido: Agena');
check('Atlas-Agena llega a órbita', atl.ok);
check('Agena 1.er encendido vs 144 s (±15 %)', pct(agena1, 144, 15), `${agena1.toFixed(0)} s`);
check('Agena encendido a Marte vs 95 s (±15 %)', pct(atl.salida.duracionRequerida, 95, 15), `${atl.salida.duracionRequerida.toFixed(0)} s`);
check('Mariner 4 llega a Marte', atl.salida.llegaDirecto, `C3 ${atl.salida.c3.toFixed(1)}`);

const fh = A.simular(cohete('falcon-heavy'), datos);
check('Falcon Heavy llega a órbita', fh.ok);
check('Falcon Heavy: separación del núcleo central vs T+251 s (±15 %)', pct(tEv(fh, 'Apagado y separación del núcleo'), 251, 15), `${tEv(fh, 'Apagado y separación del núcleo').toFixed(0)} s`);
check('Europa Clipper NO puede ir directo a Júpiter (como en la realidad)', !fh.salida.llegaDirecto, `C3 ${fh.salida.c3.toFixed(1)} < ${fh.salida.c3Requerido.toFixed(1)}`);
check('…pero sí por la ruta de asistencias (C3 de Marte)', fh.salida.llegaAsistido);

// --- Capacidad comparada con cifras publicadas ---
const fhMarte = A.cargaMaxima(cohete('falcon-heavy'), datos, { directo: false });
check('Falcon Heavy a Marte ≈ 16 800 kg publicados (±10 %)', pct(fhMarte, 16800, 10), `${Math.round(fhMarte)} kg`);
const satLuna = A.cargaMaxima(cohete('saturno-v'), datos);
check('Saturno V a la Luna ≈ 48 t (±10 %)', pct(satLuna, 48000, 10), `${Math.round(satLuna)} kg`);
for (const c of datos.cohetes) {
  const s = A.simular(c, datos, { masaNave: c.mision.masaNave * 3 });
  const llega = s.ok && (s.salida.llegaAsistido ?? s.salida.llegaDirecto);
  check(`${c.nombre}: con el triple de carga ya no llega`, !llega);
}

console.log(`\n${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
