// OWNER: Rol 3 (@JU4NMAX) — Nivel 2 · Taller del CubeSat (docs/niveles/nivel-2.md).
// Lee la misión del Nivel 1 de `eo-mision` (docs/contrato-niveles.md), deja armar el CubeSat bajo
// los límites de masa, energía y presupuesto, y escribe solo la sección `satellite`.
import { validateDesign, resolvePieces, KG_PER_U } from '../js/physics.js';
import { loadMission, saveMission, levelHref } from '../js/mision-store.js';
import { grams, meterData, rocketOverload, instrumentStatus, incompatibleSelected, powerText, signedW, checkState, tradeHints } from '../js/taller-reglas.js';
import { TEXTOS } from './textos.js';

const CATEGORIES = ['structure', 'power', 'propulsion', 'comms', 'adcs', 'obc', 'instrument'];
export const DEMO = {
  missionId: 'moon',
  rocketId: 'pico',
  budget: { total: 100, launch: 25, space: 25, ground: 8, user: 5 },
  plan: { scienceTargetIdx: 0 },
  satellite: { formFactor: 'struct-6u', pieces: ['battery', 'prop-green', 'comm-uhf', 'obc', 'inst-camera'], propellantKg: 2.5 },
};

// --- Idioma ---------------------------------------------------------------
const LANG_KEY = 'srl-lang';
let lang = (() => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es'; } catch { return 'es'; } })();
function t(key, vars = {}) {
  const get = (l) => key.split('.').reduce((o, k) => o?.[k], TEXTOS[l]);
  const v = get(lang) ?? get('es') ?? key;
  return String(v).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}
const tx = (o) => (o && typeof o === 'object' ? o[lang] ?? o.es : o ?? '');
const fmt = (n, d = 1) => Number(n).toFixed(d);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// --- Datos y estado -------------------------------------------------------
let data;
let m;
let demo = false;
let removedIds = [];

export function pickMission(saved) {
  const usable = saved?.missionId && saved?.rocketId && saved?.budget?.space > 0;
  if (!usable) return { mission: structuredClone(DEMO), demo: true };
  const satellite = { formFactor: null, pieces: [], propellantKg: 0, ...saved.satellite };
  return { mission: { ...saved, plan: saved.plan || {}, satellite }, demo: false };
}

export function satelliteSummary(sat, result, rocket) {
  const r1 = (n) => Math.round(n * 1000) / 1000;
  return {
    formFactor: sat.formFactor,
    pieces: [...sat.pieces],
    propellantKg: sat.propellantKg,
    dryKg: r1(result.metrics.dry),
    wetKg: r1(result.metrics.wet),
    isp: result.metrics.isp,
    dvAvailable: Math.round(result.metrics.dv),
    powerGenW: r1(result.metrics.power.generated),
    powerUseW: r1(result.metrics.power.consumed),
    powerNetW: r1(result.metrics.power.net),
    batteryWh: result.metrics.storage.capacityWh,
    maxPayloadKg: rocket?.maxPayloadKg ?? null,
    validated: result.valid,
  };
}

function persist() {
  if (demo) return;
  saveMission({ satellite: { formFactor: m.satellite.formFactor, pieces: [...m.satellite.pieces], propellantKg: m.satellite.propellantKg, validated: false } });
}

function setSatellite(patch) {
  m.satellite = { ...m.satellite, ...patch };
  removedIds = [];
  persist();
  render();
}

function togglePiece(p) {
  const sat = m.satellite;
  if (p.category === 'structure') return setSatellite({ formFactor: p.id });
  const has = sat.pieces.includes(p.id);
  if (p.category === 'propulsion') {
    const others = sat.pieces.filter((id) => data.pieces.find((x) => x.id === id)?.category !== 'propulsion');
    return setSatellite({ pieces: has ? others : [...others, p.id], propellantKg: has ? 0 : sat.propellantKg });
  }
  return setSatellite({ pieces: has ? sat.pieces.filter((id) => id !== p.id) : [...sat.pieces, p.id] });
}

// ═════════════════════════════════════════════════════════
// SVG — VISOR DE ENSAMBLAJE CUBESAT 101
// ═════════════════════════════════════════════════════════

const SVG_NS = 'http://www.w3.org/2000/svg';
const U_SIZE = 72;   // px por celda U en el viewBox 480×600
const MIN_PIECE_H = 22;
const PIECE_GAP = 2;

// Colores por categoría/subsistema
const CAT_COLOR = {
  power: '#fbbf24',
  propulsion: '#ff6b35',
  comms: '#a78bfa',
  adcs: '#34d399',
  obc: '#60a5fa',
  instrument: '#4ade80',
};

// Etiqueta corta para cada pieza en el SVG
const PIECE_ABBR = {
  'battery': 'BAT 80Wh', 'battery-large': 'BAT 160Wh',
  'prop-cold': 'GAS FRÍO', 'prop-green': 'MONOPROP', 'prop-ion': 'ION',
  'comm-uhf': 'UHF', 'comm-x': 'X-BAND',
  'adcs': 'ADCS', 'obc': 'OBC',
  'inst-camera': 'CAM', 'inst-spectro': 'ESPECT',
  'inst-radar': 'RADAR', 'inst-mag': 'MAG',
};

// Piezas externas (no van en las celdas del chasis)
const EXTERNAL_IDS = new Set(['solar-deploy', 'rtg-mini', 'comm-uhf', 'comm-x', 'prop-cold', 'prop-green', 'prop-ion']);

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function getChassisGeom(formFactorId) {
  const GEOMS = {
    'struct-3u':  { cols: 1, rows: 3 },
    'struct-6u':  { cols: 2, rows: 3 },
    'struct-12u': { cols: 2, rows: 6 },
  };
  const g = GEOMS[formFactorId] || GEOMS['struct-3u'];
  const w = g.cols * U_SIZE;
  const h = g.rows * U_SIZE;
  const x = 240 - w / 2;
  const y = 300 - h / 2;
  return { ...g, w, h, x, y };
}

/** Piezas internas: solo las que ocupan celdas del chasis */
function getInternalPieces(pieceIds) {
  const INTERNAL_CATS = new Set(['power', 'adcs', 'obc', 'instrument']);
  return pieceIds
    .map((id) => data.pieces.find((p) => p.id === id))
    .filter((p) => p && INTERNAL_CATS.has(p.category) && !EXTERNAL_IDS.has(p.id));
}

/**
 * Distribuye las piezas internas en las celdas del chasis.
 * Para 1 col apila todo en la única columna; para 2 cols
 * alterna hacia la columna con menos altura acumulada.
 */
function packInternal(pieces, geom) {
  const colW = geom.w / geom.cols;
  const cols = Array.from({ length: geom.cols }, () => ({ y: 4 }));
  return pieces.map((piece, idx) => {
    const h = Math.max(MIN_PIECE_H, Math.round(piece.volumeU * U_SIZE));
    const ci = geom.cols === 1 ? 0 : cols[0].y <= cols[1].y ? 0 : 1;
    const col = cols[ci];
    const px = geom.x + ci * colW + 3;
    const py = geom.y + col.y;
    const overflow = col.y + h > geom.h - 4;
    col.y += h + PIECE_GAP;
    return { piece, x: px, y: py, w: colW - 6, h, overflow, idx };
  });
}

function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function renderSVG() {
  const root = $('n2-cubesat');
  root.replaceChildren();
  const sat = m.satellite;

  if (!sat.formFactor) {
    // Placeholder antes de elegir estructura
    const icon = svgEl('text', { x: '240', y: '268', 'text-anchor': 'middle', 'font-size': '52', opacity: '0.18' });
    icon.textContent = '🛰️';
    const hint = svgEl('text', {
      x: '240', y: '300', 'text-anchor': 'middle',
      fill: '#9aa6cf', 'font-size': '12.5',
      'font-family': '"Space Grotesk",system-ui,sans-serif',
    });
    hint.textContent = t('pickStructure') + ' →';
    root.append(icon, hint);
    return;
  }

  const geom = getChassisGeom(sat.formFactor);

  // ── 1. CHASIS: rejilla de celdas ──────────────────────────
  const chassisG = svgEl('g');

  const chassisRect = svgEl('rect', {
    id: 'n2-chassis',
    x: geom.x, y: geom.y, width: geom.w, height: geom.h,
    fill: '#0e1530', stroke: '#4fc3f7', 'stroke-width': '1.5', rx: '4',
  });
  chassisG.append(chassisRect);

  // Líneas de celda U (rejilla interna)
  for (let col = 0; col <= geom.cols; col++) {
    const lx = geom.x + col * U_SIZE;
    const line = svgEl('line', { x1: lx, y1: geom.y, x2: lx, y2: geom.y + geom.h, stroke: '#263362', 'stroke-width': '0.6' });
    chassisG.append(line);
  }
  for (let row = 0; row <= geom.rows; row++) {
    const ly = geom.y + row * U_SIZE;
    const line = svgEl('line', { x1: geom.x, y1: ly, x2: geom.x + geom.w, y2: ly, stroke: '#263362', 'stroke-width': '0.6' });
    chassisG.append(line);
  }

  // Etiqueta del factor de forma encima del chasis
  const struct = data.pieces.find((p) => p.id === sat.formFactor);
  const ffLbl = svgEl('text', {
    x: geom.x + geom.w / 2, y: geom.y - 8,
    'text-anchor': 'middle', fill: '#4fc3f7',
    'font-family': '"JetBrains Mono",monospace', 'font-size': '11', 'font-weight': '500',
  });
  ffLbl.textContent = struct ? tx(struct.name) : '';
  chassisG.append(ffLbl);

  root.append(chassisG);

  // ── 2. PIEZAS INTERNAS: bloques animados en las celdas ────
  const internalPieces = getInternalPieces(sat.pieces);
  const packed = packInternal(internalPieces, geom);
  const internalG = svgEl('g');

  packed.forEach(({ piece, x, y, w, h, overflow, idx }) => {
    const color = CAT_COLOR[piece.category] || '#9aa6cf';
    const g = svgEl('g', {
      class: 'n2-svg-piece',
      style: `animation-delay:${idx * 0.06}s`,
    });
    const rect = svgEl('rect', {
      x, y, width: w, height: h,
      fill: hexAlpha(color, 0.22),
      stroke: overflow ? '#ff7a7a' : color,
      'stroke-width': overflow ? '1.5' : '0.9',
      rx: '3',
      class: overflow ? 'n2-svg-overflow' : '',
    });
    const fontSize = Math.min(9.5, h * 0.42);
    const lbl = svgEl('text', {
      x: x + w / 2, y: y + h / 2 + fontSize * 0.38,
      'text-anchor': 'middle', fill: color,
      'font-family': '"JetBrains Mono",monospace',
      'font-size': fontSize, 'font-weight': '500',
    });
    lbl.textContent = PIECE_ABBR[piece.id] || piece.id.toUpperCase();
    g.append(rect, lbl);
    internalG.append(g);
  });
  root.append(internalG);

  // ── 3. PANELES SOLARES ────────────────────────────────────
  if (sat.pieces.includes('solar-deploy')) {
    const panelW = 88;   // ancho total de cada panel
    const panelH = 34;   // alto del panel
    const panelY = geom.y + (geom.h - panelH) / 2;  // centrado vertical en el chasis
    const nSegs = 3;
    const segW = (panelW - (nSegs - 1) * 2) / nSegs;

    const drawPanel = (cls, startX) => {
      const g = svgEl('g', { class: cls });
      for (let i = 0; i < nSegs; i++) {
        const sx = startX + i * (segW + 2);
        const seg = svgEl('rect', {
          x: sx, y: panelY, width: segW, height: panelH,
          fill: hexAlpha('#60a5fa', 0.28), stroke: '#4fc3f7',
          'stroke-width': '0.75', rx: '1.5',
        });
        // Línea central de la celda solar (aspecto de panel fotovoltaico)
        const mid = svgEl('line', {
          x1: sx, y1: panelY + panelH / 2,
          x2: sx + segW, y2: panelY + panelH / 2,
          stroke: '#4fc3f7', 'stroke-width': '0.4', opacity: '0.6',
        });
        // Línea vertical
        const vm = svgEl('line', {
          x1: sx + segW / 2, y1: panelY,
          x2: sx + segW / 2, y2: panelY + panelH,
          stroke: '#4fc3f7', 'stroke-width': '0.4', opacity: '0.6',
        });
        g.append(seg, mid, vm);
      }
      return g;
    };

    const leftG = drawPanel('n2-svg-panel-l', geom.x - panelW);
    const rightG = drawPanel('n2-svg-panel-r', geom.x + geom.w + 2);
    root.append(leftG, rightG);
  }

  // ── 4. PROPULSOR ─────────────────────────────────────────
  const propId = sat.pieces.find((id) => data.pieces.find((p) => p.id === id)?.category === 'propulsion');
  if (propId) {
    const thrusterG = svgEl('g', { class: 'n2-svg-thruster' });
    // Dimensiones según tipo
    const BW = propId === 'prop-ion' ? 22 : propId === 'prop-cold' ? 16 : 30;
    const BH = propId === 'prop-ion' ? 44 : propId === 'prop-cold' ? 26 : 36;
    const tx0 = geom.x + geom.w / 2 - BW / 2;
    const ty0 = geom.y + geom.h + 2;

    // Cuerpo del motor
    const body = svgEl('rect', {
      x: tx0, y: ty0, width: BW, height: BH * 0.55,
      fill: hexAlpha('#ff6b35', 0.18), stroke: '#ff6b35',
      'stroke-width': '1', rx: '2',
    });
    // Tobera (polígono que se ensancha)
    const nW = BW * 1.6;
    const nH = BH * 0.45;
    const nx = tx0 + BW / 2;
    const ny0 = ty0 + BH * 0.55;
    const nozzle = svgEl('polygon', {
      points: `${nx - BW / 2},${ny0} ${nx + BW / 2},${ny0} ${nx + nW / 2},${ny0 + nH} ${nx - nW / 2},${ny0 + nH}`,
      fill: hexAlpha('#ff6b35', 0.12), stroke: '#ff6b35', 'stroke-width': '0.75',
    });
    // Llama animada
    const flameG = svgEl('g', { class: 'n2-svg-flame' });
    const flameBase = ny0 + nH;
    const flame1 = svgEl('polygon', {
      points: `${nx - BW * 0.35},${flameBase} ${nx + BW * 0.35},${flameBase} ${nx},${flameBase + 22}`,
      fill: '#ff6b35', opacity: '0.65',
    });
    const flame2 = svgEl('polygon', {
      points: `${nx - BW * 0.2},${flameBase} ${nx + BW * 0.2},${flameBase} ${nx},${flameBase + 14}`,
      fill: '#fbbf24', opacity: '0.9',
    });
    flameG.append(flame1, flame2);

    // Etiqueta
    const lbl = svgEl('text', {
      x: nx, y: flameBase + 30,
      'text-anchor': 'middle', fill: '#ff6b35',
      'font-family': '"JetBrains Mono",monospace', 'font-size': '8.5',
    });
    lbl.textContent = propId === 'prop-ion' ? 'ION ⚡' : propId === 'prop-cold' ? 'GAS' : 'MONO';

    thrusterG.append(body, nozzle, flameG, lbl);
    root.append(thrusterG);
  }

  // ── 5. ANTENAS ───────────────────────────────────────────
  const hasUHF = sat.pieces.includes('comm-uhf');
  const hasXBand = sat.pieces.includes('comm-x');

  if (hasUHF || hasXBand) {
    const antG = svgEl('g', { class: 'n2-svg-antenna' });
    const topY = geom.y - 4;

    if (hasUHF) {
      // Dipolo UHF: vástago + brazo en T + ondas
      const ax = hasXBand ? geom.x + geom.w * 0.32 : geom.x + geom.w * 0.5;
      const uhfG = svgEl('g');
      uhfG.append(svgEl('line', { x1: ax, y1: topY, x2: ax, y2: topY - 26, stroke: '#a78bfa', 'stroke-width': '1.5' }));
      uhfG.append(svgEl('line', { x1: ax - 10, y1: topY - 26, x2: ax + 10, y2: topY - 26, stroke: '#a78bfa', 'stroke-width': '1.5' }));
      for (let i = 0; i < 3; i++) {
        const sig = svgEl('circle', {
          cx: ax, cy: topY - 26, r: (i + 1) * 5.5,
          fill: 'none', stroke: '#a78bfa',
          'stroke-width': '0.6', opacity: '0.55',
          class: 'n2-svg-signal',
          style: `animation-delay:${i * 0.52}s`,
        });
        uhfG.append(sig);
      }
      antG.append(uhfG);
    }

    if (hasXBand) {
      // Plato parabólico banda X + ondas
      const ax = hasUHF ? geom.x + geom.w * 0.68 : geom.x + geom.w * 0.5;
      const xbG = svgEl('g');
      xbG.append(svgEl('line', { x1: ax, y1: topY, x2: ax, y2: topY - 18, stroke: '#a78bfa', 'stroke-width': '1.5' }));
      xbG.append(svgEl('path', {
        d: `M ${ax - 14} ${topY - 18} Q ${ax} ${topY - 34} ${ax + 14} ${topY - 18}`,
        fill: hexAlpha('#a78bfa', 0.18), stroke: '#a78bfa', 'stroke-width': '1.4',
      }));
      for (let i = 0; i < 3; i++) {
        const sig = svgEl('circle', {
          cx: ax, cy: topY - 34, r: (i + 1) * 5,
          fill: 'none', stroke: '#a78bfa',
          'stroke-width': '0.6', opacity: '0.55',
          class: 'n2-svg-signal',
          style: `animation-delay:${i * 0.52}s`,
        });
        xbG.append(sig);
      }
      antG.append(xbG);
    }
    root.append(antG);
  }

  // ── 6. RTG ───────────────────────────────────────────────
  if (sat.pieces.includes('rtg-mini')) {
    const rtgG = svgEl('g', { class: 'n2-svg-rtg' });
    const rx0 = geom.x + geom.w + 10;
    const ry0 = geom.y + geom.h * 0.5 - 25;

    // Soporte de conexión al chasis
    rtgG.append(svgEl('line', {
      x1: geom.x + geom.w, y1: ry0 + 25,
      x2: rx0, y2: ry0 + 25,
      stroke: '#ff6b35', 'stroke-width': '1.2', 'stroke-dasharray': '3,2',
    }));
    // Cuerpo
    rtgG.append(svgEl('rect', {
      x: rx0, y: ry0, width: 18, height: 50,
      fill: hexAlpha('#ff6b35', 0.18), stroke: '#ff6b35',
      'stroke-width': '1', rx: '3',
    }));
    // Aletas de disipación naranja
    for (let i = 0; i < 4; i++) {
      rtgG.append(svgEl('rect', {
        x: rx0 + 18, y: ry0 + i * 12 + 2,
        width: 9, height: 8,
        fill: hexAlpha('#ff6b35', 0.3), stroke: '#ff6b35',
        'stroke-width': '0.5', rx: '1',
      }));
    }
    const rtgLbl = svgEl('text', {
      x: rx0 + 9, y: ry0 + 60,
      'text-anchor': 'middle', fill: '#ff6b35',
      'font-family': '"JetBrains Mono",monospace', 'font-size': '8',
    });
    rtgLbl.textContent = 'RTG';
    rtgG.append(rtgLbl);
    root.append(rtgG);
  }

  // ── 7. INDICADOR DE VOLUMEN EXCEDIDO ─────────────────────
  if (struct) {
    const usedU = internalPieces.reduce((s, p) => s + (p.volumeU || 0), 0);
    if (usedU > struct.volumeU) {
      const ovfl = svgEl('text', {
        x: '240', y: '586',
        'text-anchor': 'middle', fill: '#ff7a7a',
        'font-family': '"JetBrains Mono",monospace', 'font-size': '10',
        class: 'n2-svg-overflow',
        filter: 'url(#n2-glow-sm)',
      });
      ovfl.textContent = `⚠ ${usedU.toFixed(1)}U / ${struct.volumeU}U`;
      root.append(ovfl);
    }
  }
}

// ═════════════════════════════════════════════════════════
// CATÁLOGO — columna izquierda
// ═════════════════════════════════════════════════════════

const popId = (p) => `n2-trl-${p.id}`;

function trlPopover(p) {
  const pop = document.createElement('div');
  pop.className = 'n2-pop';
  pop.id = popId(p);
  pop.setAttribute('popover', '');
  pop.innerHTML = `
    <h3>${tx(p.name)} · TRL ${p.trl}</h3>
    <p class="n2-pop-level">${t(`trlLevels.${p.trl}`)}</p>
    <h4>${t('trlWhatTitle')}</h4>
    <p>${t('trlWhat')}</p>
    <h4>${t('trlWhyTitle')}</h4>
    <p>${tx(p.desc)}</p>
    <button type="button" class="n2-btn n2-btn-primary" popovertarget="${pop.id}" popovertargetaction="hide">${t('gotIt')}</button>`;
  return pop;
}

function pieceButton(p, solarFactor) {
  const sat = m.satellite;
  const fit = instrumentStatus(p, m, data.workshop.instrumentFit);
  const selected = p.id === sat.formFactor || sat.pieces.includes(p.id);
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.id = p.id;
  b.className = `n2-piece${selected ? ' is-selected' : ''}${fit.compatible ? '' : ' is-off'}`;
  b.disabled = !fit.compatible;
  b.title = tx(p.desc);
  b.setAttribute('aria-pressed', String(selected));
  let extra = '';
  if (p.category === 'structure') {
    const form = data.workshop.formFactors?.[p.id];
    extra = `<small class="n2-hint">${form ? `${tx(form)} · ` : ''}${t('maxMass', { n: `<span class="n2-num">${grams(p.volumeU * KG_PER_U)}</span>` })}</small>`;
  } else if (fit.why) {
    extra = `<small class="n2-why" id="n2-why-${p.id}">${fit.compatible ? '✔' : '✘'} ${tx(fit.why)}</small>`;
    b.setAttribute('aria-describedby', `n2-why-${p.id}`);
  }
  b.innerHTML = `<strong>${tx(p.name)}</strong>
    <small class="n2-specs">${grams(p.massKg)} g · ${p.volumeU}U · ${powerText(p, solarFactor, (w) => t('atDest', { w: fmt(w) }))} · $${p.cost}M${p.isp ? ` · Isp ${p.isp}s` : ''}</small>
    <small class="n2-trl">TRL ${p.trl} · ${t(`trlShort.${p.trl}`)}</small>${extra}`;
  b.addEventListener('click', () => togglePiece(p));

  const wrap = document.createElement('div');
  wrap.className = 'n2-piece-wrap';
  const info = document.createElement('button');
  info.type = 'button';
  info.className = 'n2-info';
  info.textContent = 'i';
  info.setAttribute('popovertarget', popId(p));
  info.setAttribute('aria-label', t('trlInfo', { name: tx(p.name), n: p.trl }));
  wrap.append(b, info);
  return wrap;
}

function renderCatalog() {
  const box = $('n2-catalog');
  box.replaceChildren();
  const { solarFactor } = validateDesign(m, data).metrics.power;
  for (const cat of CATEGORIES) {
    const h = document.createElement('p');
    h.className = 'n2-cat-heading';
    h.textContent = t(`categories.${cat}`);
    const list = document.createElement('div');
    list.className = 'n2-pieces';
    for (const p of data.pieces.filter((x) => x.category === cat)) list.append(pieceButton(p, solarFactor));
    box.append(h, list);
  }
  const pops = $('n2-pops');
  pops.replaceChildren();
  for (const p of data.pieces) pops.append(trlPopover(p));
}

// ═════════════════════════════════════════════════════════
// TELEMETRÍA — columna derecha (Pasos 2 y 3)
// ═════════════════════════════════════════════════════════

function meterHTML({ label, value, d, aria, note, marker }) {
  const tight = d.level === 'warn' ? ` · ${t('tight')}` : '';
  if (d.level === 'pending') {
    return `
    <div class="n2-meter lvl-pending" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="${aria}">
      <div class="n2-meter-head"><span>${label}</span><b>${value}</b></div>
      <div class="n2-track"><div class="n2-fill" style="width:0%"></div></div>
      ${note ? `<small class="n2-note">${note}</small>` : ''}
    </div>`;
  }
  return `
    <div class="n2-meter lvl-${d.level}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="${Math.round(d.pct)}" aria-valuetext="${aria}${tight}">
      <div class="n2-meter-head"><span>${label}</span><b>${value}</b></div>
      <div class="n2-track"><div class="n2-fill" style="width:${d.pct}%"></div>${marker || ''}</div>
      ${note ? `<small class="n2-note">${note}</small>` : ''}
    </div>`;
}

function metersHTML(mission) {
  const res = validateDesign(mission, data);
  const x = res.metrics;
  const dest = data.missions.find((d) => d.id === mission.missionId);
  const rocket = data.rockets.find((r) => r.id === mission.rocketId);
  const M = meterData(x, dest, mission.budget.space);
  const req = t('required', { n: fmt(M.dv.required, 0) });
  const use = t('powerUse', { g: fmt(x.power.generated), c: fmt(x.power.consumed) });
  const sun = x.power.solarFactor < 0.995 ? t('sunAtDest', { pct: fmt(x.power.solarFactor * 100, 0) }) : '';
  const s = x.storage;
  const storeUse = t('batteryUse', { n: fmt(s.neededWh, 0), e: fmt(s.eclipseWh, 0), b: fmt(s.burnWh, 0), u: fmt(s.usableWh, 0), c: fmt(s.capacityWh, 0) });
  return [
    meterHTML({
      label: 'Δv', d: M.dv,
      value: M.dv.level === 'pending' ? `— / ${fmt(M.dv.required, 0)} m/s` : `${fmt(x.dv, 0)} / ${fmt(M.dv.required, 0)} m/s`,
      aria: `${fmt(x.dv, 0)} m/s, ${req}`,
      marker: M.dv.markerPct == null ? '' : `<i class="n2-marker" style="left:${M.dv.markerPct}%"></i>`,
      note: M.dv.markerPct == null ? '' : `│ ${req}`,
    }),
    M.mass.level === 'pending'
      ? meterHTML({ label: t('mass'), d: M.mass, value: '— / — g', aria: t('pickStructure'), note: t('pickStructure') })
      : meterHTML({ label: t('mass'), d: M.mass, value: `${grams(x.wet)} / ${grams(M.mass.cap)} g`, aria: `${grams(x.wet)} g / ${grams(M.mass.cap)} g` }),
    meterHTML({
      label: t('power'), d: M.power,
      value: M.power.level === 'pending' ? '—' : signedW(M.power.net),
      aria: `${signedW(M.power.net)}: ${use}`,
      note: [M.power.powerLow ? t('minPower', { n: M.power.minW }) : '', use, sun].filter(Boolean).join(' · '),
    }),
    M.battery.level === 'pending'
      ? meterHTML({ label: t('battery'), d: M.battery, value: '—', aria: t('noBattery'), note: t('noBattery') })
      : meterHTML({ label: t('battery'), d: M.battery, value: `${fmt(s.neededWh, 0)} / ${fmt(s.usableWh, 0)} Wh`, aria: storeUse, note: storeUse }),
    meterHTML({ label: t('cost'), d: M.cost, value: `$${x.cost}M / $${mission.budget.space}M`, aria: `$${x.cost}M / $${mission.budget.space}M` }),
    rocketOverload(x, rocket)
      ? `<p class="n2-alert" role="alert">🚫 ${t('rocketLimit', { name: tx(rocket.name), n: grams(rocket.maxPayloadKg) })}</p>`
      : '',
  ].join('');
}

function renderTelem() {
  const telem = $('n2-telem');
  telem.replaceChildren();
  const sat = m.satellite;

  // — Slider de propelente —
  const prop = data.pieces.find((p) => sat.pieces.includes(p.id) && p.category === 'propulsion');
  const metersDiv = document.createElement('div');
  metersDiv.className = 'n2-meters';
  metersDiv.innerHTML = metersHTML(m);

  if (prop) {
    const propSec = document.createElement('div');
    propSec.className = 'n2-telem-section';
    const ph = document.createElement('p');
    ph.className = 'n2-telem-heading';
    ph.textContent = t('propellant');
    const propRow = document.createElement('label');
    propRow.className = 'n2-prop';
    propRow.innerHTML = `
      <div class="n2-prop-row">
        <span>${t('propellant')}</span>
        <output>${fmt(sat.propellantKg)} kg</output>
      </div>
      <input type="range" min="0" max="${prop.maxPropellantKg}" step="0.1" value="${sat.propellantKg}">`;
    const input = propRow.querySelector('input');
    input.addEventListener('input', (e) => {
      propRow.querySelector('output').textContent = `${fmt(e.target.value)} kg`;
      const preview = { ...m, satellite: { ...sat, propellantKg: Number(e.target.value) } };
      metersDiv.innerHTML = metersHTML(preview);
    });
    input.addEventListener('change', (e) => setSatellite({ propellantKg: Number(e.target.value) }));
    propSec.append(ph, propRow);
    telem.append(propSec);
  }

  // — Medidores —
  const metersSec = document.createElement('div');
  metersSec.className = 'n2-telem-section';
  const mh = document.createElement('p');
  mh.className = 'n2-telem-heading';
  mh.textContent = lang === 'en' ? 'Resources' : 'Recursos';
  metersSec.append(mh, metersDiv);
  telem.append(metersSec);

  // — Verificaciones —
  const result = validateDesign(m, data);
  const checksSec = document.createElement('div');
  checksSec.className = 'n2-telem-section';
  const ch = document.createElement('p');
  ch.className = 'n2-telem-heading';
  ch.textContent = t('checksTitle');
  const list = document.createElement('ul');
  list.className = 'n2-checks';
  const MARK = { ok: '✔', bad: '✘', pending: '○' };
  for (const c of result.checks) {
    const state = checkState(c, result.metrics);
    const li = document.createElement('li');
    li.className = `n2-${state}`;
    li.textContent = `${MARK[state]} ${t(`checks.${c.id}`)}`;
    list.append(li);
  }
  const pendingNote = document.createElement('p');
  pendingNote.className = 'n2-pending-note';
  pendingNote.hidden = !result.checks.some((c) => checkState(c, result.metrics) === 'pending');
  pendingNote.textContent = sat.formFactor ? t('pendingBattery') : t('pendingHint');

  const dest = data.missions.find((d) => d.id === m.missionId);
  const parts = resolvePieces([sat.formFactor, ...sat.pieces].filter(Boolean), data.pieces);
  const tips = tradeHints(result, parts, data.pieces, dest, m.budget.space, {
    nameOf: (p) => tx(p.name),
    allowed: (p) => instrumentStatus(p, m, data.workshop.instrumentFit).compatible,
  });
  const tipsBox = document.createElement('ul');
  tipsBox.className = 'n2-tips';
  tipsBox.hidden = !tips.length;
  for (const tip of tips) {
    const li = document.createElement('li');
    li.textContent = `💡 ${t(`tips.${tip.key}`, { dest: tx(dest?.name), ...tip.vars })}`;
    tipsBox.append(li);
  }

  checksSec.append(ch, list, pendingNote, tipsBox);
  telem.append(checksSec);

  // — Botones Atrás / Lanzar —
  const footer = document.createElement('div');
  footer.className = 'n2-footer';
  const back = document.createElement('a');
  back.className = 'n2-btn n2-btn-ghost';
  back.href = levelHref(1);
  back.textContent = t('back');
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'n2-btn n2-btn-primary';
  launch.textContent = t('launch');
  launch.disabled = !result.valid;
  launch.title = t('launchHelp');
  launch.addEventListener('click', () => {
    const rocket = data.rockets.find((r) => r.id === m.rocketId);
    const satellite = satelliteSummary(m.satellite, result, rocket);
    if (!demo) saveMission({ satellite });
    else if (!loadMission()) saveMission({ missionId: m.missionId, rocketId: m.rocketId, budget: m.budget, plan: m.plan, satellite });
    location.href = levelHref(3);
  });
  footer.append(back, launch);
  telem.append(footer);
}

// ═════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ═════════════════════════════════════════════════════════

function render() {
  const dest = data.missions.find((d) => d.id === m.missionId);
  const target = dest?.scienceTargets?.[m.plan?.scienceTargetIdx];
  const brand = lang === 'en' ? 'Orbit Explorers' : 'Exploradores de Órbita';

  document.documentElement.lang = lang;
  document.title = `${t('title')} · ${brand}`;
  $('n2-brand-name').textContent = brand;
  $('n2-menu').title = t('menu');
  $('n2-lang').textContent = t('lang');
  $('n2-lang').setAttribute('aria-label', t('langLabel'));
  $('n2-reset').title = lang === 'en' ? 'Reset assembly' : 'Reiniciar ensamblaje';

  // Objetivo en la barra superior
  const objBar = $('n2-topbar-obj');
  if (target) {
    objBar.innerHTML = `🎯 <strong>${tx(target)}</strong> — ${lang === 'en' ? 'Incompatible instruments appear grey' : 'Los instrumentos incompatibles aparecen en gris'}`;
  } else {
    objBar.textContent = t('title');
  }

  // Avisos
  $('n2-demo').textContent = t('demo');
  $('n2-demo').hidden = !demo;
  $('n2-notice').hidden = !removedIds.length;
  if (removedIds.length) $('n2-notice').textContent = t('removed', { list: removedIds.map((id) => tx(data.pieces.find((p) => p.id === id).name)).join(', ') });

  renderCatalog();
  renderSVG();
  renderTelem();
}

// ═════════════════════════════════════════════════════════
// BOOT
// ═════════════════════════════════════════════════════════

async function boot() {
  const load = (f) => fetch(`../data/${f}.json`).then((r) => { if (!r.ok) throw new Error(`data/${f}.json`); return r.json(); });
  const [missions, rockets, pieces, workshop] = await Promise.all(['missions', 'rockets', 'pieces', 'workshop'].map(load));
  data = { missions, rockets, pieces, workshop };

  ({ mission: m, demo } = pickMission(loadMission()));
  const bad = incompatibleSelected(m, pieces, workshop.instrumentFit);
  if (bad.length) {
    m.satellite.pieces = m.satellite.pieces.filter((id) => !bad.includes(id));
    persist();
  }
  removedIds = bad;

  $('n2-lang').addEventListener('click', () => {
    lang = lang === 'es' ? 'en' : 'es';
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
    render();
  });

  $('n2-reset').addEventListener('click', () => {
    setSatellite({ formFactor: null, pieces: [], propellantKg: 0 });
  });

  render();
}

if (typeof document !== 'undefined' && document.getElementById('n2-catalog')) {
  boot().catch((err) => {
    console.error(err);
    $('n2-catalog').innerHTML = `<p style="color:#ff7a7a;padding:12px">${t('loadError')}: ${esc(err.message)}. ${t('serveHint')} <code>python3 -m http.server</code>.</p>`;
  });
}
