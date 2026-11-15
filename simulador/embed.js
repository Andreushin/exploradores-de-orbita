// OWNER: Rol 1 — Simulador de cohetes · modo incrustado (lo abre el Nivel 3 dentro de un iframe).
// Módulo puro (sin DOM) para probarlo en Node: simulador/tests/embed.test.mjs.
//
//   simulador/?rocket=saturno-v&lock=1&embed=1
//     rocket  id de cohetes.json con el que arranca (si no existe, se ignora)
//     lock    1 = el cohete no se puede cambiar (solo vale con un rocket válido)
//     embed   1 = va dentro de otra página: sin enlace de marca ni botón de idioma, y avisa al terminar
//
// Mensajes con la página que lo contiene (mismo origen, window.postMessage):
//   simulador → página   { type: SIM_DONE, rocketId, ok, perigeoKm, apogeoKm, tiempoS, propRestanteKg }
//   página → simulador   { type: SIM_LANG, lang: 'es' | 'en' }

export const SIM_DONE = 'eo:sim-done';
export const SIM_LANG = 'eo:sim-lang';

/** Lee los parámetros de la URL (`location.search`) contra la lista de cohetes de cohetes.json. */
export function leerParametros(search, cohetes) {
  const p = new URLSearchParams(search || '');
  const id = p.get('rocket');
  const rocketId = (cohetes || []).some((c) => c.id === id) ? id : null;
  return {
    rocketId,
    lock: rocketId !== null && p.get('lock') === '1',
    embed: p.get('embed') === '1',
  };
}

/** Resumen serializable del vuelo que llegó a órbita (resultado de ascenso.js → simular()). */
export function mensajeFin(sim, cohete) {
  const i = sim.insercion || {};
  const r = (n) => (Number.isFinite(n) ? Math.round(n) : null);
  return {
    type: SIM_DONE,
    rocketId: cohete.id,
    ok: Boolean(sim.ok),
    perigeoKm: r(i.perigeoKm),
    apogeoKm: r(i.apogeoKm),
    tiempoS: r(i.t),
    propRestanteKg: r(sim.salida?.propRestante),
  };
}
