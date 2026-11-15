// OWNER: Rol 3 (@JU4NMAX) — Simulador de pilotaje · estado y reglas de la misión (sin DOM ni Three.js).
// Marco inercial centrado en el cuerpo, con los ejes del cuerpo en t = 0: x hacia lon 0°, z hacia el polo norte.
// El cuerpo gira alrededor de z con su periodo de rotación. Unidades SI; ángulos en grados solo en la API pública.
import * as F from './fisica.js?v=9';
import { CUERPOS } from './cuerpos-datos.js?v=9';
import { DESTINOS } from './destinos.js?v=9';

const RAD = Math.PI / 180;

// Distancia Tierra–Luna: semieje mayor 384 400 km (NASA NSSDCA, Moon Fact Sheet).
const DISTANCIA_TIERRA = 384400e3;

/** Parámetros del juego. Lo marcado "simplificado" se rotula así en pantalla. */
export const AJUSTES = {
  aceleracion: 3.0,        // m/s² del motor por defecto — simplificado
  dvMax: 2000,             // m/s disponibles — simplificado (deja margen para capturar y corregir)
  escalas: [1, 5, 30, 120],// segundos de misión por segundo real — simplificado
  velGiro: 45,             // °/s reales, giro manual
  velGiroAuto: 75,         // °/s reales, piloto automático
  dtMax: 2,                // s de misión por subpaso de integración
  dtMaxMotor: 0.25,        // subpaso con el motor encendido: el corte de la captura es preciso
  conoObsGrados: 12,       // semiángulo del cono de la cámara para observar un lugar
  distMaxObsKm: 800,       // distancia máxima por defecto en línea recta al lugar
  elevMinGrados: 8,        // elevación mínima de la nave sobre el horizonte del lugar
  solMinGrados: 5,         // elevación mínima del Sol sobre el lugar
  alineadoGrados: 3,       // error de apuntado para encender el motor en piloto automático
  periapsisMinKm: 20,      // órbita "estable": el periapsis queda al menos a esta altura
  fijarS: 2.2,             // segundos REALES con el lugar dentro del círculo para auto-observarlo
  ahorroEstrella: 0.25,    // la 3.ª estrella exige que quede al menos este Δv (fracción)
  alertaFrenadoS: 90,      // s de misión antes del punto más bajo en que se avisa "¡frena!"
};

// --- Vectores y rotaciones -------------------------------------------------------------
function rotar(v, eje, ang) {
  const c = Math.cos(ang); const s = Math.sin(ang);
  const k = F.punto(eje, v) * (1 - c);
  return F.suma(F.suma(F.esc(v, c), F.esc(F.cruz(eje, v), s)), F.esc(eje, k));
}
const Z = [0, 0, 1];
const anguloEntre = (a, b) => Math.acos(Math.max(-1, Math.min(1, F.punto(F.unitario(a), F.unitario(b))))) / RAD;
function ortonormalizar(fwd, up) {
  const f = F.unitario(fwd);
  const u = F.unitario(F.resta(up, F.esc(f, F.punto(up, f))));
  return { fwd: f, up: u };
}
const vectorLatLon = (lat, lon) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];

/** Dirección inercial (unitaria) del punto lat/lon del cuerpo en el instante t. */
export function normalLugar(lugar, t, cuerpo) {
  return rotar(vectorLatLon(lugar.lat, lugar.lon), Z, (2 * Math.PI * t) / cuerpo.rotacion);
}

export const aceleracionMision = (m) => m.dest?.llegada?.aceleracion ?? AJUSTES.aceleracion;
export const distMaxObsMisionKm = (m) => m.dest?.llegada?.distMaxObsKm ?? AJUSTES.distMaxObsKm;

// --- Creación ---------------------------------------------------------------------------
/**
 * Crea una misión. La nave llega en sobrevuelo hiperbólico, en un plano polar (decisión de juego)
 * con el periapsis sobre la latitud `latPeriapsisGrados` del meridiano `lonNodoGrados`.
 */
export function crearMision(destinoId = 'luna') {
  const dest = DESTINOS[destinoId];
  if (!dest) throw new Error(`El destino «${destinoId}» todavía no es jugable`);
  dest.jugable = true;
  const cuerpo = CUERPOS[dest.cuerpo];
  const ll = dest.llegada;
  const rp = cuerpo.radio + ll.alturaPeriapsisKm * 1000;
  const e0 = F.llegadaSobrevuelo(cuerpo.mu, { vInf: ll.vInfinito, rp, rIni: ll.radiosIniciales * cuerpo.radio });
  // Del plano XY (periapsis en +x, movimiento hacia +y) al plano polar elegido
  const { lonNodoGrados: L0, latPeriapsisGrados: lp } = ll.planoPolar;
  const p = vectorLatLon(lp, L0);
  const q = [-Math.sin(lp * RAD) * Math.cos(L0 * RAD), -Math.sin(lp * RAD) * Math.sin(L0 * RAD), Math.cos(lp * RAD)];
  const n = F.cruz(p, q);
  const mapa = (v) => F.suma(F.suma(F.esc(p, v[0]), F.esc(q, v[1])), F.esc(n, v[2]));
  const estado = { r: mapa(e0.r), v: mapa(e0.v) };
  // Al iniciar, el cohete apunta hacia adelante en la dirección de su trayectoria (prógrado)
  const haciaCuerpo = F.esc(F.unitario(estado.r), -1);
  const att = ortonormalizar(estado.v, haciaCuerpo);
  return {
    destino: destinoId, dest, cuerpo,
    t: 0, r: estado.r, v: estado.v,
    fwd: att.fwd, up: att.up,
    escala: 30,
    dvUsado: 0, motor: 0, piloto: null, objetivo: null,
    captura: { fase: 'espera' },
    observados: [],        // { id, t, calidad }
    observacion: null,     // { id, acum, frac } mientras se mantiene un lugar en el círculo
    recienObservado: null,
    fin: null,
    ultimoError: null,
    sol: vectorLatLon(ll.sol.latGrados, ll.sol.lonGrados),
    planoBase: { p, q, n }, // Base ortonormal del plano orbital para el radar 2D
  };
}

// --- Magnitudes derivadas --------------------------------------------------------------
export const altura = (m) => F.norma(m.r) - m.cuerpo.radio;
export const elementosActuales = (m) => F.elementos({ r: m.r, v: m.v }, m.cuerpo.mu);
export const dvRestante = (m) => Math.max(0, AJUSTES.dvMax - m.dvUsado);
const tierraInercial = (m) => F.esc(rotar([1, 0, 0], Z, (2 * Math.PI * m.t) / m.cuerpo.rotacion), DISTANCIA_TIERRA);

/** Posición inercial de la Tierra (m). Sirve para dibujarla y para decidir la señal. */
export const posicionTierra = tierraInercial;

/** ¿El cuerpo tapa la Tierra? (sin señal directa) */
export const sinSenal = (m) => F.tapado(m.r, tierraInercial(m), m.cuerpo.radio);

/** Condiciones para observar un lugar desde la posición y actitud actuales. */
export function condiciones(m, lugar) {
  const R = m.cuerpo.radio;
  const nrm = normalLugar(lugar, m.t, m.cuerpo);
  const P = F.esc(nrm, R);
  const haciaLugar = F.resta(P, m.r);
  const dist = F.norma(haciaLugar);
  // elevación de la nave sobre el horizonte del lugar
  const elev = Math.asin(Math.max(-1, Math.min(1, (F.punto(nrm, m.r) - R) / dist))) / RAD;
  const cono = anguloEntre(m.fwd, haciaLugar);
  const solElev = Math.asin(Math.max(-1, Math.min(1, F.punto(nrm, m.sol)))) / RAD;
  const A = AJUSTES;
  const distMaxM = distMaxObsMisionKm(m) * 1000;
  const visible = elev >= A.elevMinGrados && dist <= distMaxM;
  const enCono = cono <= A.conoObsGrados;
  const luz = Boolean(lugar.observarDeNoche) || solElev >= A.solMinGrados;
  const calidad = visible
    ? Math.max(0.68, Math.min(0.99, 0.58 + 0.22 * (1 - dist / (distMaxM * 1.15)) + 0.2 * Math.min(1, elev / 35)))
    : 0;
  return { dist, elev, cono, solElev, visible, enCono, luz, cumple: visible && enCono && luz, calidad, directo: F.unitario(haciaLugar) };
}

// --- Actitud y piloto automático -------------------------------------------------------
function dirObjetivo(m) {
  switch (m.piloto) {
    case 'progrado': return F.unitario(m.v);
    case 'retrogrado': return F.esc(F.unitario(m.v), -1);
    case 'planeta': return F.esc(F.unitario(m.r), -1);
    case 'lugar': {
      const l = m.dest.lugares.find((x) => x.id === m.objetivo);
      return l ? condiciones(m, l).directo : null;
    }
    case 'captura': return F.esc(F.unitario(m.v), -1);
    default: return null;
  }
}

/** Gira `fwd` hacia `dir` como máximo `maxGrados`. Devuelve el error de apuntado restante en grados. */
function girarHacia(m, dir, maxGrados) {
  const err = anguloEntre(m.fwd, dir);
  if (err < 1e-6) return 0;
  const paso = Math.min(err, maxGrados);
  let eje = F.cruz(m.fwd, dir);
  if (F.norma(eje) < 1e-9) eje = m.up; // opuestos: gira alrededor de cualquier eje perpendicular
  eje = F.unitario(eje);
  const a = paso * RAD;
  const att = ortonormalizar(rotar(m.fwd, eje, a), rotar(m.up, eje, a));
  m.fwd = att.fwd; m.up = att.up;
  return err - paso;
}

function girarManual(m, ctrl, dtReal) {
  const a = AJUSTES.velGiro * RAD * dtReal;
  const der = F.unitario(F.cruz(m.fwd, m.up));
  let { fwd, up } = m;
  if (ctrl.guinada) { fwd = rotar(fwd, up, -ctrl.guinada * a); }
  if (ctrl.cabeceo) { fwd = rotar(fwd, der, ctrl.cabeceo * a); up = rotar(up, der, ctrl.cabeceo * a); }
  if (ctrl.alabeo) { up = rotar(up, fwd, ctrl.alabeo * a); }
  const att = ortonormalizar(fwd, up);
  m.fwd = att.fwd; m.up = att.up;
}

// --- Captura automática ------------------------------------------------------------------
export function apoObjetivo(m) { return m.cuerpo.radio + m.dest.mision.orbitaObjetivo.alturaApolunioKm * 1000; }

export function capturaLista(m) {
  const el = elementosActuales(m);
  return el.ligada && el.apoapsis <= apoObjetivo(m) && el.periapsis >= m.cuerpo.radio + AJUSTES.periapsisMinKm * 1000;
}

export function datosFrenado(m) {
  const el = elementosActuales(m);
  const apoObj = apoObjetivo(m);
  const rp = el.periapsis;
  const mu = m.cuerpo.mu;
  const acc = aceleracionMision(m);
  const vPeriObjetivo = Math.sqrt(mu * (2 / rp - 2 / (rp + apoObj)));
  const dvNec = el.ligada
    ? Math.max(0, Math.sqrt(mu * (2 / rp - 1 / el.semiejeMayor)) - vPeriObjetivo)
    : F.dvCaptura(mu, { vInf: el.vInfinito, rp, ra: apoObj });
  const tQuema = dvNec / acc;
  const tPeri = F.tiempoAlPeriapsis({ r: m.r, v: m.v }, m.cuerpo.mu);
  const yaPaso = F.punto(m.r, m.v) >= 0;
  const tParaEncendido = Math.max(0, tPeri - tQuema / 2);
  return { dvNec, tQuema, tPeri, tParaEncendido, yaPaso };
}

function pasoCaptura(m, errApunte) {
  if (capturaLista(m)) { m.captura.fase = 'lista'; m.piloto = null; return 0; }
  if (m.captura.fase === 'quemando' || m.captura.fase === 'espera') {
    const { tPeri, tQuema, yaPaso } = datosFrenado(m);
    if (m.captura.fase === 'espera' && (tPeri <= tQuema / 2 || yaPaso)) {
      m.captura.fase = 'quemando';
    }
    if (m.captura.fase === 'quemando') {
      // Garantiza alineación retrógrada exacta al iniciar la quema para no perder el periapsis en Marte/Europa
      if (errApunte > AJUSTES.alineadoGrados) {
        const retro = F.esc(F.unitario(m.v), -1);
        girarHacia(m, retro, 180);
      }
      return 1;
    }
  }
  return 0;
}

// --- Paso de simulación -----------------------------------------------------------------------
/**
 * Avanza la misión `dtReal` segundos reales (equivale a dtReal × escala segundos de misión).
 * @param {object} ctrl { guinada, cabeceo, alabeo: −1…1, motor: −1|0|1 }
 */
export function avanzar(m, dtReal, ctrl = {}) {
  if (m.fin) return;
  const escalaSegura = Number.isFinite(m.escala) && m.escala > 0 ? Math.min(m.escala, 300) : 1;
  const dtMision = Math.min(dtReal, 0.25) * escalaSegura;
  const accMag = aceleracionMision(m);

  // Actitud (en captura orbital gira a 160°/s para completar la Fase 1/3 en ~1 s sin retrasar el frenado)
  let errApunte = 0;
  const dir = dirObjetivo(m);
  const velGiro = m.piloto === 'captura' ? 160 : AJUSTES.velGiroAuto;
  if (m.piloto && dir) errApunte = girarHacia(m, dir, velGiro * dtReal);
  else girarManual(m, ctrl, dtReal);

  // Motor
  let empuje = ctrl.motor || 0;
  if (m.piloto === 'captura') empuje = pasoCaptura(m, errApunte);
  if (dvRestante(m) <= 0) { empuje = 0; if (m.piloto === 'captura') { m.captura.fase = 'sin-dv'; m.piloto = null; } }
  m.motor = empuje;

  // Integración con subpasos
  let resto = dtMision;
  while (resto > 1e-9 && !m.fin) {
    const h = Math.min(empuje ? AJUSTES.dtMaxMotor : AJUSTES.dtMax, resto);
    const acc = empuje && dvRestante(m) > 0 ? F.esc(m.fwd, empuje * accMag) : null;
    const s = F.paso({ r: m.r, v: m.v }, m.cuerpo.mu, h, acc ? () => acc : null);
    m.r = s.r; m.v = s.v; m.t += h; resto -= h;
    if (acc) m.dvUsado += accMag * h;
    if (F.norma(m.r) <= m.cuerpo.radio) { m.fin = { tipo: 'choque', t: m.t }; m.motor = 0; break; }
    // El piloto automático apaga el motor en el instante exacto en que la órbita pedida queda lista
    if (m.piloto === 'captura' && m.captura.fase === 'quemando' && capturaLista(m)) {
      m.captura.fase = 'lista'; m.piloto = null; m.motor = 0; empuje = 0;
    }
    if (dvRestante(m) <= 0) empuje = 0;
  }

  if (!m.fin) m.recienObservado = actualizarObservacion(m, dtReal);

  // Se fue para siempre: sin energía para volver
  const el = elementosActuales(m);
  if (!m.fin && !el.ligada && F.punto(m.r, m.v) > 0 && F.norma(m.r) > m.dest.llegada.radiosIniciales * m.cuerpo.radio * 1.2) {
    m.fin = { tipo: 'escapo', t: m.t };
  }
}

// --- Acciones del jugador ---------------------------------------------------------------------
export function fijarPiloto(m, modo, objetivo = null) {
  m.piloto = modo; // 'progrado' | 'retrogrado' | 'planeta' | 'lugar' | 'captura' | null
  m.objetivo = objetivo;
  if (modo === 'captura' && m.captura.fase !== 'quemando') m.captura = { fase: 'espera' };
}
export const capturarOrbita = (m) => fijarPiloto(m, 'captura');
export function ciclarEscala(m, delta) {
  const i = AJUSTES.escalas.indexOf(m.escala);
  m.escala = AJUSTES.escalas[Math.max(0, Math.min(AJUSTES.escalas.length - 1, (i < 0 ? 2 : i) + delta))];
}

/**
 * Escanea inmediatamente el lugar que mejor cumple las condiciones (el más centrado en la cámara).
 * @returns {{ok:boolean, motivo?:string, lugar?:object, calidad?:number}}
 */
export function escanear(m) {
  if (m.fin) return { ok: false, motivo: 'fin' };
  let mejor = null;
  for (const l of m.dest.lugares) {
    if (m.observados.some((o) => o.id === l.id)) continue;
    const c = condiciones(m, l);
    if (c.cumple && (!mejor || c.cono < mejor.c.cono)) mejor = { l, c };
  }
  if (!mejor) return { ok: false, motivo: 'nada' };
  m.observados.push({ id: mejor.l.id, t: m.t, calidad: mejor.c.calidad });
  m.observacion = null;
  return { ok: true, lugar: mejor.l, calidad: mejor.c.calidad };
}

/**
 * Observación por permanencia: si un lugar pendiente cumple las condiciones (a la vista, dentro del círculo, con luz),
 * se acumula tiempo REAL; al llegar a `fijarS` queda observado automáticamente.
 * @returns {object|null} el lugar recién observado, si lo hubo
 */
export function actualizarObservacion(m, dtReal) {
  let mejor = null;
  for (const l of m.dest.lugares) {
    if (m.observados.some((o) => o.id === l.id)) continue;
    const c = condiciones(m, l);
    if (c.cumple && (!mejor || c.cono < mejor.c.cono)) mejor = { l, c };
  }
  if (!mejor) { m.observacion = null; return null; }
  const acum = (m.observacion?.id === mejor.l.id ? m.observacion.acum : 0) + dtReal;
  if (acum >= AJUSTES.fijarS) {
    m.observados.push({ id: mejor.l.id, t: m.t, calidad: mejor.c.calidad });
    m.observacion = null;
    return mejor.l;
  }
  m.observacion = { id: mejor.l.id, acum, frac: acum / AJUSTES.fijarS };
  return null;
}

/**
 * Adelanta la simulación hasta unos segundos antes del encendido de captura orbital,
 * para que el jugador no tenga que esperar minutos viendo el vacío durante la aproximación.
 */
export function adelantarAFrenado(m) {
  if (m.fin) return false;
  capturarOrbita(m);
  const escalaAnt = m.escala;
  m.escala = 60;
  let pasos = 0;
  while (!m.fin && m.captura.fase === 'espera' && pasos < 4000) {
    const { tParaEncendido } = datosFrenado(m);
    if (tParaEncendido <= 18) break;
    avanzar(m, 0.05);
    pasos++;
  }
  m.escala = Math.min(escalaAnt, 5);
  return true;
}

/**
 * Adelanta la nave a lo largo de su órbita hasta que el lugar indicado entre en ventana de observación
 * (a la vista, con iluminación/radar y apuntado por el piloto automático).
 */
export function adelantarALugar(m, lugarId) {
  if (m.fin) return false;
  const l = m.dest.lugares.find((x) => x.id === lugarId);
  if (!l || m.observados.some((o) => o.id === lugarId)) return false;
  fijarPiloto(m, 'lugar', lugarId);
  const el = elementosActuales(m);
  if (!el.ligada) return false;
  const maxTiempo = (el.periodo || 7800) * 1.8;
  const t0 = m.t;
  m.escala = 30;
  // Alinea primero la actitud hacia el objetivo
  girarHacia(m, condiciones(m, l).directo, 180);
  while (!m.fin && m.t - t0 < maxTiempo) {
    const c = condiciones(m, l);
    if (c.visible && c.luz) {
      let prevElev = c.elev;
      for (let k = 0; k < 45; k++) {
        const copia = { r: [...m.r], v: [...m.v], t: m.t };
        avanzar(m, 0.05);
        if (m.observacion) m.observacion = null;
        const idx2 = m.observados.findIndex((o) => o.id === lugarId);
        if (idx2 >= 0) { m.observados.splice(idx2, 1); m.recienObservado = null; }
        const c2 = condiciones(m, l);
        if (!c2.visible || !c2.luz || c2.elev < prevElev) {
          m.r = copia.r; m.v = copia.v; m.t = copia.t;
          break;
        }
        prevElev = c2.elev;
      }
      girarHacia(m, condiciones(m, l).directo, 180);
      break;
    }
    avanzar(m, 0.05);
    if (m.observacion) m.observacion = null;
    // Si por algún motivo se auto-observó en el borde del paso, lo dejamos listo para que el jugador lo vea y escanee
    const idx = m.observados.findIndex((o) => o.id === lugarId);
    if (idx >= 0) { m.observados.splice(idx, 1); m.recienObservado = null; break; }
  }
  girarHacia(m, condiciones(m, l).directo, 180);
  m.escala = 1;
  return condiciones(m, l).cumple;
}

/** Qué toca hacer ahora: guía al jugador paso a paso. */
export function objetivoActual(m) {
  if (m.fin) return { clave: 'fin' };
  const el = elementosActuales(m);
  const R = m.cuerpo.radio;
  if (!el.ligada || el.apoapsis > apoObjetivo(m) * 1.15) {
    const { tPeri, tParaEncendido, yaPaso } = datosFrenado(m);
    return {
      clave: el.ligada ? 'bajarAlto' : 'frenar',
      tPeri,
      tParaEncendido,
      urgente: !yaPaso && tParaEncendido <= AJUSTES.alertaFrenadoS,
      yaPaso,
      quemando: m.captura?.fase === 'quemando' || m.motor > 0,
      pilotoCaptura: m.piloto === 'captura',
    };
  }
  if (el.periapsis < R + AJUSTES.periapsisMinKm * 1000) return { clave: 'subirBajo' };
  const pendiente = m.dest.lugares.find((l) => !m.observados.some((o) => o.id === l.id));
  if (pendiente) return { clave: 'observar', lugar: pendiente };
  return { clave: 'completa' };
}

export function terminar(m) { if (!m.fin) m.fin = { tipo: 'terminada', t: m.t }; }

// --- Calificación -------------------------------------------------------------------------------
export function evaluar(m) {
  const el = elementosActuales(m);
  const R = m.cuerpo.radio;
  const orbita = el.ligada && el.periapsis >= R + AJUSTES.periapsisMinKm * 1000 && el.apoapsis < 25 * R;
  const lugares = m.observados.map((o) => o.id);
  const ahorro = dvRestante(m) / AJUSTES.dvMax;
  const todos = lugares.length === m.dest.lugares.length;
  // ★ órbita · ★★ además 2 lugares · ★★★ además los 3 lugares y sobra ≥ 25 % del Δv
  const estrellas = !orbita ? 0 : 1 + (lugares.length >= 2 ? 1 : 0) + (todos && ahorro >= AJUSTES.ahorroEstrella ? 1 : 0);
  const puntos = Math.round((orbita ? 500 : 0) + m.observados.reduce((s, o) => s + 300 + 700 * o.calidad, 0) + 0.5 * dvRestante(m));
  return {
    orbita, lugares, estrellas, puntos, ahorro,
    perilunioKm: orbita ? (el.periapsis - R) / 1000 : null, apolunioKm: orbita ? (el.apoapsis - R) / 1000 : null,
    dvUsado: m.dvUsado, dvRestante: dvRestante(m), tiempoMision: m.t, fin: m.fin?.tipo ?? 'en curso',
  };
}
