// OWNER: Rol 3 (@JU4NMAX) — Arma los modelos 3D con cada etapa como grupo separable.
// Los constructores (saturno-v.js, …) salen de los HTML originales. Aquí cada pieza se asigna a su
// etapa según su posición en el modelo (y, |x|) y el cohete se escala a su altura real en metros.
import { construir as saturnoV } from './saturno-v.js';
import { construir as atlasAgena } from './atlas-agena-d.js';
import { construir as falconHeavy } from './falcon-heavy.js';

/** Radio aproximado de la geometría de una pieza (para distinguir faldones y cuerpos anchos). */
function radioPieza(obj) {
  const p = obj.geometry?.parameters;
  if (!p) return 0;
  return Math.max(p.radiusTop ?? 0, p.radiusBottom ?? 0, p.radius ?? 0);
}

// Reglas: la primera que coincide gana. `p` = { x, y, r } de cada pieza en coordenadas del modelo.
export const MODELOS = {
  'saturno-v': {
    construir: saturnoV,
    alturaReal: 110.6,
    etapas: [
      { id: 'les', regla: (p) => p.y >= 15.0 },
      { id: 'nave', regla: (p) => p.y >= 9.45 },
      { id: 's-ivb', regla: (p) => p.y >= 5.2 },
      { id: 's-ii', regla: (p) => p.y >= -2.8 },
      { id: 's-ic', regla: () => true },
    ],
  },
  'atlas-agena-d': {
    construir: atlasAgena,
    alturaReal: 28.4, // Atlas-Agena D completo: 93 ft (ver FUENTES.md)
    etapas: [
      { id: 'cofia', regla: (p) => p.y >= 12.0 },
      { id: 'agena', regla: (p) => p.y >= 8.0 },
      { id: 'booster', regla: (p) => p.y < -6.5 && (Math.abs(p.x) > 0.3 || p.r > 1.6) },
      { id: 'atlas', regla: () => true },
    ],
  },
  'falcon-heavy': {
    construir: falconHeavy,
    alturaReal: 70.0,
    etapas: [
      { id: 'lateral-izq', regla: (p) => p.x < -1.5 },
      { id: 'lateral-der', regla: (p) => p.x > 1.5 },
      { id: 'cofia', regla: (p) => p.y >= 12.0 },
      { id: 'segunda', regla: (p) => p.y >= 7.0 },
      { id: 'central', regla: () => true },
    ],
  },
};

/** Qué grupos 3D se sueltan con cada evento de la simulación (fase o ítem de cohetes.json). */
export const SUELTAS = {
  'saturno-v': { 's-ic': ['s-ic'], les: ['les'], 's-ii': ['s-ii'] },
  'atlas-agena-d': { booster: ['booster'], cofia: ['cofia'], atlas: ['atlas'] },
  'falcon-heavy': { laterales: ['lateral-izq', 'lateral-der'], cofia: ['cofia'], central: ['central'] },
};

/**
 * Construye el cohete `id` a escala real (1 unidad = 1 m), con la base en y = 0.
 * @returns {{ grupo: THREE.Group, etapas: Record<string, THREE.Group>, altura: number }}
 */
export function armarCohete(THREE, id) {
  const def = MODELOS[id];
  const original = def.construir(THREE);
  const grupo = new THREE.Group();
  const etapas = Object.fromEntries(def.etapas.map((e) => [e.id, new THREE.Group()]));
  for (const g of Object.values(etapas)) grupo.add(g);

  for (const pieza of [...original.children]) {
    const p = { x: pieza.position.x, y: pieza.position.y, r: radioPieza(pieza) };
    const etapa = def.etapas.find((e) => e.regla(p));
    for (const [k, g] of Object.entries(etapas)) g.name = k;
    etapas[etapa.id].add(pieza); // conserva su posición relativa
  }

  // Escala a la altura real y base en y = 0
  const caja = new THREE.Box3().setFromObject(grupo);
  const escala = def.alturaReal / (caja.max.y - caja.min.y);
  grupo.scale.setScalar(escala);
  grupo.position.y = -caja.min.y * escala;
  const contenedor = new THREE.Group();
  contenedor.add(grupo);
  return { grupo: contenedor, etapas, altura: def.alturaReal, escala };
}
