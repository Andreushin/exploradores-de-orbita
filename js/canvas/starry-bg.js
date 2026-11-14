// OWNER: Rol 1 — Fondo animado WebGL "noche estrellada" en tonos pastel.
// Uso: const stop = mountStarryBackground(); … stop();  (cada pantalla decide si lo usa)
// Si el navegador no tiene WebGL no hace nada y queda el fondo de css/base.css.

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

vec2 swirlWarp(vec2 p, float t) {
    float n1 = snoise(p * 1.5 + vec2(t * 0.15, -t * 0.08));
    float n2 = snoise(p * 1.8 + vec2(-t * 0.12, t * 0.14) + vec2(n1 * 1.2, n1 * 0.8));
    vec2 c1 = vec2(0.2, 0.3);
    vec2 d1 = p - c1;
    float r1 = length(d1);
    float a1 = atan(d1.y, d1.x) + (1.2 / (r1 + 0.3)) * sin(t * 0.2 + 1.0);
    vec2 s1 = vec2(cos(a1), sin(a1)) * r1;

    vec2 c2 = vec2(-0.4, -0.1);
    vec2 d2 = p - c2;
    float r2 = length(d2);
    float a2 = atan(d2.y, d2.x) - (1.5 / (r2 + 0.25)) * cos(t * 0.25);
    vec2 s2 = vec2(cos(a2), sin(a2)) * r2;

    return mix(p, s1 + s2 * 0.5, 0.45) + vec2(n2 * 0.35, n1 * 0.35);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float t = u_time * 0.4;
    vec2 warpedUV = swirlWarp(uv * 1.8, t);

    float f1 = snoise(warpedUV * 3.5 + vec2(t * 0.2, -t * 0.15));
    float f2 = snoise(warpedUV * 7.0 + vec2(-t * 0.3, t * 0.25) + f1 * 0.8);
    float f3 = snoise(warpedUV * 14.0 + f2 * 1.2);
    float brush = smoothstep(-0.6, 0.8, sin((warpedUV.x + warpedUV.y * 1.5 + f1 * 1.5 + f2 * 0.7) * 22.0 + t * 0.5));

    vec3 deepNavyPastel   = vec3(0.06, 0.09, 0.18);
    vec3 pastelSkyBlue    = vec3(0.35, 0.56, 0.82);
    vec3 pastelPeriwinkle = vec3(0.55, 0.68, 0.90);
    vec3 pastelLemonCream = vec3(0.96, 0.90, 0.58);
    vec3 pastelButterGold = vec3(0.98, 0.82, 0.45);
    vec3 softWhiteGlow    = vec3(0.97, 0.98, 1.0);

    float flowVal = clamp((f1 * 0.5 + f2 * 0.3 + f3 * 0.2) + 0.5, 0.0, 1.0);
    vec3 skyColor = mix(deepNavyPastel, pastelSkyBlue, smoothstep(0.12, 0.65, flowVal));
    skyColor = mix(skyColor, pastelPeriwinkle, smoothstep(0.45, 0.85, flowVal));

    float goldSpirals = smoothstep(0.65, 0.96, abs(f1 * 1.1 + f2 * 0.6));
    float pulse = 0.5 + 0.5 * sin(t * 1.2 + warpedUV.x * 3.0);
    vec3 yellowGlow = mix(pastelButterGold, pastelLemonCream, f2 * 0.5 + 0.5);

    vec3 finalColor = mix(skyColor, skyColor * 1.3 + vec3(0.04, 0.06, 0.1), brush * 0.28);
    finalColor += yellowGlow * goldSpirals * (0.65 + 0.35 * pulse);
    finalColor += softWhiteGlow * smoothstep(0.82, 0.99, abs(f2 * 1.2 + f3 * 0.5)) * 0.5;

    vec2 sPos1 = vec2(0.35, 0.22);
    vec2 sPos2 = vec2(-0.45, 0.18);
    vec2 sPos3 = vec2(0.55, -0.28);
    float d1 = length(uv - sPos1);
    float d2 = length(uv - sPos2);
    float d3 = length(uv - sPos3);

    float halo = exp(-d1 * 5.0) * (0.8 + 0.2 * sin(t * 3.0)) +
                 exp(-d2 * 6.5) * (0.7 + 0.3 * cos(t * 2.5)) +
                 exp(-d3 * 7.0) * (0.6 + 0.4 * sin(t * 4.0));
    vec3 starColor = mix(pastelLemonCream, softWhiteGlow, exp(-d1 * 12.0) + exp(-d2 * 14.0) + exp(-d3 * 15.0));
    finalColor += starColor * halo;

    float vignette = 1.0 - smoothstep(0.4, 1.45, length(uv));
    finalColor *= (vignette * 0.5 + 0.5);

    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
`;

// El shader es pesado: limitamos la resolución interna (el trazo es difuso, no se nota).
const MAX_DPR = 1;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader: ${log}`);
  }
  return sh;
}

/** Monta el canvas de fondo y devuelve una función que lo detiene y lo quita. */
export function mountStarryBackground() {
  const canvas = document.createElement('canvas');
  canvas.className = 'starry-bg';
  canvas.setAttribute('aria-hidden', 'true');

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return () => {};

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    console.warn('[starry-bg] WebGL no disponible:', err);
    return () => {};
  }
  gl.useProgram(program);

  // Un triángulo que cubre toda la pantalla.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uRes = gl.getUniformLocation(program, 'u_resolution');

  document.body.prepend(canvas);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now();
  let raf = 0;

  function draw(now) {
    gl.uniform1f(uTime, reduced ? 12 : (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
    if (reduced) draw(performance.now()); // con movimiento reducido solo se pinta un cuadro fijo
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  if (reduced) {
    draw(performance.now());
  } else {
    const loop = (now) => { draw(now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.remove();
    gl.deleteBuffer(buf);
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
