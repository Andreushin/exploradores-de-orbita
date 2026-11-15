// OWNER: Rol 3 (@JU4NMAX) — Simulador de cohetes reales · interfaz.
// La física está en ascenso.js (probada en Node) y la vista 3D en escena.js.
// Si el navegador no tiene WebGL, todo sigue funcionando sin la vista 3D (bitácora, HUD y resultado).
import { simular, cargaMaxima } from './ascenso.js';
import { t as L, tr, getLang, setLang } from './textos.js';

const $ = (id) => document.getElementById(id);
const nf = (n, d = 0) => Number(n).toLocaleString(getLang() === 'en' ? 'en-US' : 'es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
const reloj = (t) => `T+${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;

let datos;
let cohete;          // el elegido (de cohetes.json)
let escena = null;   // null si no hay WebGL
let sim = null;      // resultado de simular()
let t = 0;           // tiempo de reproducción (s simulados)
let corriendo = false;
let pendientes = []; // eventos aún no mostrados
let ultimoReal = 0;
let etapaActual = '';
let frenoSep = 0;    // ventana (s reales) de cámara lenta automática al desprender piezas
// Estado para volver a pintar todo al cambiar de idioma (los textos se traducen al mostrarlos, no al guardarlos)
let bitacora = [];   // eventos ya mostrados
let fase = 'espera'; // qué muestra «Resultado»: espera | orbita | salida
let ultimoHud = null;
let fichaEtapa = null;
let cargaMax = null; // { directo, asistido } de la salida ya calculada
let enPausa = false;

// --- Pestañas y ficha -------------------------------------------------------------
function pintarPestanas() {
  const tabs = $('sim-tabs');
  tabs.replaceChildren();
  for (const c of datos.cohetes) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sim-tab';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(c.id === cohete.id));
    b.innerHTML = `${tr(c.nombre)}<small>${tr(c.mision.nombre)} → ${tr(datos.destinos[c.mision.destino].nombre)}</small>`;
    b.addEventListener('click', () => elegir(c.id));
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
    <div><dt>${L('fPayload')}</dt><dd>${tr(c.mision.nave)} · ${nf(c.mision.masaNave)} kg</dd></div>
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
  cohete = datos.cohetes.find((c) => c.id === id);
  detener();
  pintarPestanas();
  pintarFicha();
  configurarCarga();
  reiniciarVista();
}

// --- HUD, bitácora, inspección 3D y resultado ----------------------------------------
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

function hud(e) {
  ultimoHud = e;
  $('sim-hud').innerHTML = `
    <span>${L('hTime')}</span><b>${reloj(e.t)}</b>
    <span>${L('hAlt')}</span><b>${nf(e.h / 1000, 1)} km</b>
    <span>${L('hSpeed')}</span><b>${nf(Math.hypot(e.vr ?? 0, e.vt ?? 0) / 1000, 2)} km/s</b>
    <span>${L('hAcc')}</span><b>${nf(e.a ?? 0, 1)} g</b>
    <span>${L('hMass')}</span><b>${nf(e.masa / 1000, 1)} t</b>
    <span>${L('hThrust')}</span><b>${nf((e.empuje ?? 0) / 1000)} kN</b>
    <span class="sim-hud-capa">${capaAtmosferica(e)}</span>
    ${etapaActual ? `<span class="sim-hud-etapa">${tr(etapaActual)}</span>` : `<span class="sim-hud-hint">${L('hHint')}</span>`}`;
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

function lineaBitacora(e) {
  const li = document.createElement('li');
  let extra = '';
  if (typeof e.historico === 'number') {
    const d = (100 * (e.t - e.historico)) / e.historico;
    extra = `<small class="${Math.abs(d) <= 15 ? 'is-ok' : 'is-warn'}">${L('logReal', { t: reloj(e.historico), d: `${d >= 0 ? '+' : ''}${nf(d, 1)}` })}</small>`;
  }
  li.innerHTML = `<time>${reloj(e.t)}</time><span>${tr(e.texto)}${extra}</span>`;
  return li;
}

function registrar(e) {
  bitacora.push(e);
  const li = lineaBitacora(e);
  $('sim-log').append(li);
  li.scrollIntoView?.({ block: 'nearest' });
  if (e.tipo === 'encendido') etapaActual = e.texto.replace('Encendido: ', '');
}

function medidor(etiqueta, valor, meta, escalaMax, nivel) {
  const pct = (v) => Math.max(0, Math.min(100, (v / escalaMax) * 100));
  return `<div class="sim-medidor ${nivel}">
    <div class="sim-medidor-head"><span>${etiqueta}</span><b>${nf(valor, 1)} / ${nf(meta, 1)} km²/s²</b></div>
    <div class="sim-track"><div class="sim-fill" style="width:${pct(valor)}%"></div><i class="sim-marca" style="left:${pct(meta)}%"></i></div>
  </div>`;
}

/** Pinta el recuadro «Resultado» según la fase (se vuelve a llamar al cambiar de idioma). */
function pintarResultado() {
  const box = $('sim-resultado');
  const cabecera = `<h2>${L('resultTitle')}</h2>`;
  if (fase === 'espera' || !sim) {
    box.innerHTML = `${cabecera}<p class="sim-muted">${L('resultIdle')}</p>`;
    return;
  }
  const destino = tr(datos.destinos[cohete.mision.destino].nombre);
  if (fase === 'orbita') {
    const i = sim.insercion;
    if (!sim.ok) {
      box.innerHTML = `${cabecera}<p class="sim-veredicto sim-bad">❌ ${tr(sim.motivo)}.</p>
        <p class="sim-muted">${L('failTitle')}</p>`;
      return;
    }
    box.innerHTML = `${cabecera}
      <p class="sim-veredicto sim-ok">${L('orbitOk', { p: nf(i.perigeoKm), a: nf(i.apogeoKm), t: reloj(i.t) })}</p>
      <dl class="sim-datos">
        <div><dt>${L('vOrbital')}</dt><dd>${nf(i.v / 1000, 2)} km/s</dd></div>
        <div><dt>${L('mOrbit')}</dt><dd>${nf(i.masa)} kg</dd></div>
        <div><dt>${L('propLeft')}</dt><dd>${nf(sim.salida.propRestante)} kg</dd></div>
      </dl>
      <button class="sim-btn sim-btn-primary" id="sim-salida" type="button">${L('burn', { dest: destino })}</button>`;
    $('sim-salida').addEventListener('click', encenderSalida);
    return;
  }
  const s = sim.salida;
  const tope = Math.max(s.c3, s.c3Requerido, 10) * 1.15;
  const v = { dest: destino, c3: nf(s.c3, 1), req: nf(s.c3Requerido, 1), ruta: tr(cohete.mision.rutaReal) };
  let veredicto;
  if (s.llegaDirecto) veredicto = `<p class="sim-veredicto sim-ok">${L('vDirect', v)}</p>`;
  else if (s.llegaAsistido) veredicto = `<p class="sim-veredicto sim-warn">${L('vAssisted', v)}</p>`;
  else veredicto = `<p class="sim-veredicto sim-bad">${L('vFail', v)}</p>`;
  const dur = s.duracionRequerida != null ? `${nf(s.duracionRequerida)} s` : '—';
  const hist = sim.eventos.find((e) => e.tipo === 'salida')?.historicoDuracion;
  const max = cargaMax
    ? `${L('maxDirect', { n: nf(cargaMax.directo) })}${cargaMax.asistido != null ? L('maxAssist', { n: nf(cargaMax.asistido) }) : ''}`
    : L('calculating');
  box.innerHTML = `${cabecera}${veredicto}
    ${medidor(L('mC3', { dest: destino }), s.c3, s.c3Requerido, tope, s.llegaDirecto ? 'sim-ok' : 'sim-bad')}
    ${s.c3RutaAsistida != null ? medidor(L('mC3Assist'), s.c3, s.c3RutaAsistida, tope, s.llegaAsistido ? 'sim-ok' : 'sim-bad') : ''}
    <dl class="sim-datos">
      <div><dt>${L('dDv')}</dt><dd>${nf(s.dv)} m/s</dd></div>
      <div><dt>${L('dDvReq')}</dt><dd>${nf(s.dvRequerido)} m/s</dd></div>
      <div><dt>${L('dBurn')}</dt><dd>${dur}${hist ? ` ${L('dHist', { n: nf(hist) })}` : ''}</dd></div>
      <div><dt>${L('dMax')}</dt><dd id="sim-max">${max}</dd></div>
    </dl>`;
}

function mostrarOrbita() {
  fase = 'orbita';
  pintarResultado();
}

function encenderSalida() {
  escena?.dibujarSalida(sim, cohete.mision.destino);
  escena?.setCamara('global');
  $('sim-camara').value = 'global';
  registrar(sim.eventos.find((e) => e.tipo === 'salida'));
  fase = 'salida';
  cargaMax = null;
  pintarResultado();
  // La carga máxima repite la simulación varias veces: se calcula después de pintar
  const simActual = sim;
  setTimeout(() => {
    if (sim !== simActual) return; // el jugador reinició mientras tanto
    const directo = cargaMaxima(cohete, datos, { directo: true });
    const asistido = cohete.mision.rutaReal ? cargaMaxima(cohete, datos, { directo: false }) : null;
    cargaMax = { directo, asistido };
    if (fase === 'salida') pintarResultado();
  }, 50);
}

// --- Reproducción ---------------------------------------------------------------------
function estadoEn(tt) {
  const S = sim.serie;
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
  pendientes = [...sim.eventos.filter((e) => e.tipo !== 'salida')];
  corriendo = true;
  $('sim-lanzar').disabled = true;
  $('sim-pausa').disabled = false;
  $('sim-reiniciar').disabled = false;
  $('sim-carga').disabled = true;
}

function detener() {
  corriendo = false;
  sim = null;
  $('sim-lanzar').disabled = false;
  $('sim-pausa').disabled = true;
  enPausa = false;
  $('sim-pausa').textContent = L('pause');
  $('sim-reiniciar').disabled = true;
  $('sim-carga').disabled = false;
}

function reiniciarVista() {
  t = 0;
  frenoSep = 0;
  etapaActual = '';
  $('sim-log').replaceChildren();
  bitacora = [];
  fase = 'espera';
  cargaMax = null;
  pintarResultado();
  escena?.cargarCohete(cohete.id, cohete.mision.latitud);
  escena?.setCamara($('sim-camara').value === 'global' ? 'persecucion' : $('sim-camara').value);
  if ($('sim-camara').value === 'global') $('sim-camara').value = 'persecucion';
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
    const velEfectiva = frenoSep > 0 ? Math.min(velUsuario, 2.5) : velUsuario;
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
      $('sim-pausa').disabled = true;
      mostrarOrbita();
    }
  }
  escena?.dibujar(dtSim, dtReal);
  requestAnimationFrame(cuadro);
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
  if (!repintar || !cohete) return;
  pintarPestanas();
  pintarFicha();
  pintarCarga();
  const log = $('sim-log');
  log.replaceChildren(...bitacora.map(lineaBitacora));
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
  cohete = datos.cohetes[0];
  try {
    const { crearEscena } = await import('./escena.js');
    escena = crearEscena($('sim-canvas'), { reducirMovimiento: reducir });
    escena.setSeleccion(mostrarFichaEtapa);
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
    corriendo = !corriendo;
    enPausa = !corriendo;
    pintarPausa();
  });
  $('sim-lang').addEventListener('click', () => { setLang(getLang() === 'es' ? 'en' : 'es'); aplicarIdioma(); });
  $('sim-reiniciar').addEventListener('click', () => { detener(); reiniciarVista(); });
  $('sim-camara').addEventListener('change', (e) => escena?.setCamara(e.target.value));
  $('sim-panorama')?.addEventListener('change', (e) => escena?.setPanorama(e.target.value));
  $('sim-carga').addEventListener('input', pintarCarga);
  $('sim-modelo').addEventListener('click', () => abrirModelo('modelo'));
  for (const b of document.querySelectorAll('#sim-dialog [data-vista]')) b.addEventListener('click', () => abrirModelo(b.dataset.vista));
  $('sim-cerrar').addEventListener('click', () => { $('sim-dialog').close(); $('sim-iframe').src = 'about:blank'; });
  requestAnimationFrame(cuadro);
}

arrancar().catch((err) => {
  console.error(err);
  $('sim-resultado').innerHTML = `<h2>${L('resultTitle')}</h2><p class="sim-veredicto sim-bad">${L('loadErr', { msg: err.message })}</p>`;
});
