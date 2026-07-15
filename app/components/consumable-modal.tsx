"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FlaskConical, Loader2, X, Sparkles } from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import { useModalTransition, modalOverlayCls, modalPanelCls } from "@/lib/useModalTransition";
import { ITEM_RARITY_BADGES, type ItemRarity } from "@/lib/item-catalog";
import type { EventoConsumibleUsado } from "@/lib/types/sala";

type Consumible = {
  bagRowId: number;
  objetoId: number;
  nombre: string;
  icono: string;
  descripcion: string;
  rareza: string;
  cantidad: number;
};

type Props = {
  partidaId: string;
  token: string | null;
  onClose: () => void;
  onUsed: (ev: EventoConsumibleUsado) => void;
};

export default function ConsumableModal({ partidaId, token, onClose, onUsed }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consumibles, setConsumibles] = useState<Consumible[]>([]);
  const [usingRowId, setUsingRowId] = useState<number | null>(null);
  const inFlightRef = useRef(false);
  const [justUsed, setJustUsed] = useState<{ nombre: string; icono: string } | null>(null);
  const { closing, closeWith } = useModalTransition();
  const handleClose = useCallback(() => closeWith(onClose), [closeWith, onClose]);

  const loadConsumibles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/partidas/${partidaId}/consumibles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudieron cargar tus consumibles");
        return;
      }
      setConsumibles(data.consumibles ?? []);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [partidaId, token]);

  useEffect(() => {
    void loadConsumibles();
  }, [loadConsumibles]);

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  async function handleUse(item: Consumible) {
    if (!token || inFlightRef.current) return;
    inFlightRef.current = true;
    setUsingRowId(item.bagRowId);
    setError(null);
    try {
      const res = await fetch(`/api/partidas/${partidaId}/consumibles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bagRowId: item.bagRowId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo usar el consumible");
        return;
      }

      // Rebajar en la vista local
      setConsumibles((prev) =>
        prev
          .map((c) =>
            c.bagRowId === item.bagRowId ? { ...c, cantidad: data.restante } : c,
          )
          .filter((c) => c.cantidad > 0),
      );

      onUsed({
        tipo: "consumible_usado",
        eventoId: crypto.randomUUID(),
        personajeId: data.personajeId,
        personajeNombre: data.personajeNombre,
        objeto: data.objeto,
        restante: data.restante,
      });

      // Overlay de éxito
      setJustUsed({ nombre: data.objeto.nombre, icono: data.objeto.icono });
      setTimeout(() => setJustUsed(null), 1300);
    } catch {
      setError("Error de conexión");
    } finally {
      inFlightRef.current = false;
      setUsingRowId(null);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm ${modalOverlayCls(closing)}`}
      onClick={handleClose}
    >
      <div
        className={`relative bg-card border border-gold-dim/40 rounded-xl shadow-2xl shadow-black/60 w-full max-w-lg flex flex-col overflow-hidden ${modalPanelCls(closing)}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gold-dim/20 bg-gradient-to-b from-gold/5 to-transparent">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans mb-1">
              En partida
            </p>
            <h2 className="text-lg font-serif text-gold flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-gold" /> Tirar consumible
            </h2>
            <p className="text-xs text-foreground/50 font-sans mt-1">
              Se rebajará de tu bolsa al usarlo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-white/10 text-foreground/50 hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 overflow-y-auto max-h-[55vh] min-h-[180px]">
          {loading ? (
            <div className="h-full min-h-[140px] flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-gold" />
            </div>
          ) : consumibles.length === 0 ? (
            <div className="h-full min-h-[140px] flex flex-col items-center justify-center gap-3 text-center animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-full border-2 border-gold-dim/30 flex items-center justify-center text-gold/60">
                <FlaskConical className="w-5 h-5" />
              </div>
              <p className="text-sm text-foreground/40 font-sans italic">
                No llevas consumibles en la bolsa.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {consumibles.map((item, i) => {
                const badge =
                  ITEM_RARITY_BADGES[item.rareza as ItemRarity] ??
                  ITEM_RARITY_BADGES["común"];
                const using = usingRowId === item.bagRowId;
                return (
                  <div
                    key={item.bagRowId}
                    className={`group flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards ${
                      using
                        ? "border-gold/60 bg-gold/10 scale-[0.98]"
                        : "border-white/10 bg-white/[0.02] hover:border-gold/40 hover:bg-gold/5"
                    }`}
                    style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
                  >
                    <span
                      className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gold/10 border border-gold/25 text-gold transition-transform duration-300 ${
                        using ? "animate-pulse scale-110" : "group-hover:scale-110"
                      }`}
                    >
                      {getIconForString(item.nombre, "w-5 h-5", item.icono)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground/90 truncate">
                          {item.nombre}
                        </p>
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${badge}`}>
                          {item.rareza}
                        </span>
                      </div>
                      {item.descripcion && (
                        <p className="text-[11px] text-foreground/40 font-sans truncate">
                          {item.descripcion}
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 text-[11px] font-sans text-foreground/50 px-2 py-0.5 rounded-full border border-white/10 bg-white/5">
                      ×{item.cantidad}
                    </span>

                    <button
                      type="button"
                      disabled={usingRowId != null}
                      onClick={() => void handleUse(item)}
                      className="shrink-0 px-3 py-1.5 rounded-md bg-gold/15 border border-gold/40 text-gold text-xs font-semibold font-sans hover:bg-gold/30 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {using ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Tirar"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-rose-400 font-sans animate-in fade-in slide-in-from-bottom-1 duration-200">
              {error}
            </p>
          )}
        </div>

        {/* Overlay de éxito */}
        {justUsed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-[2px] animate-in fade-in duration-200 pointer-events-none">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-20 h-20 rounded-full bg-gold/20 animate-ping" />
              <span className="relative w-16 h-16 flex items-center justify-center rounded-full bg-gold/15 border border-gold/50 text-gold animate-in zoom-in-50 duration-300">
                {getIconForString(justUsed.nombre, "w-7 h-7", justUsed.icono)}
              </span>
              <Sparkles className="absolute -top-2 -right-3 w-4 h-4 text-gold animate-pulse" />
            </div>
            <p className="text-sm font-serif text-gold animate-in fade-in slide-in-from-bottom-2 duration-300">
              ¡{justUsed.nombre} usado!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
