"use client";

// Aviso de cambio de estado del personaje (cansancio, heridas) durante la partida.

import { useEffect, useMemo, useRef, useState } from "react";
import { Zap, HeartPulse, Moon } from "lucide-react";
import { MAX_CAIDAS, MAX_CANSANCIO, EFECTOS_CANSANCIO } from "@/lib/caidas";
import { playCansancioSfx, playRecuperacionSfx } from "@/lib/sfx";
import CaidasTracker from "@/app/components/caidas-tracker";

export type EstadoFx =
  | { tipo: "cansancio"; personajeNombre: string; cansancio: number }
  | { tipo: "recuperacion"; personajeNombre: string; caidas: number };

type Props = {
  fx: EstadoFx;
  onDone: () => void;
};

/**
 * Aviso a pantalla completa para el jugador afectado (no para toda la sala):
 * el agotamiento que se acumula y el alivio al recuperar una caída.
 * Hermano ligero de CaidasOverlay — misma gramática visual, menos duración.
 */
export default function EstadoOverlay({ fx, onDone }: Props) {
  const cansado = fx.tipo === "cansancio";
  const [leaving, setLeaving] = useState(false);

  // Ref para que el efecto de sonido corra una sola vez aunque el padre
  // re-renderice (eventos en vivo cambian la identidad de onDone → sfx doble).
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (cansado) playCansancioSfx();
    else playRecuperacionSfx();
    const visibleMs = cansado ? 2600 : 2400;
    const t1 = window.setTimeout(() => setLeaving(true), visibleMs);
    const t2 = window.setTimeout(() => onDoneRef.current(), visibleMs + 400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // Solo al montar: fx es fijo para este montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ceniza que cae en el agotamiento; chispas que suben en la recuperación.
  const particles = useMemo(
    () =>
      Array.from({ length: cansado ? 18 : 14 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.4,
        duration: (cansado ? 3.4 : 2.4) + Math.random() * 2.4,
        size: 2 + Math.random() * 3.5,
        drift: (Math.random() - 0.5) * 120,
      })),
    [cansado],
  );

  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(onDone, 400);
  };

  return (
    <div
      className={`fixed inset-0 z-70 flex items-center justify-center overflow-hidden ${
        leaving ? "cd-overlay-out pointer-events-none" : "cd-vignette-in"
      }`}
      onClick={dismiss}
      role="alertdialog"
      aria-label={cansado ? "Agotamiento" : "Caída recuperada"}
    >
      {/* Viñeta */}
      <div
        className="absolute inset-0"
        style={{
          background: cansado
            ? "radial-gradient(ellipse at center, rgba(12,8,2,0.7) 0%, rgba(38,24,4,0.82) 60%, rgba(70,45,6,0.9) 100%)"
            : "radial-gradient(ellipse at center, rgba(2,12,9,0.62) 0%, rgba(4,34,26,0.76) 60%, rgba(6,62,46,0.86) 100%)",
        }}
      />
      <div
        className={`absolute inset-6 sm:inset-10 rounded-2xl border pointer-events-none ${
          cansado ? "border-amber-900/30" : "border-emerald-900/30"
        }`}
      />

      {/* Partículas */}
      {particles.map((p, i) =>
        cansado ? (
          <span
            key={i}
            className="est-mote absolute top-0 rounded-full bg-amber-300/70 pointer-events-none"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              boxShadow: "0 0 6px 1px rgba(251,191,36,0.4)",
              ["--est-delay" as string]: `${p.delay}s`,
              ["--est-duration" as string]: `${p.duration}s`,
              ["--est-drift" as string]: `${p.drift}px`,
            }}
          />
        ) : (
          <span
            key={i}
            className="cd-ember absolute bottom-0 rounded-full bg-emerald-400/80 pointer-events-none"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              boxShadow: "0 0 8px 2px rgba(16,185,129,0.5)",
              ["--cd-delay" as string]: `${p.delay}s`,
              ["--cd-duration" as string]: `${p.duration}s`,
              ["--cd-drift" as string]: `${p.drift}px`,
            }}
          />
        ),
      )}

      <div className="relative flex flex-col items-center gap-4 sm:gap-5 px-6 text-center">
        {cansado ? (
          <span className="est-drain inline-flex">
            <span className="est-weary-breath inline-flex">
              <Zap className="w-16 h-16 sm:w-20 sm:h-20 text-amber-400" />
            </span>
          </span>
        ) : (
          <span className="relative inline-flex items-center justify-center">
            {[0, 0.5].map((d) => (
              <span
                key={d}
                className="est-heal-ring absolute inset-0 rounded-full border-2 border-emerald-400/70 pointer-events-none"
                style={{ ["--est-delay" as string]: `${d}s` }}
              />
            ))}
            <span className="est-heal-pop inline-flex">
              <span className="est-heal-beat inline-flex">
                <HeartPulse className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-400" />
              </span>
            </span>
          </span>
        )}

        <h2
          className={`cd-overlay-title font-serif uppercase ${
            cansado ? "text-amber-400" : "text-emerald-400"
          }`}
          style={{ fontSize: "clamp(1.4rem, 5vw, 2.4rem)" }}
        >
          {cansado ? "Agotamiento" : "Te recuperas"}
        </h2>

        <div className="cd-overlay-sub flex flex-col items-center gap-3">
          {cansado ? (
            <>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: MAX_CANSANCIO }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-6 rounded-full border transition-colors ${
                      i < fx.cansancio
                        ? "bg-amber-400/80 border-amber-300/60"
                        : "bg-black/40 border-amber-900/40"
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm sm:text-base text-amber-100/85 font-sans max-w-md leading-relaxed">
                {fx.personajeNombre} acumula cansancio — nivel {fx.cansancio} de {MAX_CANSANCIO}.
                <span className="block mt-1 text-amber-400/90 italic">
                  {EFECTOS_CANSANCIO[Math.min(MAX_CANSANCIO, fx.cansancio)]}
                </span>
              </p>
              <p className="inline-flex items-center gap-1.5 text-xs text-foreground/50 font-sans">
                <Moon className="w-3.5 h-3.5 text-gold/70" />
                Un descanso largo aliviará un nivel.
              </p>
            </>
          ) : (
            <>
              <CaidasTracker caidas={fx.caidas} size="lg" />
              <p className="text-sm sm:text-base text-emerald-100/85 font-sans max-w-md leading-relaxed">
                {fx.personajeNombre} vuelve a ponerse en pie — quedan {fx.caidas} de {MAX_CAIDAS} caídas.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
