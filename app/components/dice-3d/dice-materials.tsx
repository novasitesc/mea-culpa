// Materiales por cara: piedra oscura con el número grabado en oro, dibujado en
// canvas con las fuentes del sitio (Cinzel Decorative). Un array de materiales
// por tipo de dado, cacheado y compartido entre todos los dados de la escena.
import * as THREE from "three";
import { diceMax } from "@/lib/types/dados";
import type { DiceType } from "@/lib/types/dados";

// Mismos tonos fijos que dice-visual.tsx (canvas no interpreta OKLch en todos lados)
const GOLD = "#D4AF37";
const GOLD_DARK = "#7a5f1c";
const BODY_LIGHT = "#241c12";
const BODY_DARK = "#0d0a07";

const TEX_SIZE = 256;

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeFaceTexture(value: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d")!;
  const c = TEX_SIZE / 2;

  const grad = ctx.createRadialGradient(c, c * 0.82, TEX_SIZE * 0.08, c, c, TEX_SIZE * 0.78);
  grad.addColorStop(0, BODY_LIGHT);
  grad.addColorStop(1, BODY_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // moteado mineral sutil, determinista por cara
  const rnd = mulberry32(value * 7919);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = rnd() > 0.5 ? "rgba(212,175,55,0.05)" : "rgba(0,0,0,0.16)";
    const r = 0.6 + rnd() * 1.7;
    ctx.beginPath();
    ctx.arc(rnd() * TEX_SIZE, rnd() * TEX_SIZE, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const label = String(value);
  ctx.font = `700 ${TEX_SIZE * (label.length > 1 ? 0.34 : 0.42)}px "Cinzel Decorative", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // grabado: sombra hundida + relleno oro + borde oscuro
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillText(label, c + 3, c + 4);
  ctx.fillStyle = GOLD;
  ctx.fillText(label, c, c);
  ctx.lineWidth = 2;
  ctx.strokeStyle = GOLD_DARK;
  ctx.strokeText(label, c, c);

  // subrayado para distinguir 6 y 9
  if (value === 6 || value === 9) {
    const w = TEX_SIZE * 0.16;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(c - w / 2, c + TEX_SIZE * 0.26);
    ctx.lineTo(c + w / 2, c + TEX_SIZE * 0.26);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const matCache = new Map<DiceType, THREE.MeshStandardMaterial[]>();

export function getDieMaterials(type: DiceType): THREE.MeshStandardMaterial[] {
  let mats = matCache.get(type);
  if (!mats) {
    mats = Array.from({ length: diceMax(type) }, (_, i) =>
      new THREE.MeshStandardMaterial({
        map: makeFaceTexture(i + 1),
        metalness: 0.3,
        roughness: 0.48,
        envMapIntensity: 0.9,
      }),
    );
    matCache.set(type, mats);
  }
  return mats;
}

/** Espera la fuente y precalienta las texturas del tipo dado (evita caras sin fuente). */
export async function preloadDiceAssets(type: DiceType): Promise<void> {
  try {
    await document.fonts.load(`700 100px "Cinzel Decorative"`);
  } catch {
    // sin Font Loading API: el fallback serif del canvas es aceptable
  }
  getDieMaterials(type);
}
