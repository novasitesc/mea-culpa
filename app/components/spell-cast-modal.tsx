"use client";

// Modal para elegir y lanzar un conjuro dentro de la partida.

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, X, Sparkles, Flame, Moon } from "lucide-react";
import { useModalTransition, modalOverlayCls, modalPanelCls } from "@/lib/useModalTransition";
import { schoolRgb } from "@/lib/spells";
import type { EventoConjuroLanzado } from "@/lib/types/sala";
import SpellDescriptionHover from "@/app/components/spell-description-hover";

type ConjuroDisponible = {
  name: string;
  spellLevel: number;
  escuela: string | null;
  descripcion: string | null;
  used: boolean;
};

type Props = {
  partidaId: string;
  token: string | null;
  onClose: () => void;
  onCast: (ev: EventoConjuroLanzado) => void;
};

export default function SpellCastModal({ partidaId, token, onClose, onCast }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conjuros, setConjuros] = useState<ConjuroDisponible[]>([]);
  const [casting, setCasting] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const { closing, closeWith } = useModalTransition();
  const handleClose = useCallback(() => closeWith(onClose), [closeWith, onClose]);

  const loadConjuros = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/partidas/${partidaId}/conjuros`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudieron cargar tus conjuros");
        return;
      }
      setConjuros(data.conjuros ?? []);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [partidaId, token]);

  useEffect(() => {
    void loadConjuros();
  }, [loadConjuros]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  async function handleCast(spell: ConjuroDisponible) {
    if (!token || inFlightRef.current) return;
    inFlightRef.current = true;
    setCasting(spell.name);
    setError(null);
    try {
      const res = await fetch(`/api/partidas/${partidaId}/conjuros`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ spellName: spell.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo lanzar el conjuro");
        return;
      }

      // Los trucos siguen disponibles; el resto queda gastado hasta el descanso largo.
      if (spell.spellLevel > 0) {
        setConjuros((prev) =>
          prev.map((c) => (c.name === spell.name ? { ...c, used: true } : c)),
        );
      }

      onCast({
        tipo: "conjuro_lanzado",
        personajeId: data.personajeId,
        personajeNombre: data.personajeNombre,
        conjuro: data.conjuro,
        spellLevel: data.spellLevel,
        escuela: data.escuela ?? null,
        descripcion: data.descripcion ?? spell.descripcion ?? null,
      });

      // Cerrar de inmediato: la animación ocurre a pantalla completa detrás.
      handleClose();
    } catch {
      setError("Error de conexión");
    } finally {
      inFlightRef.current = false;
      setCasting(null);
    }
  }

  const porNivel = conjuros.reduce<Record<number, ConjuroDisponible[]>>((acc, c) => {
    (acc[c.spellLevel] ??= []).push(c);
    return acc;
  }, {});
  const niveles = Object.keys(porNivel).map(Number).sort((a, b) => a - b);
  const gastados = conjuros.filter((c) => c.used).length;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm ${modalOverlayCls(closing)}`}
      onClick={handleClose}
    >
      <div
        className={`relative bg-card border border-gold-dim/40 rounded-xl shadow-2xl shadow-black/60 w-full max-w-lg flex flex-col overflow-hidden ${modalPanelCls(closing)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gold-dim/20 bg-gradient-to-b from-gold/5 to-transparent">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans mb-1">
              En expedición
            </p>
            <h2 className="text-lg font-serif text-gold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gold" /> Lanzar conjuro
            </h2>
            <p className="text-xs text-foreground/50 font-sans mt-1">
              Gasta el espacio hasta el próximo descanso largo. Los trucos no se gastan.
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

        <div className="p-5 overflow-y-auto max-h-[55vh] min-h-[180px]">
          {loading ? (
            <div className="h-full min-h-[140px] flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-gold" />
            </div>
          ) : conjuros.length === 0 ? (
            <div className="h-full min-h-[140px] flex flex-col items-center justify-center gap-3 text-center animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-full border-2 border-gold-dim/30 flex items-center justify-center text-gold/60">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-sm text-foreground/40 font-sans italic">
                Este personaje no tiene conjuros registrados.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {gastados > 0 && (
                <p className="flex items-center gap-2 text-[11px] text-amber-200/90 font-sans rounded border border-amber-800/30 bg-amber-900/10 px-2.5 py-1.5">
                  <Moon className="w-3.5 h-3.5 shrink-0" />
                  {gastados} gastado{gastados === 1 ? "" : "s"}. Un descanso largo los devuelve.
                </p>
              )}

              {niveles.map((nivel) => (
                <div key={nivel} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 border-b border-gold-dim/20 pb-1">
                    <span className="text-[10px] font-bold text-gold uppercase tracking-widest font-serif">
                      {nivel === 0 ? "Trucos" : `Nivel ${nivel}`}
                    </span>
                    <span className="text-[9px] text-foreground/40 bg-black/30 px-1.5 py-0.5 rounded font-mono">
                      {porNivel[nivel].length}
                    </span>
                  </div>

                  {porNivel[nivel].map((spell, i) => {
                    const [, edge] = schoolRgb(spell.escuela);
                    const lanzando = casting === spell.name;
                    return (
                      <div
                        key={spell.name}
                        className={`group flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards ${
                          spell.used
                            ? "border-white/5 bg-white/[0.01] opacity-50"
                            : lanzando
                              ? "border-gold/60 bg-gold/10 scale-[0.98]"
                              : "border-white/10 bg-white/[0.02] hover:border-gold/40 hover:bg-gold/5"
                        }`}
                        style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
                      >
                        <span
                          className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border transition-transform duration-300 ${
                            lanzando ? "animate-pulse scale-110" : "group-hover:scale-110"
                          }`}
                          style={{
                            color: `rgb(${edge})`,
                            borderColor: `rgba(${edge},0.35)`,
                            background: `rgba(${edge},0.1)`,
                          }}
                        >
                          <Sparkles className="w-5 h-5" />
                        </span>

                        <div className="flex-1 min-w-0">
                          <SpellDescriptionHover
                            name={spell.name}
                            escuela={spell.escuela}
                            spellLevel={spell.spellLevel}
                            description={spell.descripcion}
                          >
                            <p
                              tabIndex={spell.descripcion ? 0 : undefined}
                              className={`text-sm font-semibold truncate w-fit max-w-full ${
                                spell.descripcion
                                  ? "cursor-help underline decoration-dotted decoration-foreground/25 underline-offset-4 outline-none focus-visible:decoration-gold/70"
                                  : ""
                              } ${spell.used ? "text-foreground/40 line-through" : "text-foreground/90"}`}
                            >
                              {spell.name}
                            </p>
                          </SpellDescriptionHover>
                          <p className="text-[11px] text-foreground/40 font-sans truncate">
                            {spell.escuela ?? "Escuela desconocida"}
                            {nivel === 0 && " · no gasta espacio"}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={spell.used || casting != null}
                          onClick={() => void handleCast(spell)}
                          className="shrink-0 px-3 py-1.5 rounded-md bg-gold/15 border border-gold/40 text-gold text-xs font-semibold font-sans hover:bg-gold/30 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                        >
                          {lanzando ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : spell.used ? (
                            <Flame className="w-4 h-4" />
                          ) : (
                            "Lanzar"
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-rose-400 font-sans animate-in fade-in slide-in-from-bottom-1 duration-200">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
