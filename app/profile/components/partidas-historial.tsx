"use client";

// Historial de partidas jugadas por el usuario.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Search, Skull } from "lucide-react";

type EventoHistorial =
  | {
      tipo: "dado_tirado";
      tipoDado: string;
      recompensaNombre: string;
      tipoResultado: string;
      objetoNombre: string | null;
      objetoIcono: string | null;
      cantidadOro: number | null;
      lutResultados: any[] | null;
      creadoEn: string;
    }
  | {
      tipo: "asignacion_manual";
      objetoNombre: string | null;
      objetoIcono: string | null;
      cantidad: number;
      cantidadOro: number | null;
      creadoEn: string;
    }
  | {
      tipo: "consumible_usado";
      objetoNombre: string;
      objetoIcono: string;
      creadoEn: string;
    }
  | {
      tipo: "desmembramiento";
      miembro: string;
      miembroLabel: string;
      desmembrado: boolean;
      creadoEn: string;
    };

type PartidaHistorial = {
  partidaId: string;
  titulo: string;
  piso: number;
  tier: number;
  finalizadaEn: string;
  personajeId: number;
  personajeNombre: string;
  muerto: boolean;
  oroDelta: number;
  eventos: EventoHistorial[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function EventoRow({ ev }: { ev: EventoHistorial }) {
  if (ev.tipo === "dado_tirado") {
    const lut = ev.lutResultados?.[0];
    if (lut?.tipo === "item" || (lut?.tipo === "subtabla" && lut?.subRoll?.objeto)) {
      const obj = lut.tipo === "item" ? lut.objeto : lut.subRoll?.objeto;
      return (
        <div className="flex items-center gap-2 text-xs font-sans text-foreground/70">
          <span className="text-foreground/40">🎲</span>
          <span className="text-foreground/50">{ev.recompensaNombre}</span>
          <span className="text-foreground/30">→</span>
          <span className="text-green-400 font-semibold">
            {obj?.icono} {obj?.nombre}
          </span>
        </div>
      );
    }
    if (lut?.tipo === "oro") {
      const amount = lut.oroDetalle?.cantidadOro ?? ev.cantidadOro;
      return (
        <div className="flex items-center gap-2 text-xs font-sans text-foreground/70">
          <span className="text-foreground/40">🎲</span>
          <span className="text-foreground/50">{ev.recompensaNombre}</span>
          <span className="text-foreground/30">→</span>
          <span className="text-yellow-400 font-semibold">+{amount?.toLocaleString("es-ES")} oro</span>
        </div>
      );
    }
    if (lut?.tipo === "nada" || ev.tipoResultado === "nada" || ev.tipoResultado === "") {
      return (
        <div className="flex items-center gap-2 text-xs font-sans text-foreground/40 italic">
          <span>🎲</span>
          <span>{ev.recompensaNombre}</span>
          <span className="text-foreground/30">→</span>
          <span>Nada</span>
        </div>
      );
    }
    if (ev.tipoResultado === "item" && ev.objetoNombre) {
      return (
        <div className="flex items-center gap-2 text-xs font-sans text-foreground/70">
          <span className="text-foreground/40">🎲</span>
          <span className="text-foreground/50">{ev.recompensaNombre}</span>
          <span className="text-foreground/30">→</span>
          <span className="text-green-400 font-semibold">
            {ev.objetoIcono} {ev.objetoNombre}
          </span>
        </div>
      );
    }
    if (ev.tipoResultado === "oro" && ev.cantidadOro != null) {
      return (
        <div className="flex items-center gap-2 text-xs font-sans text-foreground/70">
          <span className="text-foreground/40">🎲</span>
          <span className="text-foreground/50">{ev.recompensaNombre}</span>
          <span className="text-foreground/30">→</span>
          <span className="text-yellow-400 font-semibold">+{ev.cantidadOro.toLocaleString("es-ES")} oro</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs font-sans text-foreground/40 italic">
        <span>🎲</span>
        <span>{ev.recompensaNombre || "Dado"}</span>
      </div>
    );
  }

  if (ev.tipo === "asignacion_manual") {
    if (ev.objetoNombre) {
      return (
        <div className="flex items-center gap-2 text-xs font-sans text-foreground/70">
          <span className="text-foreground/40">⚔️</span>
          <span className="text-foreground/50">Asignado por DM</span>
          <span className="text-foreground/30">→</span>
          <span className="text-green-400 font-semibold">
            {ev.objetoIcono} {ev.objetoNombre}
            {ev.cantidad > 1 ? ` ×${ev.cantidad}` : ""}
          </span>
        </div>
      );
    }
    if (ev.cantidadOro != null) {
      return (
        <div className="flex items-center gap-2 text-xs font-sans text-foreground/70">
          <span className="text-foreground/40">⚔️</span>
          <span className="text-foreground/50">Asignado por DM</span>
          <span className="text-foreground/30">→</span>
          <span className="text-yellow-400 font-semibold">+{ev.cantidadOro.toLocaleString("es-ES")} oro</span>
        </div>
      );
    }
    return null;
  }

  if (ev.tipo === "consumible_usado") {
    return (
      <div className="flex items-center gap-2 text-xs font-sans text-foreground/50 italic">
        <span>🧪</span>
        <span>Usó {ev.objetoIcono} {ev.objetoNombre}</span>
      </div>
    );
  }

  if (ev.tipo === "desmembramiento") {
    return (
      <div className={`flex items-center gap-2 text-xs font-sans font-semibold ${ev.desmembrado ? "text-rose-400" : "text-emerald-400"}`}>
        <span>{ev.desmembrado ? "🩸" : "✨"}</span>
        <span>
          {ev.desmembrado
            ? `Perdió ${ev.miembroLabel}`
            : `Recuperó ${ev.miembroLabel}`}
        </span>
      </div>
    );
  }

  return null;
}

// Una expedición = una línea. Todo lo secundario (piso, tier, personaje) cabe
// en la misma fila; el detalle solo existe si lo despliegas. Con 50 partidas la
// diferencia es la que hay entre una pantalla y seis.
function PartidaRow({ p }: { p: PartidaHistorial }) {
  const [open, setOpen] = useState(false);
  const tierRoman = ["", "I", "II", "III", "IV", "V"][p.tier] ?? p.tier;
  const hasEvents = p.eventos.length > 0;

  return (
    <li className="border-b border-border/40 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gold/[0.04]"
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 text-foreground/30 transition-transform duration-200 ${
            open ? "rotate-90 text-gold/70" : ""
          }`}
        />

        {p.muerto && (
          <Skull className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-label="Murió" />
        )}

        <span className="min-w-0 flex-1 truncate font-sans text-[13px] text-foreground/80 group-hover:text-foreground">
          {p.titulo}
        </span>

        <span className="hidden shrink-0 truncate font-sans text-[11px] text-foreground/35 sm:inline sm:max-w-[9rem]">
          {p.personajeNombre}
        </span>

        <span className="hidden shrink-0 font-sans text-[11px] tabular-nums text-foreground/25 md:inline">
          P{p.piso} · T{tierRoman}
        </span>

        <span className="shrink-0 font-sans text-[11px] tabular-nums text-foreground/30">
          {formatDate(p.finalizadaEn)}
        </span>

        <span className="w-20 shrink-0 text-right font-sans text-xs font-bold tabular-nums">
          {p.oroDelta !== 0 ? (
            <span className={p.oroDelta > 0 ? "text-yellow-400" : "text-rose-400"}>
              {p.oroDelta > 0 ? "+" : ""}
              {p.oroDelta.toLocaleString("es-ES")}
            </span>
          ) : (
            <span className="text-foreground/15">—</span>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-border/30 bg-background/50 px-3 py-2.5 pl-8">
          {hasEvents ? (
            <div className="flex flex-col gap-1.5">
              {p.eventos.map((ev, i) => (
                <EventoRow key={i} ev={ev} />
              ))}
            </div>
          ) : (
            <p className="font-sans text-xs italic text-foreground/30">
              Sin eventos registrados para este personaje.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

type Props = {
  token: string | null;
};

export default function PartidasHistorial({ token }: Props) {
  const [partidas, setPartidas] = useState<PartidaHistorial[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/profile/partidas-historial", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setPartidas(data.partidas ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // El resumen se calcula sobre TODAS las partidas, no sobre lo filtrado: es el
  // balance de tu historial, no del texto que acabas de escribir en el buscador.
  const resumen = useMemo(() => {
    const todas = partidas ?? [];
    return {
      total: todas.length,
      oro: todas.reduce((acc, p) => acc + p.oroDelta, 0),
      muertes: todas.filter((p) => p.muerto).length,
    };
  }, [partidas]);

  const visibles = useMemo(() => {
    const todas = partidas ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return todas;
    return todas.filter(
      (p) =>
        p.titulo.toLowerCase().includes(q) ||
        p.personajeNombre.toLowerCase().includes(q),
    );
  }, [partidas, query]);

  return (
    <section className="rounded-lg border-2 border-[#8B7355] bg-card/80 p-6 backdrop-blur-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl text-[#D4AF37]">Historial de partidas</h2>
          <p className="mt-0.5 font-sans text-xs text-foreground/40">
            Expediciones finalizadas. Pulsa una para ver su registro.
          </p>
        </div>

        {resumen.total > 0 && (
          <div className="flex items-center gap-2 font-sans text-[11px]">
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-foreground/50">
              {resumen.total} {resumen.total === 1 ? "expedición" : "expediciones"}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 tabular-nums ${
                resumen.oro >= 0
                  ? "border-yellow-600/30 bg-yellow-900/10 text-yellow-400/90"
                  : "border-rose-700/30 bg-rose-900/10 text-rose-400/90"
              }`}
            >
              {resumen.oro > 0 ? "+" : ""}
              {resumen.oro.toLocaleString("es-ES")} oro
            </span>
            {resumen.muertes > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-700/30 bg-rose-900/10 px-2.5 py-1 text-rose-400/90">
                <Skull className="h-3 w-3" />
                {resumen.muertes}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : resumen.total === 0 ? (
        <p className="py-8 text-center font-sans text-sm italic text-foreground/30">
          Aún no has participado en ninguna expedición finalizada.
        </p>
      ) : (
        <>
          {/* El buscador solo aparece cuando hay suficiente historial como para
              que recorrerlo a ojo empiece a costar. */}
          {resumen.total > 6 && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar por expedición o personaje..."
                aria-label="Filtrar historial de partidas"
                className="w-full rounded-lg border border-border/60 bg-background/60 py-2 pl-9 pr-3 font-sans text-xs text-foreground placeholder:text-foreground/30 focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/30"
              />
            </div>
          )}

          {/* Altura acotada: el historial crece sin fin, la sección no. */}
          <ul className="feed-scroll mt-3 max-h-[22rem] overflow-y-auto rounded-lg border border-border/50 bg-background/30">
            {visibles.length === 0 ? (
              <li className="px-3 py-6 text-center font-sans text-xs italic text-foreground/30">
                Ninguna expedición coincide con «{query.trim()}».
              </li>
            ) : (
              visibles.map((p) => (
                <PartidaRow key={`${p.partidaId}-${p.personajeId}`} p={p} />
              ))
            )}
          </ul>

          {query.trim() !== "" && visibles.length > 0 && (
            <p className="mt-2 font-sans text-[11px] text-foreground/30">
              {visibles.length} de {resumen.total}
            </p>
          )}
        </>
      )}
    </section>
  );
}
