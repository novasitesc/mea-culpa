"use client";

// Indicador de las 3 caídas del personaje. A la tercera pierde la expedición
// (MAX_CAIDAS, lib/caidas.ts).

import { Skull } from "lucide-react";
import { MAX_CAIDAS } from "@/lib/caidas";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { token: string; icon: string; rune: string; gap: string }> = {
  sm: { token: "w-4 h-4", icon: "w-2.5 h-2.5", rune: "w-1.5 h-1.5", gap: "gap-1" },
  md: { token: "w-7 h-7", icon: "w-4 h-4", rune: "w-2.5 h-2.5", gap: "gap-1.5" },
  lg: { token: "w-11 h-11", icon: "w-6 h-6", rune: "w-4 h-4", gap: "gap-2.5" },
};

type Props = {
  caidas: number;
  size?: Size;
  showLabel?: boolean;
  /** false = versión estática sin parpadeos ni latidos (ej. en el perfil). */
  animated?: boolean;
  className?: string;
};

/**
 * Sellos de caída: tres runas que se van encendiendo con calaveras de sangre.
 * A las 3 marcas el personaje pierde la expedición (regresa al Nexo).
 */
export default function CaidasTracker({ caidas, size = "md", showLabel = false, animated = true, className = "" }: Props) {
  const s = SIZES[size];
  const value = Math.max(0, Math.min(MAX_CAIDAS, caidas));
  const doomed = value >= MAX_CAIDAS;

  return (
    <div
      className={`inline-flex items-center ${s.gap} ${className}`}
      role="img"
      aria-label={`Caídas: ${value} de ${MAX_CAIDAS}`}
      title={`Caídas: ${value}/${MAX_CAIDAS}`}
    >
      {showLabel && (
        <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-sans mr-0.5">
          Caídas
        </span>
      )}
      {Array.from({ length: MAX_CAIDAS }, (_, i) => {
        const filled = i < value;
        const isLast = filled && i === value - 1;
        return (
          <span
            key={i}
            className={`relative ${s.token} rounded-full border flex items-center justify-center shrink-0 transition-colors duration-300 ${
              filled
                ? "border-red-800/80 bg-gradient-to-b from-red-950/80 to-black/80"
                : "border-gold-dim/40 bg-black/40"
            } ${animated && isLast ? (doomed ? "cd-token-doom" : "cd-token-throb") : ""}`}
          >
            {filled ? (
              <Skull className={`${s.icon} text-red-400 ${animated ? "cd-skull-ignite" : ""}`} />
            ) : (
              <span className={`${s.rune} rounded-full border border-gold-dim/30 ${animated ? "cd-rune-flicker" : ""}`} />
            )}
          </span>
        );
      })}
    </div>
  );
}
