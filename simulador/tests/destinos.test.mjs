// Pruebas de los datos de lugares:  node simulador/tests/destinos.test.mjs
import { DESTINOS } from '../pilotaje/destinos.js';
import { CUERPOS } from '../pilotaje/cuerpos-datos.js';
import { distanciaAngular } from '../pilotaje/fisica.js';

let pass = 0; let fail = 0;
function check(nombre, cond, info = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${nombre}${info ? `  (${info})` : ''}`);
}
const cerca = (a, b, tol) => Math.abs(a - b) <= tol;

for (const d of Object.values(DESTINOS)) {
  check(`${d.id}: tiene exactamente 3 lugares`, d.lugares.length === 3);
  check(`${d.id}: el cuerpo existe en cuerpos-datos`, Boolean(CUERPOS[d.cuerpo]));
  for (const l of d.lugares) {
    check(`${d.id}/${l.id}: lat ∈ [−90, 90] y lon ∈ [−180, 180] (este positivo)`, Math.abs(l.lat) <= 90 && Math.abs(l.lon) <= 180, `${l.lat}, ${l.lon}`);
    check(`${d.id}/${l.id}: nombre y dato en ES y EN, con fuente y enlace`, Boolean(l.nombre.es && l.nombre.en && l.dato.es && l.dato.en && l.fuente && l.enlace?.startsWith('https://')));
  }
}

// Conversiones desde "oeste positivo" del USGS
const lugar = (d, id) => DESTINOS[d].lugares.find((l) => l.id === id);
check('Conamara: 272.70° O = 87.30° E', cerca(lugar('europa', 'conamara').lon, 87.3, 1e-9));
check('Olimpo: 226.2° E = −133.8°', cerca(lugar('marte', 'olimpo').lon, -133.8, 1e-9));
check('Tara Regio: centro del recuadro 42–107° O = 74.5° O y lat −35…20 → −7.5°', cerca(lugar('europa', 'tara').lon, -74.5, 1e-9) && cerca(lugar('europa', 'tara').lat, -7.5, 1e-9));
check('Tara Regio está marcado como centro derivado', lugar('europa', 'tara').centroDerivado === true);

// Cordura geográfica
const luna = DESTINOS.luna.lugares;
check('Chang’e 4 está en el lado oculto (|lon| > 90°)', Math.abs(lugar('luna', 'change4').lon) > 90);
check('Tranquilidad está en el lado visible (|lon| < 90°)', Math.abs(lugar('luna', 'tranquilidad').lon) < 90);
check('Shackleton está a menos de 1° del polo sur', 90 - Math.abs(lugar('luna', 'shackleton').lat) < 1);
check('Shackleton se observa con altímetro porque su fondo nunca recibe luz', lugar('luna', 'shackleton').observarDeNoche === true);
check('Chang’e 4 y Tranquilidad: distancia angular ≈ 130° (casi lados opuestos)', (() => { const d = distanciaAngular(luna[0], luna[2]); return d > 125 && d < 135; })(), `${distanciaAngular(luna[0], luna[2]).toFixed(1)}°`);

// Órbita objetivo del Apolo 11
const o = DESTINOS.luna.mision.orbitaObjetivo;
check('órbita objetivo: 61.6 × 169.5 millas náuticas = 114.1 × 313.9 km (1 nmi = 1.852 km)', cerca(61.6 * 1.852, o.alturaPerilunioKm, 0.1) && cerca(169.5 * 1.852, o.alturaApolunioKm, 0.1), `${(61.6 * 1.852).toFixed(1)} × ${(169.5 * 1.852).toFixed(1)}`);
check('lo no verificado de la misión está declarado', DESTINOS.luna.mision.noVerificado.length === 3);
check('Europa: la alineación de textura está declarada como no verificada', DESTINOS.europa.textura.alineacion.estado === 'no verificada');

console.log(`\n${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
