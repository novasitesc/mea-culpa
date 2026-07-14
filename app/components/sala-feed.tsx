"use client";

import { useEffect, useRef } from "react";
import type { SalaEvento } from "@/lib/types/sala";
import { Package, Droplet, Dices } from "lucide-react";
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

  if (ev.tipo === "consumible_usado") {
    return (
      <div key={i} className="flex items-center gap-2 py-2 border-b border-gold-dim/10 last:border-0 animate-in fade-in duration-300">
        <span className="text-base shrink-0">🧪</span>
        <p className="text-xs font-sans">
          <span className="text-foreground/70 font-semibold">{ev.personajeNombre}</span>
          <span className="text-foreground/40"> usó </span>
          <span className="text-emerald-400 font-semibold">{ev.objeto.icono} {ev.objeto.nombre}</span>
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
