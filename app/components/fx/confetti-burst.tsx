"use client";

// Estallido de confeti 2D (DOM) para el momento de recompensa. Una sola pasada
// al montar; colores de la paleta arcade compartida. Sin lib de confeti: framer
// ya está en el bundle y esto son unos pocos <span> animados.
import { motion } from "framer-motion";
import { useMemo } from "react";
import { CANDY_PALETTE } from "./particles";

export default function ConfettiBurst({ count = 28 }: { count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, () => {
        const ang = Math.random() * Math.PI * 2;
        const dist = 70 + Math.random() * 150;
        const [r, g, b] = CANDY_PALETTE[(Math.random() * CANDY_PALETTE.length) | 0];
        const x = Math.cos(ang) * dist;
        const y = Math.sin(ang) * dist - 50; // sesgo arriba: sube y luego cae
        return {
          color: `rgb(${r},${g},${b})`,
          size: 5 + Math.random() * 6,
          x: [0, x * 0.65, x] as number[],
          y: [0, y, y + 110] as number[], // gravedad: cae al final
          rot: [0, Math.random() * 360 - 180, Math.random() * 720 - 360] as number[],
          delay: Math.random() * 0.08,
          dur: 0.9 + Math.random() * 0.5,
        };
      }),
    [count],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 rounded-[2px]"
          style={{ width: b.size, height: b.size * 0.6, background: b.color, boxShadow: `0 0 8px ${b.color}` }}
          initial={{ opacity: 1, scale: 1 }}
          animate={{ x: b.x, y: b.y, rotate: b.rot, opacity: [1, 1, 0], scale: [1, 1, 0.6] }}
          transition={{ duration: b.dur, delay: b.delay, ease: "easeOut", times: [0, 0.6, 1] }}
        />
      ))}
    </div>
  );
}
