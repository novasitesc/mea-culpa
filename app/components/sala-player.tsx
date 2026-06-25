"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import SalaFeed from "@/app/components/sala-feed";
import type { SalaPartida, SalaParticipante, SalaEvento, EventoConsumibleUsado } from "@/lib/types/sala";

type Consumible = {
  bolsaId: number;
  objetoId: number;
  nombre: string;
  icono: string;
  rareza: string;
  cantidad: number;
};

type Props = {
  partida: SalaPartida;
  participantes: SalaParticipante[];
  eventos: SalaEvento[];
  token: string | null;
  onEvent: (ev: SalaEvento) => void;
};

export default function SalaPlayer({ partida, participantes, eventos, token, onEvent }: Props) {
  const tierRoman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][partida.tier] ?? partida.tier;

  const [consumibles, setConsumibles] = useState<Consumible[]>([]);
  const [loadingConsumibles, setLoadingConsumibles] = useState(false);
  const [usandoId, setUsandoId] = useState<number | null>(null);
  const [personajeId, setPersonajeId] = useState<number | null>(null);
  const [personajeNombre, setPersonajeNombre] = useState<string>("");

  const fetchConsumibles = useCallback(async () => {
    if (!token || partida.estado === "abierta") return;
    setLoadingConsumibles(true);
    try {
      const res = await fetch(`/api/partidas/${partida.id}/consumibles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConsumibles(data.consumibles ?? []);
        setPersonajeId(data.personajeId ?? null);
        setPersonajeNombre(data.personajeNombre ?? "");
      }
    } finally {
      setLoadingConsumibles(false);
    }
  }, [token, partida.id, partida.estado]);

  useEffect(() => {
    void fetchConsumibles();
  }, [fetchConsumibles]);

  // Re-fetch cuando el DM asigna un consumible al jugador
  const lastAsignacion = eventos.filter((ev) => ev.tipo === "asignacion_manual").length;
  useEffect(() => {
    if (lastAsignacion > 0) void fetchConsumibles();
  }, [lastAsignacion, fetchConsumibles]);

  async function handleUsar(c: Consumible) {
    if (!token || usandoId !== null) return;
    setUsandoId(c.bolsaId);
    try {
      const res = await fetch(`/api/partidas/${partida.id}/usar-consumible`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bolsaId: c.bolsaId }),
      });
      if (!res.ok) return;
      const data = await res.json();

      const evento: EventoConsumibleUsado = {
        tipo: "consumible_usado",
        personajeId: data.personajeId,
        personajeNombre: data.personajeNombre,
        objeto: data.objeto,
      };
      onEvent(evento);

      if (data.cantidadRestante <= 0) {
        setConsumibles((prev) => prev.filter((x) => x.bolsaId !== c.bolsaId));
      } else {
        setConsumibles((prev) =>
          prev.map((x) => x.bolsaId === c.bolsaId ? { ...x, cantidad: data.cantidadRestante } : x),
        );
      }
    } finally {
      setUsandoId(null);
    }
  }

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
      </div>

      {/* Panel de consumibles — solo en progreso */}
      {partida.estado === "en_progreso" && personajeId !== null && (
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3">
          <p className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-sans mb-2">
            🧪 Consumibles
          </p>
          {loadingConsumibles ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400/50" />
          ) : consumibles.length === 0 ? (
            <p className="text-xs text-foreground/30 italic font-sans">Sin consumibles en inventario</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {consumibles.map((c) => (
                <div
                  key={c.bolsaId}
                  className="flex items-center gap-1.5 rounded-md border border-emerald-800/40 bg-emerald-950/30 px-2 py-1"
                >
                  <span className="text-sm">{c.icono}</span>
                  <span className="text-xs text-foreground/80 font-sans">{c.nombre}</span>
                  {c.cantidad > 1 && (
                    <span className="text-[10px] text-foreground/40 font-sans">×{c.cantidad}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleUsar(c)}
                    disabled={usandoId !== null}
                    className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-700/40 border border-emerald-600/40 text-emerald-300 hover:bg-emerald-700/60 disabled:opacity-40 disabled:cursor-not-allowed font-sans transition-colors"
                  >
                    {usandoId === c.bolsaId ? "..." : "Usar"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feed en vivo — ocupa todo el espacio restante */}
      <div className="flex-1 rounded-lg border border-gold-dim/40 bg-card p-4 min-h-75 overflow-hidden">
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
    </div>
  );
}
