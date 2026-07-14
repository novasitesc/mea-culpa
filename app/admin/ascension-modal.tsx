"use client";

import { useCallback, useEffect, useMemo } from "react";
import { Crown, X, Sparkles, Loader2, ShieldAlert, ScrollText } from "lucide-react";
import {
  useModalTransition,
  modalOverlayCls,
  modalPanelCls,
} from "@/lib/useModalTransition";
import { useSealRitual, type RitualPhase } from "./use-seal-ritual";

export type AscensionTarget = {
  id: string;
  name: string;
  email: string;
};

/**
 * Emblema central: medallón con anillos de runas, escudo y corona.
 * Reacciona al `charge` (zoom + brillo) y al `phase`.
 */
function AscensionEmblem({
  charge,
  phase,
}: {
  charge: number;
  phase: RitualPhase;
}) {
  const runes = "ᛝᚨᛞᛗᛁᚾᛟᚱᛃᛖᛚᚷᚹ";
  return (
    <div className="relative flex items-center justify-center w-44 h-44 select-none">
      {/* Halo */}
      <div
        className="absolute inset-0 rounded-full asc-pulse-glow"
        style={{
          background:
            "radial-gradient(circle, rgba(212,175,55,0.35), rgba(212,175,55,0.08) 55%, transparent 70%)",
          transform: `scale(${1 + charge * 0.35})`,
        }}
      />

      {/* Anillo de runas exterior */}
      <div className="absolute inset-0 asc-rune-spin">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle
            cx="100"
            cy="100"
            r="92"
            fill="none"
            stroke="rgba(212,175,55,0.35)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />
          {runes.split("").map((r, i) => {
            const a = (i / runes.length) * Math.PI * 2;
            const x = 100 + Math.cos(a) * 82;
            const y = 100 + Math.sin(a) * 82;
            return (
              <text
                key={i}
                x={x}
                y={y}
                fontSize="11"
                fill="rgba(212,175,55,0.7)"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {r}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Anillo interior contrarrotatorio */}
      <div className="absolute inset-4 asc-rune-spin-rev">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle
            cx="100"
            cy="100"
            r="78"
            fill="none"
            stroke="rgba(200,217,255,0.28)"
            strokeWidth="1.5"
            strokeDasharray="1 10"
          />
        </svg>
      </div>

      {/* Medallón central */}
      <div
        className="relative w-24 h-24 rounded-full flex items-center justify-center border-2"
        style={{
          borderColor: "rgba(212,175,55,0.75)",
          background:
            "radial-gradient(circle at 50% 30%, #2a2410, #14100a 70%)",
          boxShadow: `0 0 ${20 + charge * 40}px rgba(212,175,55,${
            0.3 + charge * 0.5
          }), inset 0 0 22px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Escudo */}
        <svg viewBox="0 0 48 48" className="w-14 h-14 drop-shadow">
          <defs>
            <linearGradient id="ascShield" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4d67a" />
              <stop offset="55%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#8a6a15" />
            </linearGradient>
          </defs>
          <path
            d="M24 4 L40 9 V24 C40 34 32 41 24 44 C16 41 8 34 8 24 V9 Z"
            fill="url(#ascShield)"
            stroke="rgba(255,240,200,0.7)"
            strokeWidth="1"
          />
          {/* Corona grabada */}
          <path
            d="M16 24 L18 17 L21.5 21 L24 15 L26.5 21 L30 17 L32 24 Z"
            fill="#14100a"
            opacity="0.85"
          />
          <rect x="16" y="25" width="16" height="2.4" rx="1" fill="#14100a" opacity="0.85" />
        </svg>

        {/* Destello barrido */}
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div
            className="absolute top-0 left-0 h-full w-1/3 asc-shine"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,245,210,0.45), transparent)",
            }}
          />
        </div>
      </div>

      {/* Corona flotante encima cuando hay éxito */}
      {phase === "success" && (
        <div className="absolute -top-3 asc-reveal-pop">
          <Crown className="w-8 h-8 text-gold drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]" />
        </div>
      )}
    </div>
  );
}

export default function AscensionModal({
  user,
  token,
  onClose,
  onPromoted,
}: {
  user: AscensionTarget;
  token: string | null;
  onClose: () => void;
  onPromoted: (updated: unknown) => void;
}) {
  const { closing, closeWith } = useModalTransition();

  const perform = useCallback(async () => {
    const res = await fetch(`/api/admin/users?id=${user.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rolSistema: "admin" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string })?.error };
    }
    onPromoted(data);
    return { ok: true };
  }, [token, user.id, onPromoted]);

  const {
    phase,
    charge,
    tilt,
    errorMsg,
    chargingRef,
    startCharge,
    cancelCharge,
    beginSealing,
    onEmblemMove,
    resetTilt,
    reset,
  } = useSealRitual({ perform });

  const handleClose = () => {
    if (phase === "sealing") return; // no cerrar durante el sellado
    closeWith(onClose);
  };

  // Escape para cerrar (salvo durante el sellado)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Partículas de brasas (memoizadas)
  const embers = useMemo(
    () =>
      Array.from({ length: 16 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 3.5 + Math.random() * 3,
        scale: 0.6 + Math.random() * 1.2,
      })),
    [],
  );

  // Chispas del estallido de éxito
  const sparks = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const dist = 70 + Math.random() * 60;
        return {
          sx: Math.cos(a) * dist,
          sy: Math.sin(a) * dist,
          delay: Math.random() * 0.15,
        };
      }),
    [],
  );

  const isSealing = phase === "sealing";

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md ${modalOverlayCls(
        closing,
      )}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`asc-grain asc-vignette relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-gold-dim/70 bg-gradient-to-b from-[#171208] to-[#0c0a06] shadow-[0_0_60px_rgba(0,0,0,0.8)] ${modalPanelCls(
          closing,
        )} ${isSealing ? "asc-shake" : ""}`}
      >
        {/* Filo superior brillante */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-80" />

        {/* Ornamentos de esquina */}
        {[
          "top-2 left-2",
          "top-2 right-2 rotate-90",
          "bottom-2 right-2 rotate-180",
          "bottom-2 left-2 -rotate-90",
        ].map((pos) => (
          <div
            key={pos}
            className={`absolute ${pos} w-6 h-6 border-t-2 border-l-2 border-gold/40 pointer-events-none`}
          />
        ))}

        {/* Brasas flotantes */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {embers.map((em, i) => (
            <span
              key={i}
              className="asc-ember"
              style={{
                left: `${em.left}%`,
                animationDelay: `${em.delay}s`,
                animationDuration: `${em.duration}s`,
                transform: `scale(${em.scale})`,
              }}
            />
          ))}
        </div>

        {/* Botón cerrar */}
        {!isSealing && (
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full text-gold/60 hover:text-gold hover:bg-gold/10 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="relative z-10 flex flex-col items-center px-6 pt-8 pb-6 text-center">
          {/* Encabezado */}
          <div className="flex items-center gap-2 text-gold/80">
            <ScrollText className="w-4 h-4" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase">
              Decreto de Ascensión
            </span>
          </div>

          {/* Emblema con zoom interactivo (perspectiva) */}
          <div
            className="mt-5 mb-4"
            style={{ perspective: "700px" }}
            onPointerMove={onEmblemMove}
            onPointerLeave={() => {
              resetTilt();
              cancelCharge();
            }}
          >
            <div
              className={phase === "idle" ? "asc-float" : ""}
              style={{
                transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${
                  1 + charge * 0.16
                })`,
                filter: `brightness(${1 + charge * 0.5}) saturate(${
                  1 + charge * 0.4
                })`,
                transition: chargingRef.current
                  ? "none"
                  : "transform 0.3s ease, filter 0.3s ease",
              }}
            >
              <div className={isSealing ? "asc-stamp" : ""}>
                <AscensionEmblem charge={charge} phase={phase} />
              </div>
            </div>
          </div>

          {/* ── Contenido por fase ── */}
          {phase === "idle" && (
            <>
              <h3 className="font-serif text-xl text-gold">
                Elevar a{" "}
                <span className="text-parchment">{user.name}</span>
              </h3>
              <p className="mt-2 text-sm text-foreground/60 leading-relaxed max-w-xs">
                Le conferirás el título de{" "}
                <span className="text-gold/90 font-semibold">Administrador</span>,
                otorgándole acceso a las funciones de gestión del sistema y la
                capacidad de supervisar a otros usuarios. Asegúrate de que esta
                persona sea digna de tal honor.
              </p>
              <p className="mt-1 text-[11px] text-foreground/35">{user.email}</p>

              {/* Sello: mantener pulsado */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {}
                  startCharge();
                }}
                onPointerUp={cancelCharge}
                onPointerCancel={cancelCharge}
                onClick={(e) => {
                  if (e.detail === 0) beginSealing();
                }}
                className="group relative mt-6 w-full overflow-hidden rounded-xl border-2 border-gold/50 bg-gradient-to-b from-gold/20 to-gold/5 px-5 py-3.5 font-serif text-gold transition-colors hover:border-gold hover:from-gold/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
                aria-label={`Mantén pulsado para nombrar administrador a ${user.name}`}
              >
                {/* Relleno de carga */}
                <span
                  className="absolute inset-y-0 left-0 bg-gold/25"
                  style={{ width: `${charge * 100}%` }}
                />
                {/* Brillo de borde al cargar */}
                <span
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{
                    boxShadow: `inset 0 0 ${charge * 30}px rgba(212,175,55,${
                      charge * 0.6
                    })`,
                  }}
                />
                <span className="relative flex items-center justify-center gap-2 text-sm font-semibold tracking-wide">
                  <Sparkles className="w-4 h-4" />
                  {charge > 0.02 && charge < 1
                    ? "Sellando…"
                    : "Mantén pulsado para sellar"}
                </span>
              </button>
              <p className="mt-2 text-[10px] text-foreground/30 tracking-wide">
                Mantén el sello presionado hasta completar el círculo
              </p>
            </>
          )}

          {phase === "sealing" && (
            <div className="asc-reveal-pop">
              <h3 className="font-serif text-xl text-gold flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Grabando el sello
              </h3>
              <p className="mt-2 text-sm text-foreground/60">
                Inscribiendo el nombre de{" "}
                <span className="text-parchment">{user.name}</span> en los anales
                del Consejo
                <span className="asc-dots" />
              </p>
              {/* Barra de progreso indeterminada con textura */}
              <div className="relative mt-5 h-2 w-64 max-w-full mx-auto overflow-hidden rounded-full border border-gold/30 bg-black/50">
                <div
                  className="absolute inset-y-0 w-1/2 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(212,175,55,0.9), transparent)",
                    animation: "asc-shine-sweep 1.1s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          )}

          {phase === "success" && (
            <div className="relative asc-reveal-pop">
              {/* Estallido */}
              <div className="pointer-events-none absolute left-1/2 -top-24 -translate-x-1/2">
                <div
                  className="asc-burst absolute w-24 h-24 rounded-full -translate-x-1/2 -translate-y-1/2"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(212,175,55,0.8), transparent 70%)",
                  }}
                />
                {sparks.map((s, i) => (
                  <span
                    key={i}
                    className="asc-spark absolute w-1.5 h-1.5 rounded-full bg-gold -translate-x-1/2 -translate-y-1/2"
                    style={
                      {
                        "--sx": `${s.sx}px`,
                        "--sy": `${s.sy}px`,
                        animationDelay: `${s.delay}s`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>

              <h3 className="font-serif text-2xl text-gold drop-shadow-[0_0_12px_rgba(212,175,55,0.5)]">
                ¡Ascensión consumada!
              </h3>
              <p className="mt-2 text-sm text-foreground/70">
                <span className="text-parchment font-semibold">{user.name}</span>{" "}
                ahora forma parte de la{" "}
                <span className="text-gold">Orden de Administradores</span>.
              </p>
              <button
                onClick={handleClose}
                className="mt-6 w-full rounded-xl border-2 border-gold/60 bg-gradient-to-b from-gold/25 to-gold/5 px-5 py-3 font-serif text-sm font-semibold text-gold transition-colors hover:border-gold hover:from-gold/35"
              >
                Que así conste
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="asc-reveal-pop">
              <div className="mx-auto mb-1 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-blood" />
              </div>
              <h3 className="font-serif text-xl text-blood">
                El sello fue rechazado
              </h3>
              <p className="mt-2 text-sm text-foreground/60">{errorMsg}</p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={reset}
                  className="flex-1 rounded-xl border-2 border-gold/50 bg-gold/15 px-4 py-2.5 text-sm font-semibold text-gold hover:border-gold hover:bg-gold/25 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
