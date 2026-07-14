"use client";

import { useEffect, useRef, useState } from "react";
import { Hourglass } from "lucide-react";

const COOLDOWN_TOTAL_SECONDS = 24 * 60 * 60;

// Cuenta atrás local anclada a los segundos que reportó el servidor: no hace
// polling ni depende del reloj del cliente (solo de su avance relativo).
function useCountdown(secondsRemaining: number, onExpire?: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor(secondsRemaining)),
  );
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const expiredRef = useRef(false);

  useEffect(() => {
    const target = Date.now() + Math.max(0, Math.floor(secondsRemaining)) * 1000;
    const tick = () => Math.max(0, Math.round((target - Date.now()) / 1000));
    setSecondsLeft(tick());
    if (tick() <= 0) return;

    const id = window.setInterval(() => {
      const remaining = tick();
      setSecondsLeft(remaining);
      if (remaining <= 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [secondsRemaining]);

  useEffect(() => {
    if (secondsLeft > 0) {
      expiredRef.current = false;
      return;
    }
    if (secondsRemaining > 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current?.();
    }
  }, [secondsLeft, secondsRemaining]);

  return secondsLeft;
}

function splitTime(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return {
    hours: Math.floor(safe / 3600),
    minutes: Math.floor((safe % 3600) / 60),
    seconds: safe % 60,
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

type CooldownProps = {
  secondsRemaining: number;
  onExpire?: () => void;
};

function TimeSegment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="min-w-[3.25rem] rounded-xl border border-[#6b531f]/70 bg-[#11100c] px-2 py-2 text-center text-2xl font-semibold tabular-nums text-[#D4AF37] shadow-[inset_0_2px_8px_rgba(0,0,0,0.65)]">
        {pad(value)}
      </span>
      <span className="mt-1 text-[9px] uppercase tracking-[0.25em] text-[#c8b78e]">
        {label}
      </span>
    </div>
  );
}

// Panel destacado para la lista/detalle de partidas: reloj HH:MM:SS con barra
// de progreso de las 24 h de descanso. Solo este componente se re-renderiza
// cada segundo; la lista de partidas no se toca.
export function CooldownBanner({ secondsRemaining, onExpire }: CooldownProps) {
  const secondsLeft = useCountdown(secondsRemaining, onExpire);
  if (secondsLeft <= 0) return null;

  const { hours, minutes, seconds } = splitTime(secondsLeft);
  const progress = Math.min(
    100,
    Math.max(0, ((COOLDOWN_TOTAL_SECONDS - secondsLeft) / COOLDOWN_TOTAL_SECONDS) * 100),
  );

  return (
    <section
      role="timer"
      aria-label={`Tiempo restante de descanso: ${hours} horas y ${minutes} minutos`}
      className="relative overflow-hidden rounded-[1.5rem] border border-[#6b531f]/70 bg-[#0d0b07]/95 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.8)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.04),_transparent_35%)] pointer-events-none" />

      <div className="relative flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5">
        <div className="flex items-start gap-4 sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#6b531f]/80 bg-[#1d1914] shadow-[inset_0_0_14px_rgba(212,175,55,0.18)]">
            <Hourglass className="h-6 w-6 animate-pulse text-[#D4AF37]" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#b99d42]/80">
              Descanso de aventurero
            </p>
            <p className="mt-1 text-sm leading-5 text-[#d4c391]">
              Tu alma aún se recupera de la última partida. Podrás unirte a una
              nueva cuando el reloj llegue a cero.
            </p>
          </div>
        </div>

        <div className="flex items-start justify-center gap-2">
          <TimeSegment value={hours} label="Horas" />
          <span className="pt-2 text-xl font-semibold text-[#b99d42]/70">:</span>
          <TimeSegment value={minutes} label="Min" />
          <span className="pt-2 text-xl font-semibold text-[#b99d42]/70">:</span>
          <TimeSegment value={seconds} label="Seg" />
        </div>
      </div>

      <div className="relative h-1.5 w-full bg-[#12100b]">
        <div
          className="h-full bg-gradient-to-r from-[#D4AF37] via-[#B8860B] to-[#8B7355] transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );
}

// Versión compacta para chips/estados dentro de tarjetas.
export function CooldownChip({ secondsRemaining, onExpire }: CooldownProps) {
  const secondsLeft = useCountdown(secondsRemaining, onExpire);
  if (secondsLeft <= 0) return null;

  const { hours, minutes, seconds } = splitTime(secondsLeft);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-[#4b3810] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-amber-200">
      <Hourglass className="h-3.5 w-3.5" />
      {hours}h {pad(minutes)}m {pad(seconds)}s
    </span>
  );
}
