// OWNER: Rol 1 — Contrato de datos entre niveles. Ver docs/contrato-niveles.md.
// Cada nivel (app principal y carpetas nivelN/) lee y escribe UNA sola clave de localStorage.

export const STORE_KEY = 'eo-mision';
export const STORE_VERSION = 1;
/** Secciones del estado que viajan entre niveles (misma forma que js/state.js). */
export const SECTIONS = ['missionId', 'rocketId', 'budget', 'plan', 'satellite', 'journey', 'report'];

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Devuelve la misión guardada o null (sin datos, versión distinta o storage bloqueado). */
export function loadMission() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.version === STORE_VERSION ? data : null;
  } catch {
    return null;
  }
}

/**
 * Mezcla `patch` con lo guardado, por sección: saveMission({ journey: { outcome: 'orbit' } })
 * conserva el resto de `journey` y de las demás secciones. Devuelve la misión resultante.
 */
export function saveMission(patch) {
  const current = loadMission() || { version: STORE_VERSION };
  for (const [k, v] of Object.entries(patch || {})) {
    current[k] = isObj(v) && isObj(current[k]) ? { ...current[k], ...v } : v;
  }
  current.version = STORE_VERSION;
  current.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(current));
  } catch { /* storage bloqueado: el nivel sigue funcionando sin guardar */ }
  return current;
}

/** Borra la misión (nueva partida). */
export function clearMission() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}

/** Solo las secciones del contrato (deja fuera `screen`, `lang`, etc.). */
export function pickSections(state) {
  return Object.fromEntries(SECTIONS.filter((k) => k in state).map((k) => [k, state[k]]));
}

/**
 * URL de un nivel, sirva desde la raíz (nivel 1) o desde una carpeta nivelN/.
 * levelUrl(1) → app principal · levelUrl(3) → nivel3/
 */
export function levelUrl(n) {
  const inFolder = /\/nivel\d+\//.test(location.pathname);
  const root = inFolder ? '../' : './';
  return n === 1 ? root : `${root}nivel${n}/`;
}
