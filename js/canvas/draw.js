// OWNER: Rol 4 — Utilidades de dibujo para la travesía.

/** Ajusta el canvas a su tamaño CSS y a la densidad de píxeles. Devuelve el contexto 2D. */
export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, width, height };
}

/** Estrellas fijas con semilla para que no parpadeen entre cuadros. */
export function makeStars(n, width, height) {
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ x: rnd() * width, y: rnd() * height, r: rnd() * 1.3 + 0.2 }));
}

export function drawStars(g, stars) {
  g.fillStyle = 'rgba(255,255,255,0.7)';
  for (const s of stars) {
    g.beginPath();
    g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    g.fill();
  }
}

export function drawBody(g, x, y, r, color, label) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  if (label) {
    g.fillStyle = '#cfd8ff';
    g.font = '12px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(label, x, y + r + 16);
  }
}

/** Punto sobre una media elipse de transferencia (tipo Hohmann) entre A y B, t ∈ [0,1]. */
export function transferPoint(ax, ay, bx, by, t, bulge = 0.35) {
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  const rx = Math.hypot(bx - ax, by - ay) / 2;
  const ry = rx * bulge;
  const ang = Math.atan2(by - ay, bx - ax);
  const theta = Math.PI - t * Math.PI; // de A (π) a B (0)
  const lx = rx * Math.cos(theta);
  const ly = -ry * Math.sin(theta);
  return {
    x: cx + lx * Math.cos(ang) - ly * Math.sin(ang),
    y: cy + lx * Math.sin(ang) + ly * Math.cos(ang),
  };
}

export function drawTransfer(g, ax, ay, bx, by, progress) {
  g.setLineDash([4, 6]);
  g.strokeStyle = 'rgba(140,170,255,0.5)';
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const p = transferPoint(ax, ay, bx, by, i / 60);
    i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y);
  }
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = '#7cf';
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i <= 60 * progress; i++) {
    const p = transferPoint(ax, ay, bx, by, i / 60);
    i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y);
  }
  g.stroke();
  g.lineWidth = 1;
}

export function drawShip(g, x, y, burning) {
  if (burning) {
    g.fillStyle = '#ffb347';
    g.beginPath();
    g.arc(x, y, 7 + Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#fff';
  g.fillRect(x - 3, y - 3, 6, 6);
}

/** Órbita alrededor del destino tras la inserción. ecc ∈ [0,1). */
export function drawOrbit(g, x, y, r, ecc, color = '#7f7') {
  g.strokeStyle = color;
  g.beginPath();
  g.ellipse(x + r * ecc, y, r, r * Math.sqrt(1 - ecc * ecc), 0, 0, Math.PI * 2);
  g.stroke();
}
