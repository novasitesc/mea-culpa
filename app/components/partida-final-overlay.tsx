"use client";

// Cierre de la expedición: resumen de lo ocurrido y el descanso obligatorio.
// Desde aquí se paga la posada — o se rehúsa y se acumula agotamiento.

import { useEffect, useMemo, useState } from "react";
import { Trophy, Swords, Home, Coins } from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import { playFanfarriaSfx, playLootRevealSfx } from "@/lib/sfx";
import type { SalaEvento } from "@/lib/types/sala";

type Props = {
  titulo: string;
  /** Eventos de la sesión del propio personaje (dado_tirado / asignacion_manual). */
  eventos: SalaEvento[];
  onIrPartidas: () => void;
  onPagarPosada: () => void;
};

type Loot = { nombre: string; icono?: string; cantidad: number };

/** Aplana los eventos de la sesión en botín agregado: objetos por nombre + oro total. */
function flattenLoot(eventos: SalaEvento[]): { items: Loot[]; oro: number } {
  const porNombre = new Map<string, Loot>();
  let oro = 0;
  const addItem = (obj: { nombre: string; icono?: string } | null | undefined, cantidad = 1) => {
    if (!obj) return;
    const prev = porNombre.get(obj.nombre);
    if (prev) prev.cantidad += cantidad;
    else porNombre.set(obj.nombre, { nombre: obj.nombre, icono: obj.icono, cantidad });
  };

  for (const ev of eventos) {
    if (ev.tipo === "dado_tirado") {
      if (ev.lutResultados && ev.lutResultados.length > 0) {
        for (const r of ev.lutResultados) {
          if (r.tipo === "item") addItem(r.objeto);
          else if (r.tipo === "oro") oro += r.oroDetalle?.cantidadOro ?? 0;
          else if (r.tipo === "subtabla") {
            addItem(r.subRoll?.objeto);
            oro += r.subRoll?.cantidadOro ?? 0;
          }
        }
      } else if (ev.tipoResultado === "item") {
        addItem(ev.objeto);
      } else if (ev.tipoResultado === "oro") {
        oro += ev.cantidadOro ?? 0;
      }
    } else if (ev.tipo === "asignacion_manual") {
      if (ev.objeto) addItem(ev.objeto, ev.cantidad ?? 1);
      else oro += ev.cantidadOro ?? 0;
    }
  }
  return { items: [...porNombre.values()], oro };
}

/**
 * Cierre ceremonial de la partida para los jugadores: fanfarria, trofeo con
 * volteo 3D y el botín de la sesión revelándose pieza a pieza.
 */
export default function PartidaFinalOverlay({ titulo, eventos, onIrPartidas, onPagarPosada }: Props) {
  const { items, oro } = useMemo(() => flattenLoot(eventos), [eventos]);
  const total = items.length + (oro > 0 ? 1 : 0);
  const [revealed, setRevealed] = useState(0);
  const [oroShown, setOroShown] = useState(0);

  useEffect(() => {
    playFanfarriaSfx();
  }, []);

  // Revelado escalonado: la primera pieza espera a la fanfarria
  useEffect(() => {
    if (revealed >= total) return;
    const t = window.setTimeout(
      () => {
        playLootRevealSfx(revealed);
        setRevealed((r) => r + 1);
      },
      revealed === 0 ? 1300 : 380,
    );
    return () => window.clearTimeout(t);
  }, [revealed, total]);

  // Contador de oro que sube al revelarse la bolsa
  const oroRevealed = oro > 0 && revealed >= total;
  useEffect(() => {
    if (!oroRevealed) return;
    const steps = 24;
    let i = 0;
    const iv = window.setInterval(() => {
      i++;
      setOroShown(Math.round((oro * i) / steps));
      if (i >= steps) window.clearInterval(iv);
    }, 40);
    return () => window.clearInterval(iv);
  }, [oroRevealed, oro]);

  const embers = useMemo(
    () =>
      Array.from({ length: 22 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.4,
        duration: 2.8 + Math.random() * 2.4,
        size: 2 + Math.random() * 3.5,
        drift: (Math.random() - 0.5) * 110,
      })),
    [],
  );

  const done = revealed >= total;

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center overflow-hidden cd-vignette-in"
      role="alertdialog"
      aria-label="Partida finalizada"
    >
      {/* Noche dorada: resplandor cálido al centro */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(30,24,8,0.9) 0%, rgba(14,11,4,0.95) 55%, rgba(4,3,1,0.98) 100%)",
        }}
      />
      <div className="absolute inset-6 sm:inset-10 rounded-2xl border border-gold-dim/25 pointer-events-none" />

      {/* Ascuas doradas */}
      {embers.map((e, i) => (
        <span
          key={i}
          className="cd-ember absolute bottom-0 rounded-full bg-gold/80 pointer-events-none"
          style={{
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            boxShadow: "0 0 8px 2px rgba(212, 175, 55, 0.5)",
            ["--cd-delay" as string]: `${e.delay}s`,
            ["--cd-duration" as string]: `${e.duration}s`,
            ["--cd-drift" as string]: `${e.drift}px`,
          }}
        />
      ))}

      <div className="relative flex flex-col items-center gap-4 sm:gap-5 px-6 text-center max-w-lg w-full">
        <span className="pf-trophy-in pf-trophy-glow inline-block">
          <Trophy className="w-20 h-20 sm:w-24 sm:h-24 text-gold" />
        </span>

        <div>
          <p className="cd-overlay-sub text-[10px] uppercase tracking-widest text-foreground/40 font-sans mb-1">
            Fin de la aventura
          </p>
          <h2
            className="cd-overlay-title pf-shine font-serif uppercase"
            style={{ fontSize: "clamp(1.5rem, 5vw, 2.6rem)" }}
          >
            {titulo}
          </h2>
        </div>

        <div className="cd-overlay-sub w-full flex flex-col items-center gap-2.5">
          <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans">
            Botín de la sesión
          </p>

          {total === 0 ? (
            <p className="text-sm text-foreground/40 italic font-sans">
              La expedición no dejó botín registrado.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2 max-h-[38vh] overflow-y-auto pr-1">
              {items.slice(0, revealed).map((it, i) => (
                <span
                  key={it.nombre}
                  className="pf-loot-in inline-flex items-center gap-1.5 rounded-full border border-green-800/50 bg-green-950/40 px-3 py-1.5 text-sm text-green-400 font-semibold font-sans"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  {getIconForString(it.nombre, "w-4 h-4 shrink-0", it.icono)}
                  {it.nombre}
                  {it.cantidad > 1 && <span className="text-green-300/70">×{it.cantidad}</span>}
                </span>
              ))}
              {oroRevealed && (
                <span className="pf-loot-in inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm text-gold font-bold font-sans">
                  <Coins className="w-4 h-4 shrink-0" />
                  +{oroShown.toLocaleString("es-ES")} oro
                </span>
              )}
            </div>
          )}
        </div>

        <div
          className={`flex flex-wrap justify-center gap-2 mt-2 transition-opacity duration-500 ${
            done ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <button
            type="button"
            onClick={onIrPartidas}
            className="px-4 py-2 rounded border border-border bg-secondary/70 hover:bg-muted text-sm font-sans transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Swords className="w-4 h-4" /> Ir a partidas
            </span>
          </button>
          <button
            type="button"
            onClick={onPagarPosada}
            className="px-4 py-2 rounded bg-gold/20 border border-gold/40 hover:bg-gold/30 text-gold text-sm font-semibold font-sans transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Home className="w-4 h-4" /> Pagar posada
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
