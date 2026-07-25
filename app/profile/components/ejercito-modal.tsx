"use client";

// Inventario de ejército de un personaje, visto desde el perfil.
// Solo lectura: las unidades entran comprándolas en la tienda y solo el DM
// puede matarlas en partida. Aquí el jugador pasa revista a sus tropas.

import { motion } from "framer-motion";
import { X, Users, Swords, Flag } from "lucide-react";
import ModalPortal from "@/components/ui/modal-portal";
import EjercitoGrid from "@/app/components/ejercito-grid";
import {
  EJERCITO_SLOTS,
  totalTropas,
  type UnidadEjercito,
} from "@/lib/ejercito";

type Props = {
  nombrePersonaje: string;
  unidades: UnidadEjercito[];
  onClose: () => void;
};

export default function EjercitoModal({ nombrePersonaje, unidades, onClose }: Props) {
  const tropas = totalTropas(unidades);
  const regimientos = unidades.reduce((acc, u) => acc + u.cantidad, 0);

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
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border-2 border-[#8B7355] bg-[#12100d] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)]"
        >
          {/* Cabecera: estandarte */}
          <div className="relative border-b border-[#8B7355]/40 bg-gradient-to-b from-[#1c1710] to-[#12100d] px-5 py-4">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-60"
            />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-gold/60">
                  Inventario de ejército
                </p>
                <h2 className="mt-0.5 truncate font-serif text-xl text-[#D4AF37]">
                  {nombrePersonaje}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Recuento de fuerzas */}
            <div className="mt-3.5 grid grid-cols-3 gap-2">
              {[
                { icon: Users, label: "Soldados", value: tropas.toLocaleString("es-ES") },
                { icon: Swords, label: "Regimientos", value: String(regimientos) },
                { icon: Flag, label: "Casillas", value: `${unidades.length}/${EJERCITO_SLOTS}` },
              ].map(({ icon: Icon, label, value }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
                  className="rounded-lg border border-[#3a3020] bg-black/30 px-3 py-2"
                >
                  <p className="flex items-center gap-1.5 font-sans text-[9px] uppercase tracking-widest text-foreground/40">
                    <Icon className="h-3 w-3" />
                    {label}
                  </p>
                  <p className="mt-0.5 font-serif text-lg leading-none text-[#e8d8b0] tabular-nums">
                    {value}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Tropas */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {unidades.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#3a3020] py-14 text-center">
                <span className="text-3xl opacity-25">⚑</span>
                <p className="font-serif text-sm text-foreground/50">
                  Aún no comandas ninguna tropa
                </p>
                <p className="max-w-xs font-sans text-xs text-foreground/30">
                  Las unidades se reclutan en las tiendas y ocupan sus propias casillas,
                  aparte de la mochila.
                </p>
              </div>
            ) : (
              <EjercitoGrid unidades={unidades} />
            )}
          </div>

          <div className="border-t border-[#8B7355]/30 px-5 py-3">
            <p className="font-sans text-[11px] leading-relaxed text-foreground/35">
              Las unidades sobreviven de una batalla a otra si las gestionas bien. Solo el
              DM puede retirarlas del inventario cuando caen en combate.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}
