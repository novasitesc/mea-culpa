"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import SalaFeed from "@/app/components/sala-feed";
import ConsumableModal from "@/app/components/consumable-modal";
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
  const canUseConsumables = partida.estado === "en_progreso" && me != null && !me.muerto;

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
        {participantes.length > 0 && (
          <div className="text-xs text-foreground/40 font-sans">
            {participantes.map((p) => p.nombre).join(" · ")}
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

      {/* Feed en vivo — ocupa todo el espacio restante */}
      <div className="flex-1 rounded-lg border border-gold-dim/40 bg-card p-4 min-h-[300px] overflow-hidden">
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
