"use client";

// Animación de muerte del personaje: el alma abandona el cuerpo.

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Skull } from "lucide-react";
import ModalPortal from "@/components/ui/modal-portal";

export type AlmaFx = { tipo: "revivir" | "matar"; nombre: string };

// Se importa perezosamente el sfx para no cargar WebAudio hasta el momento.
import { playRevivirSfx, playMatarSfx } from "@/lib/sfx";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/**
 * Ceremonia a pantalla completa que ve el admin al revivir o matar a un
 * personaje. Se monta en <body> (ModalPortal) para escapar del modal de
 * personajes, que está animado y atraparía un `fixed`. Un toque o el temporizador
 * la cierran.
 */
export default function AlmaOverlay({ fx, onDone }: { fx: AlmaFx; onDone: () => void }) {
  const celestial = fx.tipo === "revivir";
  const [leaving, setLeaving] = useState(false);

  // onDone puede cambiar de identidad si el padre re-renderiza (p. ej. cuando el
  // toast de éxito se auto-cierra). Lo guardamos en un ref para que el efecto de
  // sonido/temporizadores corra UNA sola vez y no reproduzca el sfx doble.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (celestial) playRevivirSfx();
    else playMatarSfx();
    const visibleMs = celestial ? 3200 : 3400;
    const t1 = window.setTimeout(() => setLeaving(true), visibleMs);
    const t2 = window.setTimeout(() => onDoneRef.current(), visibleMs + 450);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // Solo al montar: fx es fijo para este montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Motas: ascienden doradas en la resurrección, caen como ceniza en la muerte.
  const motes = useMemo(
    () =>
      Array.from({ length: celestial ? 26 : 22 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.4,
        duration: (celestial ? 3.4 : 3.2) + Math.random() * 2.6,
        size: 2 + Math.random() * 4,
        drift: (Math.random() - 0.5) * 130,
      })),
    [celestial],
  );

  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(onDone, 450);
  };

  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 z-[130] flex items-center justify-center overflow-hidden ${
          leaving ? "cd-overlay-out pointer-events-none" : "cd-vignette-in"
        }`}
        onClick={dismiss}
        role="alertdialog"
        aria-label={celestial ? "Resurrección" : "Sentencia de muerte"}
      >
        {/* Fondo */}
        <div
          className="absolute inset-0"
          style={{
            background: celestial
              ? "radial-gradient(ellipse at center, rgba(60,48,18,0.55) 0%, rgba(20,14,4,0.82) 55%, rgba(4,3,1,0.96) 100%)"
              : "radial-gradient(ellipse at center, rgba(12,3,3,0.72) 0%, rgba(34,4,4,0.9) 55%, rgba(60,6,6,0.97) 100%)",
          }}
        />

        {/* Textura de grano */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: GRAIN }}
        />

        {/* Rayos divinos (solo resurrección) */}
        {celestial && (
          <div
            className="alm-rays absolute left-1/2 top-1/2 h-[170vmax] w-[170vmax] pointer-events-none"
            style={{
              background:
                "repeating-conic-gradient(from 0deg, rgba(255,238,180,0) 0deg, rgba(255,238,180,0.13) 2.5deg, rgba(255,238,180,0) 6deg)",
              maskImage: "radial-gradient(circle, black 0%, transparent 62%)",
              WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 62%)",
            }}
          />
        )}

        {/* Grietas rojas (solo muerte) */}
        {!celestial && (
          <div
            className="alm-crack-in absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Cg fill='none' stroke='%23ff2a2a' stroke-width='1.2' opacity='0.5'%3E%3Cpath d='M400 400 L250 120 M400 400 L520 90 M400 400 L120 300 M400 400 L700 260 M400 400 L180 620 M400 400 L620 660 M400 400 L440 780 M250 120 L200 40 M250 120 L320 60 M520 90 L560 20 M120 300 L30 260 M700 260 L780 200 M180 620 L90 700 M620 660 L710 730'/%3E%3C/g%3E%3C/svg%3E\")",
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "drop-shadow(0 0 6px rgba(220,40,40,0.6))",
            }}
          />
        )}

        {/* Anillo interior tenue */}
        <div
          className={`absolute inset-6 sm:inset-10 rounded-2xl border pointer-events-none ${
            celestial ? "border-amber-300/25" : "border-red-900/40"
          }`}
        />

        {/* Motas */}
        {motes.map((m, i) => (
          <span
            key={i}
            className={`${celestial ? "alm-rise" : "cd-ember"} absolute rounded-full pointer-events-none ${
              celestial ? "bottom-0 bg-amber-200/90" : "bottom-0 bg-red-500/80"
            }`}
            style={{
              left: `${m.left}%`,
              width: m.size,
              height: m.size,
              boxShadow: celestial
                ? "0 0 10px 2px rgba(255,225,140,0.7)"
                : "0 0 8px 2px rgba(220,60,40,0.55)",
              ...(celestial
                ? {
                    ["--alm-delay" as string]: `${m.delay}s`,
                    ["--alm-dur" as string]: `${m.duration}s`,
                    ["--alm-drift" as string]: `${m.drift}px`,
                  }
                : {
                    ["--cd-delay" as string]: `${m.delay}s`,
                    ["--cd-duration" as string]: `${m.duration}s`,
                    ["--cd-drift" as string]: `${m.drift}px`,
                  }),
            }}
          />
        ))}

        {/* Núcleo del ritual */}
        <div className={`relative flex flex-col items-center gap-4 sm:gap-5 px-6 text-center ${celestial ? "" : "cd-defeat-quake"}`}>
          <span className="relative inline-flex items-center justify-center">
            {celestial ? (
              <>
                {/* Halo radiante */}
                <span
                  className="alm-halo-in alm-halo-breathe absolute h-40 w-40 rounded-full pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(255,240,190,0.85) 0%, rgba(255,215,120,0.35) 40%, transparent 70%)",
                  }}
                />
                {[0, 0.6].map((d) => (
                  <span
                    key={d}
                    className="alm-ring absolute inset-0 rounded-full border-2 border-amber-200/70 pointer-events-none"
                    style={{ ["--alm-delay" as string]: `${d}s` }}
                  />
                ))}
                <Sparkles className="alm-icon-in relative w-20 h-20 sm:w-24 sm:h-24 text-amber-200" />
              </>
            ) : (
              <>
                <span className="cd-shockwave absolute inset-0 rounded-full border-2 border-red-600/70 pointer-events-none" />
                <Skull className="cd-overlay-skull relative w-24 h-24 sm:w-32 sm:h-32 text-red-500" />
              </>
            )}
          </span>

          <h2
            className={`cd-overlay-title font-serif uppercase ${celestial ? "text-amber-200" : "text-red-400"}`}
            style={{ fontSize: "clamp(1.6rem, 5.5vw, 2.9rem)" }}
          >
            {celestial ? "Resurrección" : "Sentencia cumplida"}
          </h2>

          <div className="cd-overlay-sub flex flex-col items-center gap-2">
            {celestial ? (
              <p className="text-sm sm:text-base text-amber-100/90 font-sans max-w-md leading-relaxed">
                <span className="font-semibold text-amber-200">{fx.nombre}</span> regresa del velo —
                la luz reclama lo que la muerte tomó.
              </p>
            ) : (
              <p className="text-sm sm:text-base text-red-200/90 font-sans max-w-md leading-relaxed">
                <span className="font-semibold text-red-300">{fx.nombre}</span> ha sido segado.
                Su vida cae a cero y el Nexo guarda su nombre.
              </p>
            )}
            <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans mt-1">
              Toca para continuar
            </p>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
