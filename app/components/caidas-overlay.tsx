"use client";

// Aviso a pantalla completa cuando un personaje suma una caída.

import { useEffect, useMemo, useState } from "react";
import { Skull, Moon } from "lucide-react";
import { MAX_CAIDAS, CANSANCIO_POR_DERROTA } from "@/lib/caidas";
import { playCaidaSfx, playDerrotaSfx } from "@/lib/sfx";
import type { EventoCaida } from "@/lib/types/sala";
import CaidasTracker from "@/app/components/caidas-tracker";
import HuesoRoto from "@/app/components/hueso-roto";

type Props = {
  evento: EventoCaida;
  /** true si el personaje caído es el del propio jugador (segunda persona);
   *  false para el resto de la sala y el DM (tercera persona, con nombre). */
  esPropio: boolean;
  onDone: () => void;
};

/**
 * Aviso dramático a pantalla completa cuando un personaje cae. Lo ve TODA la
 * sala, así que el texto se dirige en segunda persona solo al dueño del
 * personaje ("¡Has caído!") y nombra al personaje para los demás
 * ("¡{nombre} ha caído!"), evitando que a otros les parezca que cayeron ellos.
 * Con menos de 3 caídas es un destello breve; con la tercera, la derrota.
 */
export default function CaidasOverlay({ evento, esPropio, onDone }: Props) {
  const defeat = evento.derrotado || evento.caidas >= MAX_CAIDAS;
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (defeat) playDerrotaSfx();
    else playCaidaSfx();
    const visibleMs = defeat ? 5600 : 2700;
    const t1 = window.setTimeout(() => setLeaving(true), visibleMs);
    const t2 = window.setTimeout(onDone, visibleMs + 400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [defeat, onDone]);

  const embers = useMemo(
    () =>
      Array.from({ length: defeat ? 26 : 10 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.2,
        duration: 2.4 + Math.random() * 2.6,
        size: 2 + Math.random() * 4,
        drift: (Math.random() - 0.5) * 140,
      })),
    [defeat],
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
      aria-label={
        defeat
          ? esPropio
            ? "Derrotado"
            : `${evento.personajeNombre} derrotado`
          : esPropio
            ? "Has caído"
            : `${evento.personajeNombre} ha caído`
      }
    >
      {/* Viñeta de sangre */}
      <div
        className="absolute inset-0"
        style={{
          background: defeat
            ? "radial-gradient(ellipse at center, rgba(10,4,4,0.88) 0%, rgba(30,5,5,0.94) 55%, rgba(60,8,8,0.97) 100%)"
            : "radial-gradient(ellipse at center, rgba(10,4,4,0.55) 0%, rgba(30,5,5,0.7) 60%, rgba(90,12,12,0.85) 100%)",
        }}
      />
      {/* Anillo interior tenue estilo grimorio */}
      <div className="absolute inset-6 sm:inset-10 rounded-2xl border border-red-900/30 pointer-events-none" />

      {/* Ascuas */}
      {embers.map((e, i) => (
        <span
          key={i}
          className="cd-ember absolute bottom-0 rounded-full bg-red-500/80 pointer-events-none"
          style={{
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            boxShadow: "0 0 8px 2px rgba(220,60,40,0.55)",
            ["--cd-delay" as string]: `${e.delay}s`,
            ["--cd-duration" as string]: `${e.duration}s`,
            ["--cd-drift" as string]: `${e.drift}px`,
          }}
        />
      ))}

      <div className={`relative flex flex-col items-center gap-4 sm:gap-5 px-6 text-center ${defeat ? "cd-defeat-quake" : ""}`}>
        {defeat ? (
          <Skull className="cd-overlay-skull text-red-500 w-24 h-24 sm:w-32 sm:h-32" />
        ) : (
          <span className="relative inline-flex items-center justify-center">
            <span className="cd-shockwave absolute inset-0 rounded-full border-2 border-red-500/70 pointer-events-none" />
            <span className="cd-fall-explode inline-block">
              <span
                className="cd-fall-wobble inline-block"
                style={{ filter: "drop-shadow(0 0 16px rgba(220, 38, 38, 0.65))" }}
              >
                <HuesoRoto className="w-16 h-16 sm:w-20 sm:h-20 text-red-400" />
              </span>
            </span>
          </span>
        )}

        <h2
          className="cd-overlay-title font-serif uppercase text-red-400"
          style={{ fontSize: defeat ? "clamp(1.8rem, 6vw, 3.2rem)" : "clamp(1.4rem, 5vw, 2.4rem)" }}
        >
          {defeat
            ? esPropio
              ? "Derrotado"
              : `${evento.personajeNombre} derrotado`
            : esPropio
              ? "¡Has caído!"
              : `¡${evento.personajeNombre} ha caído!`}
        </h2>

        <div className="cd-overlay-sub flex flex-col items-center gap-3">
          <CaidasTracker caidas={evento.caidas} size="lg" />
          {defeat ? (
            <>
              <p className="text-sm sm:text-base text-red-200/90 font-sans max-w-md leading-relaxed">
                {evento.personajeNombre} pierde la expedición y el Nexo lo reclama.
                Se retira con <span className="text-red-400 font-semibold">+{CANSANCIO_POR_DERROTA} punto de cansancio</span>.
              </p>
              <p className="inline-flex items-center gap-1.5 text-xs text-foreground/50 font-sans">
                <Moon className="w-3.5 h-3.5 text-gold/70" />
                Solo un descanso largo restaurará sus caídas.
              </p>
            </>
          ) : (
            <p className="text-sm sm:text-base text-red-200/80 font-sans max-w-md leading-relaxed">
              {evento.personajeNombre} muerde el polvo — caída {evento.caidas} de {MAX_CAIDAS}.
              {evento.caidas === MAX_CAIDAS - 1 && (
                <span className="block mt-1 text-red-400/90 italic">
                  Una más y la expedición {esPropio ? "te" : "lo"} perderá…
                </span>
              )}
            </p>
          )}
        </div>

        {defeat && (
          <p className="cd-overlay-sub text-[10px] uppercase tracking-widest text-foreground/40 font-sans mt-2">
            Toca para continuar
          </p>
        )}
      </div>
    </div>
  );
}
