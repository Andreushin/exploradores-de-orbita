// OWNER: Rol 3 (@JU4NMAX) — Simulador de pilotaje · cabina: controles, HUD, briefing y resultado.
// La física vive en mision.js (probada en Node) y la vista 3D en cuerpos.js. Si el navegador no tiene WebGL,
// todo lo demás (instrumentos, registro, lugares, resultado) sigue funcionando.
import * as M from './mision.js';
import { TEXTOS } from './textos.js';

const $ = (id) => document.getElementById(id);
const reducirMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const nf = (n, d = 0) => Number(n).toLocaleString(lang() === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const LLAVE_IDIOMA = 'srl-lang';

let idioma = (() => { try { return localStorage.getItem(LLAVE_IDIOMA) === 'en' ? 'en' : 'es'; } catch { return 'es'; } })();
function lang() { return idioma; }
function t(clave, vars = {}) {
  const get = (l) => clave.split('.').reduce((o, k) => o?.[k], TEXTOS[l]);
  const v = get(idioma) ?? get('es') ?? clave;
  return String(v).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}
const tx = (o) => (o && typeof o === 'object' ? o[idioma] ?? o.es : o ?? '');

// --- Estado de la cabina ---------------------------------------------------------------
let m;                 // misión
let escena = null;     // vista 3D (null sin WebGL)
let pausado = true;    // empieza pausado, con el briefing abierto
let registro = [];     // { texto, tipo }
let objetivo = null;   // lugar al que apunta el piloto «hacia el lugar»
let faseAnterior = 'espera';
let senalAnterior = true;
let finMostrado = false;
let cuadroN = 0;
let ultimoReal = 0;
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

// --- Registro ---------------------------------------------------------------------------------------
function anotar(texto, tipo = '') {
  registro.push({ texto, tipo });
  if (registro.length > 40) registro.shift();
  const ol = $('pil-registro');
  if (!ol) return;
  ol.replaceChildren(...registro.slice(-6).map((r) => { const li = document.createElement('li'); li.textContent = r.texto; if (r.tipo) li.className = r.tipo; return li; }));
  ol.parentElement.scrollTop = 1e6;
}

// --- Textos estáticos ----------------------------------------------------------------------------------
function textosEstaticos() {
  document.documentElement.lang = idioma;
  document.title = `${t('titulo')} · ${idioma === 'es' ? 'Exploradores de Órbita' : 'Orbit Explorers'}`;
  $('pil-marca').textContent = idioma === 'es' ? 'Exploradores de Órbita' : 'Orbit Explorers';
  $('pil-idioma').textContent = t('idioma');
  $('pil-idioma').setAttribute('aria-label', t('idiomaEtiqueta'));
  $('pil-nombre-mision').textContent = `${tx(m.dest.mision.nombre)} → ${tx(m.cuerpo.nombre)}`;
  $('pil-pie').textContent = t('simplificadoPie');
  pintarBotones();
}

// --- Botones -----------------------------------------------------------------------------------------------
function pintarBotones() {
  const nav = $('pil-botones');
  nav.replaceChildren();
  const b = (id, texto, onClick, { mantener = null, titulo = '' } = {}) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'pil-btn'; el.id = `pil-b-${id}`; el.textContent = texto; if (titulo) el.title = titulo;
    if (mantener) {
      const on = (v) => (e) => { e.preventDefault(); botonesMantenidos[mantener] = v; el.classList.toggle('activo', v); };
      el.addEventListener('pointerdown', on(true)); el.addEventListener('pointerup', on(false));
      el.addEventListener('pointerleave', on(false)); el.addEventListener('pointercancel', on(false));
    } else el.addEventListener('click', onClick);
    nav.append(el);
    return el;
  };
  b('motor', `${t('botones.motor')} (W)`, null, { mantener: 'motor' });
  b('reversa', `${t('botones.reversa')} (S)`, null, { mantener: 'reversa' });
  b('captura', `${t('botones.captura')} (C)`, accionCapturar);
  b('escanear', `${t('botones.escanear')} (␣)`, accionEscanear);
  b('lugar', `${t('botones.lugar')} (4)`, () => accionPiloto('lugar'));
  b('menos', `${t('botones.menos')} (Z)`, () => { M.ciclarEscala(m, -1); });
  b('mas', `${t('botones.mas')} (X)`, () => { M.ciclarEscala(m, +1); });
  b('pausa', `${t('log.pausa')} (P)`, alternarPausa);
  b('terminar', `${t('botones.terminar')} (R)`, accionTerminar);
}

// --- Acciones ----------------------------------------------------------------------------------------------------
function siguienteObjetivo() {
  const pend = m.dest.lugares.filter((l) => !m.observados.some((o) => o.id === l.id));
  if (!pend.length) return null;
  const i = pend.findIndex((l) => l.id === objetivo);
  return pend[(i + 1) % pend.length].id;
}
function accionPiloto(modo) {
  if (modo !== 'lugar') { M.fijarPiloto(m, modo); return; }
  const pend = m.dest.lugares.filter((l) => !m.observados.some((o) => o.id === l.id));
  if (!pend.length) { M.fijarPiloto(m, null); return; }
  const vigente = objetivo && pend.some((l) => l.id === objetivo);
  // Si ya apuntas a un lugar, pulsar otra vez pasa al siguiente; si no, empieza por el primero pendiente
  objetivo = vigente && m.piloto === 'lugar' ? siguienteObjetivo() : (vigente ? objetivo : pend[0].id);
  M.fijarPiloto(m, 'lugar', objetivo);
}
function accionCapturar() { M.capturarOrbita(m); anotar(t('log.captura')); pitido(520); }
function accionEscanear() {
  const r = M.escanear(m);
  if (r.ok) { anotar(t('log.escanear', { lugar: tx(r.lugar.nombre), calidad: nf(r.calidad * 100) }), 'ok'); pitido(1040); }
  else anotar(t('log.escanearNada'));
}
function accionTerminar() { M.terminar(m); }
function alternarPausa() {
  pausado = !pausado;
  const b = $('pil-b-pausa'); if (b) b.textContent = `${pausado ? t('log.seguir') : t('log.pausa')} (P)`;
}

// --- Teclado y ratón -----------------------------------------------------------------------------------------
function alPresionar(e) {
  if (e.target.closest?.('dialog[open]')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (e.repeat) { teclas.add(k); return; }
  teclas.add(k);
  switch (k) {
    case 'c': accionCapturar(); break;
    case ' ': accionEscanear(); break;
    case '1': M.fijarPiloto(m, 'progrado'); break;
    case '2': M.fijarPiloto(m, 'retrogrado'); break;
    case '3': M.fijarPiloto(m, 'planeta'); break;
    case '4': accionPiloto('lugar'); break;
    case '0': M.fijarPiloto(m, null); break;
    case 'z': M.ciclarEscala(m, -1); break;
    case 'x': M.ciclarEscala(m, +1); break;
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
  guinada = clamp(guinada + arrastre.dx / 12);
  cabeceo = clamp(cabeceo - arrastre.dy / 12);
  arrastre.dx = 0; arrastre.dy = 0;
  const motor = (k('w') || botonesMantenidos.motor ? 1 : 0) - (k('s') || botonesMantenidos.reversa ? 1 : 0);
  return { guinada, cabeceo, alabeo, motor };
}

// --- Instrumentos -------------------------------------------------------------------------------------------------
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
    ${fila(t('hud.tiempo'), hms(m.t))}
    ${fila(t('hud.altura'), `${nf(M.altura(m) / 1000, 1)} km`)}
    ${fila(t('hud.velocidad'), `${nf(Math.hypot(...m.v) / 1000, 3)} km/s`)}
    ${fila(t('hud.velVertical'), `${nf(vr, 0)} m/s`)}
    ${el.ligada ? fila(t('hud.periapsis'), `${nf((el.periapsis - R) / 1000, 1)} km`, (el.periapsis - R) / 1000 < M.AJUSTES.periapsisMinKm ? 'mal' : 'bien')
      + fila(t('hud.apoapsis'), `${nf((el.apoapsis - R) / 1000, 1)} km`) + fila(t('hud.periodo'), `${nf(el.periodo / 60, 1)} min`)
      : fila(t('hud.periapsis'), `${nf((el.periapsis - R) / 1000, 1)} km`, (el.periapsis - R) / 1000 < 0 ? 'mal' : '')}
    ${fila(t('hud.dv'), `${nf(M.dvRestante(m))} m/s`, dvPct < 15 ? 'mal' : '')}
    <div class="pil-barra ${dvPct < 15 ? 'critico' : dvPct < 40 ? 'bajo' : ''}"><i style="width:${dvPct}%"></i></div>
    ${fila(t('hud.motor'), t(`hud.motorEstado.${m.motor}`), m.motor ? 'bien' : '')}
    ${fila(t('hud.piloto'), t(`hud.pilotos.${m.piloto ?? 'ninguno'}`))}
    ${fila(t('hud.escala'), `×${m.escala}`)}
    ${fila(t('hud.senal'), sin ? t('hud.senalPerdida') : t('hud.senalOk'), sin ? 'mal' : 'bien')}`;
}

function pintarLugares() {
  $('pil-lugares').replaceChildren(...m.dest.lugares.map((l) => {
    const hecho = m.observados.find((o) => o.id === l.id);
    const c = M.condiciones(m, l);
    const chip = (ok, txt) => `<span class="pil-chip ${ok ? 'si' : ''}">${ok ? '✔' : '○'} ${txt}</span>`;
    const div = document.createElement('div');
    div.className = `pil-lugar${hecho ? ' hecho' : ''}${m.piloto === 'lugar' && objetivo === l.id ? ' activo' : ''}`;
    div.innerHTML = hecho
      ? `<b>★ ${tx(l.nombre)}</b><small>${t('lugar.hecho')} · ${nf(hecho.calidad * 100)} %</small>`
      : `<b>${tx(l.nombre)}</b><div class="pil-chips">${chip(c.visible, t('lugar.visible'))}${chip(c.enCono, t('lugar.cono'))}${chip(c.luz, l.observarDeNoche ? t('lugar.luzRadar') : t('lugar.luz'))}</div>
         <small>${t('lugar.distancia')} ${nf(c.dist / 1000)} km · ${t('lugar.elevacion')} ${nf(c.elev)}°</small>`;
    return div;
  }));
}

function pintarEtiquetas() {
  const cont = $('pil-etiquetas');
  if (!escena) { cont.replaceChildren(); return; }
  if (cont.children.length !== m.dest.lugares.length) {
    cont.replaceChildren(...m.dest.lugares.map((l) => { const d = document.createElement('div'); d.className = 'pil-etiq'; d.dataset.id = l.id; return d; }));
  }
  const W = innerWidth; const H = innerHeight;
  for (const l of m.dest.lugares) {
    const div = cont.querySelector(`[data-id="${l.id}"]`);
    const c = M.condiciones(m, l);
    const p = escena.proyectar(l);
    const hecho = m.observados.some((o) => o.id === l.id);
    const mostrar = p.delante && c.elev > 0 && p.x > 0.02 && p.x < 0.98 && p.y > 0.08 && p.y < 0.92;
    div.style.display = mostrar ? '' : 'none';
    if (!mostrar) continue;
    div.style.left = `${p.x * W}px`; div.style.top = `${p.y * H}px`;
    div.textContent = `${hecho ? '★ ' : ''}${tx(l.nombre)} · ${nf(c.dist / 1000)} km`;
    div.className = `pil-etiq${hecho ? ' hecho' : ''}${c.cumple && !hecho ? ' listo' : ''}`;
  }
}

function pintarMira() {
  const mira = $('pil-mira');
  const alto = innerHeight;
  const fov = escena ? escena.camara.fov : 60;
  const diam = (Math.tan((M.AJUSTES.conoObsGrados * Math.PI) / 180) / Math.tan((fov * Math.PI) / 360)) * alto;
  mira.style.setProperty('--pil-cono', `${Math.max(40, diam)}px`);
  mira.classList.toggle('listo', m.dest.lugares.some((l) => !m.observados.some((o) => o.id === l.id) && M.condiciones(m, l).cumple));
}

// --- Diálogos -----------------------------------------------------------------------------------------------------------
function abrir(dlg) { if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', ''); }
function cerrar(dlg) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }

function mostrarBriefing() {
  const d = m.dest; const o = d.mision.orbitaObjetivo; const A = M.AJUSTES;
  const dlg = $('pil-briefing');
  dlg.innerHTML = `
    <h2>${tx(d.mision.nombre)} → ${tx(m.cuerpo.nombre)}</h2>
    <p class="nota">${tx(d.mision.fecha)} · ${t('briefing.mision')}</p>
    <h3>${t('briefing.real')}</h3>
    <p>${tx(d.mision.resumen)}</p>
    <p class="nota">${t('briefing.ordenReal', { peri: nf(o.alturaPerilunioKm, 1), apo: nf(o.alturaApolunioKm, 1) })}</p>
    <h3>${t('briefing.objetivo')}</h3>
    <p>${t('briefing.objetivoTexto')}</p>
    <h3>${t('briefing.lugares')}</h3>
    <ul>${d.lugares.map((l) => `<li><b>${tx(l.nombre)}</b> (${nf(Math.abs(l.lat), 2)}° ${l.lat >= 0 ? 'N' : 'S'}, ${nf(Math.abs(l.lon), 2)}° ${l.lon >= 0 ? 'E' : idioma === 'es' ? 'O' : 'W'}). ${tx(l.dato)} <a href="${l.enlace}" target="_blank" rel="noopener">${l.fuente}</a></li>`).join('')}</ul>
    <h3>${t('briefing.controles')}</h3>
    <dl>${['girar', 'rolar', 'motor', 'piloto', 'capturar', 'escanear', 'tiempo', 'pausa', 'terminar'].map((k) => `<dt>${t(`teclas.${k}`)}</dt><dd>${t(`teclas.${k}T`)}</dd>`).join('')}</dl>
    <h3>${t('briefing.simplificado')}</h3>
    <p class="nota">${t('briefing.simplificadoLista', { vinf: d.llegada.vInfinito, dv: A.dvMax, acc: A.aceleracion })}</p>
    <p class="nota"><b>${t('briefing.noVerificado')}:</b> ${t('briefing.noVerificadoLista')}</p>
    <div class="pil-pie-dialogo"><button class="pil-btn principal" id="pil-empezar" type="button">${t('briefing.empezar')}</button></div>`;
  abrir(dlg);
  $('pil-empezar').addEventListener('click', empezar, { once: true });
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
  dlg.innerHTML = `
    <h2>${t(`resultado.titulo.${ev.fin === 'en curso' ? 'terminada' : ev.fin}`)}</h2>
    <p class="pil-estrellas" aria-label="${t('resultado.estrellas')}: ${ev.estrellas}/3">${estrellas}</p>
    <dl>
      <dt>${t('resultado.orbita')}</dt><dd>${ev.orbita ? t('resultado.orbitaSi', { peri: nf(ev.perilunioKm), apo: nf(ev.apolunioKm) }) : t('resultado.orbitaNo')}</dd>
      <dt>${t('resultado.lugares')}</dt><dd>${ev.lugares.length} / ${m.dest.lugares.length}</dd>
      <dt>${t('resultado.dvUsado')}</dt><dd>${nf(ev.dvUsado)} / ${nf(M.AJUSTES.dvMax)} m/s</dd>
      <dt>${t('resultado.tiempo')}</dt><dd>${hms(ev.tiempoMision)}</dd>
    </dl>
    <ul>${m.observados.map((o) => { const l = m.dest.lugares.find((x) => x.id === o.id); return `<li>★ ${tx(l.nombre)} — ${t('resultado.calidad', { q: nf(o.calidad * 100) })}</li>`; }).join('')}</ul>
    ${consejo ? `<p class="nota">${consejo}</p>` : ''}
    <div class="pil-pie-dialogo"><button class="pil-btn principal" id="pil-reintentar" type="button">${t('resultado.reintentar')}</button></div>`;
  abrir(dlg);
  $('pil-reintentar').addEventListener('click', reintentar, { once: true });
}

function reintentar() {
  cerrar($('pil-resultado'));
  m = M.crearMision('luna');
  registro = []; finMostrado = false; faseAnterior = 'espera'; senalAnterior = true; objetivo = null;
  escena?.reiniciar(m);
  anotar(t('log.inicio', { cuerpo: tx(m.cuerpo.nombre) }));
  pausado = false;
}

// --- Bucle ----------------------------------------------------------------------------------------------------------------
function vigilarEventos() {
  if (m.captura.fase !== faseAnterior) {
    if (m.captura.fase === 'lista') {
      const el = M.elementosActuales(m);
      anotar(t('log.capturaLista', { peri: nf((el.periapsis - m.cuerpo.radio) / 1000), apo: nf((el.apoapsis - m.cuerpo.radio) / 1000) }), 'ok');
      pitido(660);
    } else if (m.captura.fase === 'sin-dv') anotar(t('log.capturaSinDv'), 'mal');
    faseAnterior = m.captura.fase;
  }
  const hayEnlace = !M.sinSenal(m);
  if (hayEnlace !== senalAnterior) { anotar(hayEnlace ? t('log.conSenal') : t('log.sinSenal'), hayEnlace ? 'ok' : 'mal'); senalAnterior = hayEnlace; }
}

function cuadro(ahora) {
  const dt = Math.min(0.1, (ahora - (ultimoReal || ahora)) / 1000);
  ultimoReal = ahora;
  if (!pausado && !m.fin) {
    const c = controles();
    if ((c.guinada || c.cabeceo || c.alabeo) && ['progrado', 'retrogrado', 'planeta', 'lugar', 'captura'].includes(m.piloto)) M.fijarPiloto(m, null);
    M.avanzar(m, dt, c);
    vigilarEventos();
  }
  sonidoMotor(!pausado && m.motor !== 0);
  $('pil-llama').classList.toggle('on', m.motor !== 0 && !pausado);
  escena?.actualizar();
  escena?.dibujar();
  if (cuadroN++ % 4 === 0) { pintarHUD(); pintarLugares(); pintarMira(); }
  pintarEtiquetas();
  if (m.fin && !finMostrado) { finMostrado = true; mostrarResultado(); }
  requestAnimationFrame(cuadro);
}

// --- Arranque ----------------------------------------------------------------------------------------------------------
export const api = {
  get mision() { return m; },
  get escena() { return escena; },
  empezar, reintentar, accionCapturar, accionEscanear, accionPiloto, alternarPausa, accionTerminar,
  cuadro: (dtSeg) => { ultimoReal = 0; cuadro(1000); cuadro(1000 + dtSeg * 1000); },
  pausado: () => pausado, registro: () => registro,
};

async function arrancar() {
  m = M.crearMision('luna');
  textosEstaticos();
  try {
    const { crearEscenaPilotaje } = await import('./cuerpos.js');
    escena = crearEscenaPilotaje($('pil-canvas'), m, { reducirMovimiento, renderer: globalThis.__pilotajeRenderer ?? null, cargarTextura: globalThis.__pilotajeTextura ?? null }); // los ganchos solo los usan las pruebas
    addEventListener('resize', () => escena.tamano());
    if (escena.fallos.length) console.warn('Texturas que no cargaron:', escena.fallos);
  } catch (err) {
    console.warn('Sin vista 3D:', err);
    const a = $('pil-aviso'); a.hidden = false; a.textContent = t('sinWebGL');
    setTimeout(() => { a.hidden = true; }, 6000);
  }
  anotar(t('log.inicio', { cuerpo: tx(m.cuerpo.nombre) }));
  addEventListener('keydown', alPresionar);
  addEventListener('keyup', alSoltar);
  addEventListener('blur', () => teclas.clear());
  const lienzo = $('pil-canvas');
  lienzo.addEventListener('pointerdown', (e) => { arrastre.activo = true; arrastre.x = e.clientX; arrastre.y = e.clientY; lienzo.setPointerCapture?.(e.pointerId); });
  lienzo.addEventListener('pointermove', (e) => { if (!arrastre.activo) return; arrastre.dx += e.clientX - arrastre.x; arrastre.dy += e.clientY - arrastre.y; arrastre.x = e.clientX; arrastre.y = e.clientY; });
  const soltar = () => { arrastre.activo = false; };
  lienzo.addEventListener('pointerup', soltar); lienzo.addEventListener('pointercancel', soltar);
  $('pil-idioma').addEventListener('click', () => {
    idioma = idioma === 'es' ? 'en' : 'es';
    try { localStorage.setItem(LLAVE_IDIOMA, idioma); } catch { /* sin almacenamiento */ }
    textosEstaticos();
    if ($('pil-briefing').open) mostrarBriefing();
    if ($('pil-resultado').open) mostrarResultado();
  });
  mostrarBriefing();
  requestAnimationFrame(cuadro);
}

if (typeof document !== 'undefined' && $('pil-canvas')) {
  arrancar().catch((err) => {
    console.error(err);
    const a = $('pil-aviso'); a.hidden = false; a.textContent = `${t('errorCarga')}: ${err.message}`;
  });
}
