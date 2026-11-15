// Cobertura de idioma del simulador:  node simulador/tests/textos.test.mjs
// Todo texto en español que el jugador puede ver (interfaz, cohetes.json, eventos de la simulación y fichas de etapas)
// debe tener traducción al inglés. Lo que no, aparece aquí y la prueba falla.
import { readFileSync } from 'node:fs';
import * as A from '../ascenso.js';
import { INFO_ETAPAS } from '../modelos/index.js';
import { t, tr, setLang, _UI } from '../textos.js';

const datos = JSON.parse(readFileSync(new URL('../cohetes.json', import.meta.url)));
let fallos = 0;
const check = (n, ok, d = '') => { if (!ok) fallos++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  (${d})` : ''}`); };

// 1) Las dos lenguas tienen exactamente las mismas claves de interfaz
const claves = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? claves(v, `${p}${k}.`) : [`${p}${k}`]));
const kes = claves(_UI.es); const ken = claves(_UI.en);
const dif = [...kes.filter((k) => !ken.includes(k)), ...ken.filter((k) => !kes.includes(k))];
check(`las ${kes.length} claves de interfaz existen en ES y EN`, dif.length === 0, dif.slice(0, 5).join(', '));
check('ningún texto de interfaz en inglés quedó vacío', ken.every((k) => k.split('.').reduce((o, x) => o[x], _UI.en).trim() !== ''));

// 2) Datos y eventos
const textos = new Set();
// Nombres propios que se escriben igual en inglés
const IGUAL = new Set(['LC-39A, Kennedy', 'Atlas LV-3 Agena D', 'Mariner 4', 'Agena D', 'LR89 (booster)', 'Bell 8096', 'Europa Clipper', 'Merlin 1D', 'Merlin 1D Vacuum', '2× Rocketdyne LR89', '9× Merlin 1D', '1× Merlin Vacuum']);
const SALTAR = (s) => IGUAL.has(s) || !/[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}/.test(s) || /^[a-z0-9-]+$/.test(s); // nombres propios, ids, números
for (const c of datos.cohetes) {
  const m = c.mision;
  for (const s of [c.nombre, m.nombre, m.fecha, m.sitio, m.nave, m.rutaReal, ...c.fases.map((f) => f.nombre), ...c.fases.flatMap((f) => f.motores.map((x) => x.nombre)), ...c.fases.flatMap((f) => (f.extra || []).map((x) => x.nombre)), ...c.masasFijas.map((x) => x.nombre)]) if (s) textos.add(s);
  for (const x of Object.values(c.incertidumbre || {})) if (typeof x === 'string') textos.add(x);
  for (const x of c.sinFuente || []) if (typeof x === 'string') textos.add(x);
  for (const carga of [0, m.masaNave, m.masaNave * 3, 1e6]) {
    const sim = A.simular(c, datos, { masaNave: carga, muestreo: 1 });
    for (const e of sim.eventos) textos.add(e.texto);
    if (sim.motivo) textos.add(sim.motivo);
  }
}
for (const d of Object.values(datos.destinos)) textos.add(d.nombre);
for (const fichas of Object.values(INFO_ETAPAS)) for (const f of Object.values(fichas)) {
  for (const s of [f.titulo, f.subtitulo, f.detalle]) if (s) textos.add(s);
  for (const [k, v] of f.datos || []) { textos.add(k); textos.add(v); }
}

setLang('en');
const sinTraducir = [...textos].filter((s) => !SALTAR(s) && tr(s) === s);
sinTraducir.forEach((s) => console.log('   · sin traducir:', JSON.stringify(s)));
check(`los ${textos.size} textos de datos y eventos tienen traducción (o no son texto)`, sinTraducir.length === 0, `${sinTraducir.length} sin traducir`);

// 3) En español todo queda igual
setLang('es');
check('en español tr() no cambia nada', [...textos].every((s) => tr(s) === s));

// 4) Los patrones componen bien
setLang('en');
check('«Encendido: S-IC (1.ª etapa)» → «Ignition: S-IC (1st stage)»', tr('Encendido: S-IC (1.ª etapa)') === 'Ignition: S-IC (1st stage)', tr('Encendido: S-IC (1.ª etapa)'));
check('«Encendido hacia la Luna: Δv 3000 m/s → C3 0 km²/s²» traduce el destino', tr('Encendido hacia la Luna: Δv 3000 m/s → C3 0 km²/s²').startsWith('Burn toward the Moon:'));
check('t() con variables', t('burn', { dest: 'Mars' }) === '🔥 Burn toward Mars');
setLang('es');
console.log(fallos ? `\n${fallos} FALLAS` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
