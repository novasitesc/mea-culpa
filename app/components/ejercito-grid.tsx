"use client";

// Rejilla del inventario de ejército: las 5 casillas de regimientos de un
// personaje, pintadas como estandartes. La comparten el perfil (solo lectura)
// y la sala del DM (donde se pueden aplicar bajas), así el jugador ve
// exactamente lo mismo que ve el DM.

import { motion, AnimatePresence } from "framer-motion";
import { Shield, Swords, Users, Skull } from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import { ITEM_RARITY_HEX, type ItemRarity } from "@/lib/item-catalog";
import {
  EJERCITO_SLOTS,
  EJERCITO_STACK_MAX,
  totalSoldados,
  type UnidadEjercito,
} from "@/lib/ejercito";

type Props = {
  unidades: UnidadEjercito[];
  /** Modo DM: las casillas se pueden seleccionar para aplicar bajas. */
  seleccionable?: boolean;
  unidadSeleccionadaId?: number | null;
  onSelect?: (unidad: UnidadEjercito) => void;
  /** Compacta la rejilla para paneles estrechos. */
  compacto?: boolean;
};

function hexDeRareza(rareza: string): string {
  return ITEM_RARITY_HEX[rareza as ItemRarity] ?? ITEM_RARITY_HEX["común"];
}

export default function EjercitoGrid({
  unidades,
  seleccionable = false,
  unidadSeleccionadaId = null,
  onSelect,
  compacto = false,
}: Props) {
  // Las casillas vacías se pintan igual: el ejército siempre ocupa 5 huecos,
  // así se ve de un vistazo cuánto margen queda para reclutar.
  const huecos = Math.max(0, EJERCITO_SLOTS - unidades.length);

  return (
    <div
      className={`grid gap-2.5 ${
        compacto
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      }`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {unidades.map((u, i) => {
          const hex = hexDeRareza(u.rareza);
          const seleccionada = unidadSeleccionadaId === u.id;
          const soldados = totalSoldados(u);
          const lleno = u.cantidad >= EJERCITO_STACK_MAX;

          return (
            <motion.div
              key={u.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              transition={{
                delay: i * 0.05,
                duration: 0.45,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={seleccionable ? { y: -4 } : { y: -2 }}
              onClick={() => seleccionable && onSelect?.(u)}
              role={seleccionable ? "button" : undefined}
              tabIndex={seleccionable ? 0 : undefined}
              onKeyDown={(e) => {
                if (!seleccionable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(u);
                }
              }}
              className={`group relative flex flex-col overflow-hidden rounded-lg border bg-gradient-to-b from-[#1a1610] to-[#0f0d0a] p-2.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
                seleccionable ? "cursor-pointer" : ""
              } ${seleccionada ? "border-gold" : "border-[#3a3020] hover:border-[#8B7355]"}`}
              style={
                seleccionada
                  ? { boxShadow: `0 0 0 1px ${hex}55, 0 8px 24px -12px ${hex}` }
                  : undefined
              }
            >
              {/* Filo superior teñido por la rareza de la unidad */}
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[2px] opacity-70 transition-opacity duration-200 group-hover:opacity-100"
                style={{ background: `linear-gradient(90deg, transparent, ${hex}, transparent)` }}
              />

              {/* Sello con los regimientos apilados */}
              <span
                className="absolute right-2 top-2 rounded-full border px-1.5 py-0.5 font-sans text-[10px] font-bold leading-none tabular-nums"
                style={{ borderColor: `${hex}66`, color: hex, background: `${hex}12` }}
                title={
                  lleno
                    ? `Casilla llena (${EJERCITO_STACK_MAX} regimientos)`
                    : `${u.cantidad} regimiento${u.cantidad !== 1 ? "s" : ""}`
                }
              >
                ×{u.cantidad}
              </span>

              <span className="mt-1 flex h-9 items-center justify-center" style={{ color: hex }}>
                {getIconForString(u.nombre, "w-7 h-7", u.icono)}
              </span>

              <p className="mt-1.5 line-clamp-2 text-center font-serif text-[12px] leading-tight text-[#e8d8b0]">
                {u.nombre}
              </p>

              {/* Soldados totales: el dato que de verdad importa en el mapa */}
              <p className="mt-1 flex items-center justify-center gap-1 font-sans text-[11px] font-semibold text-gold tabular-nums">
                <Users className="h-3 w-3 opacity-70" />
                {soldados > 0 ? soldados.toLocaleString("es-ES") : "—"}
              </p>
              {u.soldados != null && (
                <p className="text-center font-sans text-[9px] leading-none text-foreground/35">
                  {u.cantidad} × {u.soldados} soldados
                </p>
              )}

              {/* CA y daño */}
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded border border-[#3a3020] bg-black/40 px-1.5 py-0.5 font-sans text-[10px] text-foreground/60 tabular-nums"
                  title="Clase de armadura"
                >
                  <Shield className="h-2.5 w-2.5 text-sky-400/70" />
                  {u.clase_armadura ?? "—"}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded border border-[#3a3020] bg-black/40 px-1.5 py-0.5 font-sans text-[10px] text-foreground/60"
                  title="Daño de la unidad"
                >
                  <Swords className="h-2.5 w-2.5 text-rose-400/70" />
                  {u.dano ?? "—"}
                </span>
              </div>

              {/* Descripción al pasar por encima */}
              {u.descripcion?.trim() && (
                <div
                  className="pointer-events-none absolute inset-x-1 bottom-1 z-20 translate-y-1 rounded-md border border-[#8B7355] bg-[#11100d]/97 px-2 py-1.5 text-left font-sans text-[10px] leading-snug text-[#e8d8b0] opacity-0 shadow-[0_8px_16px_rgba(0,0,0,0.5)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100"
                  aria-hidden
                >
                  {u.descripcion}
                </div>
              )}

              {seleccionable && (
                <span className="pointer-events-none absolute inset-0 flex items-end justify-center pb-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-700/50 bg-rose-950/80 px-2 py-0.5 font-sans text-[9px] uppercase tracking-widest text-rose-300">
                    <Skull className="h-2.5 w-2.5" /> Bajas
                  </span>
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {Array.from({ length: huecos }).map((_, i) => (
        <motion.div
          key={`hueco-${i}`}
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: (unidades.length + i) * 0.05, duration: 0.4 }}
          className="flex min-h-[8.5rem] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#3a3020] bg-black/20"
        >
          <span className="text-lg opacity-20">⚑</span>
          <span className="font-sans text-[9px] uppercase tracking-widest text-foreground/20">
            Casilla libre
          </span>
        </motion.div>
      ))}
    </div>
  );
}
