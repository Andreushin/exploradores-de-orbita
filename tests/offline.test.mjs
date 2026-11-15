// Guardia del modo sin internet. Corre con:  node tests/offline.test.mjs
// Falla si el juego vuelve a depender de internet o si sw.js quedó desactualizado.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estaAlDia, calcular } from '../scripts/precache.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
let fallos = 0;
const check = (nombre, ok, detalle = '') => { if (!ok) fallos++; console.log(`${ok ? 'PASS' : 'FAIL'} ${nombre}${detalle ? ' · ' + detalle : ''}`); };

function archivos(dir = '', acc = []) {
  for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
    const ruta = dir ? `${dir}/${e.name}` : e.name;
    if (/^(docs|tests|e2e|test-results|node_modules|scripts|\.git|\.claude)(\/|$)/.test(ruta) || ruta.includes(':')) continue;
    if (e.isDirectory()) archivos(ruta, acc); else acc.push(ruta);
  }
  return acc;
}
const todos = archivos();
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8');

// 1) Ningún HTML, CSS ni JS del juego pide recursos a internet (los enlaces de «Fuentes» que el jugador pulsa sí valen)
const externas = [];
for (const f of todos.filter((x) => ['.html', '.css', '.js', '.mjs'].includes(extname(x)) && !x.startsWith('js/vendor/') && !x.startsWith('simulador/tests/'))) {
  const t = leer(f);
  for (const m of t.matchAll(/(?:<(?:script|link|img|iframe|source)\b[^>]*?\b(?:src|href)=["']|@import\s+(?:url\()?["']?|url\(["']?|from\s+["']|import\(\s*["'])(https?:)?\/\/[^"')\s]+/g)) {
    // los <a href> son enlaces de lectura, no recursos: el regex solo mira etiquetas de recurso
    externas.push(`${f}: ${m[0].slice(-70)}`);
  }
  // mapas de importación
  for (const m of t.matchAll(/"(?:three|three\/addons\/)"\s*:\s*"(https?:\/\/[^"]+)"/g)) externas.push(`${f}: importmap ${m[1]}`);
}
check('ningún archivo del juego carga recursos de internet (fuentes, scripts, importmaps, imágenes)', externas.length === 0, externas.slice(0, 3).join(' | '));

// 2) Las referencias locales de cada HTML existen (un 404 aquí rompe el juego en pleno evento)
const rotas = [];
for (const f of todos.filter((x) => x.endsWith('.html'))) {
  const base = dirname(f);
  for (const m of leer(f).matchAll(/\b(?:src|href)=["']([^"'#?]+)(?:[?#][^"']*)?["']/g)) {
    const r = m[1];
    if (/^(https?:|data:|mailto:|javascript:|\/\/)/.test(r)) continue;
    const dest = join(RAIZ, base, r);
    if (!existsSync(dest)) rotas.push(`${f} → ${r}`);
  }
}
check('todas las referencias locales (src/href) de los HTML existen', rotas.length === 0, rotas.slice(0, 3).join(' | '));

// 3) Las fuentes y librerías locales están
for (const f of ['assets/fonts/fonts.css', 'assets/fonts/SpaceGrotesk-latin.woff2', 'assets/fonts/JetBrainsMono-latin.woff2', 'js/vendor/three/three.module.js', 'js/vendor/three/addons/controls/OrbitControls.js', 'js/vendor/three-r128/three.min.js', 'js/vendor/three-r128/OrbitControls.js', 'js/vendor/three/LICENSE'])
  check(`existe ${f}`, existsSync(join(RAIZ, f)));
check('las @font-face apuntan a archivos que existen', [...leer('assets/fonts/fonts.css').matchAll(/url\('([^']+)'\)/g)].every((m) => existsSync(join(RAIZ, 'assets/fonts', m[1]))));

// 4) El service worker
check('sw.js está al día con los archivos del juego (corre `node scripts/precache.mjs`)', estaAlDia());
const { nucleo, pesados } = calcular();
check('el precaché incluye las 5 páginas de entrada, three y las fuentes', ['', 'nivel2/', 'nivel3/', 'simulador/', 'simulador/pilotaje/', 'js/vendor/three/three.module.js', 'assets/fonts/fonts.css'].every((r) => nucleo.includes(r)));
check('las texturas pesadas van aparte para no frenar la instalación', pesados.some((f) => f.startsWith('simulador/texturas/')) && !nucleo.some((f) => f.startsWith('simulador/texturas/')));
const paginas = ['index.html', 'nivel2/index.html', 'nivel3/index.html', 'simulador/index.html', 'simulador/pilotaje/index.html'];
check('las 5 páginas registran el service worker', paginas.every((p) => /sw-register\.js/.test(leer(p))));

console.log(fallos ? `\n${fallos} FALLAS` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
