"use client";

import { useEffect, useRef } from "react";
import type { SalaEvento } from "@/lib/types/sala";
import { Package, Droplet, Dices, FlaskConical, Skull, HeartPulse, Moon, Zap } from "lucide-react";
import { MAX_CAIDAS, MAX_CANSANCIO, EFECTOS_CANSANCIO, CANSANCIO_POR_DERROTA } from "@/lib/caidas";
import HuesoRoto from "@/app/components/hueso-roto";
import { getIconForString } from "@/lib/iconMapper";

type Props = {
  eventos: SalaEvento[];
};

function renderEvento(ev: SalaEvento, i: number) {
  if (ev.tipo === "dado_tirado") {
    const { recompensaNombre, tipoDado, resultados, tipoResultado, objeto, cantidadOro, lutResultados, personajeNombre } = ev;

    if (lutResultados && lutResultados.length > 0) {
      const items = lutResultados.filter(
        (r) => r.tipo === "item" || (r.tipo === "subtabla" && r.subRoll?.objeto),
      );
      const oros = lutResultados
        .filter((r) => r.tipo === "oro")
        .reduce((acc, r) => acc + (r.oroDetalle?.cantidadOro ?? 0), 0);
      const subOros = lutResultados
        .filter((r) => r.tipo === "subtabla" && r.subRoll?.cantidadOro)
        .reduce((acc, r) => acc + (r.subRoll?.cantidadOro ?? 0), 0);
      const totalOro = oros + subOros;

      return (
        <div key={i} className="flex flex-col gap-1 py-2 border-b border-gold-dim/10 last:border-0 animate-in fade-in duration-300">
          <p className="text-[11px] text-foreground/50 font-sans">
            <Dices className="w-3.5 h-3.5 text-gold/80 inline-block mr-1 -mt-0.5" /> DM tiró <span className="text-gold/80">{recompensaNombre}</span>
            {lutResultados.length > 1 && <span> ×{lutResultados.length}</span>}
            {" → "}
            <span className="text-foreground/70">{personajeNombre}</span>
          </p>
          <div className="flex flex-wrap gap-2 mt-0.5">
            {items.map((r, j) => {
              const obj = r.tipo === "item" ? r.objeto : r.subRoll?.objeto;
              return obj ? (
                <span key={j} className="text-xs text-green-400 font-semibold flex items-center gap-1.5">
                  {getIconForString(obj.nombre, "w-3.5 h-3.5 shrink-0", obj.icono)} {obj.nombre}
                </span>
              ) : null;
            })}
            {totalOro > 0 && (
              <span className="text-xs text-gold font-semibold">+{totalOro.toLocaleString("es-ES")} oro</span>
            )}
            {items.length === 0 && totalOro === 0 && (
              <span className="text-xs text-foreground/40 italic">Sin recompensa</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={i} className="flex items-center gap-2 py-2 border-b border-gold-dim/10 last:border-0 animate-in fade-in duration-300">
        <span className="text-xs shrink-0 w-7 h-7 flex items-center justify-center rounded bg-gold/10 border border-gold/30 text-gold font-bold">
          {resultados[0] ?? "?"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-foreground/50 font-sans">
            <Dices className="w-3.5 h-3.5 text-gold/80 inline-block mr-1 -mt-0.5" /> <span className="text-gold/80">{tipoDado?.toUpperCase()}</span> · {recompensaNombre}
          </p>
          <p className="text-xs font-sans truncate">
            {tipoResultado === "item" && objeto ? (
              <span className="text-green-400 font-semibold flex items-center gap-1.5">{getIconForString(objeto.nombre, "w-3.5 h-3.5 shrink-0", objeto.icono)} {objeto.nombre}</span>
            ) : tipoResultado === "oro" && cantidadOro != null ? (
              <span className="text-gold font-semibold">+{cantidadOro.toLocaleString("es-ES")} oro</span>
            ) : (
              <span className="text-foreground/40 italic">Sin recompensa</span>
            )}
            <span className="text-foreground/40 ml-1">→ {personajeNombre}</span>
          </p>
        </div>
      </div>
    );
  }

  if (ev.tipo === "asignacion_manual") {
    const { objeto, cantidadOro, personajeNombre, cantidad } = ev;
    return (
      <div key={i} className="flex items-center gap-2 py-2 border-b border-gold-dim/10 last:border-0 animate-in fade-in duration-300">
        <span className="shrink-0 flex items-center justify-center w-7 h-7 bg-gold/10 border border-gold/30 rounded text-gold"><Package className="w-4 h-4" /></span>
        <p className="text-xs font-sans">
          {objeto ? (
            <span className="text-green-400 font-semibold flex items-center gap-1.5">
              {getIconForString(objeto.nombre, "w-3.5 h-3.5 shrink-0", objeto.icono)} {objeto.nombre}{cantidad && cantidad > 1 ? ` ×${cantidad}` : ""}
            </span>
          ) : cantidadOro != null ? (
            <span className="text-gold font-semibold">+{cantidadOro.toLocaleString("es-ES")} oro</span>
          ) : null}
          <span className="text-foreground/40 ml-1">→ {personajeNombre}</span>
        </p>
      </div>
    );
  }

  if (ev.tipo === "consumible_usado") {
    const { objeto, personajeNombre, restante } = ev;
    return (
      <div key={i} className="flex items-center gap-2 py-2 border-b border-gold-dim/10 last:border-0 animate-in fade-in slide-in-from-bottom-1 duration-300">
        <span className="shrink-0 flex items-center justify-center w-7 h-7 bg-purple-900/20 border border-purple-700/40 rounded text-purple-400"><FlaskConical className="w-4 h-4" /></span>
        <p className="text-xs font-sans">
          <span className="text-foreground/70 font-semibold">{personajeNombre}</span>
          <span className="text-foreground/40"> tiró </span>
          <span className="text-purple-400 font-semibold inline-flex items-center gap-1.5">
            {getIconForString(objeto.nombre, "w-3.5 h-3.5 shrink-0", objeto.icono)} {objeto.nombre}
          </span>
          {restante > 0 && (
            <span className="text-foreground/30 ml-1">(quedan ×{restante})</span>
          )}
        </p>
      </div>
    );
  }

  if (ev.tipo === "caida") {
    const recuperacion = ev.delta < 0;
    return (
      <div
        key={i}
        className={`flex items-center gap-2 py-2 border-b last:border-0 animate-in fade-in duration-300 ${
          ev.derrotado ? "border-red-900/40" : "border-rose-900/30"
        }`}
      >
        <span
          className={`shrink-0 flex items-center justify-center w-7 h-7 rounded border ${
            recuperacion
              ? "bg-emerald-900/20 border-emerald-700/40 text-emerald-400"
              : ev.derrotado
                ? "bg-red-950/40 border-red-700/60 text-red-500 cd-token-doom"
                : "bg-red-900/20 border-red-900/50 text-red-400"
          }`}
        >
          {recuperacion ? (
            <HeartPulse className="w-4 h-4" />
          ) : ev.derrotado ? (
            <Skull className="w-4 h-4" />
          ) : (
            <HuesoRoto className="w-4 h-4" />
          )}
        </span>
        <p className="text-xs font-sans">
          <span className="text-foreground/70 font-semibold">{ev.personajeNombre}</span>
          {recuperacion ? (
            <>
              <span className="text-foreground/40"> se recupera de una caída </span>
              <span className="text-emerald-400 font-semibold">({ev.caidas}/{MAX_CAIDAS})</span>
            </>
          ) : ev.derrotado ? (
            <>
              <span className="text-foreground/40"> ha sido </span>
              <span className="text-red-400 font-bold uppercase">derrotado</span>
              <span className="text-foreground/40"> — se retira al Nexo con +{CANSANCIO_POR_DERROTA} cansancio</span>
            </>
          ) : (
            <>
              <span className="text-foreground/40"> ha caído en combate </span>
              <span className="text-red-400 font-semibold">({ev.caidas}/{MAX_CAIDAS})</span>
            </>
          )}
        </p>
      </div>
    );
  }

  if (ev.tipo === "cansancio") {
    const alivio = ev.delta < 0;
    return (
      <div
        key={i}
        className="flex items-center gap-2 py-2 border-b border-amber-900/30 last:border-0 animate-in fade-in duration-300"
      >
        <span
          className={`shrink-0 flex items-center justify-center w-7 h-7 rounded border ${
            alivio
              ? "bg-emerald-900/20 border-emerald-700/40 text-emerald-400"
              : "bg-amber-900/20 border-amber-700/40 text-amber-400"
          }`}
        >
          <Zap className="w-4 h-4" />
        </span>
        <p className="text-xs font-sans">
          <span className="text-foreground/70 font-semibold">{ev.personajeNombre}</span>
          {alivio ? (
            <>
              <span className="text-foreground/40"> alivia su cansancio </span>
              <span className="text-emerald-400 font-semibold">({ev.cansancio}/{MAX_CANSANCIO})</span>
            </>
          ) : (
            <>
              <span className="text-foreground/40"> acumula un punto de cansancio </span>
              <span className="text-amber-400 font-semibold">({ev.cansancio}/{MAX_CANSANCIO})</span>
              {ev.cansancio > 0 && (
                <span className="text-foreground/30 italic"> — {EFECTOS_CANSANCIO[Math.min(MAX_CANSANCIO, ev.cansancio)]}</span>
              )}
            </>
          )}
        </p>
      </div>
    );
  }

  if (ev.tipo === "descanso_largo" || ev.tipo === "descanso_corto") {
    const corto = ev.tipo === "descanso_corto";
    const conRacion = ev.personajes.filter((p) => !p.sinRacion);
    const sinRacion = ev.personajes.filter((p) => p.sinRacion);
    return (
      <div key={i} className="py-2 border-b border-emerald-900/30 last:border-0 animate-in fade-in slide-in-from-bottom-1 duration-500">
        <div className="rounded-lg border border-emerald-800/40 bg-gradient-to-r from-emerald-950/40 via-black/30 to-emerald-950/40 px-3 py-2.5 flex items-center gap-2.5">
          <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-emerald-900/30 border border-emerald-700/50 text-emerald-300 cd-rest-glow">
            <Moon className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-sans text-emerald-300 font-semibold uppercase tracking-widest">
              {corto ? "Descanso corto" : "Descanso largo"}
            </p>
            {conRacion.length > 0 && (
              <p className="text-[11px] text-foreground/50 font-sans">
                <span className="text-foreground/70">{conRacion.map((p) => p.nombre).join(", ")}</span>
                <span className="text-emerald-400 font-semibold">
                  {corto ? " — ración consumida, cura 1 caída" : " — caídas restauradas y −1 de cansancio"}
                </span>
              </p>
            )}
            {sinRacion.length > 0 && (
              <p className="text-[11px] text-foreground/50 font-sans">
                <span className="text-foreground/70">{sinRacion.map((p) => p.nombre).join(", ")}</span>
                <span className="text-red-400 font-semibold"> — sin ración: +1 de cansancio</span>
              </p>
            )}
            {ev.personajes.length === 0 && (
              <p className="text-[11px] text-foreground/40 italic font-sans">
                El grupo descansa; nadie necesitaba recuperarse.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (ev.tipo === "desmembramiento") {
    return (
      <div
        key={i}
        className="flex items-center gap-2 py-2 border-b border-rose-900/30 last:border-0 animate-in fade-in duration-300"
      >
        <span className="shrink-0 flex items-center justify-center w-7 h-7 bg-rose-900/20 border border-rose-900/50 rounded text-rose-500"><Droplet className="w-4 h-4" /></span>
        <p className="text-xs font-sans">
          <span className="text-foreground/70 font-semibold">{ev.personajeNombre}</span>
          <span className="text-foreground/40"> {ev.desmembrado ? "perdió" : "recuperó"} </span>
          <span className={ev.desmembrado ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
            {ev.miembroLabel}
          </span>
        </p>
      </div>
    );
  }

  return null;
}

export default function SalaFeed({ eventos }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [eventos.length]);

  return (
    <div className="flex flex-col h-full">
      <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans mb-2">
        Feed en vivo
      </p>
      <div className="flex-1 overflow-y-auto min-h-0 space-y-0 pr-1">
        {eventos.length === 0 ? (
          <p className="text-xs text-foreground/30 italic font-sans">Esperando al DM...</p>
        ) : (
          eventos.map((ev, i) => renderEvento(ev, i))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
