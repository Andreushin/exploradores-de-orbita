// Pruebas del motor orbital:  node simulador/tests/pilotaje.test.mjs
import * as F from '../pilotaje/fisica.js';
import { CUERPOS } from '../pilotaje/cuerpos-datos.js';

let pass = 0; let fail = 0;
function check(nombre, cond, info = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${nombre}${info ? `  (${info})` : ''}`);
}
const cerca = (a, b, tol) => Math.abs(a - b) <= Math.abs(b) * tol;
const L = CUERPOS.luna; const M = CUERPOS.marte; const E = CUERPOS.europa;

// --- Constantes (valores de las fichas de NASA/JPL) ---
check('Luna: gravedad en superficie ≈ 1.62 m/s² (NSSDCA)', cerca(L.mu / L.radio ** 2, 1.62, 0.01), (L.mu / L.radio ** 2).toFixed(3));
check('Marte: gravedad en superficie ≈ 3.73 m/s² (NSSDCA)', cerca(M.mu / M.radio ** 2, 3.73, 0.01), (M.mu / M.radio ** 2).toFixed(3));
check('Luna: velocidad de escape ≈ 2.38 km/s (NSSDCA)', cerca(Math.sqrt(2 * L.mu / L.radio), 2380, 0.01));
check('Marte: velocidad de escape ≈ 5.03 km/s (NSSDCA)', cerca(Math.sqrt(2 * M.mu / M.radio), 5030, 0.01));
check('Europa: densidad ≈ 3.013 g/cm³ (JPL)', cerca((E.mu / 6.6743e-11) / ((4 / 3) * Math.PI * E.radio ** 3) / 1000, 3.013, 0.005));

// --- Órbita circular ---
const rc = L.radio + 100e3;
let e = { r: [rc, 0, 0], v: [0, F.velocidadCircular(L.mu, rc), 0] };
const el0 = F.elementos(e, L.mu);
check('circular: excentricidad ≈ 0', el0.excentricidad < 1e-9, el0.excentricidad.toExponential(1));
check('circular: periodo = 2π√(r³/μ) ≈ 118 min a 100 km de la Luna', cerca(el0.periodo, 2 * Math.PI * Math.sqrt(rc ** 3 / L.mu), 1e-9), `${(el0.periodo / 60).toFixed(1)} min`);
const dt = 5; const N = Math.round(el0.periodo / dt);
let rMin = Infinity; let rMax = 0;
for (let i = 0; i < N * 3; i++) { e = F.paso(e, L.mu, dt); const r = F.norma(e.r); rMin = Math.min(rMin, r); rMax = Math.max(rMax, r); }
check('circular: 3 vueltas sin deriva (variación < 0.01 % del radio)', (rMax - rMin) / rc < 1e-4, `${((rMax - rMin) / 1000).toFixed(3)} km`);
const el1 = F.elementos(e, L.mu);
check('circular: la energía se conserva (3 vueltas, < 1e-7 relativo)', Math.abs(el1.energia - el0.energia) / Math.abs(el0.energia) < 1e-7);
check('circular: el momento angular se conserva', cerca(F.norma(el1.momentoAngular), F.norma(el0.momentoAngular), 1e-9));

// --- Elipse ---
const rp = L.radio + 100e3; const ra = L.radio + 1000e3;
const vp = Math.sqrt(L.mu * (2 / rp - 2 / (rp + ra)));
let eli = { r: [rp, 0, 0], v: [0, vp, 0] };
const elE = F.elementos(eli, L.mu);
check('elipse: periapsis y apoapsis recuperados', cerca(elE.periapsis, rp, 1e-9) && cerca(elE.apoapsis, ra, 1e-9));
let pasoPorApo = 0;
for (let t = 0; t < elE.periodo / 2; t += 5) { eli = F.paso(eli, L.mu, 5); }
pasoPorApo = F.norma(eli.r);
check('elipse: a medio periodo está en el apoapsis', cerca(pasoPorApo, ra, 5e-3), `${((pasoPorApo - L.radio) / 1000).toFixed(0)} km de altura`);

// --- Llegada en sobrevuelo ---
// Mariner 4 llegó a Marte con unos 9 800 km de distancia mínima; aquí un paso más cercano para poder capturar.
const vInf = 2500; const rpMarte = M.radio + 300e3; const rIni = 12 * M.radio;
const ll = F.llegadaSobrevuelo(M.mu, { vInf, rp: rpMarte, rIni });
const elLl = F.elementos(ll, M.mu);
check('llegada: es hiperbólica (e > 1) con el v∞ pedido', elLl.excentricidad > 1 && cerca(elLl.vInfinito, vInf, 1e-9), `e = ${elLl.excentricidad.toFixed(3)}`);
check('llegada: el periapsis es el pedido', cerca(elLl.periapsis, rpMarte, 1e-9), `${((elLl.periapsis - M.radio) / 1000).toFixed(0)} km de altura`);
const sinMotor = F.predecir(ll, M.mu, { dt: 5, pasos: 6000, radioCuerpo: M.radio });
check('sin motor la nave pasa de largo: no choca', !sinMotor.choca);
check('sin motor la nave se aleja de nuevo (la trayectoria no queda ligada)', F.elementos({ r: sinMotor.puntos.at(-1), v: ll.v }, M.mu).ligada === false);

// Captura: frenar en el periapsis con el Δv teórico deja una elipse con el apoapsis pedido
const raCaptura = M.radio + 20000e3;
const dvC = F.dvCaptura(M.mu, { vInf, rp: rpMarte, ra: raCaptura });
let s = ll; let capturado = null;
for (let t = 0; t < 40000; t += 2) {
  const antes = F.norma(s.r);
  s = F.paso(s, M.mu, 2);
  if (F.norma(s.r) > antes && !capturado) {           // pasó el periapsis: freno impulsivo
    const u = F.unitario(s.v);
    s = { r: s.r, v: F.resta(s.v, F.esc(u, dvC)) };
    capturado = F.elementos(s, M.mu);
    break;
  }
}
check('captura: el frenado deja una órbita ligada', capturado?.ligada === true);
check('captura: apoapsis ≈ el pedido (±2 %, el freno ocurre un paso después del periapsis)', capturado && cerca(capturado.apoapsis, raCaptura, 0.02), capturado ? `${((capturado.apoapsis - M.radio) / 1000).toFixed(0)} km` : '');
check('captura: sin frenar a la mitad del Δv sigue sin quedar ligada', F.dvCaptura(M.mu, { vInf, rp: rpMarte, ra: raCaptura }) > 0
  && Math.sqrt(vInf ** 2 + 2 * M.mu / rpMarte) - dvC / 2 > Math.sqrt(2 * M.mu / rpMarte));

// --- Tiempo al periapsis ---
{
  const tp = F.tiempoAlPeriapsis(ll, M.mu);
  let q = ll; let t = 0; let antes = F.norma(q.r);
  while (true) { q = F.paso(q, M.mu, 1); t += 1; const ahora = F.norma(q.r); if (ahora > antes) break; antes = ahora; }
  check('tiempo al periapsis (hipérbola): coincide con la integración numérica (±0.5 %)', cerca(tp, t, 0.005), `${tp.toFixed(0)} s vs ${t} s`);
  check('tiempo al periapsis: 0 cuando ya se aleja', F.tiempoAlPeriapsis(q, M.mu) === 0);
  const rp2 = L.radio + 100e3; const ra2 = L.radio + 1000e3;
  let el2 = { r: [rp2, 0, 0], v: [0, Math.sqrt(L.mu * (2 / rp2 - 2 / (rp2 + ra2))), 0] };
  for (let i = 0; i < 700; i++) el2 = F.paso(el2, L.mu, 5);   // 3 500 s de un periodo de ~6 400 s: camino al apoapsis
  const per = F.elementos(el2, L.mu).periodo;
  let q2 = el2; let t2 = 0; let a2 = F.norma(q2.r);
  if (F.punto(q2.r, q2.v) > 0) { while (F.punto(q2.r, q2.v) > 0) q2 = F.paso(q2, L.mu, 5); }
  const tp2 = F.tiempoAlPeriapsis(q2, L.mu);
  let q3 = q2; let t3 = 0; let prev = F.norma(q3.r);
  while (true) { q3 = F.paso(q3, L.mu, 1); t3 += 1; const now = F.norma(q3.r); if (now > prev) break; prev = now; }
  check('tiempo al periapsis (elipse): coincide con la integración (±0.5 %)', cerca(tp2, t3, 0.005), `${tp2.toFixed(0)} s vs ${t3} s; periodo ${per.toFixed(0)} s`);
}

// --- Ecuación del cohete ---
check('Tsiolkovsky: Δv con Isp 300 s y m0/mf = 2 ≈ 2039 m/s', cerca(F.dvDisponible(300, 2, 1), 2039, 1e-3));
check('propelente = m·(1 − e^(−Δv/Isp·g0)) es consistente con Δv', cerca(F.dvDisponible(300, 1000, 1000 - F.propelenteGastado(1000, 700, 300)), 700, 1e-9));
check('Δv de circularizar Luna 100 → 1 000 km ≈ 0.18 km/s', F.dvCircularizar(L.mu, { rp: L.radio + 100e3, ra: L.radio + 1000e3 }) > 150 && F.dvCircularizar(L.mu, { rp: L.radio + 100e3, ra: L.radio + 1000e3 }) < 260);

// --- Geometría de observación ---
check('horizonte: a 1 radio de altura el cuerpo ocupa 30° de radio angular', cerca(F.radioAngular(1000, 2000) * 180 / Math.PI, 30, 1e-9));
check('señal tapada: la Luna entre la nave y la Tierra', F.tapado([-3e6, 0, 0], [3.844e8, 0, 0], L.radio));
check('señal libre: nave del mismo lado que la Tierra', !F.tapado([3e6, 0, 0], [3.844e8, 0, 0], L.radio));
check('señal libre: la línea pasa a 3 000 km del centro, fuera de la Luna', !F.tapado([0, -3e6, 0], [3.844e8, 0, 0], L.radio));
const polo = F.subpunto([0, 0, L.radio], { rotacion: L.rotacion });
check('subpunto: sobre el polo la latitud es 90°', cerca(polo.lat, 90, 1e-9));
const sp = F.subpunto([L.radio, 0, 0], { rotacion: L.rotacion, t: L.rotacion / 4 });
check('subpunto: tras un cuarto de rotación la longitud bajo la nave cambia −90°', cerca(sp.lon, -90, 1e-9), `${sp.lon.toFixed(1)}°`);
check('distancia angular: dos puntos en el ecuador a 90° de longitud', cerca(F.distanciaAngular({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }), 90, 1e-9));
check('distancia angular: polo a polo = 180°', cerca(F.distanciaAngular({ lat: 90, lon: 0 }, { lat: -90, lon: 0 }), 180, 1e-9));

console.log(`\n${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
