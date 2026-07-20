"use client";

import { useEffect, useMemo, useState } from "react";
import { Axe, Droplet } from "lucide-react";
import { playDesmembramientoSfx } from "@/lib/sfx";
import type { EventoDesmembramiento } from "@/lib/types/sala";

type Props = {
  evento: EventoDesmembramiento;
  onDone: () => void;
};

/**
 * Tajo dramático a pantalla completa cuando un personaje pierde un miembro.
 * Solo se muestra para la pérdida; la recuperación queda en el feed.
 */
export default function DesmembramientoOverlay({ evento, onDone }: Props) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    playDesmembramientoSfx();
    const t1 = window.setTimeout(() => setLeaving(true), 3600);
    const t2 = window.setTimeout(onDone, 4000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);

  const drops = useMemo(
    () =>
      Array.from({ length: 18 }, () => ({
        left: 20 + Math.random() * 60,
        top: 18 + Math.random() * 25,
        delay: Math.random() * 1.6,
        duration: 1.6 + Math.random() * 1.6,
        size: 3 + Math.random() * 4,
        drift: (Math.random() - 0.5) * 80,
      })),
    [],
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
      aria-label="Desmembramiento"
    >
      {/* Viñeta carmesí */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(12,3,3,0.82) 0%, rgba(40,6,8,0.9) 55%, rgba(80,10,14,0.96) 100%)",
        }}
      />
      <div className="absolute inset-6 sm:inset-10 rounded-2xl border border-rose-900/30 pointer-events-none" />

      {/* Tajo diagonal que cruza la pantalla */}
      <div
        className="dm-slash absolute left-[-10%] top-1/2 w-[120%] h-[3px] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,220,220,0.95) 20%, rgba(244,63,94,0.9) 50%, rgba(255,220,220,0.95) 80%, transparent)",
          boxShadow: "0 0 18px 4px rgba(244, 63, 94, 0.6)",
        }}
      />

      {/* Gotas de sangre */}
      {drops.map((d, i) => (
        <span
          key={i}
          className="dm-blood absolute rounded-full bg-rose-600/90 pointer-events-none"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size * 1.4,
            boxShadow: "0 0 6px 1px rgba(225, 29, 72, 0.5)",
            ["--dm-delay" as string]: `${d.delay}s`,
            ["--dm-duration" as string]: `${d.duration}s`,
            ["--dm-drift" as string]: `${d.drift}px`,
          }}
        />
      ))}

      <div className="relative flex flex-col items-center gap-4 sm:gap-5 px-6 text-center cd-defeat-quake">
        <span className="dm-axe-in inline-block">
          <Axe
            className="w-20 h-20 sm:w-24 sm:h-24 text-rose-400"
            style={{ filter: "drop-shadow(0 0 18px rgba(244, 63, 94, 0.7))" }}
          />
        </span>

        <h2
          className="cd-overlay-title font-serif uppercase text-rose-400"
          style={{ fontSize: "clamp(1.6rem, 5.5vw, 2.8rem)" }}
        >
          ¡Desmembrado!
        </h2>

        <div className="cd-overlay-sub flex flex-col items-center gap-2">
          <p className="text-sm sm:text-base text-rose-200/90 font-sans max-w-md leading-relaxed">
            <span className="font-semibold text-foreground">{evento.personajeNombre}</span> pierde{" "}
            <span className="text-rose-400 font-bold">{evento.miembroLabel}</span>.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-foreground/50 font-sans">
            <Droplet className="w-3.5 h-3.5 text-rose-500" />
            La herida lo acompañará hasta que sane.
          </p>
        </div>

        <p className="cd-overlay-sub text-[10px] uppercase tracking-widest text-foreground/40 font-sans mt-2">
          Toca para continuar
        </p>
      </div>
    </div>
  );
}
