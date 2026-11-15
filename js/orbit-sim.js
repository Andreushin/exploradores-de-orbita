// OWNER: Rol 2 (física) — Simulador orbital 2D sin DOM. Lo usa el Nivel 3 pilotado.
// Unidades: km, km/s y s para la órbita; kg, N y s para el motor. Los Δv se devuelven en m/s,
// igual que en js/physics.js. Valores reales de μ y radio (ver docs/fuentes.md).
import { G0 } from './physics.js';

/** Cuerpos: μ = GM (km³/s²), radio (km). `vInf` = velocidad de llegada (km/s); null = se ajusta al Δv del destino. */
export const BODIES = {
  earth: { mu: 398600.4, radius: 6371 },
  moon: { mu: 4902.8, radius: 1737.4, vInf: null },
  mars: { mu: 42828.4, radius: 3389.5, vInf: 2.6 },
  europa: { mu: 3202.7, radius: 1560.8, vInf: null },
};

/** Salida desde la Tierra: órbita de estacionamiento y energía que exige cada destino. */
export const PARKING_ALT_KM = 300;
export const MOON_DISTANCE_KM = 384400;
const DEPART_VINF = { mars: 2.94, europa: 8.8 }; // km/s de exceso hiperbólico (Hohmann a Marte y a Júpiter)

/** Periapsis objetivo de la captura, en radios del destino. */
export const TARGET_PERIAPSIS_R = 1.15;
/** Distancia donde empieza la llegada y límite a partir del cual la nave se considera perdida (radios). */
export const ARRIVAL_START_R = 22;
export const ESCAPE_LIMIT_R = 30;

const hypot = Math.hypot;

/** Estado inicial en órbita circular de radio r (sentido antihorario), con la nave apuntando prógrado. */
export function circularState(mu, r) {
  return { x: r, y: 0, vx: 0, vy: Math.sqrt(mu / r), angle: Math.PI / 2 };
}

/**
 * Elementos de la órbita (cónica) a partir del estado.
 * @returns {{ energy, h, e, a, rp, ra, bound, argp, p }} ra = Infinity si la trayectoria es abierta
 */
export function elements(s, mu) {
  const r = hypot(s.x, s.y);
  const v2 = s.vx * s.vx + s.vy * s.vy;
  const energy = v2 / 2 - mu / r;
  const h = s.x * s.vy - s.y * s.vx;
  // Vector de excentricidad: apunta al periapsis
  const ex = (s.vy * h) / mu - s.x / r;
  const ey = (-s.vx * h) / mu - s.y / r;
  const e = hypot(ex, ey);
  const p = (h * h) / mu;
  const rp = p / (1 + e);
  const bound = energy < 0 && e < 1;
  const ra = bound ? p / (1 - e) : Infinity;
  const a = energy !== 0 ? -mu / (2 * energy) : Infinity;
  const argp = e > 1e-9 ? Math.atan2(ey, ex) : Math.atan2(s.y, s.x);
  return { energy, h, e, a, rp, ra, bound, argp, p };
}

/** Puntos [x, y] de la cónica para dibujarla. En trayectorias abiertas se corta en `rMax`. */
export function conicPoints(el, n = 120, rMax = Infinity) {
  const pts = [];
  let half = Math.PI;
  if (!el.bound || el.ra > rMax) {
    const c = (el.p / rMax - 1) / el.e;
    half = c <= -1 ? Math.PI : c >= 1 ? 0 : Math.acos(c);
    if (!el.bound) half = Math.min(half, Math.acos(Math.max(-1, -1 / el.e)) - 1e-3);
  }
  for (let i = 0; i <= n; i++) {
    const nu = -half + (2 * half * i) / n;
    const r = el.p / (1 + el.e * Math.cos(nu));
    const th = el.argp + nu;
    pts.push([r * Math.cos(th), r * Math.sin(th)]);
  }
  return pts;
}

/**
 * Consume propelente durante `dt` s de motor encendido. La masa baja mientras se quema, así que
 * el Δv sale de la ecuación del cohete: Δv = Isp · g₀ · ln(m₀ / m₁).
 * @param ship { dry, prop, isp, thrustN } (se modifica `prop`)
 * @returns {{ dv, kg, out }} dv en m/s; out = true si el tanque se vació en este paso
 */
export function consume(ship, dt) {
  if (!(ship.isp > 0) || ship.prop <= 0) return { dv: 0, kg: 0, out: true };
  const want = (ship.thrustN / (ship.isp * G0)) * dt;
  const kg = Math.min(want, ship.prop);
  const m0 = ship.dry + ship.prop;
  ship.prop -= kg;
  const dv = ship.isp * G0 * Math.log(m0 / (m0 - kg));
  return { dv, kg, out: ship.prop <= 1e-9 };
}

/**
 * Avanza el estado `dt` s con gravedad del cuerpo central y un empuje opcional (Verlet de velocidad).
 * @param dvMs Δv del motor en este paso (m/s), aplicado en la dirección `s.angle`
 */
export function step(s, mu, dt, dvMs = 0) {
  const acc = (x, y) => { const r = hypot(x, y); const k = -mu / (r * r * r); return [k * x, k * y]; };
  const t = dvMs / 1000 / dt; // km/s²
  const tx = t * Math.cos(s.angle); const ty = t * Math.sin(s.angle);
  const [ax, ay] = acc(s.x, s.y);
  s.x += s.vx * dt + 0.5 * (ax + tx) * dt * dt;
  s.y += s.vy * dt + 0.5 * (ay + ty) * dt * dt;
  const [bx, by] = acc(s.x, s.y);
  s.vx += (0.5 * (ax + bx) + tx) * dt;
  s.vy += (0.5 * (ay + by) + ty) * dt;
  return s;
}

/** Ángulo prógrado (dirección de la velocidad). El retrógrado es este + π. */
export const prograde = (s) => Math.atan2(s.vy, s.vx);

// --- Salida desde la Tierra -------------------------------------------------------------------

/**
 * Qué debe lograr el cohete para ir a un destino.
 * @returns {{ r0, energy0, energyTarget, dvIdeal }} dvIdeal en m/s (quemado impulsivo perfecto)
 */
export function departure(destId) {
  const { mu, radius } = BODIES.earth;
  const r0 = radius + PARKING_ALT_KM;
  const energy0 = -mu / (2 * r0);
  const energyTarget = destId === 'moon'
    ? -mu / (r0 + MOON_DISTANCE_KM)
    : (DEPART_VINF[destId] ?? DEPART_VINF.mars) ** 2 / 2;
  const dvIdeal = (Math.sqrt(2 * (energyTarget + mu / r0)) - Math.sqrt(mu / r0)) * 1000;
  return { r0, energy0, energyTarget, dvIdeal };
}

/** Avance de la salida (0–1): cuánta de la energía necesaria ya tiene la órbita. */
export function departureProgress(s, dep) {
  const { energy } = elements(s, BODIES.earth.mu);
  return Math.max(0, Math.min(1, (energy - dep.energy0) / (dep.energyTarget - dep.energy0)));
}

// --- Llegada y captura ------------------------------------------------------------------------

/**
 * Plan de llegada a un destino. La captura nominal es un frenado de `dvRequired` m/s en el periapsis objetivo.
 * Si el cuerpo no fija `vInf`, se elige para que ese frenado deje una órbita circular.
 * @returns {{ body, rpTarget, vInf, vPeri, bTarget, startR, limitR, dvRequired }}
 */
export function arrival(destId, dvRequired) {
  const body = BODIES[destId] || BODIES.moon;
  const rpTarget = body.radius * TARGET_PERIAPSIS_R;
  const dv = dvRequired / 1000;
  const esc2 = (2 * body.mu) / rpTarget;
  let vInf = body.vInf;
  if (vInf == null) {
    const v = Math.sqrt(body.mu / rpTarget) + dv;
    vInf = Math.sqrt(Math.max(0.01, v * v - esc2));
  }
  const vPeri = Math.sqrt(vInf * vInf + esc2);
  return {
    body, rpTarget, vInf, vPeri, dvRequired,
    bTarget: impactParameter(rpTarget, vInf, body.mu),
    startR: body.radius * ARRIVAL_START_R,
    limitR: body.radius * ESCAPE_LIMIT_R,
  };
}

/** Parámetro de impacto (km) de una hipérbola con periapsis rp y velocidad de llegada vInf. */
export function impactParameter(rp, vInf, mu) {
  return rp * Math.sqrt(1 + (2 * mu) / (rp * vInf * vInf));
}
/** Periapsis (km) que resulta de un parámetro de impacto b. */
export function periapsisFor(b, vInf, mu) {
  const k = mu / (vInf * vInf);
  return -k + Math.sqrt(k * k + b * b);
}

/** Estado al entrar en la zona del destino: sobre una hipérbola con periapsis `rp0`, a distancia `startR`, acercándose desde la izquierda. */
export function arrivalState(plan, rp0) {
  const { mu } = plan.body;
  const e = 1 + (rp0 * plan.vInf * plan.vInf) / mu;
  const p = rp0 * (1 + e);
  const nu = -Math.acos(Math.max(-1, Math.min(1, (p / plan.startR - 1) / e)));
  const k = Math.sqrt(mu / p);
  const px = plan.startR * Math.cos(nu); const py = plan.startR * Math.sin(nu);
  const vx = -k * Math.sin(nu); const vy = k * (e + Math.cos(nu));
  const rot = Math.PI - Math.atan2(py, px); // la nave empieza a la izquierda del destino
  const c = Math.cos(rot); const sn = Math.sin(rot);
  const s = { x: px * c - py * sn, y: px * sn + py * c, vx: vx * c - vy * sn, vy: vx * sn + vy * c, angle: 0 };
  s.angle = prograde(s) + Math.PI; // apuntando retrógrado, lista para frenar
  return s;
}

/**
 * Frenado equivalente: qué fracción del Δv nominal de captura representa la energía que perdió la nave.
 * 0 = no frenó · 1 = frenado nominal · > 1 = frenó de más.
 */
export function insertionRatio(el, plan) {
  const after = Math.sqrt(Math.max(0, 2 * (el.energy + plan.body.mu / plan.rpTarget)));
  return ((plan.vPeri - after) * 1000) / plan.dvRequired;
}

/**
 * Resultado de la captura con la órbita actual: los mismos estados que `insertionOutcome` de physics.js,
 * pero leídos de la órbita real (si choca, si escapa o qué tan alargada quedó).
 * @returns 'orbit' | 'eccentric' | 'flyby' | 'crash'
 */
export function captureOutcome(el, plan) {
  if (el.rp <= plan.body.radius) return 'crash';
  if (!el.bound || el.ra > plan.limitR) return 'flyby';
  return insertionRatio(el, plan) < 0.95 ? 'eccentric' : 'orbit';
}

/** ¿La órbita ya es cerrada, no toca la superficie y no se aleja demasiado? */
export const isCaptured = (el, plan) => el.bound && el.rp > plan.body.radius && el.ra <= plan.limitR;

/**
 * Hacia dónde conviene empujar para llevar el periapsis al objetivo: perpendicular a la velocidad,
 * del lado que acerca `rp` a `rpTarget`. Devuelve el ángulo en radianes.
 */
export function correctionAngle(s, plan) {
  const pg = prograde(s);
  const err = (side) => {
    const a = pg + side * Math.PI / 2;
    const t = { ...s, vx: s.vx + 0.001 * Math.cos(a), vy: s.vy + 0.001 * Math.sin(a) };
    return Math.abs(elements(t, plan.body.mu).rp - plan.rpTarget);
  };
  return pg + (err(1) < err(-1) ? 1 : -1) * Math.PI / 2;
}
