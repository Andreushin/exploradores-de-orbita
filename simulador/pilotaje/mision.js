// OWNER: Rol 3 (@JU4NMAX) — Simulador de pilotaje · estado y reglas de la misión (sin DOM ni Three.js).
// Marco inercial centrado en el cuerpo, con los ejes del cuerpo en t = 0: x hacia lon 0°, z hacia el polo norte.
// El cuerpo gira alrededor de z con su periodo de rotación. Unidades SI; ángulos en grados solo en la API pública.
import * as F from './fisica.js';
import { CUERPOS } from './cuerpos-datos.js';
import { DESTINOS } from './destinos.js';

const RAD = Math.PI / 180;

// Distancia Tierra–Luna: semieje mayor 384 400 km (NASA NSSDCA, Moon Fact Sheet).
const DISTANCIA_TIERRA = 384400e3;

/** Parámetros del juego. Lo marcado "simplificado" se rotula así en pantalla. */
export const AJUSTES = {
  aceleracion: 3.0,        // m/s² del motor — simplificado (no es el del Apolo 11)
  dvMax: 1400,             // m/s disponibles — simplificado
  escalas: [1, 5, 30, 120],// segundos de misión por segundo real — simplificado
  velGiro: 45,             // °/s reales, giro manual
  velGiroAuto: 70,         // °/s reales, piloto automático
  dtMax: 2,                // s de misión por subpaso de integración
  dtMaxMotor: 0.25,        // subpaso con el motor encendido: el corte de la captura es preciso
  conoObsGrados: 10,       // semiángulo del cono de la cámara para observar un lugar
  distMaxObsKm: 800,       // distancia máxima en línea recta al lugar
  elevMinGrados: 8,        // elevación mínima de la nave sobre el horizonte del lugar
  solMinGrados: 5,         // elevación mínima del Sol sobre el lugar
  alineadoGrados: 3,       // error de apuntado para encender el motor en piloto automático
  periapsisMinKm: 20,      // órbita "estable": el periapsis queda al menos a esta altura
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

// --- Creación ---------------------------------------------------------------------------
/**
 * Crea una misión. La nave llega en sobrevuelo hiperbólico, en un plano polar (decisión de juego)
 * con el periapsis sobre la latitud `latPeriapsisGrados` del meridiano `lonNodoGrados`.
 */
export function crearMision(destinoId = 'luna') {
  const dest = DESTINOS[destinoId];
  if (!dest?.jugable) throw new Error(`El destino «${destinoId}» todavía no es jugable`);
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
  const att = ortonormalizar(estado.v, F.esc(F.unitario(estado.r), -1));
  return {
    destino: destinoId, dest, cuerpo,
    t: 0, r: estado.r, v: estado.v,
    fwd: att.fwd, up: att.up,
    escala: 30,
    dvUsado: 0, motor: 0, piloto: null, objetivo: null,
    captura: { fase: 'espera' },
    observados: [],        // { id, t, calidad }
    fin: null,
    ultimoError: null,
    sol: vectorLatLon(ll.sol.latGrados, ll.sol.lonGrados),
  };
}

// --- Magnitudes derivadas --------------------------------------------------------------
export const altura = (m) => F.norma(m.r) - m.cuerpo.radio;
export const elementosActuales = (m) => F.elementos({ r: m.r, v: m.v }, m.cuerpo.mu);
export const dvRestante = (m) => Math.max(0, AJUSTES.dvMax - m.dvUsado);
const tierraInercial = (m) => F.esc(rotar([1, 0, 0], Z, (2 * Math.PI * m.t) / m.cuerpo.rotacion), DISTANCIA_TIERRA);

/** Posición inercial de la Tierra (m). Sirve para dibujarla y para decidir la señal. */
export const posicionTierra = tierraInercial;

/** ¿La Luna tapa la Tierra? (sin señal) */
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
  const visible = elev >= A.elevMinGrados && dist <= A.distMaxObsKm * 1000;
  const enCono = cono <= A.conoObsGrados;
  const luz = Boolean(lugar.observarDeNoche) || solElev >= A.solMinGrados;
  const calidad = visible ? Math.max(0, 1 - dist / (A.distMaxObsKm * 1000)) * Math.min(1, elev / 45 + 0.4) : 0;
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
function apoObjetivo(m) { return m.cuerpo.radio + m.dest.mision.orbitaObjetivo.alturaApolunioKm * 1000; }

function capturaLista(m) {
  const el = elementosActuales(m);
  return el.ligada && el.apoapsis <= apoObjetivo(m) && el.periapsis >= m.cuerpo.radio + AJUSTES.periapsisMinKm * 1000;
}

function pasoCaptura(m, errApunte) {
  const el = elementosActuales(m);
  const apoObj = apoObjetivo(m);
  if (capturaLista(m)) { m.captura.fase = 'lista'; m.piloto = null; return 0; }
  if (m.captura.fase === 'quemando' || m.captura.fase === 'espera') {
    // duración estimada del frenado centrado en el periapsis
    const rp = el.periapsis;
    const mu = m.cuerpo.mu;
    const vPeriObjetivo = Math.sqrt(mu * (2 / rp - 2 / (rp + apoObj)));
    const dvNec = el.ligada
      ? Math.max(0, Math.sqrt(mu * (2 / rp - 1 / el.semiejeMayor)) - vPeriObjetivo) // ya ligada: bajar el apoapsis
      : F.dvCaptura(mu, { vInf: el.vInfinito, rp, ra: apoObj });
    const tQuema = dvNec / AJUSTES.aceleracion;
    const tPeri = F.tiempoAlPeriapsis({ r: m.r, v: m.v }, m.cuerpo.mu);
    const yaPaso = F.punto(m.r, m.v) >= 0;
    if (m.captura.fase === 'espera' && (tPeri <= tQuema / 2 || yaPaso)) m.captura.fase = 'quemando';
    if (m.captura.fase === 'quemando' && errApunte <= AJUSTES.alineadoGrados) return 1;
  }
  return 0;
}

// --- Paso de simulación -----------------------------------------------------------------------
/**
 * Avanza la misión `dtReal` segundos reales (equivale a dtReal × escala segundos de misión).
 * @param {object} ctrl { guinada, cabeceo, alabeo: −1…1, motor: −1|0|1 } (se ignora lo manual si hay piloto)
 */
export function avanzar(m, dtReal, ctrl = {}) {
  if (m.fin) return;
  const dtMision = dtReal * m.escala;

  // Actitud
  let errApunte = 0;
  const dir = dirObjetivo(m);
  if (m.piloto && dir) errApunte = girarHacia(m, dir, AJUSTES.velGiroAuto * dtReal);
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
    const acc = empuje && dvRestante(m) > 0 ? F.esc(m.fwd, empuje * AJUSTES.aceleracion) : null;
    const s = F.paso({ r: m.r, v: m.v }, m.cuerpo.mu, h, acc ? () => acc : null);
    m.r = s.r; m.v = s.v; m.t += h; resto -= h;
    if (acc) m.dvUsado += AJUSTES.aceleracion * h;
    if (F.norma(m.r) <= m.cuerpo.radio) { m.fin = { tipo: 'choque', t: m.t }; m.motor = 0; break; }
    // El piloto automático apaga el motor en el instante exacto en que la órbita pedida queda lista
    if (m.piloto === 'captura' && m.captura.fase === 'quemando' && capturaLista(m)) {
      m.captura.fase = 'lista'; m.piloto = null; m.motor = 0; empuje = 0;
    }
    if (dvRestante(m) <= 0) empuje = 0;
  }

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
 * Escanea el lugar que mejor cumple las condiciones (el más centrado en la cámara).
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
  return { ok: true, lugar: mejor.l, calidad: mejor.c.calidad };
}

export function terminar(m) { if (!m.fin) m.fin = { tipo: 'terminada', t: m.t }; }

// --- Calificación -------------------------------------------------------------------------------
export function evaluar(m) {
  const el = elementosActuales(m);
  const R = m.cuerpo.radio;
  const orbita = el.ligada && el.periapsis >= R + AJUSTES.periapsisMinKm * 1000 && el.apoapsis < 25 * R;
  const lugares = m.observados.map((o) => o.id);
  const estrellas = (orbita ? 1 : 0) + (orbita && lugares.length >= 2 ? 1 : 0) + (orbita && lugares.length >= 3 ? 1 : 0);
  return {
    orbita, lugares, estrellas,
    perilunioKm: orbita ? (el.periapsis - R) / 1000 : null, apolunioKm: orbita ? (el.apoapsis - R) / 1000 : null,
    dvUsado: m.dvUsado, dvRestante: dvRestante(m), tiempoMision: m.t, fin: m.fin?.tipo ?? 'en curso',
  };
}
