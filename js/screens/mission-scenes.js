// OWNER: Rol 3 — Fondos animados del Nivel 1: una escena SVG por paso que reacciona a lo que elige el jugador.
// Uso: const scenes = createScenes(); scenes.update({ step, planet, level, status }); scenes.destroy();
//   step:   'project' | 'launch' | 'space' | 'ground' | 'user' | 'review'
//   planet: color del destino (missions.json → color)
//   level:  nivel (0..3) de la tarjeta colocada en el segmento del paso; 0 = ninguna
//   status: 'insufficient' | 'oversized' | 'ok' | '' → tiñe el fondo (rojo / ámbar / nada)
// Estilos en css/screens/mission.css (sección "Escenas"). Respeta prefers-reduced-motion.

const W = 1600;
const H = 900;

/** Estrellas deterministas (misma semilla → mismo cielo en cada render). */
function stars(count, maxY = H, seed = 7) {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  let out = '';
  for (let i = 0; i < count; i++) {
    const r = (rand() * 1.6 + 0.4).toFixed(1);
    out += `<circle class="${i % 5 === 0 ? 'tw' : ''}" cx="${(rand() * W).toFixed(0)}" cy="${(rand() * maxY).toFixed(0)}" r="${r}" style="animation-delay:${(rand() * 4).toFixed(1)}s"/>`;
  }
  return `<g class="sc-stars">${out}</g>`;
}

const svg = (body) => `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" focusable="false">${body}</svg>`;

// 1 · Proyecto: el planeta destino domina el cielo.
const PROJECT = svg(`
  <defs>
    <radialGradient id="lvl-neb" cx="30%" cy="35%" r="80%"><stop offset="0" stop-color="#2a1f5c"/><stop offset="1" stop-color="#050816"/></radialGradient>
    <radialGradient id="lvl-planet" cx="35%" cy="32%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".28" style="stop-color:var(--planet)"/><stop offset="1" style="stop-color:var(--planet)"/></radialGradient>
    <radialGradient id="lvl-shade" cx="72%" cy="72%" r="80%"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".8"/></radialGradient>
    <radialGradient id="lvl-halo"><stop offset=".55" style="stop-color:var(--planet)" stop-opacity=".4"/><stop offset="1" style="stop-color:var(--planet)" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#lvl-neb)"/>
  ${stars(140)}
  <g class="sc-float">
    <circle cx="1220" cy="470" r="400" fill="url(#lvl-halo)"/>
    <circle cx="1220" cy="470" r="250" fill="url(#lvl-planet)"/>
    <circle cx="1220" cy="470" r="250" fill="url(#lvl-shade)"/>
    <ellipse class="sc-ring" cx="1220" cy="470" rx="390" ry="105" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2" stroke-dasharray="6 14"/>
  </g>`);

// 2 · Lanzamiento: rampa al amanecer; el cohete crece con el nivel y enciende motores.
const LAUNCH = svg(`
  <defs>
    <linearGradient id="lvl-dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1238"/><stop offset=".55" stop-color="#3b2a6b"/><stop offset=".82" stop-color="#c8705a"/><stop offset="1" stop-color="#f6c177"/></linearGradient>
    <radialGradient id="lvl-flame" cx=".5" cy=".15" r=".85"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#ffd36b"/><stop offset=".7" stop-color="#ff7a2f"/><stop offset="1" stop-color="#ff3d00" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#lvl-dawn)"/>
  ${stars(70, 380, 11)}
  <path d="M0 770 Q 400 725 800 755 T 1600 745 V900 H0Z" fill="#0a0f24"/>
  <g class="sc-tower" stroke="#1b2550" stroke-width="6" fill="none">
    <rect x="880" y="420" width="56" height="340"/>
    <path d="M880 460 L936 500 M936 460 L880 500 M880 540 L936 580 M936 540 L880 580 M880 620 L936 660 M936 620 L880 660 M880 700 L936 740 M936 700 L880 740"/>
    <path d="M936 520 H985 M936 640 H985"/>
  </g>
  <rect x="760" y="752" width="340" height="18" fill="#141c3d"/>
  <g class="sc-smoke">
    <circle cx="960" cy="770" r="40"/><circle cx="1060" cy="775" r="48"/><circle cx="1010" cy="785" r="34"/>
  </g>
  <g class="sc-rocket">
    <ellipse class="sc-flame" cx="1010" cy="790" rx="22" ry="48" fill="url(#lvl-flame)"/>
    <path d="M990 752 V520 Q1010 430 1030 520 V752 Z" fill="#e6ebff"/>
    <rect x="990" y="600" width="40" height="10" fill="#5b8cff"/>
    <circle cx="1010" cy="560" r="8" fill="#1d2f7a"/>
    <path d="M990 700 L962 762 L990 752Z M1030 700 L1058 762 L1030 752Z" fill="#5b8cff"/>
  </g>`);

// 3 · Espacio: el CubeSat orbita la Tierra; paneles, antena y RTG según el nivel.
const SPACE = svg(`
  <defs>
    <linearGradient id="lvl-deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02030b"/><stop offset="1" stop-color="#0b1640"/></linearGradient>
    <radialGradient id="lvl-earth" cx="40%" cy="20%" r="70%"><stop offset="0" stop-color="#7cc8ff"/><stop offset=".35" stop-color="#2a6fd6"/><stop offset=".7" stop-color="#16408f"/><stop offset="1" stop-color="#0a1f4d"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#lvl-deep)"/>
  ${stars(150, H, 23)}
  <circle cx="800" cy="1680" r="1030" fill="none" stroke="#7cf" stroke-opacity=".35" stroke-width="26"/>
  <circle cx="800" cy="1680" r="1000" fill="url(#lvl-earth)"/>
  <path d="M260 920 Q 420 800 640 830 T 980 760" stroke="rgba(255,255,255,.18)" stroke-width="30" fill="none" stroke-linecap="round"/>
  <circle cx="800" cy="1680" r="1270" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2" stroke-dasharray="8 14"/>
  <g class="sc-orbit">
    <g class="sc-sat" transform="translate(800 410)">
      <g class="sat-panels">
        <rect x="-150" y="-18" width="105" height="36" rx="3" fill="#1e3a8a" stroke="#93c5fd" stroke-width="2"/>
        <rect x="45" y="-18" width="105" height="36" rx="3" fill="#1e3a8a" stroke="#93c5fd" stroke-width="2"/>
        <path d="M-115 -18 V18 M-80 -18 V18 M80 -18 V18 M115 -18 V18" stroke="#93c5fd" stroke-width="1.5"/>
      </g>
      <path class="sat-dish" d="M-22 -40 Q 0 -78 22 -40 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <g class="sat-rtg"><rect x="-6" y="40" width="12" height="40" fill="#94a3b8"/><circle cx="0" cy="88" r="12" fill="#fb923c"/></g>
      <rect class="sat-body" x="-40" y="-40" width="80" height="80" rx="6" fill="#cbd5e1" stroke="#64748b" stroke-width="3"/>
      <path class="sat-body" d="M-40 -13 H40 M-40 13 H40" stroke="#64748b" stroke-width="2"/>
      <path class="sat-antenna" d="M0 -40 V-75" stroke="#e2e8f0" stroke-width="3"/>
    </g>
  </g>`);

/** Antena parabólica en (x, 760): soporte + plato apuntando al cielo + ondas de señal. Su tamaño lo da el CSS (nivel 1–3). */
function dish(x) {
  return `<g class="sc-dish" style="transform-origin:${x}px 760px">
    <g transform="translate(${x} 760)">
      <path d="M-10 0 L-26 -60 H26 L10 0 Z" fill="#1b2550"/>
      <path d="M-70 -120 Q -10 -40 70 -150 Z" fill="#cbd5e1" stroke="#64748b" stroke-width="4"/>
      <path d="M0 -105 L 40 -170" stroke="#94a3b8" stroke-width="4"/>
      <g class="sc-waves"><circle cx="40" cy="-175" r="30"/><circle cx="40" cy="-175" r="30"/><circle cx="40" cy="-175" r="30"/></g>
    </g>
  </g>`;
}

// 4 · Tierra: una sola antena, a la derecha del banco de tarjetas y a la izquierda del panel lateral, que crece
// de pequeña a grande según la red contratada (nivel 1 → 3).
const GROUND = svg(`
  <defs>
    <linearGradient id="lvl-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#040714"/><stop offset=".7" stop-color="#0f1d4a"/><stop offset="1" stop-color="#1b2f6b"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#lvl-night)"/>
  ${stars(160, 620, 31)}
  <ellipse cx="900" cy="260" rx="900" ry="90" fill="#7c3aed" opacity=".12" transform="rotate(-12 900 260)"/>
  <circle class="sc-target" cx="1380" cy="150" r="6" fill="#a5f3fc"/>
  <path d="M0 720 Q 300 650 620 700 T 1200 690 T 1600 700 V900 H0Z" fill="#0b1433"/>
  <path d="M0 780 Q 380 740 820 770 T 1600 760 V900 H0Z" fill="#070c22"/>
  ${dish(950)}`);

// 5 · Usuario: centro de datos; más paneles de análisis según el enfoque.
const USER = svg(`
  <defs>
    <linearGradient id="lvl-lab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050816"/><stop offset="1" stop-color="#0b1a3a"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#lvl-lab)"/>
  <g class="sc-grid" stroke="rgba(124,204,255,.16)" stroke-width="2">
    ${Array.from({ length: 17 }, (_, i) => `<line x1="${i * 100}" y1="900" x2="800" y2="420"/>`).join('')}
    ${[440, 470, 515, 580, 670, 790].map((y) => `<line x1="0" y1="${y}" x2="1600" y2="${y}"/>`).join('')}
  </g>
  <g class="sc-rain">
    ${Array.from({ length: 14 }, (_, i) => `<rect x="${60 + i * 110}" y="-60" width="4" height="40" rx="2" style="animation-delay:${(i * 0.37) % 3}s"/>`).join('')}
  </g>
  <g class="sc-panel" data-panel="1" transform="translate(140 180)">
    <rect width="380" height="220" rx="14"/>
    <polyline points="20,150 50,90 80,170 110,60 140,140 170,80 200,190 230,70 260,150 290,100 320,170 360,90" class="sc-noise"/>
  </g>
  <g class="sc-panel" data-panel="2" transform="translate(610 120)">
    <rect width="380" height="220" rx="14"/>
    <path d="M20 180 C 90 170 120 60 190 90 S 300 40 360 50" class="sc-line"/>
  </g>
  <g class="sc-panel" data-panel="3" transform="translate(1080 180)">
    <rect width="380" height="220" rx="14"/>
    <g class="sc-bars">${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${30 + i * 56}" y="40" width="34" height="160" rx="4" style="animation-delay:${i * 0.15}s"/>`).join('')}</g>
  </g>`);

// 6 · Revisión: la trayectoria completa Tierra → destino.
function review(reduced) {
  const motion = reduced ? '' : '<animateMotion dur="9s" repeatCount="indefinite" rotate="auto"><mpath href="#lvl-traj"/></animateMotion>';
  return svg(`
    <defs>
      <radialGradient id="lvl-neb2" cx="60%" cy="40%" r="80%"><stop offset="0" stop-color="#1c2a66"/><stop offset="1" stop-color="#050816"/></radialGradient>
      <radialGradient id="lvl-planet2" cx="35%" cy="32%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".3" style="stop-color:var(--planet)"/><stop offset="1" style="stop-color:var(--planet)"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#lvl-neb2)"/>
    ${stars(150, H, 47)}
    <circle cx="300" cy="640" r="80" fill="#2a6fd6"/><circle cx="300" cy="640" r="88" fill="none" stroke="#7cf" stroke-opacity=".5" stroke-width="8"/>
    <circle cx="1300" cy="280" r="120" fill="url(#lvl-planet2)"/>
    <path id="lvl-traj" d="M360 590 Q 820 40 1190 250" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-dasharray="10 12"/>
    <g class="sc-ship"><path d="M-14 -7 L14 0 L-14 7 Z" fill="#a5f3fc"/>${motion}</g>`);
}

export function createScenes() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layer = document.createElement('div');
  layer.className = 'lvl-scenes';
  layer.setAttribute('aria-hidden', 'true');
  const scenes = { project: PROJECT, launch: LAUNCH, space: SPACE, ground: GROUND, user: USER, review: review(reduced) };
  layer.innerHTML = Object.entries(scenes).map(([id, body]) => `<div class="scene scene-${id}" data-scene="${id}">${body}</div>`).join('');
  document.body.append(layer);

  return {
    update({ step, planet, level = 0, status = '' }) {
      layer.dataset.status = status;
      if (planet) layer.style.setProperty('--planet', planet);
      for (const node of layer.children) {
        const on = node.dataset.scene === step;
        node.classList.toggle('is-active', on);
        if (on) node.dataset.level = String(level);
      }
    },
    destroy() {
      layer.remove();
    },
  };
}
