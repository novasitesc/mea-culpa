"use client";

import { useState } from "react";
import { FlaskConical, Skull, Moon, Zap } from "lucide-react";
import { MAX_CANSANCIO, EFECTOS_CANSANCIO } from "@/lib/caidas";
import SalaFeed from "@/app/components/sala-feed";
import ConsumableModal from "@/app/components/consumable-modal";
import CaidasTracker from "@/app/components/caidas-tracker";
import type { SalaPartida, SalaParticipante, SalaEvento } from "@/lib/types/sala";

type Props = {
  partida: SalaPartida;
  participantes: SalaParticipante[];
  eventos: SalaEvento[];
  token: string | null;
  usuarioId: string | null;
  onEvent: (ev: SalaEvento) => void;
};

export default function SalaPlayer({ partida, participantes, eventos, token, usuarioId, onEvent }: Props) {
  const tierRoman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][partida.tier] ?? partida.tier;

  const [consumablesOpen, setConsumablesOpen] = useState(false);

  const me = usuarioId
    ? participantes.find((p) => p.usuarioId === usuarioId) ?? null
    : null;
  const canUseConsumables =
    partida.estado === "en_progreso" && me != null && !me.muerto && !me.derrotado;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Info de la partida */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-full px-3 py-1 text-[11px] font-sans bg-gold/10 border border-gold/30 text-gold uppercase tracking-widest">
          Tier {tierRoman}
        </div>
        <div className="rounded-full px-3 py-1 text-[11px] font-sans bg-white/5 border border-white/10 text-foreground/60 uppercase tracking-widest">
          Piso {partida.piso}
        </div>
        {me && (
          <div className="rounded-full px-3 py-1 bg-black/30 border border-red-900/40 flex items-center">
            <CaidasTracker caidas={me.caidas} size="sm" showLabel />
          </div>
        )}
        {me && me.cansancio > 0 && (
          <div
            className={`rounded-full px-3 py-1 bg-black/30 border flex items-center gap-1.5 text-[11px] font-sans transition-all animate-in fade-in duration-300 ${
              me.cansancio >= MAX_CANSANCIO - 2
                ? "border-red-900/60 text-red-400"
                : "border-amber-900/40 text-amber-300/90"
            }`}
            title={EFECTOS_CANSANCIO[Math.min(MAX_CANSANCIO, me.cansancio)]}
          >
            <Zap className="w-3 h-3" />
            Cansancio {me.cansancio}/{MAX_CANSANCIO}
          </div>
        )}
        {canUseConsumables && (
          <button
            type="button"
            onClick={() => setConsumablesOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-sans font-semibold bg-gold/15 border border-gold/40 text-gold uppercase tracking-widest hover:bg-gold/30 active:scale-95 transition-all"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Consumibles
          </button>
        )}
      </div>

      {/* Compañeros de expedición */}
      {participantes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {participantes.map((p) => (
            <span
              key={p.personajeId}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-sans border transition-all ${
                p.derrotado || p.muerto
                  ? "border-red-900/40 bg-red-950/20 text-foreground/35 line-through decoration-red-800/60"
                  : "border-white/10 bg-white/5 text-foreground/60"
              }`}
            >
              {(p.derrotado || p.muerto) && <Skull className="w-3 h-3 text-red-600 shrink-0" />}
              {p.nombre}
              {!p.muerto && !p.derrotado && p.caidas > 0 && (
                <CaidasTracker caidas={p.caidas} size="sm" />
              )}
            </span>
          ))}
        </div>
      )}

      {/* Estandarte de derrota del propio personaje */}
      {me?.derrotado && (
        <div className="rounded-lg border border-red-900/50 bg-gradient-to-r from-red-950/40 via-black/40 to-red-950/40 p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-500">
          <Skull className="w-6 h-6 text-red-500 shrink-0 cd-token-doom rounded-full" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-300 font-sans uppercase tracking-widest">
              Derrotado — de vuelta al Nexo
            </p>
            <p className="text-[11px] text-foreground/50 font-sans mt-0.5 flex items-center gap-1.5 flex-wrap">
              Perdiste la expedición y cargas puntos de cansancio.
              <span className="inline-flex items-center gap-1">
                <Moon className="w-3 h-3 text-gold/70" /> Un descanso largo restaurará tus caídas.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Feed en vivo — ocupa todo el espacio restante */}
      <div className="flex-1 rounded-lg border border-gold-dim/40 bg-card p-4 min-h-[300px] max-h-[65vh] overflow-hidden">
        {partida.estado === "abierta" ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full border-2 border-gold-dim/30 flex items-center justify-center">
              <span className="text-lg">⏳</span>
            </div>
            <p className="text-sm text-foreground/50 font-sans">Esperando al DM para iniciar la partida...</p>
          </div>
        ) : (
          <SalaFeed eventos={eventos} />
        )}
      </div>

      {/* Modal de consumibles */}
      {consumablesOpen && (
        <ConsumableModal
          partidaId={partida.id}
          token={token}
          onClose={() => setConsumablesOpen(false)}
          onUsed={onEvent}
        />
      )}
    </div>
  );
}
