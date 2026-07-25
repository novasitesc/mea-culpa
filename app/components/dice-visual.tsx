"use client";

// Dibujo 2D de un dado con su valor, para las tiradas sin escena 3D.

import type { DiceType } from "@/lib/types/dados";

type Props = {
  type: DiceType;
  value?: number;
  rolling: boolean;
  size?: number;
};

const GOLD = "#D4AF37";
const GOLD_DIM = "#B8860B";
const BG = "hsl(var(--card))";

function D4({ size }: { size: number }) {
  const cx = size / 2;
  const top = size * 0.1;
  const left = size * 0.08;
  const right = size * 0.92;
  const bottom = size * 0.88;
  const points = `${cx},${top} ${right},${bottom} ${left},${bottom}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={points} fill={BG} stroke={GOLD} strokeWidth="2.5" />
      <polygon
        points={`${cx},${top + 10} ${right - 10},${bottom - 6} ${left + 10},${bottom - 6}`}
        fill="none"
        stroke={GOLD_DIM}
        strokeWidth="1"
        opacity="0.4"
      />
    </svg>
  );
}

function D6({ size }: { size: number }) {
  const pad = size * 0.08;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} rx="6" fill={BG} stroke={GOLD} strokeWidth="2.5" />
      <rect x={pad + 6} y={pad + 6} width={size - pad * 2 - 12} height={size - pad * 2 - 12} rx="3" fill="none" stroke={GOLD_DIM} strokeWidth="1" opacity="0.35" />
    </svg>
  );
}

function D8({ size }: { size: number }) {
  const cx = size / 2;
  const top = size * 0.06;
  const bottom = size * 0.94;
  const midLeft = size * 0.06;
  const midRight = size * 0.94;
  const points = `${cx},${top} ${midRight},${cx} ${cx},${bottom} ${midLeft},${cx}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={points} fill={BG} stroke={GOLD} strokeWidth="2.5" />
      <line x1={cx} y1={top + 6} x2={midRight - 6} y2={cx} stroke={GOLD_DIM} strokeWidth="1" opacity="0.35" />
      <line x1={midRight - 6} y1={cx} x2={cx} y2={bottom - 6} stroke={GOLD_DIM} strokeWidth="1" opacity="0.35" />
      <line x1={cx} y1={bottom - 6} x2={midLeft + 6} y2={cx} stroke={GOLD_DIM} strokeWidth="1" opacity="0.35" />
      <line x1={midLeft + 6} y1={cx} x2={cx} y2={top + 6} stroke={GOLD_DIM} strokeWidth="1" opacity="0.35" />
    </svg>
  );
}

function D10({ size }: { size: number }) {
  const cx = size / 2;
  const top = size * 0.06;
  const bottom = size * 0.94;
  const wideTop = size * 0.14;
  const wideBottom = size * 0.78;
  const points = `${cx},${top} ${size - wideTop},${size * 0.38} ${size - wideBottom * 0.12},${bottom} ${wideBottom * 0.12},${bottom} ${wideTop},${size * 0.38}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={points} fill={BG} stroke={GOLD} strokeWidth="2.5" />
      <line x1={cx} y1={top + 4} x2={cx} y2={bottom - 4} stroke={GOLD_DIM} strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

function D12({ size }: { size: number }) {
  const cx = size / 2;
  const r = size * 0.44;
  const sides = 5;
  const points = Array.from({ length: sides }, (_, i) => {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cx + r * Math.sin(angle)}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={points} fill={BG} stroke={GOLD} strokeWidth="2.5" />
      <polygon
        points={Array.from({ length: sides }, (_, i) => {
          const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
          const ri = r * 0.7;
          return `${cx + ri * Math.cos(angle)},${cx + ri * Math.sin(angle)}`;
        }).join(" ")}
        fill="none"
        stroke={GOLD_DIM}
        strokeWidth="1"
        opacity="0.35"
      />
    </svg>
  );
}

function D20({ size }: { size: number }) {
  const cx = size / 2;
  const r = size * 0.44;
  const sides = 6;
  const points = Array.from({ length: sides }, (_, i) => {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 6;
    return `${cx + r * Math.cos(angle)},${cx + r * Math.sin(angle)}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={points} fill={BG} stroke={GOLD} strokeWidth="2.5" />
      <polygon
        points={Array.from({ length: sides }, (_, i) => {
          const angle = (Math.PI * 2 * i) / sides - Math.PI / 6;
          const ri = r * 0.65;
          return `${cx + ri * Math.cos(angle)},${cx + ri * Math.sin(angle)}`;
        }).join(" ")}
        fill="none"
        stroke={GOLD_DIM}
        strokeWidth="1"
        opacity="0.35"
      />
    </svg>
  );
}

const SHAPES: Record<DiceType, React.ComponentType<{ size: number }>> = {
  d4: D4,
  d6: D6,
  d8: D8,
  d10: D10,
  d12: D12,
  d20: D20,
};

export default function DiceVisual({ type, value, rolling, size = 64 }: Props) {
  const Shape = SHAPES[type];

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${
        rolling ? "dice-rolling" : value === undefined ? "dice-idle" : ""
      }`}
      style={{ width: size, height: size }}
    >
      <Shape size={size} />
      {/* Label del tipo arriba */}
      <span
        className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider uppercase"
        style={{ color: GOLD, textShadow: "0 0 8px rgba(212,175,55,0.5)" }}
      >
        {type.toUpperCase()}
      </span>
      {/* Resultado centrado */}
      {value !== undefined && !rolling && (
        <span
          className="absolute inset-0 flex items-center justify-center font-serif font-bold"
          style={{
            fontSize: size * 0.32,
            color: GOLD,
            textShadow: "0 0 10px rgba(212,175,55,0.8)",
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
