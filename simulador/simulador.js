// OWNER: Rol 3 (@JU4NMAX) — Simulador de cohetes reales · interfaz.
// La física está en ascenso.js (probada en Node) y la vista 3D en escena.js.
// Si el navegador no tiene WebGL, todo sigue funcionando sin la vista 3D (avisos, panel ⓘ y resultado).
// Pantalla completa: el 3D ocupa la ventana; HUD mínimo, avisos que se desvanecen, ⚙ ajustes e ⓘ información.
// Modo incrustado (?rocket=…&lock=1&embed=1): lo usa el Nivel 3 con el cohete de la misión. Ver embed.js.
import { simular, cargaMaxima } from './ascenso.js';
import { t as L, tr, getLang, setLang } from './textos.js';
import { leerParametros, mensajeFin, SIM_LANG } from './embed.js';

const $ = (id) => document.getElementById(id);
const nf = (n, d = 0) => Number(n).toLocaleString(getLang() === 'en' ? 'en-US' : 'es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
const reloj = (t) => {
  const a = Math.abs(t);
  if (t < 0) return `T−${Math.floor(a / 60)}:${String(Math.ceil(a % 60)).padStart(2, '0')}`;
  return `T+${Math.floor(a / 60)}:${String(Math.floor(a % 60)).padStart(2, '0')}`;
};
const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
const nombreCorto = (c) => tr(c.nombre).replace(/ \(.*\)$/, '');

let datos;
let modo = { rocketId: null, lock: false, embed: false }; // parámetros de la URL (embed.js)
let cohete;          // el elegido (de cohetes.json)
let escena = null;   // null si no hay WebGL
let sim = null;      // resultado de simular()
let t = 0;           // tiempo de reproducción (s simulados; negativo durante la secuencia de encendido)
let corriendo = false;
let pendientes = []; // eventos aún no mostrados
let ultimoReal = 0;
let etapaActual = '';
let frenoSep = 0;    // ventana (s reales) de cámara lenta automática al desprender piezas
// Estado para volver a pintar todo al cambiar de idioma (los textos se traducen al mostrarlos, no al guardarlos)
let bitacora = [];   // eventos ya mostrados
let fase = 'espera'; // espera | orbita
let ultimoHud = null;
let fichaEtapa = null;
let cargaMax = null; // { directo, asistido }; se calcula al abrir ⓘ tras el vuelo
let enPausa = false;

// --- Pestañas y ficha -------------------------------------------------------------
function pintarPestanas() {
  const tabs = $('sim-tabs');
  tabs.replaceChildren();
  // Con el cohete fijado (lock) solo se muestra el de la misión, sin poder cambiarlo
  for (const c of modo.lock ? [cohete] : datos.cohetes) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sim-tab';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(c.id === cohete.id));
    b.innerHTML = `<b>${modo.lock ? '🔒 ' : ''}${nombreCorto(c)}</b><small>${tr(c.mision.nombre)} → ${tr(datos.destinos[c.mision.destino].nombre)}</small>`;
    if (modo.lock) {
      b.classList.add('is-locked');
      b.setAttribute('aria-disabled', 'true');
      b.title = L('lockedRocket');
    } else {
      b.addEventListener('click', () => elegir(c.id));
    }
    tabs.append(b);
  }
}

function pintarFicha() {
  const c = cohete;
  const motores = c.fases.map((f) => `${tr(f.nombre)}: ${f.motores.map((m) => `${m.n}× ${tr(m.nombre)}`).join(' + ')}`).join(' · ');
  const masaTotal = c.fases.reduce((s, f) => s + f.seco + f.propelente + (f.extra || []).reduce((e, x) => e + x.masa, 0), 0)
    + c.masasFijas.reduce((s, m) => s + m.masa, 0) + c.mision.masaNave;
  $('sim-ficha').innerHTML = `
    <div><dt>${L('fMission')}</dt><dd>${tr(c.mision.nombre)} · ${tr(c.mision.fecha)}</dd></div>
    <div><dt>${L('fDest')}</dt><dd>${tr(datos.destinos[c.mision.destino].nombre)}</dd></div>
    <div><dt>${L('fSite')}</dt><dd>${tr(c.mision.sitio)}</dd></div>
    <div><dt>${L('fMass')}</dt><dd>${nf(masaTotal / 1000, 1)} t</dd></div>
    <div class="sim-wide"><dt>${L('fPayload')}</dt><dd>${tr(c.mision.nave)} · ${nf(c.mision.masaNave)} kg</dd></div>
    <div class="sim-wide"><dt>${L('fStages')}</dt><dd>${motores}</dd></div>
    ${c.mision.rutaReal ? `<div class="sim-wide"><dt>${L('fRoute')}</dt><dd>${tr(c.mision.rutaReal)}</dd></div>` : ''}`;
}

function configurarCarga() {
  const real = cohete.mision.masaNave;
  const tope = { 'saturno-v': 80000, 'atlas-agena-d': 1000, 'falcon-heavy': 25000 }[cohete.id] ?? real * 3;
  const s = $('sim-carga');
  s.max = tope;
  s.step = tope >= 10000 ? 100 : 1;
  s.value = real;
  pintarCarga();
}

function pintarCarga() {
  const v = Number($('sim-carga').value);
  $('sim-carga-val').textContent = `${nf(v)} kg${v === cohete.mision.masaNave ? ` ${L('real')}` : ''}`;
}

function elegir(id) {
  if (modo.lock && id !== cohete.id) return; // el cohete de la misión no se cambia
  cohete = datos.cohetes.find((c) => c.id === id);
  detener();
  pintarPestanas();
  pintarFicha();
  configurarCarga();
  reiniciarVista();
}

// --- HUD, avisos, bitácora, inspección 3D y resultado ------------------------------
function capaAtmosferica(e) {
  const h = e.h ?? 0;
  const vRel = e.vRel ?? Math.hypot(e.vr ?? 0, e.vt ?? 0);
  if (h < 5 && (e.empuje ?? 0) === 0) return L('layer.pad');
  if (h > 3500 && h < 18500 && vRel >= 280 && vRel <= 410) return L('layer.maxq');
  if (h < 11000) return L('layer.tropo');
  if (h < 50000) return L('layer.strato');
  if (h < 85000) return L('layer.meso');
  if (h < 100000) return L('layer.termo');
  return L('layer.space');
}

/** HUD mínimo (tiempo, altitud, velocidad) creado una vez; el resto de los datos va al panel ⓘ. */
let hudNodos = null;
function armarHud() {
  $('sim-hud').innerHTML = `
    <div class="sim-hud-tiempo" id="hud-t">T+0:00</div>
    <div class="sim-hud-fila">
      <div class="sim-hud-dato"><b id="hud-h">0</b><span id="hud-h-u"></span></div>
      <div class="sim-hud-dato"><b id="hud-v">0</b><span id="hud-v-u"></span></div>
    </div>
    <div class="sim-hud-etapa" id="hud-etapa"></div>
    <div class="sim-telemetria" id="hud-tele" hidden><i></i><span></span></div>`;
  hudNodos = { t: $('hud-t'), h: $('hud-h'), hu: $('hud-h-u'), v: $('hud-v'), vu: $('hud-v-u'), etapa: $('hud-etapa'), tele: $('hud-tele') };
}

function hud(e) {
  ultimoHud = e;
  if (!hudNodos) armarHud();
  hudNodos.t.textContent = reloj(e.t);
  hudNodos.h.textContent = nf(Math.max(0, e.h) / 1000, 1);
  hudNodos.hu.textContent = L('hAltUnit');
  hudNodos.v.textContent = nf(Math.hypot(e.vr ?? 0, e.vt ?? 0) / 1000, 2);
  hudNodos.vu.textContent = L('hSpeedUnit');
  hudNodos.etapa.textContent = etapaActual ? tr(etapaActual) : '';
  hudNodos.tele.hidden = !sim || e.t <= 0;
  hudNodos.tele.querySelector('span').textContent = L('telemetry', { cohete: nombreCorto(cohete) });
  $('sim-hud-extra').innerHTML = `
    <div><dt>${L('hAcc')}</dt><dd>${nf(e.a ?? 0, 1)} g</dd></div>
    <div><dt>${L('hMass')}</dt><dd>${nf(e.masa / 1000, 1)} t</dd></div>
    <div><dt>${L('hThrust')}</dt><dd>${nf((e.empuje ?? 0) / 1000)} kN</dd></div>
    <div><dt>${L('hAlt')}</dt><dd>${capaAtmosferica(e)}</dd></div>`;
}

/** Pulso del rótulo de telemetría con cada onda que sale del cohete. */
function pulsoTelemetria() {
  const el = hudNodos?.tele;
  if (!el || el.hidden) return;
  el.classList.remove('is-pulso');
  void el.offsetWidth;
  el.classList.add('is-pulso');
}

function mostrarFichaEtapa(id, info) {
  const card = $('sim-etapa-card');
  if (!card) return;
  if (!id || !info) {
    fichaEtapa = null;
    card.hidden = true;
    card.replaceChildren();
    return;
  }
  fichaEtapa = { id, info };
  const specs = (info.datos || [])
    .map(([k, v]) => `<div><dt>${tr(k)}</dt><dd>${tr(v)}</dd></div>`)
    .join('');
  card.hidden = false;
  card.innerHTML = `
    <div class="sim-etapa-head">
      <div>
        <span class="sim-etapa-badge ${info.separada ? 'is-sep' : 'is-attached'}">${info.separada ? L('separated') : L('attached')}</span>
        <h3>${tr(info.titulo)}</h3>
        ${info.subtitulo ? `<p class="sim-etapa-sub">${tr(info.subtitulo)}</p>` : ''}
      </div>
      <button type="button" class="sim-etapa-close" id="sim-etapa-cerrar" aria-label="${L('closeInspect')}">✕</button>
    </div>
    ${info.detalle ? `<p class="sim-etapa-desc">${tr(info.detalle)}</p>` : ''}
    ${specs ? `<dl class="sim-etapa-specs">${specs}</dl>` : ''}
    <div class="sim-etapa-actions">
      <button type="button" class="sim-btn" id="sim-etapa-enfocar">${L('focusStage')}</button>
    </div>`;
  $('sim-etapa-cerrar')?.addEventListener('click', () => escena?.deseleccionar());
  $('sim-etapa-enfocar')?.addEventListener('click', () => escena?.enfocarEtapa(id));
}

/** Texto de un evento: los de la interfaz llevan `clave`; los de la simulación, `texto` en español. */
const textoEvento = (e) => (e.clave ? L(e.clave) : tr(e.texto));

function lineaBitacora(e) {
  const li = document.createElement('li');
  let extra = '';
  if (typeof e.historico === 'number') {
    const d = (100 * (e.t - e.historico)) / e.historico;
    extra = `<small class="${Math.abs(d) <= 15 ? 'is-ok' : 'is-warn'}">${L('logReal', { t: reloj(e.historico), d: `${d >= 0 ? '+' : ''}${nf(d, 1)}` })}</small>`;
  }
  li.innerHTML = `<time>${reloj(e.t)}</time><span>${textoEvento(e)}${extra}</span>`;
  return li;
}

function registrar(e) {
  bitacora.push(e);
  $('sim-log').append(lineaBitacora(e));
  avisar(e);
  if (e.tipo === 'encendido') etapaActual = e.texto.replace('Encendido: ', '');
}

/** Aviso breve sobre el 3D: como máximo 3 a la vez, se desvanece a los ~5 s. */
function avisar(e) {
  const lista = $('sim-avisos');
  const li = document.createElement('li');
  li.innerHTML = `<time>${reloj(e.t)}</time><span>${textoEvento(e)}</span>`;
  lista.append(li);
  while (lista.children.length > 3) lista.firstElementChild.remove();
  setTimeout(() => li.classList.add('is-sale'), 4200);
  setTimeout(() => li.remove(), 5000);
}

function medidor(etiqueta, valor, meta, escalaMax, nivel) {
  const pct = (v) => Math.max(0, Math.min(100, (v / escalaMax) * 100));
  return `<div class="sim-medidor ${nivel}">
    <div class="sim-medidor-head"><span>${etiqueta}</span><b>${nf(valor, 1)} / ${nf(meta, 1)} km²/s²</b></div>
    <div class="sim-track"><div class="sim-fill" style="width:${pct(valor)}%"></div><i class="sim-marca" style="left:${pct(meta)}%"></i></div>
  </div>`;
}

const botonCerrarResultado = () => `<button class="sim-icono" type="button" data-cerrar="sim-resultado" aria-label="${L('closeResult')}">✕</button>`;

/**
 * Fin del vuelo: el cohete se queda donde terminó (sin botón ni cambio de vista). Arriba aparece un
 * cartel breve y el detalle (órbita, energía para el destino, carga máxima) queda en el panel ⓘ.
 * Se vuelve a llamar al cambiar de idioma.
 */
function pintarResultado(conCartel = false) {
  const info = $('sim-info-resultado');
  const box = $('sim-resultado');
  if (fase === 'espera' || !sim) {
    info.innerHTML = `<p class="sim-muted">${L('resultIdle')}</p>`;
    box.hidden = true;
    return;
  }
  if (conCartel) box.hidden = false;
  if (!sim.ok) {
    box.className = 'sim-resultado sim-bad';
    box.innerHTML = `<b>${L('bannerFail')}</b><span>${L('bannerFailHelp', { motivo: tr(sim.motivo) })}</span>${botonCerrarResultado()}`;
    info.innerHTML = `<p class="sim-veredicto sim-bad">❌ ${tr(sim.motivo)}.</p><p class="sim-muted">${L('failTitle')}</p>`;
    return;
  }
  const i = sim.insercion;
  const s = sim.salida;
  box.className = 'sim-resultado sim-ok';
  box.innerHTML = `<b>${L('bannerOk')}</b><span>${nf(i.perigeoKm)} × ${nf(i.apogeoKm)} km · ${reloj(i.t)}</span>${botonCerrarResultado()}`;
  const destino = tr(datos.destinos[cohete.mision.destino].nombre);
  const v = { dest: destino, c3: nf(s.c3, 1), req: nf(s.c3Requerido, 1), ruta: tr(cohete.mision.rutaReal) };
  let veredicto;
  if (s.llegaDirecto) veredicto = `<p class="sim-veredicto sim-ok">${L('vWould', v)}</p>`;
  else if (s.llegaAsistido) veredicto = `<p class="sim-veredicto sim-warn">${L('vAssisted', v)}</p>`;
  else veredicto = `<p class="sim-veredicto sim-bad">${L('vWouldFail', v)}</p>`;
  const tope = Math.max(s.c3, s.c3Requerido, 10) * 1.15;
  const max = cargaMax
    ? `${L('maxDirect', { n: nf(cargaMax.directo) })}${cargaMax.asistido != null ? L('maxAssist', { n: nf(cargaMax.asistido) }) : ''}`
    : cargaMax === null && calculandoMax ? L('calculating') : L('maxOnOpen');
  info.innerHTML = `
    <p class="sim-veredicto sim-ok">${L('orbitOk', { p: nf(i.perigeoKm), a: nf(i.apogeoKm), t: reloj(i.t) })}</p>
    <dl class="sim-datos">
      <div><dt>${L('vOrbital')}</dt><dd>${nf(i.v / 1000, 2)} km/s</dd></div>
      <div><dt>${L('mOrbit')}</dt><dd>${nf(i.masa)} kg</dd></div>
      <div><dt>${L('propLeft')}</dt><dd>${nf(s.propRestante)} kg</dd></div>
      <div><dt>${L('dvAvail')}</dt><dd>${nf(s.dv)} m/s</dd></div>
    </dl>
    ${veredicto}
    ${medidor(L('mC3', { dest: destino }), s.c3, s.c3Requerido, tope, s.llegaDirecto ? 'sim-ok' : 'sim-bad')}
    <dl class="sim-datos"><div class="sim-wide"><dt>${L('dMax')}</dt><dd id="sim-max">${max}</dd></div></dl>`;
}

/** La carga máxima repite la simulación varias veces: solo se calcula si se abre ⓘ tras el vuelo. */
let calculandoMax = false;
function calcularCargaMaxima() {
  if (cargaMax || calculandoMax || fase !== 'orbita' || !sim?.ok) return;
  calculandoMax = true;
  pintarResultado();
  const simActual = sim;
  setTimeout(() => {
    calculandoMax = false;
    if (sim !== simActual) return; // el jugador reinició mientras tanto
    const directo = cargaMaxima(cohete, datos, { directo: true });
    const asistido = cohete.mision.rutaReal ? cargaMaxima(cohete, datos, { directo: false }) : null;
    cargaMax = { directo, asistido };
    pintarResultado();
  }, 50);
}

function mostrarOrbita() {
  fase = 'orbita';
  pintarResultado(true);
  if (!$('sim-info').hidden) calcularCargaMaxima();
}

/**
 * Incrustado: avisa a la página que lo contiene (Nivel 3) que el cohete llegó a órbita.
 * Si no llegó, no avisa: el jugador reinicia (o baja la carga en ⚙) y vuelve a lanzar.
 */
function avisarFin() {
  if (!modo.embed || !sim?.ok || window.parent === window) return;
  window.parent.postMessage(mensajeFin(sim, cohete), location.origin);
}

// --- Reproducción ---------------------------------------------------------------------
function estadoEn(tt) {
  const S = sim.serie;
  // Secuencia de encendido (t < 0): motores encendidos y el cohete todavía sujeto en la rampa
  if (tt < 0) return { ...S[0], t: tt, h: 0, vr: 0, vt: 0, vRel: 0, a: 0, empuje: S[0].empuje || 1 };
  if (tt <= S[0].t) return S[0];
  if (tt >= S.at(-1).t) return S.at(-1);
  let i = Math.min(S.length - 2, Math.floor(tt / (S[1].t - S[0].t)));
  while (i > 0 && S[i].t > tt) i--;
  while (i < S.length - 2 && S[i + 1].t < tt) i++;
  const a = S[i]; const b = S[i + 1]; const k = (tt - a.t) / (b.t - a.t || 1);
  const out = { t: tt };
  for (const key of ['x', 'y', 'h', 'vr', 'vt', 'vRel', 'masa', 'a', 'empuje', 'pitch']) {
    out[key] = (a[key] ?? b[key] ?? 0) + ((b[key] ?? a[key] ?? 0) - (a[key] ?? b[key] ?? 0)) * k;
  }
  out.empuje = a.empuje; // el empuje cambia de golpe en las separaciones
  out.grupo = a.grupo;
  return out;
}

function lanzar() {
  sim = simular(cohete, datos, { masaNave: Number($('sim-carga').value), muestreo: 0.25 });
  reiniciarVista();
  // Los motores encienden antes del despegue (dato con fuente en cohetes.json → visual.encendidoPrevio)
  t = reducir ? 0 : -(cohete.visual?.encendidoPrevio ?? 0);
  if (t < 0) registrar({ t, clave: 'preIgnition', tipo: 'previo' });
  pendientes = [...sim.eventos.filter((e) => e.tipo !== 'salida')];
  corriendo = true;
  enPausa = false;
  pintarPausa();
  $('sim-lanzar').hidden = true;
  $('sim-pausa').hidden = false;
  $('sim-reiniciar').hidden = false;
  $('sim-carga').disabled = true;
  cerrarPaneles();
}

function detener() {
  corriendo = false;
  sim = null;
  enPausa = false;
  pintarPausa();
  $('sim-lanzar').hidden = false;
  $('sim-pausa').hidden = true;
  $('sim-reiniciar').hidden = true;
  $('sim-carga').disabled = false;
}

function reiniciarVista() {
  t = 0;
  frenoSep = 0;
  etapaActual = '';
  $('sim-log').replaceChildren();
  $('sim-avisos').replaceChildren();
  bitacora = [];
  fase = 'espera';
  cargaMax = null;
  calculandoMax = false;
  pintarResultado();
  escena?.cargarCohete(cohete.id, cohete.mision.latitud, cohete.visual);
  ponerCamara($('sim-camara').value === 'global' ? 'auto' : $('sim-camara').value);
  const masaInicial = cohete.fases.reduce((s, f) => s + f.seco + f.propelente + (f.extra || []).reduce((e, x) => e + x.masa, 0), 0)
    + cohete.masasFijas.reduce((s, m) => s + m.masa, 0) + Number($('sim-carga').value || cohete.mision.masaNave);
  hud({ t: 0, h: 0, vr: 0, vt: 0, vRel: 0, masa: masaInicial, a: 0, empuje: 0 });
}

function cuadro(ahora) {
  const dtReal = Math.min(0.1, (ahora - (ultimoReal || ahora)) / 1000);
  ultimoReal = ahora;
  let dtSim = 0;
  if (corriendo && sim) {
    const velUsuario = Number($('sim-velocidad').value);
    // La secuencia de encendido se ve a ritmo real (×1); las separaciones, a ×2.5 como máximo
    const velEfectiva = t < 0 ? 1 : frenoSep > 0 ? Math.min(velUsuario, 2.5) : velUsuario;
    frenoSep = Math.max(0, frenoSep - dtReal);
    dtSim = dtReal * velEfectiva;
    t = Math.min(t + dtSim, sim.serie.at(-1).t);
    const e = estadoEn(t);
    escena?.ponerEstado(e);
    let huboSuelta = false;
    while (pendientes.length && pendientes[0].t <= t) {
      const ev = pendientes.shift();
      registrar(ev);
      if (ev.tipo === 'separacion') { escena?.soltar(ev.fase, e); huboSuelta = true; }
      if (ev.tipo === 'suelta') { escena?.soltar(ev.item, e); huboSuelta = true; }
    }
    if (huboSuelta) {
      frenoSep = 2.4;
      escena?.ponerEstado(e);
    }
    hud(e);
    if (t >= sim.serie.at(-1).t) {
      corriendo = false;
      $('sim-pausa').hidden = true;
      mostrarOrbita();
      avisarFin();
    }
  }
  escena?.dibujar(dtSim, dtReal);
  requestAnimationFrame(cuadro);
}

// --- Cámara y paneles ----------------------------------------------------------------
const CICLO_CAMARAS = ['auto', 'persecucion', 'seguimiento', 'onboard', 'global'];
function ponerCamara(m) {
  $('sim-camara').value = m;
  $('sim-b-camara-txt').textContent = L(`camShort.${m}`);
  escena?.setCamara(m);
}
function siguienteCamara() {
  const i = CICLO_CAMARAS.indexOf($('sim-camara').value);
  ponerCamara(CICLO_CAMARAS[(i + 1) % CICLO_CAMARAS.length]);
}

function cerrarPaneles(excepto = null) {
  for (const id of ['sim-ajustes', 'sim-info']) {
    if (id === excepto) continue;
    $(id).hidden = true;
    document.querySelector(`[aria-controls="${id}"]`)?.setAttribute('aria-expanded', 'false');
  }
}
function alternarPanel(id) {
  const abrir = $(id).hidden;
  cerrarPaneles(id);
  $(id).hidden = !abrir;
  document.querySelector(`[aria-controls="${id}"]`)?.setAttribute('aria-expanded', String(abrir));
  if (abrir && id === 'sim-info') calcularCargaMaxima();
}

// --- Idioma ---------------------------------------------------------------------------
function pintarPausa() {
  $('sim-pausa').textContent = enPausa ? L('resume') : L('pause');
}

/** Aplica el idioma activo a toda la página; `repintar` vuelve a dibujar lo que ya estaba en pantalla. */
function aplicarIdioma(repintar = true) {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.title = `${L('title')} · ${L('brand')}`;
  for (const n of document.querySelectorAll('[data-i18n]')) if (n.id !== 'sim-pausa') n.textContent = L(n.dataset.i18n);
  for (const n of document.querySelectorAll('[data-i18n-html]')) n.innerHTML = L(n.dataset.i18nHtml);
  for (const n of document.querySelectorAll('[data-i18n-aria]')) n.setAttribute('aria-label', L(n.dataset.i18nAria));
  for (const n of document.querySelectorAll('[data-i18n-title]')) n.setAttribute('title', L(n.dataset.i18nTitle));
  const b = $('sim-lang');
  b.textContent = L('lang');
  b.setAttribute('aria-label', L('langLabel'));
  b.lang = lang === 'es' ? 'en' : 'es'; // el botón muestra el nombre del OTRO idioma
  pintarPausa();
  $('sim-b-camara-txt').textContent = L(`camShort.${$('sim-camara').value}`);
  if (!repintar || !cohete) return;
  pintarPestanas();
  pintarFicha();
  pintarCarga();
  $('sim-log').replaceChildren(...bitacora.map(lineaBitacora));
  pintarResultado();
  if (ultimoHud) hud(ultimoHud);
  if (fichaEtapa) mostrarFichaEtapa(fichaEtapa.id, fichaEtapa.info);
}

// --- Modelo original (armado / despiezado) ------------------------------------------
function abrirModelo(vista = 'modelo') {
  const dlg = $('sim-dialog');
  $('sim-iframe').src = cohete[vista];
  for (const b of dlg.querySelectorAll('[data-vista]')) b.setAttribute('aria-selected', String(b.dataset.vista === vista));
  if (!dlg.open) dlg.showModal();
}

// --- Arranque ----------------------------------------------------------------------
async function arrancar() {
  datos = await fetch('cohetes.json').then((r) => r.json());
  modo = leerParametros(location.search, datos.cohetes);
  cohete = datos.cohetes.find((c) => c.id === modo.rocketId) ?? datos.cohetes[0];
  if (modo.embed) {
    document.body.classList.add('sim-embed');
    // El idioma lo manda la página que lo contiene (su botón ES/EN)
    addEventListener('message', (e) => {
      if (e.source !== window.parent || e.origin !== location.origin || e.data?.type !== SIM_LANG) return;
      setLang(e.data.lang);
      aplicarIdioma();
    });
  }
  try {
    const { crearEscena } = await import('./escena.js');
    escena = crearEscena($('sim-canvas'), { reducirMovimiento: reducir });
    escena.setSeleccion(mostrarFichaEtapa);
    escena.setAlOnda?.(pulsoTelemetria);
    addEventListener('resize', () => escena.tamano());
  } catch (err) {
    console.warn('Sin vista 3D:', err);
    const aviso = $('sim-aviso');
    aviso.hidden = false;
    aviso.dataset.i18n = 'noWebgl';
  }
  aplicarIdioma(false);
  elegir(cohete.id);

  $('sim-lanzar').addEventListener('click', lanzar);
  $('sim-pausa').addEventListener('click', () => {
    if (!sim || t >= sim.serie.at(-1).t) return;
    corriendo = !corriendo;
    enPausa = !corriendo;
    pintarPausa();
  });
  $('sim-lang').addEventListener('click', () => { setLang(getLang() === 'es' ? 'en' : 'es'); aplicarIdioma(); });
  $('sim-reiniciar').addEventListener('click', () => { detener(); reiniciarVista(); });
  $('sim-camara').addEventListener('change', (e) => ponerCamara(e.target.value));
  $('sim-b-camara').addEventListener('click', siguienteCamara);
  $('sim-b-ajustes').addEventListener('click', () => alternarPanel('sim-ajustes'));
  $('sim-b-info').addEventListener('click', () => alternarPanel('sim-info'));
  document.addEventListener('click', (e) => {
    const id = e.target.closest?.('[data-cerrar]')?.dataset.cerrar;
    if (!id) return;
    if (id === 'sim-resultado') $(id).hidden = true;
    else cerrarPaneles();
  });
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, select, textarea, button, a') && e.key !== 'Escape') return;
    if (e.key === 'Escape') cerrarPaneles();
    if (e.key === 'c' || e.key === 'C') siguienteCamara();
    if (e.key === ' ' && !$('sim-dialog').open) {
      e.preventDefault();
      if (!sim) lanzar();
      else $('sim-pausa').click();
    }
  });
  $('sim-panorama')?.addEventListener('change', (e) => escena?.setPanorama(e.target.value));
  $('sim-carga').addEventListener('input', pintarCarga);
  $('sim-modelo').addEventListener('click', () => abrirModelo('modelo'));
  for (const b of document.querySelectorAll('#sim-dialog [data-vista]')) b.addEventListener('click', () => abrirModelo(b.dataset.vista));
  $('sim-cerrar').addEventListener('click', () => { $('sim-dialog').close(); $('sim-iframe').src = 'about:blank'; });
  requestAnimationFrame(cuadro);
}

arrancar().catch((err) => {
  console.error(err);
  const box = $('sim-resultado');
  box.hidden = false;
  box.className = 'sim-resultado sim-bad';
  box.innerHTML = `<span>${L('loadErr', { msg: err.message })}</span>`;
});
