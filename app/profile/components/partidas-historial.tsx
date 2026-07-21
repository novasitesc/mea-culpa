"use client";

// Historial de partidas jugadas por el usuario.

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

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

function PartidaRow({ p }: { p: PartidaHistorial }) {
  const [open, setOpen] = useState(false);
  const tierRoman = ["", "I", "II", "III", "IV", "V"][p.tier] ?? p.tier;
  const hasEvents = p.eventos.length > 0;

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-card/60 hover:bg-card/90 transition-colors text-left"
      >
        <span className="text-foreground/40 shrink-0">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{p.titulo}</span>
            {p.muerto && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900/40 border border-rose-700/50 text-rose-400 font-sans uppercase tracking-wider shrink-0">
                💀 Murió
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            <span className="text-[11px] text-foreground/40 font-sans">{p.personajeNombre}</span>
            <span className="text-[11px] text-foreground/30 font-sans">Piso {p.piso} · Tier {tierRoman}</span>
            <span className="text-[11px] text-foreground/30 font-sans">{formatDate(p.finalizadaEn)}</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          {p.oroDelta !== 0 && (
            <span className={`text-sm font-bold font-sans ${p.oroDelta > 0 ? "text-yellow-400" : "text-rose-400"}`}>
              {p.oroDelta > 0 ? "+" : ""}{p.oroDelta.toLocaleString("es-ES")}
              <span className="text-[10px] ml-0.5 opacity-70">oro</span>
            </span>
          )}
          {!hasEvents && p.oroDelta === 0 && (
            <span className="text-[11px] text-foreground/20 font-sans italic">sin registro</span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/40 bg-background/40 px-4 py-3">
          {hasEvents ? (
            <div className="flex flex-col gap-2">
              {p.eventos.map((ev, i) => (
                <EventoRow key={i} ev={ev} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-foreground/30 italic font-sans">Sin eventos registrados para este personaje.</p>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  token: string | null;
};

export default function PartidasHistorial({ token }: Props) {
  const [partidas, setPartidas] = useState<PartidaHistorial[] | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <section className="rounded-lg border-2 border-[#8B7355] bg-card/80 backdrop-blur-sm p-6">
      <h2 className="text-xl font-serif text-[#D4AF37] mb-1">Historial de partidas</h2>
      <p className="text-xs text-foreground/40 font-sans mb-5">
        Expediciones finalizadas en las que participaste, con el registro de cambios que afectaron a tu personaje.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : !partidas || partidas.length === 0 ? (
        <p className="text-sm text-foreground/30 italic font-sans text-center py-8">
          Aún no has participado en ninguna expedición finalizada.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {partidas.map((p) => (
            <PartidaRow key={`${p.partidaId}-${p.personajeId}`} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
