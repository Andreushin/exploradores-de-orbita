// OWNER: Rol 3 (@JU4NMAX) — Simulador de pilotaje · motor orbital PURO (sin DOM ni Three.js).
// Pensado para llevarse al juego del equipo (issue #57). Vectores 3D como [x, y, z], unidades SI.
// Gravedad de un solo cuerpo (problema de dos cuerpos) con empuje opcional; integrador leapfrog
// (kick-drift-kick), simpléctico: la energía no deriva en órbitas largas.

export const G0 = 9.80665;

// --- Álgebra mínima --------------------------------------------------------------
export const suma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const esc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norma = (a) => Math.hypot(a[0], a[1], a[2]);
export const unitario = (a) => { const n = norma(a); return n ? esc(a, 1 / n) : [0, 0, 0]; };

// --- Dinámica -----------------------------------------------------------------------
/** Aceleración de gravedad (m/s²) en la posición r, hacia el origen. */
export function gravedad(mu, r) {
  const d = norma(r);
  return esc(r, -mu / (d * d * d));
}

/**
 * Un paso leapfrog. `empuje(estado)` devuelve una aceleración extra [ax, ay, az] (m/s²) o null.
 * @param {{r:number[], v:number[]}} e estado
 * @returns {{r:number[], v:number[]}} nuevo estado
 */
export function paso(e, mu, dt, empuje = null) {
  const acc = (r, v) => {
    const g = gravedad(mu, r);
    const t = empuje ? empuje({ r, v }) : null;
    return t ? suma(g, t) : g;
  };
  const a0 = acc(e.r, e.v);
  const vMedia = suma(e.v, esc(a0, dt / 2));
  const r = suma(e.r, esc(vMedia, dt));
  const a1 = acc(r, vMedia);
  return { r, v: suma(vMedia, esc(a1, dt / 2)) };
}

/** Elementos orbitales a partir de posición y velocidad. Sirve para órbitas elípticas e hiperbólicas. */
export function elementos(e, mu) {
  const { r, v } = e;
  const rn = norma(r);
  const v2 = punto(v, v);
  const h = cruz(r, v);
  const hn = norma(h);
  const energia = v2 / 2 - mu / rn;
  const ev = esc(suma(esc(r, v2 - mu / rn), esc(v, -punto(r, v))), 1 / mu); // vector de excentricidad
  const exc = norma(ev);
  const semi = Math.abs(energia) < 1e-12 ? Infinity : -mu / (2 * energia); // negativo si es hiperbólica
  const p = (hn * hn) / mu;
  const periapsis = p / (1 + exc);
  const ligada = energia < 0;
  return {
    energia, excentricidad: exc, semiejeMayor: semi, periapsis,
    apoapsis: ligada ? semi * (1 + exc) : Infinity,
    periodo: ligada ? 2 * Math.PI * Math.sqrt(semi ** 3 / mu) : Infinity,
    inclinacion: Math.acos(Math.max(-1, Math.min(1, h[2] / hn))),
    momentoAngular: h, ligada, vInfinito: ligada ? 0 : Math.sqrt(2 * energia),
  };
}

/** Velocidad circular a la distancia r. */
export const velocidadCircular = (mu, r) => Math.sqrt(mu / r);

/**
 * Trayectoria predicha SIN empuje: lista de posiciones para dibujarla.
 * @returns {{puntos:number[][], choca:boolean, tChoque:number|null}}
 */
export function predecir(e, mu, { dt = 10, pasos = 800, radioCuerpo = 0 } = {}) {
  const puntos = [e.r];
  let s = e;
  for (let i = 0; i < pasos; i++) {
    s = paso(s, mu, dt);
    puntos.push(s.r);
    if (radioCuerpo && norma(s.r) <= radioCuerpo) return { puntos, choca: true, tChoque: (i + 1) * dt };
  }
  return { puntos, choca: false, tChoque: null };
}

// --- Llegada en sobrevuelo --------------------------------------------------------------
/**
 * Estado inicial de una llegada hiperbólica: la nave entra con velocidad `vInf` (m/s) en el
 * plano XY y pasaría por el periapsis `rp` (m) si no frenara. Se coloca en `rIni` (m), antes del periapsis.
 * Sin motor, la nave pasa de largo: la misión se gana frenando (captura), no apuntando.
 */
export function llegadaSobrevuelo(mu, { vInf, rp, rIni }) {
  const a = -mu / (vInf * vInf);           // semieje (negativo)
  const exc = 1 - rp / a;                  // e = 1 + rp·vInf²/μ
  const p = a * (1 - exc * exc);           // semilatus rectum (positivo)
  const cosNu = (p / rIni - 1) / exc;      // anomalía verdadera de entrada (negativa)
  const nu = -Math.acos(Math.max(-1, Math.min(1, cosNu)));
  const r = [rIni * Math.cos(nu), rIni * Math.sin(nu), 0];
  const k = Math.sqrt(mu / p);
  const v = [-k * Math.sin(nu), k * (exc + Math.cos(nu)), 0];
  return { r, v, excentricidad: exc, semiejeMayor: a };
}

/** Δv (m/s) de un frenado impulsivo en el periapsis para quedar en una elipse con apoapsis `ra` (m). */
export function dvCaptura(mu, { vInf, rp, ra }) {
  const vPeriHiper = Math.sqrt(vInf * vInf + (2 * mu) / rp);
  const aElipse = (rp + ra) / 2;
  const vPeriElipse = Math.sqrt(mu * (2 / rp - 1 / aElipse));
  return vPeriHiper - vPeriElipse;
}

/** Δv (m/s) para pasar de una órbita circular a una elipse con apoapsis `ra`, quemando en el periapsis. */
export function dvCircularizar(mu, { rp, ra }) {
  return Math.sqrt(mu * (2 / rp - 2 / (rp + ra))) - velocidadCircular(mu, rp);
}

// --- Ecuación del cohete ---------------------------------------------------------------
export const dvDisponible = (isp, m0, mf) => isp * G0 * Math.log(m0 / mf);
export const propelenteGastado = (m, dv, isp) => m * (1 - Math.exp(-dv / (isp * G0)));

// --- Geometría de observación ---------------------------------------------------------------
/** Radio angular (rad) del cuerpo visto desde la distancia d: define el horizonte. */
export const radioAngular = (radio, d) => Math.asin(Math.min(1, radio / d));

/** Altitud (m) a la que el horizonte queda a `angulo` rad bajo la dirección al centro. Útil para HUD. */
export const distanciaAlHorizonte = (radio, d) => Math.sqrt(Math.max(0, d * d - radio * radio));

/**
 * ¿El cuerpo de radio `radio`, centrado en el origen, tapa la línea recta entre la nave y `objetivo`?
 * Se usa para perder la señal con la Tierra detrás de la Luna.
 */
export function tapado(posNave, objetivo, radio) {
  const d = resta(objetivo, posNave);
  const L = norma(d);
  const u = esc(d, 1 / L);
  const t = -punto(posNave, u); // punto de la recta más cercano al origen
  if (t <= 0 || t >= L) return false;
  return norma(suma(posNave, esc(u, t))) < radio;
}

/** Latitud y longitud (grados, este positivo) del punto del cuerpo bajo el vector `p` en el instante t. */
export function subpunto(p, { rotacion, t = 0 }) {
  const ang = (2 * Math.PI * t) / rotacion;           // giro del cuerpo desde t = 0
  const x = p[0] * Math.cos(ang) + p[1] * Math.sin(ang);
  const y = -p[0] * Math.sin(ang) + p[1] * Math.cos(ang);
  const lat = Math.asin(p[2] / norma(p)) * (180 / Math.PI);
  let lon = Math.atan2(y, x) * (180 / Math.PI);
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

/** Distancia angular (grados) entre dos puntos de la superficie dados por lat/lon (grados). */
export function distanciaAngular(a, b) {
  const r = Math.PI / 180;
  const c = Math.sin(a.lat * r) * Math.sin(b.lat * r) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.cos((a.lon - b.lon) * r);
  return Math.acos(Math.max(-1, Math.min(1, c))) / r;
}
