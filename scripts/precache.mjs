// Genera la lista de archivos que guarda el service worker (sw.js) para jugar sin internet.
//   node scripts/precache.mjs          → reescribe el bloque PRECACHE de sw.js
//   node scripts/precache.mjs --check  → no escribe; falla si sw.js está desactualizado (lo usa tests/offline.test.mjs)
// Sin dependencias: solo Node.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const EXT = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.woff2', '.png', '.jpg', '.jpeg', '.webp', '.ico']);
const EXCLUIR = [/^docs\//, /^tests\//, /^e2e\//, /^test-results\//, /^node_modules\//, /^scripts\//, /^simulador\/tests\//, /^\./, /^sw\.js$/, /:/];
// Texturas 4k y páginas de modelos: se guardan igual, pero sin hacer fallar la instalación si alguna no baja.
const PESADOS = [/^simulador\/texturas\//, /^simulador\/modelos\/originales\//];
// Páginas con URL de carpeta (lo que escribe el jugador en la barra de direcciones)
const CARPETAS = ['', 'nivel2/', 'nivel3/', 'simulador/', 'simulador/pilotaje/'];

function listar(dir = '', acc = []) {
  for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
    const ruta = dir ? `${dir}/${e.name}` : e.name;
    if (EXCLUIR.some((r) => r.test(ruta))) continue;
    if (e.isDirectory()) listar(ruta, acc);
    else if (EXT.has(extname(e.name).toLowerCase())) acc.push(ruta);
  }
  return acc;
}

export function calcular() {
  const todos = listar().sort();
  const pesados = todos.filter((f) => PESADOS.some((r) => r.test(f)));
  const nucleo = [...CARPETAS, ...todos.filter((f) => !pesados.includes(f))];
  const hash = createHash('sha1');
  for (const f of todos) hash.update(f).update(readFileSync(join(RAIZ, f)));
  return { version: hash.digest('hex').slice(0, 10), nucleo, pesados };
}

export function bloque({ version, nucleo, pesados }) {
  const lista = (a) => `[\n${a.map((f) => `  ${JSON.stringify(f)},`).join('\n')}\n]`;
  return `/* PRECACHE:INICIO — generado por scripts/precache.mjs, no editar a mano */\nconst VERSION = ${JSON.stringify(version)};\nconst NUCLEO = ${lista(nucleo)};\nconst PESADOS = ${lista(pesados)};\n/* PRECACHE:FIN */`;
}

const RE = /\/\* PRECACHE:INICIO[\s\S]*?\/\* PRECACHE:FIN \*\//;

export function estaAlDia() {
  const sw = readFileSync(join(RAIZ, 'sw.js'), 'utf8');
  return sw.includes(bloque(calcular()));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    if (!estaAlDia()) { console.error('sw.js está desactualizado: corre `node scripts/precache.mjs`'); process.exit(1); }
    console.log('sw.js al día');
  } else {
    const datos = calcular();
    const ruta = join(RAIZ, 'sw.js');
    writeFileSync(ruta, readFileSync(ruta, 'utf8').replace(RE, () => bloque(datos)));
    console.log(`sw.js actualizado: ${datos.nucleo.length} archivos en el núcleo + ${datos.pesados.length} pesados · versión ${datos.version}`);
  }
}
