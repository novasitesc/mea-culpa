"use client";

// Feed de eventos de la partida (`partidas_eventos`): el registro en vivo de lo
// que ocurre en la sala. Lo ven jugadores y DM.

import { useCallback, useEffect, useRef, useState } from "react";
import { playConsumibleSfx } from "@/lib/sfx";
import type { SalaEvento } from "@/lib/types/sala";
import { Package, Droplet, Dices, FlaskConical, Skull, HeartPulse, Moon, Zap, DoorOpen, Sparkles, Swords } from "lucide-react";
import { schoolRgb, spellKey } from "@/lib/spells";
import { MAX_CAIDAS, MAX_CANSANCIO, EFECTOS_CANSANCIO, CANSANCIO_POR_DERROTA } from "@/lib/caidas";
import HuesoRoto from "@/app/components/hueso-roto";
import SpellDescriptionHover from "@/app/components/spell-description-hover";
import { getIconForString } from "@/lib/iconMapper";
import { ShoppingCart } from "lucide-react";

type Props = {
  eventos: SalaEvento[];
};

function renderEvento(ev: SalaEvento, i: number, descOf: (name: string) => string | null) {
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
      <div key={i} className="sf-flash-purple rounded-sm flex items-center gap-2 py-2 border-b border-gold-dim/10 last:border-0 animate-in fade-in slide-in-from-bottom-1 duration-300">
        <span className="relative shrink-0 flex items-center justify-center w-7 h-7 bg-purple-900/20 border border-purple-700/40 rounded text-purple-400">
          <span className="sf-flask-pop inline-flex"><FlaskConical className="w-4 h-4" /></span>
          {[0, 1, 2].map((j) => (
            <span
              key={j}
              className="sf-spark absolute w-1 h-1 rounded-full bg-purple-300 pointer-events-none"
              style={{
                left: `${22 + j * 24}%`,
                top: "8%",
                ["--sf-delay" as string]: `${0.15 + j * 0.2}s`,
                ["--sf-drift" as string]: `${(j - 1) * 10}px`,
              }}
            />
          ))}
        </span>
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
        className={`flex items-center gap-2 py-2 border-b last:border-0 rounded-sm ${
          recuperacion ? "animate-in fade-in duration-300" : "sf-shake-in sf-flash-red"
        } ${ev.derrotado ? "border-red-900/40" : "border-rose-900/30"}`}
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
            <span className="cd-skull-ignite inline-flex"><Skull className="w-4 h-4" /></span>
          ) : (
            <span className="cd-skull-ignite inline-flex"><HuesoRoto className="w-4 h-4" /></span>
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
                  {corto
                    ? " — ración consumida, cura 1 caída"
                    : " — caídas restauradas, −1 de cansancio y conjuros recuperados"}
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

  if (ev.tipo === "compra_tienda") {
    const isMultiple = ev.items.length > 1 || (ev.items[0]?.cantidad ?? 0) > 1;
    const summary = isMultiple
      ? `${ev.items.reduce((acc, item) => acc + item.cantidad, 0)} objetos`
      : ev.items[0]?.nombre || "algo";

    return (
      <div key={i} className="py-2 border-b border-amber-900/30 last:border-0 animate-in fade-in slide-in-from-bottom-1 duration-500">
        <div className="rounded-lg border border-amber-800/40 bg-gradient-to-r from-amber-950/40 via-black/30 to-amber-950/40 px-3 py-2.5 flex items-center gap-2.5">
          <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-amber-900/30 border border-amber-700/50 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.2)]">
            <ShoppingCart className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-sans text-foreground/70">
              <span className="font-semibold text-foreground/90">{ev.personajeNombre}</span> compró{" "}
              <span className="text-amber-400 font-semibold">{summary}</span> por{" "}
              <span className="text-gold font-semibold">{ev.oroGastado} oro</span>
            </p>
            {isMultiple && (
              <p className="text-[10px] text-foreground/40 font-sans truncate mt-0.5">
                {ev.items.map(item => `${item.cantidad}x ${item.nombre}`).join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (ev.tipo === "conjuro_lanzado") {
    const [, edge] = schoolRgb(ev.escuela);
    // Catálogo primero (funciona para eventos viejos y nuevos); el evento como respaldo.
    const descripcion = descOf(ev.conjuro) ?? ev.descripcion ?? null;
    return (
      <div
        key={i}
        className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0 animate-in fade-in slide-in-from-bottom-1 duration-500"
      >
        <span
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded border"
          style={{ color: `rgb(${edge})`, borderColor: `rgba(${edge},0.4)`, background: `rgba(${edge},0.12)` }}
        >
          <Sparkles className="w-4 h-4" />
        </span>
        <p className="text-xs font-sans min-w-0">
          <span className="text-foreground/70 font-semibold">{ev.personajeNombre}</span>
          <span className="text-foreground/40"> lanza </span>
          <SpellDescriptionHover
            name={ev.conjuro}
            escuela={ev.escuela}
            spellLevel={ev.spellLevel}
            description={descripcion}
          >
            <span
              tabIndex={descripcion ? 0 : undefined}
              className={`font-semibold ${
                descripcion
                  ? "cursor-help underline decoration-dotted underline-offset-2 outline-none"
                  : ""
              }`}
              style={{ color: `rgb(${edge})` }}
            >
              {ev.conjuro}
            </span>
          </SpellDescriptionHover>
          <span className="text-foreground/30">
            {ev.spellLevel === 0 ? " · truco" : ` · nivel ${ev.spellLevel}`}
          </span>
        </p>
      </div>
    );
  }

  if (ev.tipo === "sala_avanzada") {
    return (
      <div
        key={i}
        className="flex items-center gap-2 py-2 border-b border-[#8B7355]/20 last:border-0 animate-in fade-in slide-in-from-bottom-1 duration-500"
      >
        <span
          className={`shrink-0 flex items-center justify-center w-7 h-7 rounded border ${
            ev.requiereDescanso
              ? "bg-amber-900/20 border-amber-700/50 text-amber-300"
              : "bg-black/30 border-[#8B7355]/40 text-foreground/50"
          }`}
        >
          <DoorOpen className="w-4 h-4" />
        </span>
        <p className="text-xs font-sans">
          <span className="text-foreground/40">El grupo avanza a la </span>
          <span className="text-foreground/70 font-semibold">sala {ev.sala}</span>
          {ev.requiereDescanso && (
            <span className="text-amber-300 font-semibold"> — toca descansar</span>
          )}
        </p>
      </div>
    );
  }

  if (ev.tipo === "desmembramiento") {
    return (
      <div
        key={i}
        className={`flex items-center gap-2 py-2 border-b border-rose-900/30 last:border-0 rounded-sm ${
          ev.desmembrado ? "sf-shake-in sf-flash-red" : "animate-in fade-in duration-300"
        }`}
      >
        <span className="shrink-0 flex items-center justify-center w-7 h-7 bg-rose-900/20 border border-rose-900/50 rounded text-rose-500">
          <span className={ev.desmembrado ? "cd-skull-ignite inline-flex" : "inline-flex"}><Droplet className="w-4 h-4" /></span>
        </span>
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

  if (ev.tipo === "ejercito_baja") {
    return (
      <div
        key={i}
        className="flex items-center gap-2 py-2 border-b border-orange-900/30 last:border-0 rounded-sm sf-shake-in sf-flash-red"
      >
        <span className="shrink-0 flex items-center justify-center w-7 h-7 bg-orange-950/30 border border-orange-800/50 rounded text-orange-400">
          <Swords className="w-4 h-4" />
        </span>
        <p className="text-xs font-sans">
          <span className="text-foreground/70 font-semibold">{ev.personajeNombre}</span>
          <span className="text-foreground/40"> pierde </span>
          <span className="text-orange-300 font-semibold">
            {ev.bajas} soldado{ev.bajas === 1 ? "" : "s"} de {ev.unidadNombre}
          </span>
          {ev.aniquilada ? (
            <span className="text-rose-400 font-semibold"> — unidad aniquilada</span>
          ) : (
            <span className="text-foreground/40">
              {" "}
              — quedan {ev.restante} en pie
            </span>
          )}
        </p>
      </div>
    );
  }

  return null;
}

// Solo los últimos eventos se pintan. El resto queda tras "ver historial": el
// panel deja de estirar la página y el DOM no crece sin límite en partidas largas.
export const VISIBLES = 15;

/**
 * Ventana visible del feed.
 * `desde` es el índice ABSOLUTO del primer evento pintado, y es lo que mantiene
 * estables las keys de React: al llegar un evento nuevo la ventana se desplaza,
 * pero cada evento conserva su índice y no se remonta (ni repite su animación).
 */
export function ventanaFeed(total: number, showAll: boolean, maximo = VISIBLES) {
  const fuera = Math.max(0, total - maximo);
  return { fuera, desde: showAll ? 0 : fuera };
}

export default function SalaFeed({ eventos }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Descripciones de conjuros para el tooltip del log. Se resuelven desde el
  // catálogo por nombre (una sola carga la primera vez que aparece un conjuro),
  // así funciona con eventos históricos que no traen la descripción embebida.
  const [spellDesc, setSpellDesc] = useState<Map<string, string>>(new Map());
  const spellsFetched = useRef(false);
  const hasConjuros = eventos.some((e) => e.tipo === "conjuro_lanzado");
  useEffect(() => {
    if (!hasConjuros || spellsFetched.current) return;
    spellsFetched.current = true;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/spells");
        const data = await res.json();
        if (!alive || !Array.isArray(data?.spells)) return;
        const m = new Map<string, string>();
        for (const s of data.spells) {
          if (s?.nombre && s?.description) m.set(spellKey(String(s.nombre)), String(s.description));
        }
        setSpellDesc(m);
      } catch {
        // silencioso: el tooltip cae al respaldo del evento o simplemente no aparece
      }
    })();
    return () => { alive = false; };
  }, [hasConjuros]);
  const descOf = useCallback(
    (name: string) => spellDesc.get(spellKey(name)) ?? null,
    [spellDesc],
  );

  useEffect(() => {
    // "nearest": desplaza solo el contenedor del feed, nunca la página entera.
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [eventos.length]);

  // Burbujeo del frasco solo con consumibles nuevos, no con el historial
  // cargado al entrar a la sala. Caídas y desmembramientos suenan en su overlay.
  useEffect(() => {
    if (prevLen.current === null) {
      prevLen.current = eventos.length;
      return;
    }
    if (eventos.length > prevLen.current) {
      for (const ev of eventos.slice(prevLen.current)) {
        if (ev.tipo === "consumible_usado") playConsumibleSfx();
      }
    }
    prevLen.current = eventos.length;
  }, [eventos]);

  const { fuera, desde } = ventanaFeed(eventos.length, showAll);
  const visibles = eventos.slice(desde);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans">
          Feed en vivo
        </p>
        {fuera > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="ml-auto rounded border border-gold-dim/30 px-2 py-0.5 font-sans text-[10px] uppercase tracking-widest text-foreground/45 transition-colors hover:border-gold/50 hover:text-gold"
          >
            {showAll ? "Ver menos" : `Ver historial (${fuera})`}
          </button>
        )}
      </div>
      <div className="feed-scroll max-h-[26rem] flex-1 overflow-y-auto min-h-0 space-y-0 pr-1">
        {eventos.length === 0 ? (
          <p className="text-xs text-foreground/30 italic font-sans">Esperando al DM...</p>
        ) : (
          visibles.map((ev, i) => renderEvento(ev, desde + i, descOf))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
