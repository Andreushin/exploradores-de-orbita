// OWNER: Rol 3 (@JU4NMAX) — Simulador de pilotaje · cabina: controles, HUD, radar 2D, asistente paso a paso, briefing y resultado.
// La física vive en mision.js (probada en Node) y la vista 3D en cuerpos.js. Si el navegador no tiene WebGL,
// todo lo demás (radar 2D, instrumentos, registro, lugares, resultado) sigue funcionando.
import * as M from './mision.js?v=9';
import * as F from './fisica.js?v=9';
import { DESTINOS } from './destinos.js?v=9';
import { CUERPOS } from './cuerpos-datos.js?v=9';
import { TEXTOS } from './textos.js?v=10';
// Modo incrustado (Nivel 3, tras los asteroides): ?destino=…&lock=1&embed=1. Ver ../embed.js.
import { leerParametrosPilotaje, mensajePilotaje, SIM_LANG } from '../embed.js';

for (const k of Object.keys(DESTINOS)) {
  if (DESTINOS[k]) DESTINOS[k].jugable = true;
}

const $ = (id) => document.getElementById(id);
const reducirMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const nf = (n, d = 0) => Number(n).toLocaleString(lang() === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const LLAVE_IDIOMA = 'srl-lang';
const ORDEN_MISIONES = ['luna', 'marte', 'europa'];
const COHETE_CORTO = {
  'saturno-v': 'Saturno V',
  'atlas-agena-d': 'Atlas-Agena D',
  'falcon-heavy': 'Falcon Heavy',
};

let idioma = (() => { try { return localStorage.getItem(LLAVE_IDIOMA) === 'en' ? 'en' : 'es'; } catch { return 'es'; } })();
function lang() { return idioma; }
function t(clave, vars = {}) {
  const get = (l) => clave.split('.').reduce((o, k) => o?.[k], TEXTOS[l]);
  const v = get(idioma) ?? get('es') ?? clave;
  return String(v).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}
const tx = (o) => (o && typeof o === 'object' ? o[idioma] ?? o.es : o ?? '');
const nombreCoheteCorto = (id) => COHETE_CORTO[id] || id || 'Cohete';

// --- Estado de la cabina ---------------------------------------------------------------
const modo = (() => {
  try { return leerParametrosPilotaje(location.search, Object.keys(DESTINOS)); } catch { return { destino: null, lock: false, embed: false }; }
})();
let destinoActual = modo.destino ?? 'luna';
let m;                 // misión activa
let escena = null;     // vista 3D (null sin WebGL)
let pausado = false;   // empieza en vivo desde el primer segundo (sin bloqueo modal)
let escalaManual = false;
let registro = [];     // { texto, tipo }
let objetivo = null;   // lugar al que apunta el piloto «hacia el lugar»
let faseAnterior = 'espera';
let senalAnterior = true;
let finMostrado = false;
let giroManual = false; // el jugador ya giró la nave a mano en esta misión (deja de seguir la trayectoria sola)
let cuadroN = 0;
let ultimoReal = 0;
let timerDescubrimiento = null;
let ultimaFirmaAsistente = '';
let ultimaFirmaLugares = '';
let ultimoDisparoAccion = 0;
let estadoLlegadaReserva = null;
let secuenciaCaptura = {
  activa: false,
  tInicioPeri: 1,
  dvTotalQuema: 1,
  dvInicioQuema: 0,
  etapa: 1, // 1: giro retrógrado, 2: descenso a PE, 3: quema de inserción
  progreso: 0,
};
const teclas = new Set();
const arrastre = { activo: false, x: 0, y: 0, dx: 0, dy: 0 };
const botonesMantenidos = { motor: false, reversa: false };

// --- Sonido (WebAudio, sintetizado: sin archivos) ----------------------------------------------
const audio = { ctx: null, gan: null, mudo: false };
function iniciarAudio() {
  if (audio.ctx || typeof AudioContext === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const fuente = ctx.createBufferSource(); fuente.buffer = buf; fuente.loop = true;
    const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 220;
    const gan = ctx.createGain(); gan.gain.value = 0;
    fuente.connect(filtro).connect(gan).connect(ctx.destination); fuente.start();
    audio.ctx = ctx; audio.gan = gan;
  } catch { /* sin audio: no pasa nada */ }
}
function sonidoMotor(on) { if (audio.gan && !audio.mudo) audio.gan.gain.setTargetAtTime(on ? 0.22 : 0, audio.ctx.currentTime, 0.08); }
function pitido(freq = 880) {
  if (!audio.ctx || audio.mudo) return;
  const o = audio.ctx.createOscillator(); const g = audio.ctx.createGain();
  o.frequency.value = freq; g.gain.value = 0.08; g.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + 0.35);
  o.connect(g).connect(audio.ctx.destination); o.start(); o.stop(audio.ctx.currentTime + 0.36);
}

// --- Registro y Descubrimientos ----------------------------------------------------------------------
function anotar(texto, tipo = '') {
  registro.push({ texto, tipo });
  if (registro.length > 40) registro.shift();
  const ol = $('pil-registro');
  if (!ol) return;
  ol.replaceChildren(...registro.slice(-6).map((r) => {
    const li = document.createElement('li');
    li.textContent = r.texto;
    if (r.tipo) li.className = r.tipo;
    return li;
  }));
  ol.parentElement.scrollTop = 1e6;
}

function mostrarDescubrimiento(lugar, calidad) {
  const card = $('pil-descubrimiento');
  if (!card || !lugar) return;
  card.hidden = false;
  card.innerHTML = `
    <h4>📡 ★ ${tx(lugar.nombre)} · ${nf(calidad * 100)} %</h4>
    <p>${tx(lugar.dato)}</p>`;
  clearTimeout(timerDescubrimiento);
  timerDescubrimiento = setTimeout(() => { card.hidden = true; }, 6500);
}

// --- Selector de Misiones y Textos Estáticos ---------------------------------------------------------
function pintarSelectorMisiones() {
  const nav = $('pil-selector-misiones');
  if (!nav) return;
  // Con la misión fijada (lock) solo se ve la del juego, sin poder cambiarla
  const ids = modo.lock ? [m.destino] : ORDEN_MISIONES;
  nav.replaceChildren(...ids.map((id) => {
    const idx = ORDEN_MISIONES.indexOf(id);
    const d = DESTINOS[id];
    const c = CUERPOS[d.cuerpo];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pil-tab-mision${id === m.destino ? ' activa' : ''}`;
    b.dataset.destino = id;
    b.innerHTML = `<span>${modo.lock ? '🔒' : d.icono || '🪐'}</span><span>${modo.lock ? '' : `${idx + 1}. `}${tx(c.nombre)}</span><small>🚀 ${nombreCoheteCorto(d.cohete)}</small>`;
    if (modo.lock) {
      b.classList.add('bloqueada');
      b.setAttribute('aria-disabled', 'true');
      b.title = t('misionFijada');
      return b;
    }
    const activar = (e) => {
      e.preventDefault();
      const ahora = performance.now();
      if (ahora - ultimoDisparoAccion < 220) return;
      ultimoDisparoAccion = ahora;
      cambiarMision(id, { abrirBriefing: false });
    };
    b.addEventListener('pointerdown', activar);
    b.addEventListener('click', activar);
    return b;
  }));
}

/**
 * Coloca el cohete a una distancia de aproximación cercana (~58 s antes del encendido en PE)
 * usando pasos keplerianos ligeros (< 1 ms) para que desde el primer segundo el planeta 4K se vea
 * grande y en movimiento frente al cohete, guardando un punto de respaldo para capturar siempre sin fallos.
 */
function prepararLlegadaVisible(mObj) {
  // El recorrido EMPIEZA LEJOS (llegada.radiosIniciales: 3,5–4 radios), con el cuerpo completo a la vista; el cohete
  // se acerca en una aproximación acelerada (actualizarCinematicaVuelo). Aparte se calcula, sobre una copia, el punto
  // de respaldo cercano (~58 s antes del encendido en PE) para reponer la aproximación si el cohete se pasa del frenado.
  const orientar = orientarPrograda;
  const copia = { ...mObj, r: [...mObj.r], v: [...mObj.v] };
  let pasos = 0;
  while (pasos < 3000) {
    const df = M.datosFrenado(copia);
    if (df.yaPaso || df.tParaEncendido <= 58) break;
    const h = Math.max(1, Math.min(12, (df.tParaEncendido - 56) * 0.5));
    const s = F.paso({ r: copia.r, v: copia.v }, copia.cuerpo.mu, h);
    copia.r = s.r;
    copia.v = s.v;
    copia.t += h;
    pasos++;
  }
  orientar(copia);
  orientar(mObj);
  mObj.escala = ESCALA_LLEGADA_MIN;
  estadoLlegadaReserva = {
    t: copia.t,
    r: [...copia.r],
    v: [...copia.v],
    fwd: [...copia.fwd],
    up: [...copia.up],
  };
}

/** Nariz hacia donde va la nave (prógrado) y «arriba» hacia el cuerpo. */
function orientarPrograda(o) {
  const vUnit = F.unitario(o.v);
  const haciaCuerpo = F.esc(F.unitario(o.r), -1);
  o.fwd = vUnit;
  o.up = F.unitario(F.resta(haciaCuerpo, F.esc(vUnit, F.punto(haciaCuerpo, vUnit))));
}

// Aproximación acelerada: el tiempo corre rápido lejos (el cuerpo crece en pantalla) y se frena al llegar.
// escala = tiempo que falta al encendido / ESCALA_LLEGADA_DIV, entre ×8 y ×300 → ≈20 s reales desde 4 radios.
const ESCALA_LLEGADA_MIN = 8;
const ESCALA_LLEGADA_MAX = 300;
const ESCALA_LLEGADA_DIV = 3;

function restaurarLlegadaSiYaPaso(umbralSeg = 32) {
  const el = M.elementosActuales(m);
  if (el.ligada || !estadoLlegadaReserva) return;
  const df = M.datosFrenado(m);
  if (df.yaPaso || df.tParaEncendido < umbralSeg || m.fin) {
    m.t = estadoLlegadaReserva.t;
    m.r = [...estadoLlegadaReserva.r];
    m.v = [...estadoLlegadaReserva.v];
    m.fwd = [...estadoLlegadaReserva.fwd];
    m.up = [...estadoLlegadaReserva.up];
    m.fin = null;
    m.motor = 0;
    m.captura = { fase: 'espera' };
  }
}

function actualizarBotonVista() {
  const b = $('pil-b-vista');
  if (!b) return;
  const modo = escena?.modoVista ?? 'orbita';
  b.textContent = modo === 'orbita' ? t('vistas.orbita') : t('vistas.cabina');
}

function textosEstaticos() {
  document.documentElement.lang = idioma;
  document.title = `${t('titulo')} · ${idioma === 'es' ? 'Exploradores de Órbita' : 'Orbit Explorers'}`;
  $('pil-marca').textContent = idioma === 'es' ? 'Exploradores de Órbita' : 'Orbit Explorers';
  $('pil-idioma').textContent = t('idioma');
  $('pil-idioma').setAttribute('aria-label', t('idiomaEtiqueta'));
  $('pil-nombre-mision').textContent = `${tx(m.dest.mision.nombre)} → ${tx(m.cuerpo.nombre)} (${nombreCoheteCorto(m.dest.cohete)})`;
  $('pil-pie').textContent = t('simplificadoPie');
  if ($('pil-b-ficha')) $('pil-b-ficha').textContent = t('vistas.ficha');
  if ($('pil-radar-titulo')) $('pil-radar-titulo').textContent = t('radar.titulo');
  if ($('pil-leyenda-pe')) $('pil-leyenda-pe').textContent = t('radar.leyendaPe');
  if ($('pil-leyenda-obj')) $('pil-leyenda-obj').textContent = t('radar.leyendaObj');
  actualizarBotonVista();
  ultimaFirmaAsistente = '';
  ultimaFirmaLugares = '';
  pintarSelectorMisiones();
  pintarBotones();
  pintarAsistente(true);
  pintarLugares(true);
  pintarHUD();
}

// --- Botones inferiores ------------------------------------------------------------------------------------
function pintarBotones() {
  const nav = $('pil-botones');
  nav.replaceChildren();
  const b = (id, texto, onClick, { mantener = null, titulo = '', clase = '' } = {}) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `pil-btn ${clase}`.trim();
    el.id = `pil-b-${id}`;
    el.textContent = texto;
    if (titulo) el.title = titulo;
    if (mantener) {
      const on = (v) => (e) => { e.preventDefault(); if (v) reanudarVuelo(); botonesMantenidos[mantener] = v; el.classList.toggle('activo', v); };
      el.addEventListener('pointerdown', on(true)); el.addEventListener('pointerup', on(false));
      el.addEventListener('pointerleave', on(false)); el.addEventListener('pointercancel', on(false));
    } else {
      const disparar = (e) => {
        e.preventDefault();
        const ahora = performance.now();
        if (ahora - ultimoDisparoAccion < 220) return;
        ultimoDisparoAccion = ahora;
        onClick?.(e);
      };
      el.addEventListener('pointerdown', disparar);
      el.addEventListener('click', disparar);
    }
    nav.append(el);
    return el;
  };
  b('captura', `${t('botones.captura')} (C)`, accionCapturar, { clase: 'info' });
  b('lugar', `${t('botones.lugar')} (4)`, () => accionPiloto('lugar'));
  b('escanear', `${t('botones.escanear')} (␣)`, accionEscanear, { clase: 'exito' });
  b('motor', `${t('botones.motor')} (W)`, null, { mantener: 'motor' });
  b('reversa', `${t('botones.reversa')} (S)`, null, { mantener: 'reversa' });
  b('menos', `${t('botones.menos')} (Z)`, () => { reanudarVuelo(); escalaManual = true; secuenciaCaptura.activa = false; M.ciclarEscala(m, -1); pintarHUD(); });
  b('mas', `${t('botones.mas')} (X)`, () => { reanudarVuelo(); escalaManual = true; secuenciaCaptura.activa = false; M.ciclarEscala(m, +1); pintarHUD(); });
  b('pausa', `${pausado ? t('log.seguir') : t('log.pausa')} (P)`, alternarPausa);
  b('terminar', `${t('botones.terminar')} (R)`, accionTerminar);
}

function reanudarVuelo() {
  if ($('pil-briefing')?.open) cerrar($('pil-briefing'));
  if (pausado) {
    pausado = false;
    ultimoReal = 0;
    const b = $('pil-b-pausa');
    if (b) b.textContent = `${t('log.pausa')} (P)`;
  }
}

// --- Acciones del jugador ----------------------------------------------------------------------------------
function siguienteObjetivo() {
  const pend = m.dest.lugares.filter((l) => !m.observados.some((o) => o.id === l.id));
  if (!pend.length) return null;
  const i = pend.findIndex((l) => l.id === objetivo);
  return pend[(i + 1) % pend.length].id;
}

function seleccionarLugar(id) {
  if (!id) return;
  reanudarVuelo();
  objetivo = id;
  secuenciaCaptura.activa = false;
  M.fijarPiloto(m, 'lugar', objetivo);
  pintarAsistente();
  pintarLugares();
}

function accionPiloto(modo) {
  reanudarVuelo();
  secuenciaCaptura.activa = false;
  if (modo !== 'lugar') { M.fijarPiloto(m, modo); pintarHUD(); return; }
  const pend = m.dest.lugares.filter((l) => !m.observados.some((o) => o.id === l.id));
  if (!pend.length) { M.fijarPiloto(m, null); return; }
  const vigente = objetivo && pend.some((l) => l.id === objetivo);
  objetivo = vigente && m.piloto === 'lugar' ? siguienteObjetivo() : (vigente ? objetivo : pend[0].id);
  M.fijarPiloto(m, 'lugar', objetivo);
  pintarAsistente();
  pintarLugares();
}

function accionCapturar() {
  iniciarAudio();
  reanudarVuelo();
  restaurarLlegadaSiYaPaso(36);
  M.capturarOrbita(m);

  // Asegura vista 3D exterior centrada en cohete + planeta para ver toda la maniobra de inserción
  if (escena) {
    escena.fijarModoVista('orbita');
    escena.centrarVistaOrbita();
    actualizarBotonVista();
  }

  const df = M.datosFrenado(m);
  secuenciaCaptura = {
    activa: true,
    tInicioPeri: Math.max(1, df.tParaEncendido || 50),
    dvTotalQuema: Math.max(1, df.dvNec || 800),
    dvInicioQuema: m.dvUsado,
    etapa: 1,
    progreso: 0.08,
  };
  m.escala = 6;

  anotar(t('log.captura'));
  pitido(520);
  pintarAsistente(true);
  pintarHUD();
}

function accionSaltarAFrenado() {
  iniciarAudio();
  reanudarVuelo();
  restaurarLlegadaSiYaPaso(36);
  M.adelantarAFrenado(m);
  // Garantiza que la nave quede alineada retrógrada al saltar directo al punto PE
  const retro = F.esc(F.unitario(m.v), -1);
  const haciaCuerpo = F.esc(F.unitario(m.r), -1);
  m.fwd = retro;
  m.up = F.unitario(F.resta(haciaCuerpo, F.esc(retro, F.punto(haciaCuerpo, retro))));
  const df = M.datosFrenado(m);
  secuenciaCaptura = {
    activa: true,
    tInicioPeri: Math.max(1, df.tParaEncendido || 18),
    dvTotalQuema: Math.max(1, df.dvNec || 800),
    dvInicioQuema: m.dvUsado,
    etapa: 2,
    progreso: 0.85,
  };
  if (escena) {
    escena.fijarModoVista('orbita');
    escena.centrarVistaOrbita();
    escena.actualizar();
    actualizarBotonVista();
  }
  anotar(t('log.viajeFrenado'), 'ok');
  pitido(600);
  pintarAsistente(true);
  pintarHUD();
  pintarLugares(true);
}

function accionViajarALugar(id) {
  iniciarAudio();
  reanudarVuelo();
  const targetId = id || objetivo || m.dest.lugares.find((l) => !m.observados.some((o) => o.id === l.id))?.id;
  if (!targetId) return;
  objetivo = targetId;
  secuenciaCaptura.activa = false;
  const l = m.dest.lugares.find((x) => x.id === targetId);
  anotar(t('log.viajeLugar', { lugar: tx(l?.nombre) }));
  M.adelantarALugar(m, targetId);
  escena?.actualizar();
  pitido(740);
  pintarAsistente();
  pintarLugares();
  pintarHUD();
}

function registrarEscaneoExitoso(lugar, calidad) {
  anotar(t('log.escanear', { lugar: tx(lugar.nombre), calidad: nf(calidad * 100) }), 'ok');
  pitido(1040);
  mostrarDescubrimiento(lugar, calidad);
  // Apunta automáticamente al siguiente lugar pendiente si queda alguno
  const pend = m.dest.lugares.find((l) => !m.observados.some((o) => o.id === l.id));
  if (pend) {
    objetivo = pend.id;
    M.fijarPiloto(m, 'lugar', objetivo);
  } else {
    objetivo = null;
  }
  pintarAsistente();
  pintarLugares();
}

function accionEscanear() {
  iniciarAudio();
  reanudarVuelo();
  const r = M.escanear(m);
  if (r.ok) {
    registrarEscaneoExitoso(r.lugar, r.calidad);
  } else {
    anotar(t('log.escanearNada'), 'mal');
    pitido(300);
  }
}

function accionTerminar() { reanudarVuelo(); M.terminar(m); }

function alternarPausa() {
  pausado = !pausado;
  const b = $('pil-b-pausa');
  if (b) b.textContent = `${pausado ? t('log.seguir') : t('log.pausa')} (P)`;
}

function alternarVista() {
  if (!escena) return;
  const nuevo = escena.modoVista === 'orbita' ? 'cabina' : 'orbita';
  escena.fijarModoVista(nuevo);
  actualizarBotonVista();
}

function cambiarMision(nuevoDestinoId, { abrirBriefing = false } = {}) {
  if (!DESTINOS[nuevoDestinoId]) return;
  if (modo.lock && m && nuevoDestinoId !== m.destino) return; // la misión del juego no se cambia (repetir sí)
  destinoActual = nuevoDestinoId;
  cerrar($('pil-resultado'));
  if (!abrirBriefing) cerrar($('pil-briefing'));
  m = M.crearMision(destinoActual);
  prepararLlegadaVisible(m);
  escalaManual = false;
  secuenciaCaptura = { activa: false, tInicioPeri: 1, dvTotalQuema: 1, dvInicioQuema: 0, etapa: 1, progreso: 0 };
  registro = [];
  finMostrado = false;
  giroManual = false;
  faseAnterior = 'espera';
  senalAnterior = true;
  objetivo = m.dest.lugares[0]?.id ?? null;
  if ($('pil-descubrimiento')) $('pil-descubrimiento').hidden = true;
  escena?.reiniciar(m);
  textosEstaticos();
  anotar(t('log.inicio', { cuerpo: tx(m.cuerpo.nombre), cohete: nombreCoheteCorto(m.dest.cohete) }));
  if (abrirBriefing) {
    pausado = true;
    mostrarBriefing();
  } else {
    pausado = false;
    ultimoReal = 0;
    const b = $('pil-b-pausa');
    if (b) b.textContent = `${t('log.pausa')} (P)`;
  }
}

// --- Teclado y ratón -----------------------------------------------------------------------------------------
function alPresionar(e) {
  if ($('pil-resultado')?.open) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if ($('pil-briefing')?.open) {
    if (k === 'Enter' || k === ' ') { e.preventDefault(); empezar(); return; }
    if (!['c', 'w', 's', '1', '2', '3', '4', 'v'].includes(k)) return;
    empezar();
  }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (['w', 's', 'a', 'd', 'q', 'e', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) reanudarVuelo();
  if (e.repeat) { teclas.add(k); return; }
  teclas.add(k);
  switch (k) {
    case 'c': accionCapturar(); break;
    case ' ': accionEscanear(); break;
    case 'v': alternarVista(); break;
    case '1': reanudarVuelo(); secuenciaCaptura.activa = false; M.fijarPiloto(m, 'progrado'); break;
    case '2': reanudarVuelo(); secuenciaCaptura.activa = false; M.fijarPiloto(m, 'retrogrado'); break;
    case '3': reanudarVuelo(); secuenciaCaptura.activa = false; M.fijarPiloto(m, 'planeta'); break;
    case '4': accionPiloto('lugar'); break;
    case '0': reanudarVuelo(); secuenciaCaptura.activa = false; M.fijarPiloto(m, null); break;
    case 'z': reanudarVuelo(); escalaManual = true; secuenciaCaptura.activa = false; M.ciclarEscala(m, -1); pintarHUD(); break;
    case 'x': reanudarVuelo(); escalaManual = true; secuenciaCaptura.activa = false; M.ciclarEscala(m, +1); pintarHUD(); break;
    case 'p': alternarPausa(); break;
    case 'r': accionTerminar(); break;
    default:
  }
}
const alSoltar = (e) => teclas.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);

function controles() {
  const k = (...n) => n.some((x) => teclas.has(x));
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  let guinada = (k('ArrowRight', 'd') ? 1 : 0) - (k('ArrowLeft', 'a') ? 1 : 0);
  let cabeceo = (k('ArrowUp') ? 1 : 0) - (k('ArrowDown') ? 1 : 0);
  const alabeo = (k('e') ? 1 : 0) - (k('q') ? 1 : 0);
  if (arrastre.dx || arrastre.dy) {
    if (escena && escena.modoVista === 'orbita') {
      escena.rotarVistaOrbita(arrastre.dx, arrastre.dy);
    } else {
      guinada = clamp(guinada + arrastre.dx / 12);
      cabeceo = clamp(cabeceo - arrastre.dy / 12);
    }
    arrastre.dx = 0; arrastre.dy = 0;
  }
  const motor = (k('w') || botonesMantenidos.motor ? 1 : 0) - (k('s') || botonesMantenidos.reversa ? 1 : 0);
  return { guinada, cabeceo, alabeo, motor };
}

// --- Cinemática de 3 Fases para la Inserción Orbital Automática ----------------------------------------------
/** @param {{guinada?:number, cabeceo?:number, alabeo?:number}} c controles del jugador en este cuadro */
function actualizarCinematicaVuelo(c = {}) {
  const el = M.elementosActuales(m);

  // 1) Si el piloto automático de captura está activo, animamos las 3 fases con claridad total
  if (m.piloto === 'captura') {
    const retro = F.esc(F.unitario(m.v), -1);
    const dot = Math.max(-1, Math.min(1, F.punto(F.unitario(m.fwd), retro)));
    const errGrados = (Math.acos(dot) * 180) / Math.PI;
    const df = M.datosFrenado(m);
    const tEnc = Number.isFinite(df.tParaEncendido) ? df.tParaEncendido : 30;
    const tQ = Number.isFinite(df.tQuema) ? df.tQuema : 200;

    if (m.captura.fase === 'espera') {
      if (errGrados > 5) {
        // Fase 1/3: Giro retrógrado ágil (~1.0 s real) con escala suave (×6) para no comerse el tiempo al PE
        secuenciaCaptura.etapa = 1;
        secuenciaCaptura.progreso = Math.max(0.08, Math.min(0.98, 1 - errGrados / 180));
        m.escala = 6;
      } else {
        // Fase 2/3: Deslizamiento fluido hasta el anillo dorado PE en ~1.3 segundos reales
        if (secuenciaCaptura.etapa < 2) {
          secuenciaCaptura.etapa = 2;
          secuenciaCaptura.tInicioPeri = Math.max(1, tEnc);
          pitido(660);
        }
        secuenciaCaptura.progreso = Math.max(0.06, Math.min(0.99, 1 - tEnc / Math.max(1, secuenciaCaptura.tInicioPeri)));
        // Desde lejos (inicio a 3,5–4 radios) puede faltar más de una hora de misión: hasta ×300 para no hacerse eterno
        m.escala = Math.max(15, Math.min(ESCALA_LLEGADA_MAX, Math.round(tEnc / 1.3)));
      }
    } else if (m.captura.fase === 'quemando') {
      // Fase 3/3: Quema del motor principal en el Periapsis (~2.2 segundos reales con llama 3D y vibración)
      if (secuenciaCaptura.etapa < 3) {
        secuenciaCaptura.etapa = 3;
        secuenciaCaptura.dvInicioQuema = m.dvUsado;
        secuenciaCaptura.dvTotalQuema = Math.max(1, Number.isFinite(df.dvNec) ? df.dvNec : 800);
      }
      const quemado = Math.max(0, m.dvUsado - secuenciaCaptura.dvInicioQuema);
      secuenciaCaptura.progreso = Math.max(0.06, Math.min(0.99, quemado / Math.max(1, secuenciaCaptura.dvTotalQuema)));
      m.escala = Math.max(15, Math.min(85, Math.round(tQ / 2.2)));
    }
    return;
  }

  // 2) Durante la aproximación sin piloto de captura: rápida lejos y fluida (×8) cerca del PE.
  // Si el usuario está explorando la cámara o leyendo los paneles y la nave se acerca demasiado al PE,
  // reponemos automáticamente la aproximación para que los botones de misión funcionen siempre
  if (!el.ligada && m.motor === 0) {
    const df = M.datosFrenado(m);
    if (df.yaPaso || df.tParaEncendido <= 32) {
      restaurarLlegadaSiYaPaso(36);
    } else if (!escalaManual) {
      m.escala = Math.round(Math.max(ESCALA_LLEGADA_MIN, Math.min(ESCALA_LLEGADA_MAX, df.tParaEncendido / ESCALA_LLEGADA_DIV)));
    }
    // En la aproximación libre la nariz sigue la trayectoria (si no, al curvarse hacia el cuerpo la cámara miraría al vacío),
    // hasta que el jugador gire la nave a mano: desde ahí se respeta su orientación
    if (c.guinada || c.cabeceo || c.alabeo) giroManual = true;
    if (m.piloto === null && !giroManual) orientarPrograda(m);
  }
}

// --- Asistente Paso a Paso (Centro Superior) ------------------------------------------------------------------
function pintarAsistente(forzar = false) {
  const cont = $('pil-asistente');
  if (!cont) return;
  const obj = M.objetivoActual(m);
  const el = M.elementosActuales(m);
  const obsN = m.observados.length;
  const enOrbita = el.ligada && el.apoapsis <= M.apoObjetivo(m) * 1.25;
  const completa = obsN === m.dest.lugares.length && enOrbita;
  const coheteNom = nombreCoheteCorto(m.dest.cohete);

  let lugarAct = null;
  let condCumple = false;
  if (obj.clave === 'observar') {
    lugarAct = m.dest.lugares.find((l) => l.id === objetivo && !m.observados.some((o) => o.id === l.id)) || obj.lugar;
    if (lugarAct && objetivo !== lugarAct.id) objetivo = lugarAct.id;
    condCumple = Boolean(lugarAct && M.condiciones(m, lugarAct).cumple);
  }

  const et = obj.quemando ? 3 : secuenciaCaptura.etapa || 2;
  const pct = Math.round((secuenciaCaptura.progreso || 0.25) * 100);
  const mostrarBtnSaltarSec = Boolean(et === 2 && obj.tParaEncendido > 20);

  // Firma de estado estructural: evitamos reconstruir innerHTML en cada frame para no destruir botones mientras se hace clic
  const firma = [
    m.destino,
    enOrbita ? 1 : 0,
    obsN,
    completa ? 1 : 0,
    obj.clave,
     Boolean(obj.urgente) ? 1 : 0,
    m.piloto ?? '',
    Boolean(obj.quemando) ? 1 : 0,
    et,
    mostrarBtnSaltarSec ? 1 : 0,
    objetivo ?? '',
    condCumple ? 1 : 0,
    idioma,
  ].join('|');

  if (!forzar && firma === ultimaFirmaAsistente) {
    const barra = cont.querySelector('.pil-sec-barra i');
    if (barra) barra.style.width = `${pct}%`;
    return;
  }
  ultimaFirmaAsistente = firma;

  const p1Cls = enOrbita ? 'hecho' : 'activo';
  const p2Cls = completa ? 'hecho' : enOrbita ? 'activo' : '';
  const p3Cls = completa ? 'activo hecho' : '';

  let titulo = '';
  let texto = '';
  let botonesHTML = '';
  let extraHTML = '';
  let estadoCls = '';

  if (obj.clave === 'frenar' || obj.clave === 'bajarAlto' || obj.clave === 'subirBajo') {
    if (m.piloto === 'captura' || obj.quemando) {
      estadoCls = 'secuencia';
      const altPeKm = nf(m.dest.llegada.alturaPeriapsisKm, 0);
      if (et === 1) {
        titulo = t('asistente.secFase1Titulo');
        texto = t('asistente.secFase1Sub', { cohete: coheteNom, cuerpo: tx(m.cuerpo.nombre) });
      } else if (et === 2) {
        titulo = t('asistente.secFase2Titulo');
        texto = t('asistente.secFase2Sub', { altPe: altPeKm, cuerpo: tx(m.cuerpo.nombre) });
      } else {
        titulo = t('asistente.secFase3Titulo');
        texto = t('asistente.secFase3Sub', { cuerpo: tx(m.cuerpo.nombre) });
      }
      const c1 = et > 1 ? 'ok' : 'on';
      const c2 = et > 2 ? 'ok' : et === 2 ? 'on' : '';
      const c3 = et === 3 ? 'on' : '';
      extraHTML = `
        <div class="pil-sec-fases">
          <span class="pil-sec-chip ${c1}">${et > 1 ? '✔ ' : '🎯 '}1. Alineación</span>
          <span class="pil-sec-chip ${c2}">${et > 2 ? '✔ ' : '⏩ '}2. Rumbo a PE</span>
          <span class="pil-sec-chip ${c3}">🔥 3. Frenado PE</span>
        </div>
        <div class="pil-sec-barra"><i style="width:${pct}%"></i></div>`;
      if (mostrarBtnSaltarSec) {
        botonesHTML = `<button type="button" class="pil-btn pil-btn-sm principal" data-accion="saltar-frenado">${t('asistente.btnSaltarFrenado')}</button>`;
      }
    } else {
      titulo = t('asistente.frenarTitulo', { cuerpo: tx(m.cuerpo.nombre).toUpperCase(), cohete: coheteNom });
      texto = t('asistente.frenarTexto', { cohete: coheteNom });
      if (obj.urgente) estadoCls = 'urgente';
      botonesHTML = `
        <button type="button" class="pil-btn pil-btn-sm principal" data-accion="capturar">${t('asistente.btnCapturar')}</button>
        <button type="button" class="pil-btn pil-btn-sm info" data-accion="saltar-frenado">${t('asistente.btnSaltarFrenado')}</button>`;
    }
  } else if (obj.clave === 'observar') {
    if (condCumple) {
      estadoCls = 'listo';
      titulo = t('asistente.listoEscanearTitulo', { lugar: tx(lugarAct.nombre) });
      texto = t('asistente.listoEscanearTexto');
      botonesHTML = `<button type="button" class="pil-btn pil-btn-sm exito" data-accion="escanear">${t('asistente.btnEscanearAhora', { lugar: tx(lugarAct.nombre) })}</button>`;
    } else {
      titulo = t('asistente.orbitaTitulo', { obs: obsN });
      texto = t('asistente.orbitaTexto', { lugar: tx(lugarAct.nombre) });
      botonesHTML = `
        <button type="button" class="pil-btn pil-btn-sm principal" data-accion="viajar-lugar" data-id="${lugarAct.id}">${t('asistente.btnViajarLugar', { lugar: tx(lugarAct.nombre) })}</button>
        <button type="button" class="pil-btn pil-btn-sm info" data-accion="apuntar-lugar" data-id="${lugarAct.id}">${t('asistente.btnApuntar', { lugar: tx(lugarAct.nombre) })}</button>`;
    }
  } else {
    estadoCls = 'listo';
    titulo = t('asistente.completaTitulo');
    texto = t('asistente.completaTexto', { cuerpo: tx(m.cuerpo.nombre) });
    const sigId = ORDEN_MISIONES[(ORDEN_MISIONES.indexOf(m.destino) + 1) % ORDEN_MISIONES.length];
    const sigNombre = tx(CUERPOS[DESTINOS[sigId].cuerpo].nombre);
    botonesHTML = `
      <button type="button" class="pil-btn pil-btn-sm exito" data-accion="terminar">${t('asistente.btnVerInforme')}</button>
      ${modo.lock ? '' : `<button type="button" class="pil-btn pil-btn-sm info" data-accion="cambiar-mision" data-destino="${sigId}">${t('asistente.btnSiguienteMision', { sig: sigNombre })}</button>`}`;
  }

  cont.className = `pil-asistente ${estadoCls}`.trim();
  cont.innerHTML = `
    <div class="pil-pasos">
      <span class="pil-paso ${p1Cls}">${enOrbita ? '✔ ' : ''}${t('asistente.paso1')}</span>
      <span class="pil-paso ${p2Cls}">${obsN === 3 ? '✔ ' : ''}${t('asistente.paso2')} (${obsN}/3)</span>
      <span class="pil-paso ${p3Cls}">${completa ? '🏆 ' : ''}${t('asistente.paso3')}</span>
    </div>
    <div class="pil-asist-cuerpo">
      <div class="pil-asist-txt">
        <strong>${titulo}</strong>
        <p>${texto}</p>
        ${extraHTML}
      </div>
      <div class="pil-asist-botones">${botonesHTML}</div>
    </div>`;
}

// --- Instrumentos (HUD, Lugares, Radar 2D, Mira y Etiquetas) -------------------------------------------------
const hms = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function fase() {
  const el = M.elementosActuales(m);
  if (el.ligada) return 'orbita';
  return M.altura(m) > 0 && (m.v[0] * m.r[0] + m.v[1] * m.r[1] + m.v[2] * m.r[2]) > 0 ? 'escape' : 'aproximacion';
}

function pintarHUD() {
  const el = M.elementosActuales(m);
  const R = m.cuerpo.radio;
  const dvPct = (M.dvRestante(m) / M.AJUSTES.dvMax) * 100;
  const vr = (m.v[0] * m.r[0] + m.v[1] * m.r[1] + m.v[2] * m.r[2]) / (R + M.altura(m));
  const sin = M.sinSenal(m);
  const f = fase();
  const fila = (etq, val, cls = '') => `<div><span>${etq}</span><b class="${cls}">${val}</b></div>`;
  $('pil-hud').innerHTML = `
    <b class="fase">${t(`hud.fase.${f}`)}</b>
    ${fila(t('hud.cohete'), `🚀 ${nombreCoheteCorto(m.dest.cohete)}`, 'cohete-tag')}
    ${fila(t('hud.tiempo'), hms(m.t))}
    ${fila(t('hud.altura'), `${nf(M.altura(m) / 1000, 1)} km`)}
    ${fila(t('hud.velocidad'), `${nf(Math.hypot(...m.v) / 1000, 2)} km/s`)}
    ${fila(t('hud.velVertical'), `${nf(vr, 0)} m/s`)}
    ${el.ligada
      ? fila(t('hud.periapsis'), `${nf((el.periapsis - R) / 1000, 1)} km`, (el.periapsis - R) / 1000 < M.AJUSTES.periapsisMinKm ? 'mal' : 'bien')
        + fila(t('hud.apoapsis'), `${nf((el.apoapsis - R) / 1000, 1)} km`, 'bien')
        + fila(t('hud.periodo'), `${nf(el.periodo / 60, 0)} min`)
      : fila(t('hud.periapsis'), `${nf((el.periapsis - R) / 1000, 1)} km`, (el.periapsis - R) / 1000 < 0 ? 'mal' : '')}
    ${fila(t('hud.dv'), `${nf(M.dvRestante(m))} m/s`, dvPct < 15 ? 'mal' : '')}
    <div class="pil-barra ${dvPct < 15 ? 'critico' : dvPct < 40 ? 'bajo' : ''}"><i style="width:${dvPct}%"></i></div>
    ${fila(t('hud.motor'), t(`hud.motorEstado.${m.motor}`), m.motor ? 'bien' : '')}
    ${fila(t('hud.piloto'), t(`hud.pilotos.${m.piloto ?? 'ninguno'}`))}
    ${fila(t('hud.escala'), `×${m.escala}`)}
    ${fila(t('hud.senal'), sin ? t('hud.senalPerdida') : t('hud.senalOk'), sin ? 'mal' : 'bien')}`;
}

function pintarLugares(forzar = false) {
  const cont = $('pil-lugares');
  if (!cont) return;
  const el = M.elementosActuales(m);
  const chip = (ok, txt) => `<span class="pil-chip ${ok ? 'si' : ''}">${ok ? '✔' : '○'} ${txt}</span>`;

  const firma = [
    m.destino,
    el.ligada ? 1 : 0,
    objetivo ?? '',
    idioma,
    ...m.dest.lugares.map((l) => {
      const hecho = m.observados.some((o) => o.id === l.id);
      const c = M.condiciones(m, l);
      return `${l.id}:${hecho ? 1 : 0}:${c.cumple ? 1 : 0}`;
    }),
  ].join('|');

  if (!forzar && firma === ultimaFirmaLugares) {
    // Sólo actualizamos chips y distancias en su lugar sin destruir los nodos <button>
    for (const l of m.dest.lugares) {
      if (m.observados.some((o) => o.id === l.id)) continue;
      const card = cont.querySelector(`.pil-lugar[data-lugar-id="${l.id}"]`);
      if (!card) continue;
      const c = M.condiciones(m, l);
      const chipsEl = card.querySelector('.pil-chips');
      if (chipsEl) {
        chipsEl.innerHTML = `
          ${chip(c.visible, t('lugar.visible'))}
          ${chip(c.enCono, t('lugar.cono'))}
          ${chip(c.luz, l.observarDeNoche ? t('lugar.luzRadar') : t('lugar.luz'))}`;
      }
      const distEl = card.querySelector('[data-lugar-dist]');
      if (distEl) {
        distEl.textContent = `${t('lugar.distancia')} ${nf(c.dist / 1000)} km · ${t('lugar.elevacion')} ${nf(c.elev)}°`;
      }
    }
    return;
  }
  ultimaFirmaLugares = firma;

  const cabecera = document.createElement('div');
  cabecera.className = 'pil-lugares-head';
  cabecera.innerHTML = `<span>${t('lugar.panelTitulo')}</span><span>${m.observados.length} / ${m.dest.lugares.length}</span>`;

  const tarjetas = m.dest.lugares.map((l) => {
    const hecho = m.observados.find((o) => o.id === l.id);
    const c = M.condiciones(m, l);
    const div = document.createElement('div');
    const esActivo = objetivo === l.id && !hecho;
    div.className = `pil-lugar${hecho ? ' hecho' : ''}${esActivo ? ' activo' : ''}${c.cumple && !hecho ? ' listo' : ''}`;
    div.dataset.lugarId = l.id;

    if (hecho) {
      div.innerHTML = `
        <b><span>★ ${tx(l.nombre)}</span><small>${nf(hecho.calidad * 100)} %</small></b>
        <p class="pil-lugar-dato">${tx(l.dato)}</p>`;
    } else {
      const acciones = c.cumple
        ? `<button type="button" class="pil-mini-btn ok" data-accion="escanear">${t('lugar.btnEscanear')}</button>`
        : el.ligada
          ? `<button type="button" class="pil-mini-btn" data-accion="apuntar-lugar" data-id="${l.id}">${t('lugar.btnApuntar')}</button>
             <button type="button" class="pil-mini-btn ok" data-accion="viajar-lugar" data-id="${l.id}">${t('lugar.btnViajar')}</button>`
          : `<button type="button" class="pil-mini-btn" data-accion="apuntar-lugar" data-id="${l.id}">${t('lugar.btnApuntar')}</button>`;
      div.innerHTML = `
        <b><span>${esActivo ? '🎯 ' : ''}${tx(l.nombre)}</span></b>
        <p class="pil-lugar-dato">${tx(l.dato)}</p>
        <div class="pil-chips">
          ${chip(c.visible, t('lugar.visible'))}
          ${chip(c.enCono, t('lugar.cono'))}
          ${chip(c.luz, l.observarDeNoche ? t('lugar.luzRadar') : t('lugar.luz'))}
        </div>
        <div class="pil-lugar-pie">
          <small data-lugar-dist>${t('lugar.distancia')} ${nf(c.dist / 1000)} km · ${t('lugar.elevacion')} ${nf(c.elev)}°</small>
          <div class="pil-lugar-acciones">${acciones}</div>
        </div>`;
    }
    return div;
  });

  cont.replaceChildren(cabecera, ...tarjetas);
}

/** Dibuja el Radar Táctico Orbital 2D proyectando sobre el plano orbital de la misión. */
function pintarRadar() {
  const cv = $('pil-mapa');
  if (!cv || !m?.planoBase) return;
  const ctx = cv.getContext('2d');
  const W = cv.width; const H = cv.height;
  const cx = W / 2; const cy = H / 2;
  ctx.clearRect(0, 0, W, H);

  const R = m.cuerpo.radio;
  const el = M.elementosActuales(m);
  const { p, q } = m.planoBase;
  const proy = (v) => [F.punto(v, p), F.punto(v, q)];

  // Escala automática para que quepa tanto la posición actual como la órbita
  const maxDist = Math.max(F.norma(m.r) * 1.15, el.ligada ? Math.min(el.apoapsis * 1.2, R * 4.2) : R * 3.8, R * 2.2);
  const esc = (Math.min(W, H) * 0.44) / maxDist;
  const aPx = (v) => { const [x, y] = proy(v); return [cx + x * esc, cy - y * esc]; };

  // Cuadrícula circular de referencia
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
  ctx.lineWidth = 1;
  for (const mult of [1.5, 2.5, 3.5]) {
    ctx.beginPath();
    ctx.arc(cx, cy, R * mult * esc, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Órbita objetivo (anillo punteado blanco)
  const rMeta = R + ((m.dest.mision.orbitaObjetivo.alturaPerilunioKm + m.dest.mision.orbitaObjetivo.alturaApolunioKm) / 2) * 1000;
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, rMeta * esc, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Trayectoria predicha (reutiliza el cálculo de escena si existe para no duplicar integraciones)
  const predPts = escena?.puntosPredichos()?.length ? escena.puntosPredichos() : null;
  const pred = predPts ? { puntos: predPts, choca: escena.chocaPredicho() } : F.predecir({ r: m.r, v: m.v }, m.cuerpo.mu, { dt: 24, pasos: 200, radioCuerpo: R });
  if (pred.puntos.length > 1) {
    ctx.beginPath();
    pred.puntos.forEach((pt, idx) => {
      const [px, py] = aPx(pt);
      if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = pred.choca ? '#ff7a7a' : el.ligada ? '#4ade80' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Cuerpo celeste central (Luna, Marte o Europa)
  const rCuerpoPx = Math.max(14, R * esc);
  const coloresCuerpo = {
    luna: ['#cbd5e1', '#475569'],
    marte: ['#ea580c', '#7c2d12'],
    europa: ['#e0f2fe', '#0369a1'],
  }[m.destino] || ['#94a3b8', '#334155'];
  const grad = ctx.createRadialGradient(cx - rCuerpoPx * 0.28, cy - rCuerpoPx * 0.28, rCuerpoPx * 0.1, cx, cy, rCuerpoPx);
  grad.addColorStop(0, coloresCuerpo[0]);
  grad.addColorStop(1, coloresCuerpo[1]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, rCuerpoPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Sitios científicos proyectados sobre el disco
  for (const l of m.dest.lugares) {
    const nrm = M.normalLugar(l, m.t, m.cuerpo);
    const [sx, sy] = aPx(F.esc(nrm, R));
    const hecho = m.observados.some((o) => o.id === l.id);
    ctx.fillStyle = hecho ? '#4ade80' : objetivo === l.id ? '#fbbf24' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(sx, sy, hecho || objetivo === l.id ? 3.6 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Marcador PE (Periapsis · Punto de frenado)
  let minR = Infinity; let mejorPe = null;
  for (const pt of pred.puntos) {
    const d = F.norma(pt);
    if (d < minR) { minR = d; mejorPe = pt; }
  }
  if (mejorPe) {
    const [pex, pey] = aPx(mejorPe);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(pex, pey, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.fillText('PE', pex + 6, pey + 3);
  }

  // Posición y vector de la nave
  const [nx, ny] = aPx(m.r);
  const [vx, vy] = proy(m.fwd);
  const ang = Math.atan2(-vy, vx);
  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(ang);
  if ((m.motor !== 0 || m.piloto === 'captura') && !pausado) {
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath();
    ctx.moveTo(-5, -2.5); ctx.lineTo(-12, 0); ctx.lineTo(-5, 2.5);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-5, -4); ctx.lineTo(-3, 0); ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Estado textual en la cabecera del radar
  const est = $('pil-radar-estado');
  if (est) {
    const periKm = nf((el.periapsis - R) / 1000, 0);
    const apoKm = nf((el.apoapsis - R) / 1000, 0);
    est.textContent = el.ligada
      ? t('radar.enOrbita', { peri: periKm, apo: apoKm })
      : t('radar.aproximacion', { peri: periKm });
  }
}

function pintarEtiquetas() {
  const cont = $('pil-etiquetas');
  if (!escena) { cont.replaceChildren(); return; }
  if (cont.children.length !== m.dest.lugares.length) {
    cont.replaceChildren(...m.dest.lugares.map((l) => {
      const d = document.createElement('div');
      d.className = 'pil-etiq';
      d.dataset.id = l.id;
      return d;
    }));
  }
  const W = innerWidth; const H = innerHeight;
  for (const l of m.dest.lugares) {
    const div = cont.querySelector(`[data-id="${l.id}"]`);
    const c = M.condiciones(m, l);
    const p = escena.proyectar(l);
    const hecho = m.observados.some((o) => o.id === l.id);
    const mostrar = p.delante && c.elev > -5 && p.x > 0.02 && p.x < 0.98 && p.y > 0.08 && p.y < 0.92;
    div.style.display = mostrar ? '' : 'none';
    if (!mostrar) continue;
    div.style.left = `${p.x * W}px`; div.style.top = `${p.y * H}px`;
    div.textContent = `${hecho ? '★ ' : objetivo === l.id ? '🎯 ' : ''}${tx(l.nombre)} · ${nf(c.dist / 1000)} km`;
    div.className = `pil-etiq${hecho ? ' hecho' : ''}${objetivo === l.id && !hecho ? ' objetivo' : ''}${c.cumple && !hecho ? ' listo' : ''}`;
  }
}

function pintarMira() {
  const mira = $('pil-mira');
  const alto = innerHeight;
  const fov = escena ? escena.camara.fov : 55;
  const diam = Math.min(220, Math.max(110, (Math.tan((M.AJUSTES.conoObsGrados * Math.PI) / 180) / Math.tan((fov * Math.PI) / 360)) * alto));
  mira.style.setProperty('--pil-cono', `${diam}px`);

  const lugarListo = m.dest.lugares.find((l) => !m.observados.some((o) => o.id === l.id) && M.condiciones(m, l).cumple);
  mira.classList.toggle('listo', Boolean(lugarListo));

  // Anillo circular de progreso cuando se auto-observa manteniendo en mira
  const prog = $('pil-mira-prog');
  if (prog) {
    const frac = m.observacion?.frac ?? (lugarListo ? 0.12 : 0);
    const circ = 289;
    prog.style.strokeDashoffset = String(circ * (1 - Math.max(0, Math.min(1, frac))));
  }

  // Etiqueta dentro de la mira
  const txt = $('pil-mira-txt');
  if (txt) {
    if (lugarListo) {
      txt.textContent = `📡 ${tx(lugarListo.nombre)} · [␣]`;
      txt.hidden = false;
    } else if (m.piloto === 'captura') {
      const et = m.captura.fase === 'quemando' ? 3 : secuenciaCaptura.etapa || 2;
      txt.textContent = et === 1
        ? '🔄 FASE 1/3: GIRO RETRÓGRADO 180°'
        : et === 2
          ? '⏩ FASE 2/3: DESCENSO AL ANILLO PE'
          : '🔥 FASE 3/3: QUEMA DE INSERCIÓN ORBITAL';
      txt.hidden = false;
    } else {
      txt.hidden = true;
    }
  }

  // Flecha direccional hacia el lugar objetivo (o hacia el planeta si está fuera de pantalla)
  const flecha = $('pil-flecha');
  if (flecha && escena) {
    const lObj = m.dest.lugares.find((l) => l.id === objetivo && !m.observados.some((o) => o.id === l.id));
    const proy = lObj ? escena.proyectar(lObj) : escena.proyectarCuerpo();
    const dx = (proy.delante ? proy.x : 1 - proy.x) - 0.5;
    const dy = (proy.delante ? proy.y : 1 - proy.y) - 0.52;
    const distCentro = Math.hypot(dx, dy);
    if (!proy.delante || distCentro > 0.14) {
      const ang = Math.atan2(dy, dx);
      const radioFlecha = diam * 0.56;
      const fx = Math.cos(ang) * radioFlecha;
      const fy = Math.sin(ang) * radioFlecha;
      flecha.hidden = false;
      flecha.style.transform = `translate(calc(-50% + ${fx.toFixed(1)}px), calc(-50% + ${fy.toFixed(1)}px)) rotate(${(ang * 180) / Math.PI}deg)`;
    } else {
      flecha.hidden = true;
    }
  }
}

// --- Diálogos (Briefing y Resultado) ------------------------------------------------------------------------
function abrir(dlg) { if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', ''); }
function cerrar(dlg) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }

function mostrarBriefing() {
  const d = m.dest; const o = d.mision.orbitaObjetivo; const A = M.AJUSTES;
  const dlg = $('pil-briefing');
  const cardsMisiones = ORDEN_MISIONES.map((id) => {
    const dest = DESTINOS[id];
    const cuerpo = CUERPOS[dest.cuerpo];
    return `
      <button type="button" class="pil-card-mision ${id === m.destino ? 'activa' : ''}" data-elegir-mision="${id}">
        <span class="icono">${dest.icono || '🪐'}</span>
        <strong>${tx(cuerpo.nombre)}</strong>
        <small>${tx(dest.mision.nombre)}</small>
        <span class="cohete-badge">🚀 ${t(`cohetes.${dest.cohete}`)}</span>
      </button>`;
  }).join('');

  dlg.innerHTML = `
    <h2>${d.icono || '🚀'} ${tx(d.mision.nombre)} → ${tx(m.cuerpo.nombre)}</h2>
    <p class="nota">${tx(d.mision.fecha)} · ${t('briefing.coheteAsignado')}: <b>${t(`cohetes.${d.cohete}`)}</b></p>

    ${modo.lock ? '' : `<h3>${t('briefing.eligeMision')}</h3>
    <div class="pil-cards-misiones">${cardsMisiones}</div>`}

    <h3>${t('briefing.comoJugar')}</h3>
    <div class="pil-guia-grid">
      <div class="pil-guia-item">${t('briefing.paso1')}</div>
      <div class="pil-guia-item">${t('briefing.paso2')}</div>
      <div class="pil-guia-item">${t('briefing.paso3')}</div>
    </div>

    <h3>${t('briefing.real')}</h3>
    <p>${tx(d.mision.resumen)}</p>
    <p class="nota">${t('briefing.ordenReal', { peri: nf(o.alturaPerilunioKm, 1), apo: nf(o.alturaApolunioKm, 1) })}</p>

    <h3>${t('briefing.lugares')}</h3>
    <ul>${d.lugares.map((l) => `<li><b>${tx(l.nombre)}</b> (${nf(Math.abs(l.lat), 2)}° ${l.lat >= 0 ? 'N' : 'S'}, ${nf(Math.abs(l.lon), 2)}° ${l.lon >= 0 ? 'E' : idioma === 'es' ? 'O' : 'W'}). ${tx(l.dato)} <a href="${l.enlace}" target="_blank" rel="noopener">${l.fuente}</a></li>`).join('')}</ul>

    <details class="pil-detalles-tec">
      <summary>${t('briefing.controles')} & ${t('briefing.simplificado')}</summary>
      <dl>${['capturar', 'escanear', 'vista', 'girar', 'motor', 'piloto', 'tiempo', 'pausa', 'terminar'].map((k) => `<dt>${t(`teclas.${k}`)}</dt><dd>${t(`teclas.${k}T`)}</dd>`).join('')}</dl>
      <p class="nota">${t('briefing.simplificadoLista', { vinf: d.llegada.vInfinito, dv: A.dvMax, acc: M.aceleracionMision(m) })}</p>
      <p class="nota"><b>${t('briefing.noVerificado')}:</b> ${t('briefing.noVerificadoLista')}</p>
    </details>

    <div class="pil-pie-dialogo">
      <button class="pil-btn info" id="pil-empezar" type="button">${t('briefing.empezar', { cuerpo: tx(m.cuerpo.nombre) })}</button>
      <button class="pil-btn principal" id="pil-empezar-auto" type="button">🔥 ${t('asistente.btnCapturar')}</button>
    </div>`;

  abrir(dlg);
  dlg.querySelectorAll('[data-elegir-mision]').forEach((btn) => {
    const elegir = () => cambiarMision(btn.dataset.elegirMision, { abrirBriefing: false });
    btn.addEventListener('pointerdown', (e) => { if (e.button === 0) elegir(); });
    btn.addEventListener('click', elegir);
  });
  $('pil-empezar')?.addEventListener('click', empezar, { once: true });
  $('pil-empezar-auto')?.addEventListener('click', () => {
    empezar();
    accionCapturar();
  }, { once: true });
}

function empezar() {
  cerrar($('pil-briefing'));
  iniciarAudio();
  pausado = false;
  const b = $('pil-b-pausa'); if (b) b.textContent = `${t('log.pausa')} (P)`;
  ultimoReal = 0;
}

function mostrarResultado() {
  const ev = M.evaluar(m);
  const dlg = $('pil-resultado');
  const estrellas = [1, 2, 3].map((i) => `<span class="${i <= ev.estrellas ? '' : 'off'}">★</span>`).join('');
  const consejo = ev.fin === 'choque' ? t('resultado.consejoChoque') : ev.fin === 'escapo' ? t('resultado.consejoEscapo') : '';
  const sigId = ORDEN_MISIONES[(ORDEN_MISIONES.indexOf(m.destino) + 1) % ORDEN_MISIONES.length];
  const sigNombre = tx(CUERPOS[DESTINOS[sigId].cuerpo].nombre);

  dlg.innerHTML = `
    <h2>${t(`resultado.titulo.${ev.fin === 'en curso' ? 'terminada' : ev.fin}`)} · ${tx(m.cuerpo.nombre)}</h2>
    <p class="pil-estrellas" aria-label="${t('resultado.estrellas')}: ${ev.estrellas}/3">${estrellas}</p>
    <dl>
      <dt>${t('hud.cohete')}</dt><dd>🚀 ${t(`cohetes.${m.dest.cohete}`)}</dd>
      <dt>${t('resultado.orbita')}</dt><dd>${ev.orbita ? t('resultado.orbitaSi', { peri: nf(ev.perilunioKm), apo: nf(ev.apolunioKm) }) : t('resultado.orbitaNo')}</dd>
      <dt>${t('resultado.lugares')}</dt><dd>${ev.lugares.length} / ${m.dest.lugares.length}</dd>
      <dt>${t('resultado.dvUsado')}</dt><dd>${nf(ev.dvUsado)} / ${nf(M.AJUSTES.dvMax)} m/s</dd>
      <dt>${t('resultado.tiempo')}</dt><dd>${hms(ev.tiempoMision)}</dd>
    </dl>
    <ul>${m.observados.map((o) => { const l = m.dest.lugares.find((x) => x.id === o.id); return `<li>★ <b>${tx(l.nombre)}</b> (${t('resultado.calidad', { q: nf(o.calidad * 100) })}) — ${tx(l.dato)}</li>`; }).join('')}</ul>
    ${consejo ? `<p class="nota">${consejo}</p>` : ''}
    ${modo.embed ? `<p class="nota pil-nota-etapa">${t('resultado.notaEtapa')}</p>` : ''}
    <div class="pil-pie-dialogo">
      <button class="pil-btn" id="pil-reintentar" type="button">${t('resultado.reintentar')}</button>
      ${modo.embed
    ? `<button class="pil-btn principal" id="pil-continuar" type="button">${t('resultado.continuar')}</button>`
    : `<button class="pil-btn principal" id="pil-siguiente-mision" type="button">${t('resultado.siguiente', { sig: sigNombre })}</button>`}
    </div>`;
  abrir(dlg);
  $('pil-reintentar').addEventListener('click', reintentar, { once: true });
  if (modo.embed) {
    // Incrustado en el Nivel 3: «Continuar» devuelve el control a la página (también tras un choque o escape)
    $('pil-continuar').addEventListener('click', () => {
      if (window.parent !== window) window.parent.postMessage(mensajePilotaje(ev, m.destino), location.origin);
    }, { once: true });
  } else {
    $('pil-siguiente-mision').addEventListener('click', () => cambiarMision(sigId, { abrirBriefing: false }), { once: true });
  }
}

function reintentar() {
  cambiarMision(m.destino, { abrirBriefing: false });
}

// --- Bucle principal ----------------------------------------------------------------------------------------
function vigilarEventos() {
  if (m.captura.fase !== faseAnterior) {
    if (m.captura.fase === 'quemando') {
      secuenciaCaptura.etapa = 3;
      secuenciaCaptura.dvInicioQuema = m.dvUsado;
      secuenciaCaptura.dvTotalQuema = Math.max(1, M.datosFrenado(m).dvNec);
      pitido(580);
      pintarAsistente(true);
    } else if (m.captura.fase === 'lista') {
      const el = M.elementosActuales(m);
      secuenciaCaptura.activa = false;
      m.escala = 5;
      // Apunta automáticamente al primer sitio científico tras entrar en órbita
      const primero = m.dest.lugares.find((l) => !m.observados.some((o) => o.id === l.id));
      if (primero) {
        objetivo = primero.id;
        M.fijarPiloto(m, 'lugar', objetivo);
      }
      anotar(t('log.capturaLista', {
        cuerpo: tx(m.cuerpo.nombre),
        peri: nf((el.periapsis - m.cuerpo.radio) / 1000),
        apo: nf((el.apoapsis - m.cuerpo.radio) / 1000),
      }), 'ok');
      pitido(720);
      pintarAsistente(true);
      pintarLugares(true);
    } else if (m.captura.fase === 'sin-dv') {
      secuenciaCaptura.activa = false;
      anotar(t('log.capturaSinDv'), 'mal');
    }
    faseAnterior = m.captura.fase;
  }

  if (m.recienObservado) {
    const lug = m.recienObservado;
    m.recienObservado = null;
    const reg = m.observados.find((o) => o.id === lug.id);
    registrarEscaneoExitoso(lug, reg?.calidad ?? 0.9);
  }

  const hayEnlace = !M.sinSenal(m);
  if (hayEnlace !== senalAnterior) {
    anotar(hayEnlace ? t('log.conSenal') : t('log.sinSenal'), hayEnlace ? 'ok' : 'mal');
    senalAnterior = hayEnlace;
  }
}

function cuadro(ahora) {
  const dt = Math.min(0.1, (ahora - (ultimoReal || ahora)) / 1000);
  ultimoReal = ahora;
  const c = controles();
  if (escena && escena.modoVista === 'orbita' && (c.guinada || c.cabeceo)) {
    escena.rotarVistaOrbita(-c.guinada * 150 * dt, c.cabeceo * 120 * dt);
  }
  if (!pausado && !m.fin) {
    if (escena?.modoVista !== 'orbita' && (c.guinada || c.cabeceo || c.alabeo) && ['progrado', 'retrogrado', 'planeta', 'lugar'].includes(m.piloto)) {
      secuenciaCaptura.activa = false;
      M.fijarPiloto(m, null);
    }
    actualizarCinematicaVuelo(c);
    M.avanzar(m, dt, c);
    vigilarEventos();
  }
  sonidoMotor(!pausado && m.motor !== 0);
  $('pil-llama').classList.toggle('on', (m.motor !== 0 || m.piloto === 'captura') && !pausado);
  escena?.actualizar();
  escena?.dibujar();
  if (cuadroN % 3 === 0) {
    pintarHUD();
    pintarMira();
    pintarRadar();
    if (m.piloto === 'captura') pintarAsistente();
  }
  if (cuadroN % 15 === 0) {
    pintarAsistente();
    pintarLugares();
  }
  cuadroN++;
  pintarEtiquetas();
  if (m.fin && !finMostrado) { finMostrado = true; mostrarResultado(); }
  requestAnimationFrame(cuadro);
}

// --- Delegación de eventos interactivos (Asistente y Tarjetas de Lugares) -----------------------------------
function configurarDelegacionUI() {
  const manejarAccion = (e) => {
    if (e.type === 'pointerdown' && e.button !== undefined && e.button !== 0) return;
    const ahora = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const btn = e.target.closest?.('[data-accion]');
    if (btn) {
      if (ahora - ultimoDisparoAccion < 220) return;
      ultimoDisparoAccion = ahora;
      e.stopPropagation();
      const acc = btn.dataset.accion;
      if (acc === 'capturar') accionCapturar();
      else if (acc === 'saltar-frenado') accionSaltarAFrenado();
      else if (acc === 'viajar-lugar') accionViajarALugar(btn.dataset.id);
      else if (acc === 'apuntar-lugar') seleccionarLugar(btn.dataset.id);
      else if (acc === 'escanear') accionEscanear();
      else if (acc === 'terminar') accionTerminar();
      else if (acc === 'cambiar-mision') cambiarMision(btn.dataset.destino, { abrirBriefing: false });
      return;
    }
    const card = e.target.closest?.('.pil-lugar[data-lugar-id]');
    if (card) {
      if (ahora - ultimoDisparoAccion < 220) return;
      ultimoDisparoAccion = ahora;
      seleccionarLugar(card.dataset.lugarId);
    }
  };
  for (const idCont of ['pil-asistente', 'pil-lugares']) {
    const elCont = $(idCont);
    if (!elCont) continue;
    elCont.addEventListener('pointerdown', manejarAccion);
    elCont.addEventListener('click', manejarAccion);
  }
}

// --- Arranque ----------------------------------------------------------------------------------------------------------
export const api = {
  get mision() { return m; },
  get escena() { return escena; },
  empezar, reintentar, cambiarMision,
  accionCapturar, accionSaltarAFrenado, accionViajarALugar, accionEscanear, accionPiloto, alternarPausa, accionTerminar,
  cuadro: (dtSeg) => { ultimoReal = 0; cuadro(1000); cuadro(1000 + dtSeg * 1000); },
  pausado: () => pausado, registro: () => registro,
};

/** Incrustado: sin marca ni botón de idioma (los pone la página de fuera), idioma por mensaje y sin cerrar el informe con Esc. */
function prepararIncrustado() {
  document.body.classList.add('pil-embed');
  addEventListener('message', (e) => {
    if (e.source !== window.parent || e.origin !== location.origin || e.data?.type !== SIM_LANG) return;
    idioma = e.data.lang === 'en' ? 'en' : 'es';
    try { localStorage.setItem(LLAVE_IDIOMA, idioma); } catch { /* sin almacenamiento */ }
    textosEstaticos();
    if ($('pil-briefing').open) mostrarBriefing();
    if ($('pil-resultado').open) mostrarResultado();
  });
  // Sin informe abierto no hay botón «Continuar»: Esc no lo cierra
  $('pil-resultado').addEventListener('cancel', (e) => e.preventDefault());
}

async function arrancar() {
  if (modo.embed) prepararIncrustado();
  m = M.crearMision(destinoActual);
  prepararLlegadaVisible(m);
  objetivo = m.dest.lugares[0]?.id ?? null;
  textosEstaticos();
  configurarDelegacionUI();

  // Enlazamos todos los eventos e iniciamos el bucle de inmediato (antes de cargar modelos 3D)
  addEventListener('keydown', alPresionar);
  addEventListener('keyup', alSoltar);
  addEventListener('blur', () => teclas.clear());
  const lienzo = $('pil-canvas');
  lienzo.addEventListener('pointerdown', (e) => {
    arrastre.activo = true; arrastre.x = e.clientX; arrastre.y = e.clientY;
    lienzo.setPointerCapture?.(e.pointerId);
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!arrastre.activo) return;
    const dx = e.clientX - arrastre.x;
    const dy = e.clientY - arrastre.y;
    arrastre.x = e.clientX;
    arrastre.y = e.clientY;
    if (escena && escena.modoVista === 'orbita') {
      escena.rotarVistaOrbita(dx, dy);
      escena.dibujar();
    } else {
      arrastre.dx += dx;
      arrastre.dy += dy;
    }
  });
  lienzo.addEventListener('wheel', (e) => {
    e.preventDefault();
    escena?.zoomVistaOrbita?.(e.deltaY);
    escena?.dibujar();
  }, { passive: false });
  const soltar = () => { arrastre.activo = false; };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  lienzo.addEventListener('dblclick', () => escena?.centrarVistaOrbita());

  // Si el usuario cierra el briefing con Escape o haciendo clic en el fondo, también despausa la simulación
  const dlgBriefing = $('pil-briefing');
  dlgBriefing?.addEventListener('close', () => {
    if (pausado && !$('pil-resultado')?.open) {
      pausado = false;
      const b = $('pil-b-pausa');
      if (b) b.textContent = `${t('log.pausa')} (P)`;
      ultimoReal = 0;
    }
  });
  dlgBriefing?.addEventListener('click', (e) => {
    if (e.target === dlgBriefing) empezar();
  });

  $('pil-b-vista')?.addEventListener('click', alternarVista);
  $('pil-b-ficha')?.addEventListener('click', () => { pausado = true; mostrarBriefing(); });
  $('pil-idioma').addEventListener('click', () => {
    idioma = idioma === 'es' ? 'en' : 'es';
    try { localStorage.setItem(LLAVE_IDIOMA, idioma); } catch { /* sin almacenamiento */ }
    textosEstaticos();
    if ($('pil-briefing').open) mostrarBriefing();
    if ($('pil-resultado').open) mostrarResultado();
  });

  anotar(t('log.inicio', { cuerpo: tx(m.cuerpo.nombre), cohete: nombreCoheteCorto(m.dest.cohete) }));
  pausado = false;
  requestAnimationFrame(cuadro);

  try {
    const esNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
    const { crearEscenaPilotaje } = await import(esNode ? './cuerpos.js' : './cuerpos.js?v=11');
    escena = crearEscenaPilotaje($('pil-canvas'), m, {
      reducirMovimiento,
      renderer: globalThis.__pilotajeRenderer ?? null,
      cargarTextura: globalThis.__pilotajeTextura ?? null,
    });
    addEventListener('resize', () => escena.tamano());
    actualizarBotonVista();
    if (escena.fallos.length) console.warn('Texturas que no cargaron:', escena.fallos);
  } catch (err) {
    console.warn('Sin vista 3D:', err);
    const a = $('pil-aviso'); a.hidden = false; a.textContent = t('sinWebGL');
    setTimeout(() => { a.hidden = true; }, 6000);
  }
}

if (typeof document !== 'undefined' && $('pil-canvas')) {
  arrancar().catch((err) => {
    console.error(err);
    const a = $('pil-aviso'); a.hidden = false; a.textContent = `${t('errorCarga')}: ${err.message}`;
  });
}
