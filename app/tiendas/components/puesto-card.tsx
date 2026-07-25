"use client";

// Un puesto del mercado en la vista de lista. El toldo a rayas y el medallón se
// tiñen con el color que lib/tienda-tema.ts deriva del id, así cada comerciante
// se reconoce de un vistazo sin guardar nada extra en la base de datos.

import { motion } from "framer-motion";
import { Lock, Package } from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import { temaTienda } from "@/lib/tienda-tema";
import { playUiHoverSfx } from "@/lib/sfx";

type Props = {
  id: string;
  name: string;
  description: string;
  icon: string;
  keeper: string;
  location: string;
  itemCount: number;
  minLevel?: number;
  hasAccess: boolean;
  index: number;
  onOpen: () => void;
};

export default function PuestoCard({
  id, name, description, icon, keeper, location,
  itemCount, minLevel, hasAccess, index, onOpen,
}: Props) {
  const { accent, deep } = temaTienda(id, `${name} ${description}`);

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={hasAccess ? { y: -6 } : undefined}
      whileTap={hasAccess ? { scale: 0.985 } : undefined}
      onHoverStart={hasAccess ? playUiHoverSfx : undefined}
      onClick={() => hasAccess && onOpen()}
      disabled={!hasAccess}
      aria-label={hasAccess ? `Entrar en ${name}` : `${name} — requiere nivel ${minLevel}`}
      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
        hasAccess
          ? "cursor-pointer border-[#3a3020] hover:border-[#8B7355]"
          : "cursor-not-allowed border-[#2a241a]"
      }`}
      style={{ background: `linear-gradient(180deg, ${deep} 0%, #0d0b08 65%)` }}
    >
      {/* Toldo: las rayas del puesto de mercado */}
      <span
        aria-hidden
        className="h-7 w-full shrink-0 transition-all duration-300 group-hover:h-8"
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, ${accent} 0 14px, #f5e6c8 14px 28px)`,
          opacity: hasAccess ? 0.85 : 0.25,
          boxShadow: `inset 0 -6px 10px -6px rgba(0,0,0,0.9)`,
        }}
      />
      {/* Fleco del toldo */}
      <span
        aria-hidden
        className="h-1.5 w-full shrink-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 6px, rgba(0,0,0,0.55) 6px 8px)",
        }}
      />

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-transform duration-300 group-hover:scale-110"
            style={{
              borderColor: `${accent}66`,
              background: `radial-gradient(circle at 50% 35%, ${accent}22, transparent 70%)`,
              color: accent,
            }}
          >
            {getIconForString(name, "w-6 h-6", icon)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-serif text-[15px] leading-tight text-[#e8d8b0]">
              {name}
            </h2>
            <p className="truncate font-sans text-[11px] text-foreground/40">{location}</p>
          </div>
        </div>

        {/* La mercancía sí se oculta si el puesto está cerrado; el nombre no,
            para que se sepa qué puesto es y a qué nivel abre. */}
        <div className="relative flex flex-1 flex-col gap-2.5">
          <p
            className={`line-clamp-2 flex-1 font-sans text-[11.5px] leading-relaxed text-foreground/50 ${
              hasAccess ? "" : "blur-[3px] select-none"
            }`}
          >
            {description}
          </p>

          <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
            <span
              className={`truncate font-sans text-[11px] italic text-foreground/45 ${
                hasAccess ? "" : "blur-[3px] select-none"
              }`}
            >
              — {keeper}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 font-sans text-[10px] tabular-nums text-foreground/50">
              <Package className="h-2.5 w-2.5" />
              {hasAccess ? itemCount : "?"}
            </span>
          </div>

          {!hasAccess && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <Lock className="h-4 w-4 text-foreground/45" />
              <p className="font-sans text-[11px] text-foreground/55">
                Abre a nivel {minLevel}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}
