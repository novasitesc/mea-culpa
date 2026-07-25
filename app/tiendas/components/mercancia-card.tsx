"use client";

// Una pieza de mercancía sobre el mostrador. El halo y el filo superior salen
// de la rareza; el precio se pone en rojo cuando no alcanza el oro, para que el
// jugador lo vea antes de intentar comprarlo y no en un error al final.

import { motion } from "framer-motion";
import { Coins, Plus, Check, Swords } from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import { ITEM_RARITY_HEX, type ItemRarity } from "@/lib/item-catalog";
import { TIPO_EJERCITO } from "@/lib/ejercito";
import { playUiHoverSfx } from "@/lib/sfx";

type Props = {
  name: string;
  description: string;
  icon: string;
  price: number;
  rarity: ItemRarity;
  category: string;
  stock: number | null;
  /** Unidades ya puestas en el carrito. */
  enCarrito: number;
  puedePagar: boolean;
  index: number;
  onAdd: () => void;
};

export default function MercanciaCard({
  name, description, icon, price, rarity, category,
  stock, enCarrito, puedePagar, index, onAdd,
}: Props) {
  const hex = ITEM_RARITY_HEX[rarity] ?? ITEM_RARITY_HEX["común"];
  const agotado = stock !== null && stock - enCarrito <= 0;
  const esEjercito = category === TIPO_EJERCITO;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.035, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      whileHover={agotado ? undefined : { y: -4 }}
      onHoverStart={agotado ? undefined : playUiHoverSfx}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-gradient-to-b from-[#171310] to-[#0d0b08] transition-colors duration-200 ${
        agotado ? "border-[#2a241a] opacity-55" : "border-[#3a3020] hover:border-[#8B7355]"
      }`}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px] opacity-60 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${hex}, transparent)` }}
      />

      {enCarrito > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 480, damping: 18 }}
          className="absolute right-2 top-2.5 z-10 inline-flex items-center gap-0.5 rounded-full border border-gold/50 bg-gold/15 px-1.5 py-0.5 font-sans text-[10px] font-bold leading-none text-gold tabular-nums"
          title={`${enCarrito} en el carrito`}
        >
          <Check className="h-2.5 w-2.5" />
          {enCarrito}
        </motion.span>
      )}

      <div className="flex flex-1 flex-col items-center gap-1.5 p-3.5 pt-4">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
          style={{ background: `radial-gradient(circle, ${hex}1f, transparent 72%)`, color: hex }}
        >
          {getIconForString(name, "w-7 h-7", icon)}
        </span>

        <p className="line-clamp-2 text-center font-serif text-[12.5px] leading-tight text-[#e8d8b0]">
          {name}
        </p>

        <span
          className="rounded-full border px-1.5 py-0.5 font-sans text-[9px] capitalize leading-none"
          style={{ borderColor: `${hex}55`, color: hex }}
        >
          {rarity}
        </span>

        {description?.trim() && (
          <p className="line-clamp-2 text-center font-sans text-[10px] leading-snug text-foreground/35">
            {description}
          </p>
        )}

        {esEjercito && (
          <span className="inline-flex items-center gap-1 font-sans text-[9px] text-orange-300/70">
            <Swords className="h-2.5 w-2.5" /> va a tus casillas de ejército
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/5 px-3 py-2.5">
        <span
          className={`inline-flex items-center gap-1 font-sans text-xs font-semibold tabular-nums ${
            puedePagar ? "text-gold" : "text-rose-400/80"
          }`}
          title={puedePagar ? undefined : "No te alcanza el oro"}
        >
          {price.toLocaleString("es-ES")}
          <Coins className="h-3 w-3" />
        </span>

        {stock !== null && (
          <span className="font-sans text-[10px] tabular-nums text-foreground/35">
            {Math.max(0, stock - enCarrito)} ud.
          </span>
        )}

        <button
          type="button"
          onClick={onAdd}
          disabled={agotado}
          aria-label={`Añadir ${name} al carrito`}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold transition-all hover:bg-gold/25 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {agotado && (
        <span className="absolute inset-x-0 bottom-11 text-center font-sans text-[10px] uppercase tracking-widest text-rose-400/70">
          Agotado
        </span>
      )}
    </motion.div>
  );
}
