"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Swords, Home } from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import Link from "next/link";
import Header from "@/app/components/header";
import Sidebar from "@/app/components/sidebar";
import SalaDM from "@/app/components/sala-dm";
import SalaPlayer from "@/app/components/sala-player";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import type { SalaPartida, SalaParticipante, SalaEvento } from "@/lib/types/sala";
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function SalaPage() {
  const params = useParams();
  const partidaId = params?.id as string;
  const router = useRouter();
  const { user, token, isLoading, isAuthenticated } = useAuth();

  const [partida, setPartida] = useState<SalaPartida | null>(null);
  const [participantes, setParticipantes] = useState<SalaParticipante[]>([]);
  const [esAdmin, setEsAdmin] = useState(false);
  const [eventos, setEventos] = useState<SalaEvento[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [showFinalModal, setShowFinalModal] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const esAdminRef = useRef(esAdmin);

  // Añade un evento evitando duplicados (mismo eventoId ya presente en el feed)
  const appendEvento = useCallback((ev: SalaEvento) => {
    setEventos((prev) => {
      const id = (ev as { eventoId?: string }).eventoId;
      if (id && prev.some((e) => (e as { eventoId?: string }).eventoId === id)) {
        return prev;
      }
      return [...prev, ev];
    });
  }, []);

  const loadSala = useCallback(async () => {
    if (!token || !partidaId) return;
    setLoadingData(true);
    try {
      const res = await fetch(`/api/partidas/${partidaId}/sala`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setAccessError(data.error ?? "No se pudo acceder a la sala");
        return;
      }
      setPartida(data.partida);
      setParticipantes(data.participantes);
      setEsAdmin(data.esAdmin);
      if (data.eventos?.length > 0) {
        setEventos(data.eventos);
      }
    } finally {
      setLoadingData(false);
    }
  }, [token, partidaId]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    void loadSala();
  }, [isAuthenticated, token, loadSala]);

  useEffect(() => { esAdminRef.current = esAdmin; }, [esAdmin]);

  // Persist feed to localStorage whenever eventos changes
  useEffect(() => {
    if (!partidaId) return;
    try {
      localStorage.setItem(`sala-eventos-${partidaId}`, JSON.stringify(eventos));
    } catch { }
  }, [eventos, partidaId]);

  // Supabase Realtime channel
  useEffect(() => {
    if (!partidaId || !isAuthenticated) return;

    const supabase = getSupabase();
    const channelName = `partida-sala-${partidaId}`;
    const channel = supabase.channel(channelName);

    channel
      .on("broadcast", { event: "dado_tirado" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
      })
      .on("broadcast", { event: "asignacion_manual" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
      })
      .on("broadcast", { event: "consumible_usado" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
      })
      .on("broadcast", { event: "partida_cerrada" }, () => {
        try { localStorage.removeItem(`sala-eventos-${partidaId}`); } catch { }
        if (esAdminRef.current) {
          router.push("/partidas");
        } else {
          setShowFinalModal(true);
        }
      })
      .on("broadcast", { event: "partida_iniciada" }, () => {
        void loadSala();
      })
      .on("broadcast", { event: "caida" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
        if (payload.tipo === "caida") {
          setParticipantes((prev) =>
            prev.map((p) =>
              p.personajeId === payload.personajeId
                ? { ...p, caidas: payload.caidas, derrotado: payload.derrotado }
                : p,
            ),
          );
        }
      })
      .on("broadcast", { event: "descanso_largo" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
        if (payload.tipo === "descanso_largo") {
          const ids = new Set(payload.personajes.map((p) => p.personajeId));
          setParticipantes((prev) =>
            prev.map((p) => (ids.has(p.personajeId) ? { ...p, caidas: 0 } : p)),
          );
        }
      })
      .on("broadcast", { event: "desmembramiento" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
        if (payload.tipo === "desmembramiento") {
          setParticipantes((prev) =>
            prev.map((p) =>
              p.personajeId === payload.personajeId
                ? {
                  ...p,
                  extremidades: {
                    ...(p.extremidades ?? {}),
                    ...(payload.desmembrado
                      ? { [payload.miembro]: false }
                      : (() => { const ex = { ...(p.extremidades ?? {}) }; delete ex[payload.miembro]; return ex; })()),
                  },
                }
                : p,
            ),
          );
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [partidaId, isAuthenticated, appendEvento]);

  function handleEvent(ev: SalaEvento) {
    channelRef.current?.send({
      type: "broadcast",
      event: ev.tipo,
      payload: ev,
    });

    if (ev.tipo === "partida_cerrada") {
      try { localStorage.removeItem(`sala-eventos-${partidaId}`); } catch { }
      if (esAdmin) {
        router.push("/partidas");
      } else {
        setShowFinalModal(true);
      }
      return;
    }

    if (ev.tipo === "partida_iniciada") {
      void loadSala();
      return;
    }

    if (ev.tipo === "caida") {
      appendEvento(ev);
      setParticipantes((prev) =>
        prev.map((p) =>
          p.personajeId === ev.personajeId
            ? { ...p, caidas: ev.caidas, derrotado: ev.derrotado }
            : p,
        ),
      );
      return;
    }

    if (ev.tipo === "descanso_largo") {
      appendEvento(ev);
      const ids = new Set(ev.personajes.map((p) => p.personajeId));
      setParticipantes((prev) =>
        prev.map((p) => (ids.has(p.personajeId) ? { ...p, caidas: 0 } : p)),
      );
      return;
    }

    if (ev.tipo === "desmembramiento") {
      appendEvento(ev);
      setParticipantes((prev) =>
        prev.map((p) =>
          p.personajeId === ev.personajeId
            ? {
              ...p,
              extremidades: ev.desmembrado
                ? { ...(p.extremidades ?? {}), [ev.miembro]: false }
                : (() => { const ex = { ...(p.extremidades ?? {}) }; delete ex[ev.miembro]; return ex; })(),
            }
            : p,
        ),
      );
      return;
    }

    appendEvento(ev);
  }

  // Compute player's own personajeId for the final modal
  const myPersonajeId = !esAdmin && user
    ? (participantes.find((p) => p.usuarioId === user.id)?.personajeId ?? null)
    : null;

  const mySessionItems = myPersonajeId != null
    ? eventos.filter(
      (ev) =>
        (ev.tipo === "dado_tirado" || ev.tipo === "asignacion_manual") &&
        (ev as any).personajeId === myPersonajeId,
    )
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto p-4">
        <Header />

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4 mt-4">
          <Sidebar />

          <section className="rounded-lg border-2 border-[#8B7355] bg-card/80 backdrop-blur-sm p-4 flex flex-col gap-4 min-h-150">
            {/* Header de la sala */}
            <div className="flex items-center gap-3 pb-3 border-b border-gold-dim/20">
              <Link
                href="/partidas"
                className="inline-flex items-center gap-1.5 text-xs text-foreground/50 hover:text-foreground/80 transition-colors font-sans"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Partidas
              </Link>
              {partida && (
                <>
                  <span className="text-foreground/20">/</span>
                  <h1 className="text-base font-serif text-[#D4AF37] flex-1 truncate">
                    {partida.titulo}
                  </h1>
                  <span className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans shrink-0">
                    {esAdmin ? "Vista DM" : "Sala"}
                  </span>
                </>
              )}
            </div>

            {/* Contenido */}
            {loadingData ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gold" />
              </div>
            ) : accessError ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <p className="text-sm text-rose-400">{accessError}</p>
                <Link
                  href="/partidas"
                  className="text-xs text-foreground/50 hover:text-foreground/80 underline"
                >
                  Volver a partidas
                </Link>
              </div>
            ) : partida ? (
              <div className="flex-1 min-h-0">
                {esAdmin ? (
                  <SalaDM
                    partida={partida}
                    participantes={participantes}
                    token={token}
                    eventos={eventos}
                    onEvent={handleEvent}
                    onStart={loadSala}
                  />
                ) : (
                  <SalaPlayer
                    partida={partida}
                    participantes={participantes}
                    eventos={eventos}
                    token={token}
                    usuarioId={user?.id ?? null}
                    onEvent={handleEvent}
                  />
                )}
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {/* Modal: Partida finalizada (jugadores) */}
      {showFinalModal && partida && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
            <div className="p-5 border-b border-border">
              <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans mb-1">Fin de la aventura</p>
              <h2 className="text-lg font-bold text-gold flex items-center gap-2"><Swords className="w-5 h-5 text-gold" /> {partida.titulo}</h2>
              <p className="text-sm text-foreground/50 font-sans mt-1">La partida ha finalizado.</p>
            </div>

            <div className="p-5 flex flex-col gap-3 overflow-y-auto max-h-[50vh]">
              <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-sans">
                Lo que recibiste en la sesión
              </p>
              {mySessionItems.length === 0 ? (
                <p className="text-sm text-foreground/30 italic font-sans">Sin asignaciones registradas.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {mySessionItems.map((ev, i) => {
                    if (ev.tipo === "dado_tirado") {
                      if (ev.lutResultados && ev.lutResultados.length > 0) {
                        const items = ev.lutResultados.filter(
                          (r: any) => r.tipo === "item" || (r.tipo === "subtabla" && r.subRoll?.objeto),
                        );
                        const oro = ev.lutResultados
                          .filter((r: any) => r.tipo === "oro")
                          .reduce((acc: number, r: any) => acc + (r.oroDetalle?.cantidadOro ?? 0), 0) +
                          ev.lutResultados
                            .filter((r: any) => r.tipo === "subtabla" && r.subRoll?.cantidadOro)
                            .reduce((acc: number, r: any) => acc + (r.subRoll?.cantidadOro ?? 0), 0);
                        return (
                          <div key={i} className="flex flex-wrap gap-2 py-1 border-b border-border/30 last:border-0">
                            {items.map((r: any, j: number) => {
                              const obj = r.tipo === "item" ? r.objeto : r.subRoll?.objeto;
                              return obj ? (
                                <span key={j} className="text-sm text-green-400 font-semibold flex items-center gap-1.5">
                                  {getIconForString(obj.nombre, "w-4 h-4 shrink-0", obj.icono)} {obj.nombre}
                                </span>
                              ) : null;
                            })}
                            {oro > 0 && (
                              <span className="text-sm text-gold font-semibold">+{oro.toLocaleString("es-ES")} oro</span>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="flex gap-2 py-1 border-b border-border/30 last:border-0">
                          {ev.tipoResultado === "item" && ev.objeto ? (
                            <span className="text-sm text-green-400 font-semibold flex items-center gap-1.5">{getIconForString(ev.objeto.nombre, "w-4 h-4 shrink-0", ev.objeto.icono)} {ev.objeto.nombre}</span>
                          ) : ev.tipoResultado === "oro" && ev.cantidadOro ? (
                            <span className="text-sm text-gold font-semibold">+{ev.cantidadOro.toLocaleString("es-ES")} oro</span>
                          ) : (
                            <span className="text-sm text-foreground/30 italic">Sin recompensa</span>
                          )}
                        </div>
                      );
                    }
                    if (ev.tipo === "asignacion_manual") {
                      return (
                        <div key={i} className="flex gap-2 py-1 border-b border-border/30 last:border-0">
                          {ev.objeto ? (
                            <span className="text-sm text-green-400 font-semibold flex items-center gap-1.5">
                              {getIconForString(ev.objeto.nombre, "w-4 h-4 shrink-0", ev.objeto.icono)} {ev.objeto.nombre}{ev.cantidad && ev.cantidad > 1 ? ` ×${ev.cantidad}` : ""}
                            </span>
                          ) : ev.cantidadOro ? (
                            <span className="text-sm text-gold font-semibold">+{ev.cantidadOro.toLocaleString("es-ES")} oro</span>
                          ) : null}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-border">
              <button
                type="button"
                onClick={() => router.push("/partidas")}
                className="px-4 py-2 rounded border border-border bg-secondary hover:bg-muted text-sm font-sans"
              >
                Ir a partidas
              </button>
              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="px-4 py-2 rounded bg-gold/20 border border-gold/40 hover:bg-gold/30 text-gold text-sm font-semibold font-sans"
              >
                <span className="flex items-center justify-center gap-1.5"><Home className="w-4 h-4" /> Pagar posada</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
