// OWNER: Rol 3 (@JU4NMAX) — Simulador de cohetes reales · interfaz.
// La física está en ascenso.js (probada en Node) y la vista 3D en escena.js.
// Si el navegador no tiene WebGL, todo sigue funcionando sin la vista 3D (bitácora, HUD y resultado).
import { simular, cargaMaxima } from './ascenso.js';

const $ = (id) => document.getElementById(id);
const nf = (n, d = 0) => Number(n).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
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
    b.innerHTML = `${c.nombre}<small>${c.mision.nombre} → ${datos.destinos[c.mision.destino].nombre}</small>`;
    b.addEventListener('click', () => elegir(c.id));
    tabs.append(b);
  }
}

function pintarFicha() {
  const c = cohete;
  const motores = c.fases.map((f) => `${f.nombre}: ${f.motores.map((m) => `${m.n}× ${m.nombre}`).join(' + ')}`).join(' · ');
  const masaTotal = c.fases.reduce((s, f) => s + f.seco + f.propelente + (f.extra || []).reduce((e, x) => e + x.masa, 0), 0)
    + c.masasFijas.reduce((s, m) => s + m.masa, 0) + c.mision.masaNave;
  $('sim-ficha').innerHTML = `
    <div><dt>Misión real</dt><dd>${c.mision.nombre} · ${c.mision.fecha}</dd></div>
    <div><dt>Destino</dt><dd>${datos.destinos[c.mision.destino].nombre}</dd></div>
    <div><dt>Sitio</dt><dd>${c.mision.sitio}</dd></div>
    <div><dt>Masa al despegar</dt><dd>${nf(masaTotal / 1000, 1)} t</dd></div>
    <div><dt>Carga real</dt><dd>${c.mision.nave} · ${nf(c.mision.masaNave)} kg</dd></div>
    <div class="sim-wide"><dt>Etapas y motores</dt><dd>${motores}</dd></div>
    ${c.mision.rutaReal ? `<div class="sim-wide"><dt>Ruta real</dt><dd>${c.mision.rutaReal}</dd></div>` : ''}`;
}

function configurarCarga() {
  const real = cohete.mision.masaNave;
  const tope = { 'saturno-v': 80000, 'atlas-agena-d': 1000, 'falcon-heavy': 25000 }[cohete.id] ?? real * 3;
  const s = $('sim-carga');
  s.max = tope;
  s.step = tope >= 10000 ? 100 : 1;
  s.value = real;
  $('sim-carga-val').textContent = `${nf(real)} kg (real)`;
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
  if (h < 5 && (e.empuje ?? 0) === 0) return 'En plataforma · Venteo LOX';
  if (h > 3500 && h < 18500 && vRel >= 280 && vRel <= 410) return '⚡ Régimen transónico (Max-Q)';
  if (h < 11000) return 'Troposfera';
  if (h < 50000) return 'Estratósfera';
  if (h < 85000) return 'Mesósfera';
  if (h < 100000) return 'Termósfera';
  return '🌌 Espacio (> 100 km · Línea de Kármán)';
}

function hud(e) {
  $('sim-hud').innerHTML = `
    <span>Tiempo</span><b>${reloj(e.t)}</b>
    <span>Altitud</span><b>${nf(e.h / 1000, 1)} km</b>
    <span>Velocidad</span><b>${nf(Math.hypot(e.vr ?? 0, e.vt ?? 0) / 1000, 2)} km/s</b>
    <span>Aceleración</span><b>${nf(e.a ?? 0, 1)} g</b>
    <span>Masa</span><b>${nf(e.masa / 1000, 1)} t</b>
    <span>Empuje</span><b>${nf((e.empuje ?? 0) / 1000)} kN</b>
    <span class="sim-hud-capa">${capaAtmosferica(e)}</span>
    ${etapaActual ? `<span class="sim-hud-etapa">${etapaActual}</span>` : '<span class="sim-hud-hint">💡 Clic en el cohete 3D para inspeccionar etapas</span>'}`;
}

function mostrarFichaEtapa(id, info) {
  const card = $('sim-etapa-card');
  if (!card) return;
  if (!id || !info) {
    card.hidden = true;
    card.replaceChildren();
    return;
  }
  const specs = (info.datos || [])
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('');
  card.hidden = false;
  card.innerHTML = `
    <div class="sim-etapa-head">
      <div>
        <span class="sim-etapa-badge ${info.separada ? 'is-sep' : 'is-attached'}">${info.separada ? 'Etapa separada' : 'Unida al vehículo'}</span>
        <h3>${info.titulo}</h3>
        ${info.subtitulo ? `<p class="sim-etapa-sub">${info.subtitulo}</p>` : ''}
      </div>
      <button type="button" class="sim-etapa-close" id="sim-etapa-cerrar" aria-label="Cerrar inspección">✕</button>
    </div>
    ${info.detalle ? `<p class="sim-etapa-desc">${info.detalle}</p>` : ''}
    ${specs ? `<dl class="sim-etapa-specs">${specs}</dl>` : ''}
    <div class="sim-etapa-actions">
      <button type="button" class="sim-btn" id="sim-etapa-enfocar">🔍 Enfocar etapa</button>
    </div>`;
  $('sim-etapa-cerrar')?.addEventListener('click', () => escena?.deseleccionar());
  $('sim-etapa-enfocar')?.addEventListener('click', () => escena?.enfocarEtapa(id));
}

function registrar(e) {
  const li = document.createElement('li');
  let extra = '';
  if (typeof e.historico === 'number') {
    const d = (100 * (e.t - e.historico)) / e.historico;
    extra = `<small class="${Math.abs(d) <= 15 ? 'is-ok' : 'is-warn'}">real: ${reloj(e.historico)} (${d >= 0 ? '+' : ''}${nf(d, 1)} %)</small>`;
  }
  li.innerHTML = `<time>${reloj(e.t)}</time><span>${e.texto}${extra}</span>`;
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

function mostrarOrbita() {
  const i = sim.insercion;
  const destino = datos.destinos[cohete.mision.destino];
  const box = $('sim-resultado');
  if (!sim.ok) {
    box.innerHTML = `<h2>Resultado</h2><p class="sim-veredicto sim-bad">❌ ${sim.motivo}.</p>
      <p class="sim-muted">Prueba con menos carga útil.</p>`;
    return;
  }
  box.innerHTML = `<h2>Resultado</h2>
    <p class="sim-veredicto sim-ok">✅ En órbita de espera: ${nf(i.perigeoKm)} × ${nf(i.apogeoKm)} km a ${reloj(i.t)}.</p>
    <dl class="sim-datos">
      <div><dt>Velocidad orbital</dt><dd>${nf(i.v / 1000, 2)} km/s</dd></div>
      <div><dt>Masa en órbita</dt><dd>${nf(i.masa)} kg</dd></div>
      <div><dt>Propelente restante</dt><dd>${nf(sim.salida.propRestante)} kg</dd></div>
    </dl>
    <button class="sim-btn sim-btn-primary" id="sim-salida" type="button">🔥 Encender hacia ${destino.nombre}</button>`;
  $('sim-salida').addEventListener('click', encenderSalida);
}

function encenderSalida() {
  const s = sim.salida;
  const destino = datos.destinos[cohete.mision.destino];
  escena?.dibujarSalida(sim, cohete.mision.destino);
  escena?.setCamara('global');
  $('sim-camara').value = 'global';
  registrar(sim.eventos.find((e) => e.tipo === 'salida'));
  const tope = Math.max(s.c3, s.c3Requerido, 10) * 1.15;
  let veredicto;
  if (s.llegaDirecto) veredicto = `<p class="sim-veredicto sim-ok">🚀 ¡Rumbo a ${destino.nombre}! El encendido da un C3 de ${nf(s.c3, 1)} km²/s² y hacían falta ${nf(s.c3Requerido, 1)}.</p>`;
  else if (s.llegaAsistido) veredicto = `<p class="sim-veredicto sim-warn">🪐 No alcanza para ir directo a ${destino.nombre} (C3 ${nf(s.c3, 1)} de ${nf(s.c3Requerido, 1)}), pero sí para la ruta con asistencias gravitatorias. Así lo hizo la misión real: ${cohete.mision.rutaReal}.</p>`;
  else veredicto = `<p class="sim-veredicto sim-bad">❌ Falta energía para llegar a ${destino.nombre}: C3 ${nf(s.c3, 1)} de ${nf(s.c3Requerido, 1)} km²/s². Reduce la carga útil.</p>`;
  const dur = s.duracionRequerida != null ? `${nf(s.duracionRequerida)} s` : '—';
  const hist = sim.eventos.find((e) => e.tipo === 'salida')?.historicoDuracion;
  $('sim-resultado').innerHTML = `<h2>Resultado</h2>${veredicto}
    ${medidor(`Energía de salida (C3) hacia ${destino.nombre}`, s.c3, s.c3Requerido, tope, s.llegaDirecto ? 'sim-ok' : 'sim-bad')}
    ${s.c3RutaAsistida != null ? medidor('C3 para la ruta con asistencias (vía Marte)', s.c3, s.c3RutaAsistida, tope, s.llegaAsistido ? 'sim-ok' : 'sim-bad') : ''}
    <dl class="sim-datos">
      <div><dt>Δv del encendido</dt><dd>${nf(s.dv)} m/s</dd></div>
      <div><dt>Δv necesario</dt><dd>${nf(s.dvRequerido)} m/s</dd></div>
      <div><dt>Encendido justo</dt><dd>${dur}${hist ? ` (real ${nf(hist)} s)` : ''}</dd></div>
      <div><dt>Carga máxima</dt><dd id="sim-max">calculando…</dd></div>
    </dl>`;
  // La carga máxima repite la simulación varias veces: se calcula después de pintar
  setTimeout(() => {
    const directo = cargaMaxima(cohete, datos, { directo: true });
    const asistido = cohete.mision.rutaReal ? cargaMaxima(cohete, datos, { directo: false }) : null;
    $('sim-max').textContent = `${nf(directo)} kg directo${asistido != null ? ` · ${nf(asistido)} kg con asistencias` : ''}`;
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
  $('sim-pausa').textContent = '⏸ Pausa';
  $('sim-reiniciar').disabled = true;
  $('sim-carga').disabled = false;
}

function reiniciarVista() {
  t = 0;
  frenoSep = 0;
  etapaActual = '';
  $('sim-log').replaceChildren();
  $('sim-resultado').innerHTML = '<h2>Resultado</h2><p class="sim-muted">Lanza el cohete para ver si llega a su destino.</p>';
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
    aviso.textContent = 'No se pudo iniciar la vista 3D (WebGL). La simulación, la bitácora y el resultado funcionan igual.';
  }
  elegir(cohete.id);

  $('sim-lanzar').addEventListener('click', lanzar);
  $('sim-pausa').addEventListener('click', () => {
    corriendo = !corriendo;
    $('sim-pausa').textContent = corriendo ? '⏸ Pausa' : '▶ Seguir';
  });
  $('sim-reiniciar').addEventListener('click', () => { detener(); reiniciarVista(); });
  $('sim-camara').addEventListener('change', (e) => escena?.setCamara(e.target.value));
  $('sim-panorama')?.addEventListener('change', (e) => escena?.setPanorama(e.target.value));
  $('sim-carga').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    $('sim-carga-val').textContent = `${nf(v)} kg${v === cohete.mision.masaNave ? ' (real)' : ''}`;
  });
  $('sim-modelo').addEventListener('click', () => abrirModelo('modelo'));
  for (const b of document.querySelectorAll('#sim-dialog [data-vista]')) b.addEventListener('click', () => abrirModelo(b.dataset.vista));
  $('sim-cerrar').addEventListener('click', () => { $('sim-dialog').close(); $('sim-iframe').src = 'about:blank'; });
  requestAnimationFrame(cuadro);
}

arrancar().catch((err) => {
  console.error(err);
  $('sim-resultado').innerHTML = `<h2>Resultado</h2><p class="sim-veredicto sim-bad">No se pudo cargar el simulador: ${err.message}. Sírvelo con <code>python3 -m http.server</code>.</p>`;
});
