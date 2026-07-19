"use client";

// Overlay a pantalla completa: el dado cae desde arriba, aterriza y revela el
// premio. La animación es SIEMPRE una reproducción del resultado del servidor.
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Volume2, VolumeX, RotateCcw } from "lucide-react";
import DiceScene from "./dice-scene";
import { preloadDiceAssets } from "./dice-materials";
import { isDiceSoundEnabled, setDiceSoundEnabled, playThud, playReveal } from "./dice-sound";
import DiceVisual from "@/app/components/dice-visual";
import { getIconForString } from "@/lib/iconMapper";
import type { DiceType, LutCaraResult, RollResult } from "@/lib/types/dados";

export type DiceOverlayData = {
  tipoDado: DiceType;
  result: RollResult;
  recompensaNombre: string;
  /** Personaje que recibe los ítems (contexto personal), si lo hay. */
  personajeNombre?: string | null;
  /** true → tirada recuperada tras un refresh: se reproduce, no se re-anuncia. */
  replay?: boolean;
};

type Props = {
  data: DiceOverlayData;
  /** Al asentarse los dados (o de inmediato sin animación): momento de anunciar. */
  onFinished: () => void;
  onClose: () => void;
};

type ItemGanado = { objeto: { id: number; nombre: string; icono: string }; cantidad: number };

function resumen(result: RollResult) {
  let oro = 0;
  const items: ItemGanado[] = [];
  if (result.lutResultados?.length) {
    for (const r of result.lutResultados) {
      if (r.tipo === "oro") oro += r.oroDetalle?.cantidadOro ?? 0;
      if (r.tipo === "item" && r.objeto) items.push({ objeto: r.objeto, cantidad: r.cantidadObjeto ?? 1 });
      if (r.tipo === "subtabla" && r.subRoll) {
        oro += r.subRoll.cantidadOro ?? 0;
        if (r.subRoll.objeto) items.push({ objeto: r.subRoll.objeto, cantidad: r.subRoll.cantidadObjeto ?? 1 });
      }
    }
  } else if (result.tipoResultado === "oro") {
    oro = result.cantidadOro ?? 0;
  } else if (result.objeto) {
    items.push({ objeto: result.objeto, cantidad: 1 });
  }
  const kind: "oro" | "item" | "nada" | "mixto" =
    oro > 0 && items.length > 0 ? "mixto" : oro > 0 ? "oro" : items.length > 0 ? "item" : "nada";
  return { oro, items, kind };
}

function LutFila({ r }: { r: LutCaraResult }) {
  return (
    <div className="flex items-start gap-2 text-xs font-sans">
      <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded bg-gold/10 border border-gold/40 text-gold text-[10px] font-bold">
        {r.cara}
      </span>
      {r.tipo === "nada" && <span className="text-foreground/40 italic leading-6">Nada</span>}
      {r.tipo === "item" && r.objeto && (
        <span className="text-green-400 font-semibold leading-6 flex items-center gap-1.5">
          {getIconForString(r.objeto.nombre, "w-4 h-4 shrink-0", r.objeto.icono)} {r.objeto.nombre}
          {(r.cantidadObjeto ?? 1) > 1 && <span className="text-foreground/50">×{r.cantidadObjeto}</span>}
        </span>
      )}
      {r.tipo === "oro" && r.oroDetalle && (
        <span className="text-gold font-semibold leading-6">
          +{r.oroDetalle.cantidadOro.toLocaleString("es-ES")} oro
        </span>
      )}
      {r.tipo === "subtabla" && r.subRoll && (
        <span className="leading-5">
          <span className="text-foreground/40 text-[10px] block">
            {r.subRoll.subtablaNombre} → cara {r.subRoll.cara}
          </span>
          {r.subRoll.objeto ? (
            <span className="text-green-400 font-semibold flex items-center gap-1.5">
              {getIconForString(r.subRoll.objeto.nombre, "w-4 h-4 shrink-0", r.subRoll.objeto.icono)}{" "}
              {r.subRoll.objeto.nombre}
              {(r.subRoll.cantidadObjeto ?? 1) > 1 && (
                <span className="text-foreground/50">×{r.subRoll.cantidadObjeto}</span>
              )}
            </span>
          ) : r.subRoll.cantidadOro !== undefined ? (
            <span className="text-gold font-semibold">+{r.subRoll.cantidadOro} oro</span>
          ) : (
            <span className="text-foreground/40 italic">Nada</span>
          )}
        </span>
      )}
    </div>
  );
}

export default function DiceOverlay({ data, onFinished, onClose }: Props) {
  const { result, tipoDado } = data;
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<"falling" | "revealed">("falling");
  const [skip, setSkip] = useState(false);
  const [sound, setSound] = useState(isDiceSoundEnabled);

  const animate = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  }, []);

  const dice = useMemo(
    () => result.resultados.map((value) => ({ type: tipoDado, value })),
    [result.resultados, tipoDado],
  );
  const { oro, items, kind } = useMemo(() => resumen(result), [result]);

  const reveal = useCallback(() => {
    setPhase((prev) => {
      if (prev === "revealed") return prev;
      playReveal(kind);
      onFinished();
      return "revealed";
    });
  }, [kind, onFinished]);

  // Carga de fuentes/texturas; sin animación se revela de inmediato.
  useEffect(() => {
    let alive = true;
    if (!animate) {
      setReady(true);
      reveal();
      return;
    }
    void preloadDiceAssets(tipoDado).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [animate, tipoDado, reveal]);

  // Bloquear scroll del fondo mientras el overlay está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc: salta la caída; con el premio visible, cierra.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (phase === "falling") setSkip(true);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onClose]);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSound((v) => {
      setDiceSoundEnabled(!v);
      return !v;
    });
  };

  // Entrega personal: nota por ítem según lo que la RPC pudo meter en la bolsa.
  const entregaNota = (idx: number, cantidad: number): React.ReactNode => {
    const e = result.entregas?.[idx];
    if (!e) {
      return data.personajeNombre === undefined ? null : (
        <span className="text-amber-400/90">— no entregado (sin personaje)</span>
      );
    }
    if (e.entregada < cantidad) {
      return (
        <span className="text-amber-400/90">
          — entregado {e.entregada}/{cantidad} (bolsa llena)
        </span>
      );
    }
    return data.personajeNombre ? (
      <span className="text-foreground/40">→ {data.personajeNombre}</span>
    ) : null;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onPointerDown={() => phase === "falling" && setSkip(true)}
      role="dialog"
      aria-modal="true"
      aria-label={`Tirada de dados: ${data.recompensaNombre}`}
    >
      {/* Fondo */}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 55% at 50% 78%, rgba(212,175,55,0.10), transparent 70%)" }}
      />

      {/* Controles */}
      <button
        onClick={toggleSound}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-4 right-4 z-20 p-2 rounded border border-gold-dim/40 text-gold/70 hover:text-gold hover:border-gold/60 transition-colors bg-card/60"
        aria-label={sound ? "Silenciar dados" : "Activar sonido de dados"}
      >
        {sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>

      {data.replay && (
        <span className="absolute top-5 left-4 z-20 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gold/70 font-sans">
          <RotateCcw className="w-3 h-3" /> Tirada recuperada
        </span>
      )}

      {/* Escena 3D */}
      {animate && (
        <div className="absolute inset-0">
          {ready ? (
            <DiceScene dice={dice} skip={skip} onImpact={playThud} onAllSettled={reveal} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-gold animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Sin animación: caras estáticas */}
      {!animate && (
        <div className="absolute top-[16%] inset-x-0 flex justify-center gap-4 flex-wrap px-6 pointer-events-none">
          {result.resultados.slice(0, 10).map((v, i) => (
            <DiceVisual key={i} type={tipoDado} value={v} rolling={false} size={56} />
          ))}
        </div>
      )}

      {phase === "falling" && ready && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.6 }}
          className="absolute bottom-6 inset-x-0 text-center text-[11px] uppercase tracking-widest text-foreground/60 font-sans pointer-events-none"
        >
          Toca para saltar
        </motion.p>
      )}

      {/* Panel de premio */}
      <AnimatePresence>
        {phase === "revealed" && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onPointerDown={(e) => e.stopPropagation()}
            className="relative z-10 w-[92vw] max-w-sm max-h-[76vh] overflow-y-auto bg-card border border-gold-dim/60 rounded-lg p-4 space-y-3 medieval-border mt-[22vh]"
          >
            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans">
                {data.recompensaNombre}
              </p>
              <div className="flex justify-center gap-1.5 flex-wrap">
                {result.resultados.map((v, i) => (
                  <span
                    key={i}
                    className="w-7 h-7 flex items-center justify-center rounded bg-gold/10 border border-gold/40 text-gold text-xs font-bold font-serif"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>

            {result.lutResultados?.length ? (
              <div className="space-y-1.5 border-t border-gold-dim/20 pt-2">
                {result.lutResultados.map((r, i) => (
                  <LutFila key={i} r={r} />
                ))}
              </div>
            ) : null}

            <div className="text-center space-y-1.5 border-t border-gold-dim/20 pt-2.5">
              {oro > 0 && (
                <p className="text-gold font-serif font-bold text-lg" style={{ textShadow: "0 0 12px rgba(212,175,55,0.5)" }}>
                  +{oro.toLocaleString("es-ES")} oro
                </p>
              )}
              {items.map((it, i) => (
                <p key={i} className="text-sm text-green-400 font-semibold flex items-center justify-center gap-1.5 flex-wrap">
                  {getIconForString(it.objeto.nombre, "w-4 h-4 shrink-0", it.objeto.icono)} {it.objeto.nombre}
                  {it.cantidad > 1 && <span className="text-foreground/50">×{it.cantidad}</span>}
                  <span className="text-[11px] font-sans font-normal">{entregaNota(i, it.cantidad)}</span>
                </p>
              ))}
              {oro === 0 && items.length === 0 && (
                <p className="text-foreground/40 italic text-sm">Sin recompensa esta vez…</p>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full py-2 rounded bg-gold/10 border border-gold/40 text-sm text-gold font-sans font-semibold tracking-wide hover:bg-gold/20 transition-colors"
            >
              Continuar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
