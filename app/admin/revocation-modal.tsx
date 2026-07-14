"use client";

import { useCallback, useEffect, useMemo } from "react";
import { X, Flame, Loader2, ShieldAlert, ScrollText, ShieldOff } from "lucide-react";
import {
  useModalTransition,
  modalOverlayCls,
  modalPanelCls,
} from "@/lib/useModalTransition";
import { useSealRitual, type RitualPhase } from "./use-seal-ritual";

export type RevocationTarget = {
  id: string;
  name: string;
  email: string;
};

/**
 * Emblema central de la revocación: escudo con corona que se agrieta según
 * `charge` y se fractura al sellar. Contraparte sombría del de ascensión.
 */
function RevocationEmblem({
  charge,
  phase,
}: {
  charge: number;
  phase: RitualPhase;
}) {
  const runes = "ᛏᚺᚨᚷᛉᛇᛞᛜᛃᛖᛊᛦ";
  const broken = phase === "sealing" || phase === "success" || phase === "error";
  const crackOpacity = broken ? 1 : charge;
  return (
    <div className="relative flex items-center justify-center w-44 h-44 select-none">
      {/* Halo rojizo */}
      <div
        className="absolute inset-0 rounded-full rev-pulse-glow"
        style={{
          background:
            "radial-gradient(circle, rgba(139,0,0,0.4), rgba(139,0,0,0.08) 55%, transparent 70%)",
          transform: `scale(${1 + charge * 0.3})`,
        }}
      />

      {/* Anillo de runas exterior (rojo, girando) */}
      <div className="absolute inset-0 asc-rune-spin">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle
            cx="100"
            cy="100"
            r="92"
            fill="none"
            stroke="rgba(180,60,50,0.4)"
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
                fill="rgba(200,90,80,0.7)"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {r}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Anillo interior contrarrotatorio (ceniza) */}
      <div className="absolute inset-4 asc-rune-spin-rev">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle
            cx="100"
            cy="100"
            r="78"
            fill="none"
            stroke="rgba(150,140,135,0.25)"
            strokeWidth="1.5"
            strokeDasharray="1 10"
          />
        </svg>
      </div>

      {/* Medallón central */}
      <div
        className="relative w-24 h-24 rounded-full flex items-center justify-center border-2"
        style={{
          borderColor: "rgba(150,45,40,0.75)",
          background: "radial-gradient(circle at 50% 30%, #2a1410, #140a0a 70%)",
          boxShadow: `0 0 ${18 + charge * 34}px rgba(139,0,0,${
            0.3 + charge * 0.45
          }), inset 0 0 22px rgba(0,0,0,0.85)`,
        }}
      >
        {/* Escudo (se desatura con la carga) */}
        <svg
          viewBox="0 0 48 48"
          className="w-14 h-14"
          style={{ filter: `saturate(${1 - charge * 0.6}) brightness(${1 - charge * 0.2})` }}
        >
          <defs>
            <linearGradient id="revShield" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c98b6a" />
              <stop offset="55%" stopColor="#9a4a37" />
              <stop offset="100%" stopColor="#5a2418" />
            </linearGradient>
          </defs>
          <path
            d="M24 4 L40 9 V24 C40 34 32 41 24 44 C16 41 8 34 8 24 V9 Z"
            fill="url(#revShield)"
            stroke="rgba(255,220,200,0.5)"
            strokeWidth="1"
          />
          {/* Corona grabada rota (le falta la punta central) */}
          <path
            d="M16 24 L18 17 L21.5 21 L24 18 L26.5 21 L30 17 L32 24 Z"
            fill="#140a0a"
            opacity="0.85"
          />
          <rect x="16" y="25" width="16" height="2.4" rx="1" fill="#140a0a" opacity="0.85" />

          {/* Grietas — aparecen con la carga */}
          <g
            stroke="#140a0a"
            strokeWidth="1.3"
            fill="none"
            strokeLinecap="round"
            style={{ opacity: crackOpacity }}
          >
            <path d="M24 6 L22 16 L26 22 L23 30 L25 40" />
            <path d="M22 16 L15 14" />
            <path d="M26 22 L33 20" />
            <path d="M23 30 L16 31" />
          </g>
          {/* Reflejo de la grieta */}
          <g
            stroke="rgba(255,120,90,0.6)"
            strokeWidth="0.5"
            fill="none"
            strokeLinecap="round"
            style={{ opacity: crackOpacity }}
          >
            <path d="M24 6 L22 16 L26 22 L23 30 L25 40" />
          </g>
        </svg>
      </div>

      {/* Icono de destitución encima cuando hay éxito */}
      {phase === "success" && (
        <div className="absolute -top-3 asc-reveal-pop">
          <ShieldOff className="w-8 h-8 text-blood drop-shadow-[0_0_10px_rgba(139,0,0,0.9)]" />
        </div>
      )}
    </div>
  );
}

export default function RevocationModal({
  user,
  token,
  onClose,
  onRevoked,
}: {
  user: RevocationTarget;
  token: string | null;
  onClose: () => void;
  onRevoked: (updated: unknown) => void;
}) {
  const { closing, closeWith } = useModalTransition();

  const perform = useCallback(async () => {
    const res = await fetch(`/api/admin/users?id=${user.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rolSistema: "usuario" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string })?.error };
    }
    onRevoked(data);
    return { ok: true };
  }, [token, user.id, onRevoked]);

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
    if (phase === "sealing") return;
    closeWith(onClose);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Ceniza cayendo (memoizada)
  const ashes = useMemo(
    () =>
      Array.from({ length: 18 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 6,
        duration: 4.5 + Math.random() * 3.5,
        scale: 0.5 + Math.random() * 1.1,
      })),
    [],
  );

  // Esquirlas del sello al romperse
  const shards = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 60 + Math.random() * 70;
        return {
          sx: Math.cos(a) * dist,
          sy: Math.sin(a) * dist + 20, // sesgo hacia abajo: caen
          sr: (Math.random() - 0.5) * 260,
          delay: Math.random() * 0.12,
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
        className={`asc-grain rev-vignette relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-blood/60 bg-gradient-to-b from-[#170c0a] to-[#0b0706] shadow-[0_0_60px_rgba(0,0,0,0.85)] ${modalPanelCls(
          closing,
        )} ${isSealing ? "rev-shudder" : ""}`}
      >
        {/* Filo superior sangriento */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blood to-transparent opacity-80" />

        {/* Ornamentos de esquina */}
        {[
          "top-2 left-2",
          "top-2 right-2 rotate-90",
          "bottom-2 right-2 rotate-180",
          "bottom-2 left-2 -rotate-90",
        ].map((pos) => (
          <div
            key={pos}
            className={`absolute ${pos} w-6 h-6 border-t-2 border-l-2 border-blood/40 pointer-events-none`}
          />
        ))}

        {/* Ceniza cayendo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {ashes.map((as, i) => (
            <span
              key={i}
              className="rev-ash"
              style={{
                left: `${as.left}%`,
                animationDelay: `${as.delay}s`,
                animationDuration: `${as.duration}s`,
                transform: `scale(${as.scale})`,
              }}
            />
          ))}
        </div>

        {/* Botón cerrar */}
        {!isSealing && (
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full text-blood/70 hover:text-blood hover:bg-blood/10 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="relative z-10 flex flex-col items-center px-6 pt-8 pb-6 text-center">
          {/* Encabezado */}
          <div className="flex items-center gap-2 text-blood/80">
            <ScrollText className="w-4 h-4" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase">
              Decreto de Destitución
            </span>
          </div>

          {/* Emblema con zoom interactivo */}
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
                transition: chargingRef.current
                  ? "none"
                  : "transform 0.3s ease, filter 0.3s ease",
              }}
            >
              <div className={isSealing ? "rev-shatter" : ""}>
                <RevocationEmblem charge={charge} phase={phase} />
              </div>
            </div>
          </div>

          {/* ── Contenido por fase ── */}
          {phase === "idle" && (
            <>
              <h3 className="font-serif text-xl text-blood">
                Destituir a <span className="text-parchment">{user.name}</span>
              </h3>
              <p className="mt-2 text-sm text-foreground/60 leading-relaxed max-w-xs">
                Le despojarás del título de{" "}
                <span className="text-blood/90 font-semibold">Administrador</span> y
                de todos sus poderes en el Consejo. Volverá a ser un ciudadano común
                del reino.
              </p>
              <p className="mt-1 text-[11px] text-foreground/35">{user.email}</p>

              {/* Sello: mantener pulsado para romper */}
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
                className="group relative mt-6 w-full overflow-hidden rounded-xl border-2 border-blood/60 bg-gradient-to-b from-blood/25 to-blood/5 px-5 py-3.5 font-serif text-blood transition-colors hover:border-blood focus:outline-none focus:ring-2 focus:ring-blood/50"
                aria-label={`Mantén pulsado para revocar el rol de administrador de ${user.name}`}
              >
                {/* Relleno de carga */}
                <span
                  className="absolute inset-y-0 left-0 bg-blood/30"
                  style={{ width: `${charge * 100}%` }}
                />
                {/* Brillo de borde al cargar */}
                <span
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{
                    boxShadow: `inset 0 0 ${charge * 30}px rgba(139,0,0,${
                      charge * 0.7
                    })`,
                  }}
                />
                <span className="relative flex items-center justify-center gap-2 text-sm font-semibold tracking-wide text-red-200">
                  <Flame className="w-4 h-4" />
                  {charge > 0.02 && charge < 1
                    ? "Rompiendo el sello…"
                    : "Mantén pulsado para romper el sello"}
                </span>
              </button>
              <p className="mt-2 text-[10px] text-foreground/30 tracking-wide">
                Mantén el sello presionado hasta que se quiebre
              </p>
            </>
          )}

          {phase === "sealing" && (
            <div className="asc-reveal-pop">
              <h3 className="font-serif text-xl text-blood flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Rompiendo el sello
              </h3>
              <p className="mt-2 text-sm text-foreground/60">
                Borrando el nombre de{" "}
                <span className="text-parchment">{user.name}</span> de la Orden de
                Administradores
                <span className="asc-dots" />
              </p>
              <div className="relative mt-5 h-2 w-64 max-w-full mx-auto overflow-hidden rounded-full border border-blood/40 bg-black/50">
                <div
                  className="absolute inset-y-0 w-1/2 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(180,30,30,0.95), transparent)",
                    animation: "asc-shine-sweep 1.1s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          )}

          {phase === "success" && (
            <div className="relative asc-reveal-pop">
              {/* Esquirlas cayendo */}
              <div className="pointer-events-none absolute left-1/2 -top-24 -translate-x-1/2">
                {shards.map((s, i) => (
                  <span
                    key={i}
                    className="rev-shard absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2"
                    style={
                      {
                        "--sx": `${s.sx}px`,
                        "--sy": `${s.sy}px`,
                        "--sr": `${s.sr}deg`,
                        animationDelay: `${s.delay}s`,
                        background:
                          "linear-gradient(135deg, #9a4a37, #3a1a12)",
                        clipPath: "polygon(50% 0, 100% 60%, 30% 100%)",
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>

              <h3 className="font-serif text-2xl text-blood drop-shadow-[0_0_12px_rgba(139,0,0,0.5)]">
                Título revocado
              </h3>
              <p className="mt-2 text-sm text-foreground/70">
                <span className="text-parchment font-semibold">{user.name}</span>{" "}
                vuelve a ser un{" "}
                <span className="text-foreground/80">ciudadano común</span> del
                reino.
              </p>
              <button
                onClick={handleClose}
                className="mt-6 w-full rounded-xl border-2 border-blood/60 bg-gradient-to-b from-blood/25 to-blood/5 px-5 py-3 font-serif text-sm font-semibold text-red-200 transition-colors hover:border-blood"
              >
                Que así se cumpla
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="asc-reveal-pop">
              <div className="mx-auto mb-1 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-blood" />
              </div>
              <h3 className="font-serif text-xl text-blood">
                El sello resistió
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
                  className="flex-1 rounded-xl border-2 border-blood/60 bg-blood/15 px-4 py-2.5 text-sm font-semibold text-red-200 hover:border-blood hover:bg-blood/25 transition-colors"
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
