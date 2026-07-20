"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, Moon, UtensilsCrossed, Zap } from "lucide-react";
import type { DescansoPersonajeResultado } from "@/lib/types/sala";

type Props = {
  /** corto = respiro con raciones; largo = campamento completo. */
  tipo?: "corto" | "largo";
  /** Ej. "El grupo acampa y recupera fuerzas" o "Potter descansa en la Posada de ruta". */
  subtitulo: string;
  /** Personajes del descanso; vacío muestra solo la escena del campamento. */
  personajes: DescansoPersonajeResultado[];
  onDone: () => void;
};

/**
 * Campanada suave de "descanso conseguido" generada con WebAudio: cuatro notas
 * ascendentes (Do-Mi-Sol-Do) en seno con ataque y caída lentos. Sin assets.
 * Si el navegador bloquea el audio sin gesto previo, falla en silencio.
 */
function playRestChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const master = ctx.createGain();
    master.gain.value = 0.1;
    master.connect(ctx.destination);
    [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.4;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.8, t + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 1.9);
    });
    window.setTimeout(() => void ctx.close().catch(() => {}), 4200);
  } catch {
    // sin WebAudio o autoplay bloqueado: el overlay habla por sí solo
  }
}

/**
 * Escena serena a pantalla completa cuando el personaje descansa (largo):
 * noche estrellada, luna, fogata con ascuas y Zzz. Contraparte apacible del
 * CaidasOverlay dramático.
 */
export default function DescansoOverlay({ tipo = "largo", subtitulo, personajes, onDone }: Props) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    playRestChime();
    const t1 = window.setTimeout(() => setLeaving(true), 6200);
    const t2 = window.setTimeout(onDone, 6600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);

  const stars = useMemo(
    () =>
      Array.from({ length: 26 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 55,
        size: 1 + Math.random() * 2,
        delay: Math.random() * 3,
        duration: 2 + Math.random() * 2.5,
      })),
    [],
  );

  const embers = useMemo(
    () =>
      Array.from({ length: 12 }, () => ({
        left: 44 + Math.random() * 12,
        delay: Math.random() * 2.4,
        duration: 2.6 + Math.random() * 2,
        size: 2 + Math.random() * 3,
        drift: (Math.random() - 0.5) * 60,
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
      aria-label="Descanso largo"
    >
      {/* Noche cerrada: azul profundo hacia los bordes */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(8,10,22,0.92) 0%, rgba(6,8,18,0.95) 55%, rgba(2,3,10,0.98) 100%)",
        }}
      />
      <div className="absolute inset-6 sm:inset-10 rounded-2xl border border-gold-dim/20 pointer-events-none" />

      {/* Cielo estrellado */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="ds-star absolute rounded-full bg-parchment/90 pointer-events-none"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            ["--ds-delay" as string]: `${s.delay}s`,
            ["--ds-duration" as string]: `${s.duration}s`,
          }}
        />
      ))}

      {/* Luna en lo alto */}
      <Moon className="ds-moon absolute top-[8%] right-[12%] w-10 h-10 sm:w-14 sm:h-14 text-gold/80 pointer-events-none" />

      {/* Ascuas cálidas que suben desde la fogata */}
      {embers.map((e, i) => (
        <span
          key={i}
          className="cd-ember absolute bottom-[28%] rounded-full bg-amber-400/80 pointer-events-none"
          style={{
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            boxShadow: "0 0 8px 2px rgba(251, 191, 36, 0.45)",
            ["--cd-delay" as string]: `${e.delay}s`,
            ["--cd-duration" as string]: `${e.duration}s`,
            ["--cd-drift" as string]: `${e.drift}px`,
          }}
        />
      ))}

      <div className="relative flex flex-col items-center gap-4 sm:gap-5 px-6 text-center">
        {/* Fogata: resplandor + llama que ondea + Zzz */}
        <span className="relative inline-flex items-center justify-center">
          <span
            className="ds-fire-glow absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(251,146,60,0.35) 0%, rgba(251,146,60,0) 70%)" }}
          />
          <span className="ds-flame inline-block">
            <Flame
              className="w-16 h-16 sm:w-20 sm:h-20 text-amber-400"
              style={{ filter: "drop-shadow(0 0 14px rgba(251, 146, 60, 0.7))" }}
            />
          </span>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="ds-zzz absolute font-serif italic text-gold/80 pointer-events-none select-none"
              style={{
                left: `${62 + i * 10}%`,
                top: `${-4 - i * 8}%`,
                fontSize: `${0.8 + i * 0.25}rem`,
                ["--ds-delay" as string]: `${i * 0.7}s`,
              }}
            >
              z
            </span>
          ))}
        </span>

        <h2
          className="cd-overlay-title font-serif uppercase text-gold"
          style={{ fontSize: "clamp(1.5rem, 5vw, 2.6rem)" }}
        >
          {tipo === "corto" ? "Descanso corto" : "Descanso largo"}
        </h2>

        <p className="cd-overlay-sub text-sm sm:text-base text-parchment/80 font-sans max-w-md leading-relaxed">
          {subtitulo}
        </p>

        {personajes.length > 0 && (
          <div className="flex flex-col items-center gap-2 max-w-md">
            {personajes.map((p, i) => {
              // Eventos antiguos no traen el estado final: se infiere con la
              // regla de cada descanso.
              const caidasFinal =
                p.caidas ?? (tipo === "largo" ? 0 : Math.max(0, p.caidasPrevias - 1));
              const cansancioFinal =
                p.cansancio ??
                (tipo === "largo" ? Math.max(0, p.cansancioPrevio - 1) : p.cansancioPrevio);
              return (
                <div
                  key={p.personajeId}
                  className={`cd-overlay-sub flex items-center gap-2.5 flex-wrap justify-center rounded-full border px-4 py-1.5 ${
                    p.sinRacion
                      ? "border-red-900/60 bg-red-950/30"
                      : "border-emerald-900/50 bg-emerald-950/30"
                  }`}
                  style={{ animationDelay: `${0.7 + i * 0.15}s` }}
                >
                  <span className="text-sm font-semibold text-foreground">{p.nombre}</span>
                  {p.sinRacion ? (
                    <span className="inline-flex items-center gap-1 text-xs font-sans text-red-300/90">
                      <UtensilsCrossed className="w-3 h-3" />
                      Sin ración · cansancio {p.cansancioPrevio} → {cansancioFinal}
                    </span>
                  ) : (
                    <>
                      {p.caidasPrevias !== caidasFinal && (
                        <span className="inline-flex items-center gap-1 text-xs font-sans text-emerald-300/90">
                          <Moon className="w-3 h-3" />
                          Caídas {p.caidasPrevias} → {caidasFinal}
                        </span>
                      )}
                      {p.cansancioPrevio !== cansancioFinal && (
                        <span className="inline-flex items-center gap-1 text-xs font-sans text-amber-300/90">
                          <Zap className="w-3 h-3" />
                          Cansancio {p.cansancioPrevio} → {cansancioFinal}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="cd-overlay-sub text-[10px] uppercase tracking-widest text-foreground/40 font-sans mt-2" style={{ animationDelay: "1.2s" }}>
          Toca para continuar
        </p>
      </div>
    </div>
  );
}
