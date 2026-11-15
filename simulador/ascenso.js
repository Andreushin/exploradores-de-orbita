// OWNER: Rol 3 (@JU4NMAX) — Simulador de cohetes reales · física del ascenso (sin DOM).
// Ascenso en el plano de la trayectoria (2D inercial, centro de la Tierra en el origen),
// con etapas en serie y en paralelo, arrastre, Isp según la presión y guiado simple.
// Después de llegar a la órbita de espera, calcula el encendido hacia el destino (C3).
// Fuentes: simulador/FUENTES.md.

export const G0 = 9.80665;
const P0 = 101.29; // kPa a nivel del mar (NASA Glenn)
const AU = 1.495978707e11;
const MU_SOL = 1.32712440018e20;

// --- Atmósfera (NASA Glenn, Earth Atmosphere Model, unidades métricas) ----------

/** Presión (kPa) y densidad (kg/m³) a la altitud h (m). Por encima de 50 km, caída exponencial. */
export function atmosfera(h) {
  if (h < 0) h = 0;
  let T; let p;
  if (h < 11000) {
    T = 15.04 - 0.00649 * h;
    p = 101.29 * ((T + 273.1) / 288.08) ** 5.256;
  } else if (h < 25000) {
    T = -56.46;
    p = 22.65 * Math.exp(1.73 - 0.000157 * h);
  } else if (h < 50000) {
    T = -131.21 + 0.00299 * h;
    p = 2.488 * ((T + 273.1) / 216.6) ** -11.388;
  } else {
    const a = atmosfera(49999.9);
    const f = Math.exp(-(h - 50000) / 7000);
    return { p: a.p * f, rho: a.rho * f };
  }
  return { p, rho: p / (0.2869 * (T + 273.1)) };
}

// --- Motores ------------------------------------------------------------------

/** Gasto másico (kg/s) de UN motor, a partir del empuje dado (vacío o nivel del mar). */
export function gastoMotor(m) {
  if (m.empujeVac != null) return (m.empujeVac * 1000) / (m.ispVac * G0);
  return (m.empujeSL * 1000) / (m.ispSL * G0);
}

/** Isp a la presión p (interpolación lineal entre nivel del mar y vacío). */
export const ispA = (m, p) => m.ispVac - (m.ispVac - m.ispSL) * Math.min(1, p / P0);

// --- Destinos -------------------------------------------------------------------

/** C3 mínimo (km²/s²) desde una órbita de radio r0 (m): transferencia de Hohmann. */
export function c3Requerido(destino, c, r0) {
  if (destino.tipo === 'geocentrico') {
    const r2 = destino.radioOrbitaKm * 1000;
    return (-2 * c.muTierra / (r0 + r2)) / 1e6;
  }
  const vT = Math.sqrt(MU_SOL / AU);
  const k = destino.radioOrbitaUA;
  const vinf = vT * (Math.sqrt((2 * k) / (1 + k)) - 1);
  return (vinf * vinf) / 1e6;
}

/** Δv (m/s) impulsivo desde órbita circular de radio r para lograr C3 (km²/s²). */
export function dvParaC3(c3, r, mu) {
  return Math.sqrt(c3 * 1e6 + (2 * mu) / r) - Math.sqrt(mu / r);
}

// --- Simulación -----------------------------------------------------------------

/**
 * Simula el lanzamiento de `cohete` (de cohetes.json) con carga `masaNave` (kg).
 * @returns {{ ok, motivo, eventos, serie, insercion, salida }}
 */
export function simular(coheteOriginal, datos, { masaNave = coheteOriginal.mision.masaNave, dt = 0.05, muestreo = 0.5, tMax = 1500 } = {}) {
  const cohete = structuredClone(coheteOriginal); // cada corrida empieza limpia
  const c = datos.constantes;
  const R = c.radioTierra;
  const mu = c.muTierra;
  const hObj = c.orbitaEsperaKm * 1000;
  const lat = (cohete.mision.latitud * Math.PI) / 180;
  const vRot = c.omegaTierra * R * Math.cos(lat); // m/s hacia el este

  // Inventario de masas
  const fases = cohete.fases.map((f, i) => ({ ...f, i, prop: f.propelente, estado: 'espera', tInicio: null }));
  const items = [
    { id: 'nave', nombre: cohete.mision.nave, masa: masaNave, unido: true },
    ...cohete.masasFijas.map((m) => ({ ...m, unido: true })),
    ...fases.flatMap((f) => (f.extra || []).map((x) => ({ ...x, fase: f.id, unido: true }))),
  ];
  const masaTotal = () => items.filter((x) => x.unido).reduce((s, x) => s + x.masa, 0)
    + fases.filter((f) => f.estado !== 'suelta').reduce((s, f) => s + f.seco + f.prop, 0);

  // Grupos de fases que encienden juntas
  const grupos = [];
  for (const f of fases) {
    if (f.enParaleloCon) grupos.find((g) => g.some((x) => x.id === f.enParaleloCon)).push(f);
    else grupos.push([f]);
  }
  const indiceGrupo = (f) => grupos.findIndex((g) => g.includes(f));

  const eventos = [];
  const evento = (t, texto, extra = {}) => eventos.push({ t, texto, ...extra });
  const serie = [];

  let x = 0; let y = R; let vx = vRot; let vy = 0; // en la plataforma, girando con la Tierra
  let t = 0;
  let grupo = 0;
  let pausa = 0;
  let enOrbita = false;
  let motivo = null;
  let proxMuestra = 0;
  const encender = (g, tt) => {
    for (const f of grupos[g]) { f.estado = 'activa'; f.tInicio = tt; }
    evento(tt, `Encendido: ${grupos[g].map((f) => f.nombre).join(' + ')}`, { tipo: 'encendido', fase: grupos[g][0].id });
  };
  encender(0, 0);
  evento(0, 'Despegue', { tipo: 'despegue', masa: masaTotal() });

  const soltarFase = (f, tt) => {
    f.estado = 'suelta';
    for (const it of items) if (it.fase === f.id && it.conEtapa && it.unido) it.unido = false;
    evento(tt, f.alApagar || `Fin de ${f.nombre}`, { tipo: 'separacion', fase: f.id, historico: f.historico?.apagado ?? f.historico?.separacion });
  };

  while (t < tMax) {
    const r = Math.hypot(x, y);
    const ux = x / r; const uy = y / r;      // vertical local
    const ex = uy; const ey = -ux;           // horizontal hacia el este
    const h = r - R;
    const { p, rho } = atmosfera(h);
    const vr = vx * ux + vy * uy;
    const vt = vx * ex + vy * ey;
    // Velocidad relativa al aire (atmósfera que gira con la Tierra)
    const vAtm = c.omegaTierra * r * Math.cos(lat);
    const rvx = vx - vAtm * ex; const rvy = vy - vAtm * ey;
    const vRel = Math.hypot(rvx, rvy);

    // Sueltas programadas (por tiempo o altitud)
    for (const it of items) {
      if (!it.unido || !it.suelta) continue;
      const f = fases.find((ff) => ff.id === it.fase);
      const porT = it.suelta.t != null && t >= it.suelta.t;
      const porAlt = it.suelta.altitudKm != null && h >= it.suelta.altitudKm * 1000;
      const porFase = it.suelta.trasEncender != null && f?.tInicio != null && t >= f.tInicio + it.suelta.trasEncender;
      if (porT || porAlt || porFase) { it.unido = false; evento(t, it.texto || `Se suelta: ${it.nombre}`, { tipo: 'suelta', item: it.id }); }
    }

    // Empuje de las fases activas
    let empuje = 0; let gasto = 0;
    const activas = pausa > 0 ? [] : fases.filter((f) => f.estado === 'activa');
    for (const f of activas) {
      for (const m of f.motores) {
        if (m.apagaEn && t >= m.apagaEn.t) continue;
        let n = m.n;
        if (m.apagaUno && t >= m.apagaUno.t) {
          n -= 1;
          if (!m._avisado) { m._avisado = true; evento(t, m.apagaUno.texto, { tipo: 'corte' }); }
        }
        let fr = 1;
        for (const s of m.regulacion || []) {
          if (s.t != null && t >= s.t) fr = s.f;
          if (s.trasFase && fases.find((ff) => ff.id === s.trasFase)?.estado === 'suelta') fr = s.f;
        }
        const md = gastoMotor(m) * n * fr;
        gasto += md;
        empuje += md * ispA(m, p) * G0;
        f._gasto = (f._gasto || 0) + md;
      }
    }
    const masa = masaTotal();

    // Guiado: ángulo sobre el horizonte
    const gc = cohete.guiado;
    let pitch;
    if (t < gc.giroInicio) pitch = Math.PI / 2;
    else if (grupo < gc.lazoCerradoDesdeGrupo) {
      // Programa de cabeceo (lazo abierto), como los cohetes reales en la atmósfera:
      // de vertical a `pitchFinal` grados en `tFin` s, y luego se mantiene.
      const sProg = Math.min(1, (t - gc.giroInicio) / (gc.tFin - gc.giroInicio));
      pitch = ((90 - (90 - gc.pitchFinal) * sProg ** gc.forma) * Math.PI) / 180;
    } else {
      const tau = gc.tau;
      const aT = empuje / masa || 1;
      const aR = (hObj - h) / (tau * tau) - (2 * vr) / tau + mu / (r * r) - (vt * vt) / r;
      pitch = Math.asin(Math.max(-0.5, Math.min(0.95, aR / aT)));
    }
    const dirx = Math.cos(pitch) * ex + Math.sin(pitch) * ux;
    const diry = Math.cos(pitch) * ey + Math.sin(pitch) * uy;

    // Fuerzas
    const fase0 = fases.filter((f) => f.estado === 'activa');
    const area = Math.max(...fase0.map((f) => f.areaFrontal || 0), Math.PI * (cohete.diametro / 2) ** 2);
    const drag = 0.5 * rho * vRel * vRel * cohete.cd * area;
    let ax = (empuje * dirx - (vRel > 0 ? drag * rvx / vRel : 0)) / masa - (mu * x) / r ** 3;
    let ay = (empuje * diry - (vRel > 0 ? drag * rvy / vRel : 0)) / masa - (mu * y) / r ** 3;
    if (h <= 0 && t < 5 && ax * ux + ay * uy < 0) { ax = 0; ay = 0; } // sobre la plataforma

    if (t >= proxMuestra) {
      serie.push({ t, x, y, h, v: Math.hypot(vx, vy), vRel, vr, vt, masa, pitch, a: Math.hypot(ax + (mu * x) / r ** 3, ay + (mu * y) / r ** 3) / G0, grupo, empuje });
      proxMuestra += muestreo;
    }

    // Integración (Euler semi-implícito)
    vx += ax * dt; vy += ay * dt;
    x += vx * dt; y += vy * dt;
    t += dt;
    if (pausa > 0) pausa -= dt;

    // Consumo de propelente
    for (const f of activas) {
      f.prop -= (f._gasto || 0) * dt;
      f._gasto = 0;
    }

    // Fin de fases
    for (const f of activas) {
      if (f.prop > 0) continue;
      f.prop = 0;
      if (f.superior) { motivo = `Se agotó ${f.nombre} antes de llegar a la órbita`; break; }
      soltarFase(f, t);
    }
    if (motivo) break;
    if (activas.length && grupos[grupo].every((f) => f.estado === 'suelta')) {
      grupo += 1;
      if (grupo >= grupos.length) { motivo = 'No quedan etapas'; break; }
      pausa = grupos[grupo][0].pausaPrevia || 1;
      encender(grupo, t + pausa);
    }

    // ¿Órbita? (etapa superior encendida, a la altura y con velocidad circular)
    const sup = fases.find((f) => f.superior);
    const rN = Math.hypot(x, y);
    // Perigeo de la órbita instantánea: se apaga cuando ya no vuelve a caer por debajo de la meta
    const eN = (vx * vx + vy * vy) / 2 - mu / rN;
    const hN = x * vy - y * vx;
    const aN = -mu / (2 * eN);
    const eccN = Math.sqrt(Math.max(0, 1 + (2 * eN * hN * hN) / (mu * mu)));
    const perigeo = eN < 0 ? aN * (1 - eccN) - R : Infinity;
    if (sup.estado === 'activa' && perigeo >= hObj - 15000) {
      enOrbita = true;
      evento(t, 'Inserción en la órbita de espera', { tipo: 'orbita', historico: sup.historico?.orbita });
      break;
    }
    if (rN - R < -10) { motivo = 'El cohete cayó'; break; }
  }
  if (!enOrbita && !motivo) motivo = 'No llegó a la órbita a tiempo';

  // Órbita alcanzada
  const r = Math.hypot(x, y);
  const v2 = vx * vx + vy * vy;
  const energia = v2 / 2 - mu / r;
  const hAng = x * vy - y * vx;
  const a = -mu / (2 * energia);
  const ecc = Math.sqrt(Math.max(0, 1 + (2 * energia * hAng * hAng) / (mu * mu)));
  const insercion = { t, h: r - R, v: Math.sqrt(v2), perigeoKm: (a * (1 - ecc) - R) / 1000, apogeoKm: (a * (1 + ecc) - R) / 1000, masa: masaTotal() };
  serie.push({ t, x, y, h: r - R, v: Math.sqrt(v2), masa: insercion.masa, grupo, empuje: 0 });

  // Encendido hacia el destino con lo que queda en la etapa superior
  let salida = null;
  if (enOrbita) {
    const sup = fases.find((f) => f.superior);
    const motor = sup.motores[0];
    const m0 = masaTotal();
    const mf = m0 - sup.prop;
    const dv = motor.ispVac * G0 * Math.log(m0 / mf);
    const vFinal = Math.sqrt(v2) + dv;
    const c3 = (vFinal * vFinal - (2 * mu) / r) / 1e6;
    const destino = datos.destinos[cohete.mision.destino];
    const req = c3Requerido(destino, c, r);
    const reqMarte = c3Requerido(datos.destinos.marte, c, r);
    salida = {
      propRestante: sup.prop, dv, c3, c3Requerido: req,
      dvRequerido: dvParaC3(req, r, mu),
      llegaDirecto: c3 >= req,
      llegaAsistido: cohete.mision.rutaReal ? c3 >= reqMarte : null,
      c3RutaAsistida: cohete.mision.rutaReal ? reqMarte : null,
      tiempoQuemado: (sup.prop * motor.ispVac * G0) / (motor.empujeVac * 1000),
    };
    // Duración del encendido justo para el destino (lo que hizo la misión real)
    const dvReq = salida.dvRequerido;
    if (dvReq <= dv) {
      const mUsada = m0 * (1 - Math.exp(-dvReq / (motor.ispVac * G0)));
      salida.duracionRequerida = (mUsada * motor.ispVac * G0) / (motor.empujeVac * 1000);
    }
    evento(t, `Encendido hacia ${destino.nombre}: Δv ${Math.round(dv)} m/s → C3 ${salida.c3.toFixed(1)} km²/s²`, {
      tipo: 'salida', duracion: salida.duracionRequerida, historicoDuracion: sup.historico?.duracionEncendidoDestino,
    });
  }
  return { ok: enOrbita, motivo, eventos, serie, insercion, salida };
}

/** Carga máxima (kg) que el cohete logra llevar a su destino (búsqueda binaria). */
export function cargaMaxima(cohete, datos, { directo = true } = {}) {
  const llega = (m) => {
    const s = simular(cohete, datos, { masaNave: m, dt: 0.1, muestreo: 1e9 });
    if (!s.ok) return false;
    return directo ? s.salida.llegaDirecto : (s.salida.llegaAsistido ?? s.salida.llegaDirecto);
  };
  let lo = 0; let hi = 200000;
  if (!llega(lo)) return 0;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (llega(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

/** Propaga una órbita sin empuje (Euler semi-implícito, como `simular`). Para dibujarla y para las pruebas. */
export function propagarOrbita({ x, y, vx, vy }, mu, { dt = 1, pasos = 6000 } = {}) {
  const puntos = [];
  for (let i = 0; i < pasos; i++) {
    const r3 = Math.hypot(x, y) ** 3;
    vx -= (mu * x / r3) * dt; vy -= (mu * y / r3) * dt;
    x += vx * dt; y += vy * dt;
    puntos.push({ x, y });
  }
  return puntos;
}
