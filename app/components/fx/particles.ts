// Helpers compartidos por los overlays 3D (ascenso de nivel, conjuros).
// Viven aparte para que ambos los reutilicen sin duplicar la textura ni las
// curvas de easing; al importarse sólo desde overlays dinámicos, `three` sigue
// fuera del bundle principal.
import * as THREE from "three";

export const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);
export const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Overshoot arcade: pasa de 1 y vuelve. El "boing" de Brawl Stars/Clash Royale. */
export const easeOutBack = (u: number, s = 2.2) =>
  1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);

/**
 * Paleta saturada tipo arcade para estallidos de recompensa. Oro de base + acentos
 * eléctricos (cian, magenta, verde, violeta) y un blanco cálido de chispa.
 */
export const CANDY_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [255, 210, 60], // oro brillante
  [0, 229, 255], // cian eléctrico
  [255, 60, 160], // magenta
  [90, 255, 120], // verde eléctrico
  [180, 110, 255], // violeta
  [255, 250, 230], // blanco cálido (chispa)
];

/** Textura blanca suave: base neutra para partículas teñidas con vertex colors. */
export function makeWhiteSparkTexture(): THREE.Texture {
  return makeSparkTexture("255,255,255", "255,255,255");
}

/**
 * Colores por-partícula (RGB 0–1) para confeti multicolor en UN solo draw call.
 * Se adjunta como attribute `color` y el material se pone `vertexColors`.
 */
export function confettiColors(
  count: number,
  palette: ReadonlyArray<readonly [number, number, number]> = CANDY_PALETTE,
): Float32Array {
  const c = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [r, g, b] = palette[(Math.random() * palette.length) | 0];
    c[i * 3] = r / 255;
    c[i * 3 + 1] = g / 255;
    c[i * 3 + 2] = b / 255;
  }
  return c;
}

/** Tamaños por-partícula sorteados en [min, max) — confeti irregular. */
export function randomSizes(count: number, min: number, max: number): Float32Array {
  const sizes = new Float32Array(count);
  const rango = max - min;
  for (let i = 0; i < count; i++) sizes[i] = min + Math.random() * rango;
  return sizes;
}

/**
 * Textura radial para partículas: un punto cuadrado delata el truco.
 * `core` es el centro incandescente y `edge` el color que se difumina.
 * Quien la crea debe llamar a `.dispose()` al desmontar.
 */
export function makeSparkTexture(core = "255,248,220", edge = "212,175,55"): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${core},1)`);
  g.addColorStop(0.35, `rgba(${edge},0.85)`);
  g.addColorStop(1, `rgba(${edge},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Velocidades sorteadas en [min, max) — una por partícula. */
export function randomSpeeds(count: number, min: number, max: number): Float32Array {
  const speeds = new Float32Array(count);
  const rango = max - min;
  for (let i = 0; i < count; i++) speeds[i] = min + Math.random() * rango;
  return speeds;
}

/** Fases iniciales del remolino, repartidas por toda la circunferencia. */
export function randomPhases(count: number): Float32Array {
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) phases[i] = Math.random() * Math.PI * 2;
  return phases;
}

/**
 * Direcciones uniformes sobre la esfera (evita el apelmazamiento en los polos
 * que produce sortear los dos ángulos por separado), achatadas en Y para que
 * la nube se lea mejor en pantallas anchas.
 */
export function sphereDirections(count: number, flatten = 0.75): Float32Array {
  const dirs = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    dirs[i * 3] = r * Math.cos(theta);
    dirs[i * 3 + 1] = u * flatten;
    dirs[i * 3 + 2] = r * Math.sin(theta);
  }
  return dirs;
}
