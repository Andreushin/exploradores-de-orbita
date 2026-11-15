// Service worker: deja jugar sin internet.
// - Al instalarse guarda el juego completo (lista generada por scripts/precache.mjs).
// - Después, red primero con límite de tiempo y caché de respaldo: con internet siempre ves lo último
//   (cómodo mientras se programa) y sin internet sale todo del caché.
// - Solo toca recursos del mismo origen; lo externo pasa de largo.
// Si agregas o quitas archivos: `node scripts/precache.mjs` actualiza el bloque de abajo.

/* PRECACHE:INICIO — generado por scripts/precache.mjs, no editar a mano */
const VERSION = "d9d6d53256";
const NUCLEO = [
  "",
  "nivel2/",
  "nivel3/",
  "simulador/",
  "simulador/pilotaje/",
  "assets/companion.png",
  "assets/favicon.svg",
  "assets/fonts/JetBrainsMono-latin-ext.woff2",
  "assets/fonts/JetBrainsMono-latin.woff2",
  "assets/fonts/SpaceGrotesk-latin-ext.woff2",
  "assets/fonts/SpaceGrotesk-latin.woff2",
  "assets/fonts/fonts.css",
  "assets/logo.svg",
  "assets/logo_blank.svg",
  "css/base.css",
  "css/screens/menu.css",
  "css/screens/mission.css",
  "css/screens/report.css",
  "data/events.json",
  "data/i18n/en/common.json",
  "data/i18n/en/menu.json",
  "data/i18n/en/mission.json",
  "data/i18n/en/report.json",
  "data/i18n/en/workshop.json",
  "data/i18n/es/common.json",
  "data/i18n/es/menu.json",
  "data/i18n/es/mission.json",
  "data/i18n/es/report.json",
  "data/i18n/es/workshop.json",
  "data/missions.json",
  "data/pieces.json",
  "data/rockets.json",
  "data/science.json",
  "data/segments.json",
  "data/workshop.json",
  "index.html",
  "js/budget.js",
  "js/canvas/starry-bg.js",
  "js/i18n.js",
  "js/levels.js",
  "js/main.js",
  "js/mision-store.js",
  "js/physics.js",
  "js/science-data.js",
  "js/screens/explorar.js",
  "js/screens/levels.js",
  "js/screens/mission-scenes.js",
  "js/screens/mission.js",
  "js/screens/report.js",
  "js/screens/start.js",
  "js/screens/workshop.js",
  "js/state.js",
  "js/sw-register.js",
  "js/taller-reglas.js",
  "js/vendor/three-r128/OrbitControls.js",
  "js/vendor/three-r128/three.min.js",
  "js/vendor/three/addons/controls/OrbitControls.js",
  "js/vendor/three/addons/postprocessing/EffectComposer.js",
  "js/vendor/three/addons/postprocessing/MaskPass.js",
  "js/vendor/three/addons/postprocessing/OutputPass.js",
  "js/vendor/three/addons/postprocessing/Pass.js",
  "js/vendor/three/addons/postprocessing/RenderPass.js",
  "js/vendor/three/addons/postprocessing/ShaderPass.js",
  "js/vendor/three/addons/postprocessing/UnrealBloomPass.js",
  "js/vendor/three/addons/shaders/CopyShader.js",
  "js/vendor/three/addons/shaders/LuminosityHighPassShader.js",
  "js/vendor/three/addons/shaders/OutputShader.js",
  "js/vendor/three/three.module.js",
  "nivel2/index.html",
  "nivel2/nivel2.css",
  "nivel2/nivel2.js",
  "nivel2/textos.js",
  "nivel3/aria.js",
  "nivel3/index.html",
  "nivel3/nivel3.css",
  "nivel3/nivel3.js",
  "nivel3/textos.js",
  "nivel3/vuelo.js",
  "simulador/ascenso.js",
  "simulador/cohetes.json",
  "simulador/embed.js",
  "simulador/escena.js",
  "simulador/index.html",
  "simulador/modelos/atlas-agena-d.js",
  "simulador/modelos/falcon-heavy.js",
  "simulador/modelos/index.js",
  "simulador/modelos/saturno-v.js",
  "simulador/pilotaje/cabina.js",
  "simulador/pilotaje/cuerpos-datos.js",
  "simulador/pilotaje/cuerpos.js",
  "simulador/pilotaje/destinos.js",
  "simulador/pilotaje/fisica.js",
  "simulador/pilotaje/index.html",
  "simulador/pilotaje/mision.js",
  "simulador/pilotaje/pilotaje.css",
  "simulador/pilotaje/textos.js",
  "simulador/simulador.css",
  "simulador/simulador.js",
  "simulador/textos.js",
];
const PESADOS = [
  "simulador/modelos/originales/atlas-agena-d/atlas-agena-assembled.html",
  "simulador/modelos/originales/atlas-agena-d/atlas-agena-exploded.html",
  "simulador/modelos/originales/atlas-agena-d/index.html",
  "simulador/modelos/originales/falcon-heavy/falcon-heavy-assembled.html",
  "simulador/modelos/originales/falcon-heavy/falcon-heavy-exploded.html",
  "simulador/modelos/originales/falcon-heavy/index.html",
  "simulador/modelos/originales/saturno-v/apollo11-assembled.html",
  "simulador/modelos/originales/saturno-v/apollo11-exploded.html",
  "simulador/modelos/originales/saturno-v/index.html",
  "simulador/texturas/europa-color-4k.jpg",
  "simulador/texturas/luna-albedo-4k.jpg",
  "simulador/texturas/luna-relieve-2k.jpg",
  "simulador/texturas/marte-color-4k.jpg",
  "simulador/texturas/marte-relieve-2k.png",
  "simulador/texturas/tierra-color-4k.jpg",
  "simulador/texturas/tierra-noche-2k.jpg",
  "simulador/texturas/tierra-nubes-2k.jpg",
];
/* PRECACHE:FIN */

const CACHE = `eo-${VERSION}`;
const ESPERA_RED_MS = 4000; // si la red no responde en este tiempo se usa el caché (wifi de evento, red cautiva)

const enRaiz = (ruta) => new URL(ruta, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Núcleo y recursos pesados (texturas 4k): ninguna falla individual impide instalar el service worker.
    for (const lista of [NUCLEO, PESADOS]) {
      const res = await Promise.allSettled(lista.map((r) => cache.add(new Request(enRaiz(r), { cache: 'reload' }))));
      res.forEach((x, i) => { if (x.status === 'rejected') console.warn('[sw] no se pudo guardar', lista[i]); });
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('eo-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const conTiempo = (promesa, ms) => new Promise((ok, mal) => {
  const t = setTimeout(() => mal(new Error('tiempo agotado')), ms);
  promesa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); mal(e); });
});

async function responder(req) {
  const cache = await caches.open(CACHE);
  try {
    const resp = await conTiempo(fetch(req), ESPERA_RED_MS);
    if (resp.ok && resp.status === 200 && resp.type === 'basic') cache.put(req, resp.clone());
    return resp;
  } catch (err) {
    // ignoreSearch: «pilotaje.css?v=9» y «pilotaje.css» son el mismo archivo
    const guardado = await cache.match(req, { ignoreSearch: true });
    if (guardado) return guardado;
    if (req.mode === 'navigate') {
      const pagina = await cache.match(new URL(new URL(req.url).pathname.replace(/[^/]*$/, 'index.html'), self.registration.scope).href, { ignoreSearch: true })
        || await cache.match(enRaiz('index.html'));
      if (pagina) return pagina;
    }
    return new Response('Sin conexión y este recurso no está guardado.', { status: 503, statusText: 'Sin conexión', headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.endsWith('/sw.js')) return;
  event.respondWith(responder(req));
});
