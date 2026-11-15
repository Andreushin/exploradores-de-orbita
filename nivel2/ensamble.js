// OWNER: Rol 3 — Nivel 2 · banco de ensamblaje: cuadrícula de U y dibujo del CubeSat (SVG).
// packCells es pura (se prueba en tests/taller.test.html); renderBanco solo arma un string SVG.

export const CELLS_PER_U = 4; // cada U se divide en 4 celdas de 0.25U (2 × 2)

/** Color e icono de cada pieza en la cuadrícula. La batería se distingue del resto de la energía. */
export function estiloPieza(p) {
  if (p.storageWh) return { color: '#facc15', icon: '🔋' };
  return {
    power: { color: '#fbbf24', icon: '⚡' },
    propulsion: { color: '#ff6b35', icon: '🔥' },
    comms: { color: '#4fc3f7', icon: '📡' },
    adcs: { color: '#a78bfa', icon: '🧭' },
    obc: { color: '#34d399', icon: '💾' },
    instrument: { color: '#f472b6', icon: '🔬' },
  }[p.category] || { color: '#9aa6cf', icon: '▪' };
}

/** Columnas × filas de U de cada estructura, como se ven de frente. */
export function formaU(capU) {
  if (capU <= 3) return { cols: 1, rows: Math.max(1, Math.ceil(capU)) };
  if (capU <= 6) return { cols: 2, rows: Math.ceil(capU / 2) };
  return { cols: 4, rows: Math.ceil(capU / 4) };
}

/**
 * Acomoda las piezas en las celdas de la estructura: primero las grandes (así las de 1U o más
 * caen alineadas a su U) y, a igual tamaño, en el orden en que se eligieron. Las que no caben
 * completas quedan en `overflow`.
 * → { placed: [{ id, start, size }], overflow: [{ id, size }], usedCells, totalCells }
 */
export function packCells(piezas, capU) {
  const totalCells = Math.round((capU || 0) * CELLS_PER_U);
  const orden = piezas
    .filter((p) => p.category !== 'structure' && p.volumeU > 0)
    .map((p, i) => ({ p, i, size: Math.max(1, Math.round(p.volumeU * CELLS_PER_U)) }))
    .sort((a, b) => b.size - a.size || a.i - b.i);
  const placed = [];
  const overflow = [];
  let next = 0;
  for (const { p, size } of orden) {
    if (next + size <= totalCells) { placed.push({ id: p.id, start: next, size }); next += size; }
    else overflow.push({ id: p.id, size });
  }
  return { placed, overflow, usedCells: next, totalCells };
}

// --- Dibujo ---------------------------------------------------------------------
const CELL = 24;       // px de una celda de 0.25U
const GAP = 3;         // separación entre celdas
const U_PX = CELL * 2 + GAP; // lado de una U
const U_GAP = 8;       // separación entre U
const FRAME = 10;      // grosor del marco (rieles)
const SIDE = 92;       // espacio a cada lado para las alas de paneles
const TOP = 64;        // espacio arriba para antenas e instrumentos
const BOTTOM = 70;     // espacio abajo para tobera y lo que no cabe

/** Posición (x, y) de la celda `k` dentro del chasis. */
function celdaXY(k, cols) {
  const u = Math.floor(k / CELLS_PER_U);
  const q = k % CELLS_PER_U;
  const ux = u % cols;
  const uy = Math.floor(u / cols);
  return {
    x: ux * (U_PX + U_GAP) + (q % 2) * (CELL + GAP),
    y: uy * (U_PX + U_GAP) + Math.floor(q / 2) * (CELL + GAP),
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * SVG del CubeSat. `estructura` es la pieza de categoría structure (o null), `piezas` el resto,
 * `nuevo` el id recién instalado (se anima), `nombre(p)` el texto accesible de cada pieza.
 */
export function renderBanco({ estructura, piezas, nuevo = null, nombre = (p) => p.id, vacio = '', ariaLabel = '' }) {
  if (!estructura) {
    return `<svg class="n2-svg" viewBox="0 0 320 220" role="img" aria-label="${esc(vacio)}">
      <rect x="110" y="40" width="100" height="140" rx="8" class="n2-ghost-frame"/>
      <text x="160" y="205" text-anchor="middle" class="n2-svg-hint">${esc(vacio)}</text></svg>`;
  }
  const capU = estructura.volumeU;
  const { cols, rows } = formaU(capU);
  const innerW = cols * U_PX + (cols - 1) * U_GAP;
  const innerH = rows * U_PX + (rows - 1) * U_GAP;
  const bodyW = innerW + FRAME * 2;
  const bodyH = innerH + FRAME * 2;
  const W = bodyW + SIDE * 2;
  const H = bodyH + TOP + BOTTOM;
  const bx = SIDE; // esquina del chasis
  const by = TOP;
  const ix = bx + FRAME;
  const iy = by + FRAME;
  const pack = packCells(piezas, capU);
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
  const has = (pred) => piezas.some(pred);
  const out = [];

  // Alas de paneles desplegables (se abren desde el costado del chasis)
  if (has((p) => p.id === 'solar-deploy')) {
    const wingH = Math.min(bodyH - 20, 120);
    const wy = by + (bodyH - wingH) / 2;
    const cls = `n2-wing${nuevo === 'solar-deploy' ? ' is-new' : ''}`;
    const panel = (x, origin) => `<g class="${cls}" style="transform-origin:${origin}px ${wy + wingH / 2}px">
      <rect x="${x}" y="${wy}" width="${SIDE - 12}" height="${wingH}" rx="3" class="n2-solar"/>
      ${[1, 2, 3].map((i) => `<line x1="${x + ((SIDE - 12) * i) / 4}" y1="${wy}" x2="${x + ((SIDE - 12) * i) / 4}" y2="${wy + wingH}" class="n2-solar-line"/>`).join('')}
      <line x1="${x}" y1="${wy + wingH / 2}" x2="${x + SIDE - 12}" y2="${wy + wingH / 2}" class="n2-solar-line"/></g>`;
    out.push(panel(6, bx), panel(bx + bodyW + 6, bx + bodyW));
    out.push(`<line x1="${bx - 6}" y1="${by + bodyH / 2}" x2="${bx}" y2="${by + bodyH / 2}" class="n2-strut"/>`);
    out.push(`<line x1="${bx + bodyW}" y1="${by + bodyH / 2}" x2="${bx + bodyW + 6}" y2="${by + bodyH / 2}" class="n2-strut"/>`);
  }

  // Antenas y aberturas de instrumentos en la cara superior
  const topItems = [];
  if (has((p) => p.id === 'comm-x')) topItems.push((x) => `<g class="n2-acc n2-antenna${nuevo === 'comm-x' ? ' is-new' : ''}"><line x1="${x}" y1="${by}" x2="${x}" y2="${by - 22}" class="n2-strut"/><path d="M${x - 20} ${by - 34} Q${x} ${by - 12} ${x + 20} ${by - 34}" class="n2-dish"/><circle cx="${x}" cy="${by - 30}" r="3" class="n2-dish-feed"/></g>`);
  if (has((p) => p.id === 'comm-uhf')) topItems.push((x) => `<g class="n2-acc n2-antenna${nuevo === 'comm-uhf' ? ' is-new' : ''}"><line x1="${x}" y1="${by}" x2="${x - 12}" y2="${by - 44}" class="n2-whip"/><line x1="${x}" y1="${by}" x2="${x + 12}" y2="${by - 44}" class="n2-whip"/></g>`);
  for (const p of piezas.filter((q) => q.category === 'instrument')) {
    const isNew = nuevo === p.id ? ' is-new' : '';
    if (p.id === 'inst-radar') topItems.push((x) => `<g class="n2-acc${isNew}"><rect x="${x - 16}" y="${by - 14}" width="32" height="10" rx="2" class="n2-radar"/><line x1="${x}" y1="${by - 4}" x2="${x}" y2="${by}" class="n2-strut"/></g>`);
    else if (p.id === 'inst-mag') topItems.push((x) => `<g class="n2-acc${isNew}"><line x1="${x}" y1="${by}" x2="${x}" y2="${by - 40}" class="n2-strut"/><circle cx="${x}" cy="${by - 42}" r="4" class="n2-mag"/></g>`);
    else topItems.push((x) => `<g class="n2-acc${isNew}"><rect x="${x - 9}" y="${by - 12}" width="18" height="12" rx="2" class="n2-lens-body"/><circle cx="${x}" cy="${by - 12}" r="6" class="n2-lens"/></g>`);
  }
  topItems.forEach((draw, i) => out.push(draw(bx + (bodyW * (i + 1)) / (topItems.length + 1))));

  // Chasis: marco con rieles y las U vacías
  out.push(`<rect x="${bx}" y="${by}" width="${bodyW}" height="${bodyH}" rx="6" class="n2-frame"/>`);
  for (let k = 0; k < pack.totalCells; k++) {
    const { x, y } = celdaXY(k, cols);
    out.push(`<rect x="${ix + x}" y="${iy + y}" width="${CELL}" height="${CELL}" rx="3" class="n2-cell"/>`);
  }

  // Piezas acomodadas: un bloque de celdas del color de la categoría, con su icono
  for (const it of pack.placed) {
    const p = byId[it.id];
    const { color, icon } = estiloPieza(p);
    const cls = `n2-block${nuevo === it.id ? ' is-new' : ''}`;
    const cells = [];
    for (let k = it.start; k < it.start + it.size; k++) {
      const { x, y } = celdaXY(k, cols);
      cells.push(`<rect x="${ix + x}" y="${iy + y}" width="${CELL}" height="${CELL}" rx="3" fill="${color}"/>`);
    }
    const first = celdaXY(it.start, cols);
    out.push(`<g class="${cls}" data-id="${esc(it.id)}"><title>${esc(nombre(p))} · ${p.volumeU}U</title>${cells.join('')}
      <text x="${ix + first.x + CELL / 2}" y="${iy + first.y + CELL / 2 + 1}" class="n2-block-icon">${icon}</text></g>`);
  }

  // Tobera (y su llama, que se enciende en la prueba en tierra)
  if (has((p) => p.category === 'propulsion')) {
    const cx = bx + bodyW / 2;
    const ny = by + bodyH;
    const isNew = piezas.some((p) => p.category === 'propulsion' && p.id === nuevo) ? ' is-new' : '';
    out.push(`<g class="n2-acc${isNew}"><path d="M${cx - 10} ${ny} L${cx + 10} ${ny} L${cx + 16} ${ny + 18} L${cx - 16} ${ny + 18} Z" class="n2-nozzle"/>
      <path d="M${cx - 13} ${ny + 18} Q${cx} ${ny + 60} ${cx + 13} ${ny + 18} Z" class="n2-flame"/></g>`);
  }
  // RTG: aletas de disipación a un costado inferior
  if (has((p) => p.id === 'rtg-mini')) {
    const rx = bx + bodyW - 18;
    const ry = by + bodyH;
    out.push(`<g class="n2-acc${nuevo === 'rtg-mini' ? ' is-new' : ''}">${[0, 1, 2].map((i) => `<rect x="${rx + i * 6}" y="${ry}" width="3" height="16" class="n2-rtg"/>`).join('')}</g>`);
  }

  // Lo que no cabe: bloques rojos fuera del marco
  if (pack.overflow.length) {
    let x = bx;
    const y = by + bodyH + 36;
    for (const it of pack.overflow) {
      const p = byId[it.id];
      const w = Math.min(it.size, 8) * (CELL / 2 + 2);
      out.push(`<g class="n2-overflow${nuevo === it.id ? ' is-new' : ''}"><title>${esc(nombre(p))}</title><rect x="${x}" y="${y}" width="${w}" height="${CELL}" rx="3"/>
        <text x="${x + w / 2}" y="${y + CELL / 2 + 1}" class="n2-block-icon">${estiloPieza(p).icon}</text></g>`);
      x += w + 4;
    }
  }

  return `<svg class="n2-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel)}">
    <defs><filter id="n2-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <g class="n2-sat">${out.join('')}</g>
    <rect class="n2-eclipse" x="0" y="0" width="${W}" height="${H}"/>
    <g class="n2-ping" transform="translate(${bx + bodyW / 2} ${by - 40})"><circle r="10"/><circle r="10"/></g>
  </svg>`;
}
