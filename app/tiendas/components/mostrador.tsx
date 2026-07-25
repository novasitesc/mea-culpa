"use client";

// El mostrador: un único panel donde se cierra la compra. Antes eran dos
// modales encadenados (carrito → elegir personaje) y se perdía de vista lo que
// llevabas al elegir quién lo recibía; aquí conviven mercancía, destinatario y
// cuentas, con el oro antes/después siempre a la vista.

import { motion } from "framer-motion";
import Image from "next/image";
import {
  X, Coins, Plus, Minus, Trash2, Loader2, Skull, Backpack, ShoppingBag, AlertTriangle,
} from "lucide-react";
import ModalPortal from "@/components/ui/modal-portal";
import { getIconForString } from "@/lib/iconMapper";
import { ITEM_RARITY_HEX, type ItemRarity } from "@/lib/item-catalog";
import { playUiHoverSfx } from "@/lib/sfx";

export type LineaCarrito = {
  id: string;
  name: string;
  icon: string;
  price: number;
  qty: number;
  rarity: ItemRarity;
  stock: number | null;
};

type Personaje = {
  id: number;
  name: string;
  portrait: string;
  lifeStatus: "vivo" | "muerto";
  bagCapacity: number;
  bagUsed: number;
};

type Props = {
  lineas: LineaCarrito[];
  personajes: Personaje[];
  seleccionadoId: number | null;
  oro: number;
  total: number;
  /** false → el carrito solo lleva unidades de ejército y la bolsa da igual. */
  necesitaBolsa: boolean;
  comprando: boolean;
  error: string | null;
  onQty: (id: string, delta: number) => void;
  onQuitar: (id: string) => void;
  onSeleccionar: (id: number) => void;
  onConfirmar: () => void;
  onClose: () => void;
};

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Mostrador({
  lineas, personajes, seleccionadoId, oro, total, necesitaBolsa,
  comprando, error, onQty, onQuitar, onSeleccionar, onConfirmar, onClose,
}: Props) {
  const restante = oro - total;
  const alcanza = restante >= 0;
  const elegido = personajes.find((p) => p.id === seleccionadoId) ?? null;
  const puedeComprar = alcanza && lineas.length > 0 && elegido != null && !comprando;

  return (
    <ModalPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.98 }}
          transition={{ duration: 0.4, ease: EASE }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Mostrador: cerrar la compra"
          className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border-2 border-[#8B7355] bg-[#12100d] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)]"
        >
          {/* Tabla del mostrador */}
          <div className="relative flex items-center justify-between gap-3 border-b border-[#8B7355]/40 bg-gradient-to-b from-[#1c1710] to-[#12100d] px-5 py-3.5">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-60"
            />
            <div>
              <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-gold/60">
                Mostrador
              </p>
              <h2 className="font-serif text-lg text-[#D4AF37]">Cerrar el trato</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[1.15fr_1fr] md:overflow-hidden">
            {/* ── Mercancía ── */}
            <div className="min-h-0 border-b border-[#8B7355]/20 p-4 md:overflow-y-auto md:border-b-0 md:border-r">
              <p className="mb-2.5 font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                Lo que te llevas
              </p>

              {lineas.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#3a3020] py-10 text-center font-sans text-xs italic text-foreground/30">
                  El mostrador está vacío.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {lineas.map((l) => {
                    const hex = ITEM_RARITY_HEX[l.rarity] ?? ITEM_RARITY_HEX["común"];
                    const topeStock = l.stock !== null && l.qty >= l.stock;
                    return (
                      <motion.div
                        key={l.id}
                        layout
                        exit={{ opacity: 0, x: -12 }}
                        className="flex items-center gap-2.5 rounded-lg border border-[#3a3020] bg-black/30 p-2.5"
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `radial-gradient(circle, ${hex}22, transparent 72%)`, color: hex }}
                        >
                          {getIconForString(l.name, "w-5 h-5", l.icon)}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-serif text-[12.5px] text-[#e8d8b0]">{l.name}</p>
                          <p className="inline-flex items-center gap-1 font-sans text-[11px] text-gold tabular-nums">
                            {(l.price * l.qty).toLocaleString("es-ES")}
                            <Coins className="h-2.5 w-2.5" />
                            {l.qty > 1 && (
                              <span className="text-foreground/30">
                                ({l.price.toLocaleString("es-ES")} c/u)
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onQty(l.id, -1)}
                            disabled={l.qty <= 1}
                            aria-label={`Quitar una unidad de ${l.name}`}
                            className="flex h-6 w-6 items-center justify-center rounded border border-white/10 text-foreground/50 transition-colors hover:border-gold/50 hover:text-gold disabled:opacity-25"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center font-sans text-xs tabular-nums text-foreground/80">
                            {l.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => onQty(l.id, 1)}
                            disabled={topeStock}
                            aria-label={`Añadir una unidad de ${l.name}`}
                            className="flex h-6 w-6 items-center justify-center rounded border border-white/10 text-foreground/50 transition-colors hover:border-gold/50 hover:text-gold disabled:opacity-25"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuitar(l.id)}
                            aria-label={`Quitar ${l.name} del carrito`}
                            className="ml-0.5 flex h-6 w-6 items-center justify-center rounded border border-white/10 text-foreground/35 transition-colors hover:border-rose-500/50 hover:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Destinatario y cuentas ── */}
            <div className="flex min-h-0 flex-col">
              <div className="min-h-0 flex-1 p-4 md:overflow-y-auto">
                <p className="mb-2.5 font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                  ¿Quién lo recibe?
                </p>

                {personajes.length === 0 ? (
                  <p className="font-sans text-xs text-foreground/40">
                    No tienes personajes. Crea uno desde tu perfil.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {personajes.map((p) => {
                      const muerto = p.lifeStatus === "muerto";
                      const llena = necesitaBolsa && p.bagUsed >= p.bagCapacity;
                      const bloqueado = muerto || llena;
                      const activo = seleccionadoId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => !bloqueado && onSeleccionar(p.id)}
                          onMouseEnter={bloqueado ? undefined : playUiHoverSfx}
                          disabled={bloqueado}
                          className={`flex items-center gap-2.5 rounded-lg border p-2 text-left transition-all disabled:cursor-not-allowed ${
                            activo
                              ? "border-gold bg-gold/10"
                              : bloqueado
                                ? "border-[#2a241a] opacity-45"
                                : "border-[#3a3020] hover:border-[#8B7355]"
                          }`}
                        >
                          <Image
                            src={p.portrait || "/characters/profileplaceholder.webp"}
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 shrink-0 rounded object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`truncate font-serif text-[13px] ${activo ? "text-gold" : "text-[#e8d8b0]"}`}>
                              {p.name}
                            </p>
                            <p className="inline-flex items-center gap-1 font-sans text-[10px] text-foreground/40 tabular-nums">
                              {muerto ? (
                                <><Skull className="h-2.5 w-2.5 text-red-500" /> Muerto</>
                              ) : (
                                <>
                                  <Backpack className="h-2.5 w-2.5" />
                                  {p.bagUsed}/{p.bagCapacity}
                                  {llena && <span className="text-rose-400"> · llena</span>}
                                </>
                              )}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!necesitaBolsa && lineas.length > 0 && (
                  <p className="mt-2.5 font-sans text-[10px] leading-relaxed text-foreground/35">
                    Solo llevas unidades de ejército: van a sus casillas propias, así que la
                    mochila llena no estorba.
                  </p>
                )}
              </div>

              {/* Cuentas */}
              <div className="shrink-0 border-t border-[#8B7355]/25 bg-black/25 p-4">
                <dl className="space-y-1 font-sans text-[11px]">
                  <div className="flex justify-between text-foreground/45">
                    <dt>Tu oro</dt>
                    <dd className="tabular-nums">{oro.toLocaleString("es-ES")}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/45">
                    <dt>Total</dt>
                    <dd className="tabular-nums">−{total.toLocaleString("es-ES")}</dd>
                  </div>
                  <div
                    className={`flex justify-between border-t border-white/10 pt-1 font-semibold ${
                      alcanza ? "text-gold" : "text-rose-400"
                    }`}
                  >
                    <dt>Te queda</dt>
                    <dd className="inline-flex items-center gap-1 tabular-nums">
                      {restante.toLocaleString("es-ES")}
                      <Coins className="h-3 w-3" />
                    </dd>
                  </div>
                </dl>

                {(error || !alcanza) && (
                  <p className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-rose-800/40 bg-rose-950/25 px-2.5 py-1.5 font-sans text-[11px] leading-snug text-rose-300">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {error ?? "No te alcanza el oro para este pedido."}
                  </p>
                )}

                <button
                  type="button"
                  onClick={onConfirmar}
                  disabled={!puedeComprar}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gold/50 bg-gold/15 px-4 py-2.5 font-sans text-sm font-semibold text-gold transition-all hover:bg-gold/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {comprando ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Cerrando el trato...</>
                  ) : (
                    <><ShoppingBag className="h-4 w-4" /> Pagar y llevárselo</>
                  )}
                </button>
                {!elegido && lineas.length > 0 && alcanza && (
                  <p className="mt-1.5 text-center font-sans text-[10px] text-foreground/35">
                    Elige quién carga con la compra.
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}
