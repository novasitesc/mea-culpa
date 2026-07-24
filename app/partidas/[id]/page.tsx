"use client";

// La sala de juego (/partidas/[id]). Decide qué vista montar:
//   · sala-dm.tsx     si eres el DM (admin)
//   · sala-player.tsx si eres jugador
// Ambas se alimentan de GET /api/partidas/[id]/sala, que se consulta cada pocos
// segundos para mantener la sala al día.

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Header from "@/app/components/header";
import Sidebar from "@/app/components/sidebar";
import SalaDM from "@/app/components/sala-dm";
import SalaPlayer from "@/app/components/sala-player";
import { useAuth } from "@/lib/useAuth";
import { getSupabase } from "@/lib/supabase";
import DescansoOverlay from "@/app/components/descanso-overlay";
import CaidasOverlay from "@/app/components/caidas-overlay";
import DesmembramientoOverlay from "@/app/components/desmembramiento-overlay";
import PartidaFinalOverlay from "@/app/components/partida-final-overlay";
import EstadoOverlay, { type EstadoFx } from "@/app/components/estado-overlay";
import type {
  SalaPartida,
  SalaParticipante,
  SalaEvento,
  EventoDadoTirado,
  EventoDescansoLargo,
  EventoDescansoCorto,
  EventoCaida,
  EventoCansancio,
  EventoDesmembramiento,
  EventoConjuroLanzado,
} from "@/lib/types/sala";
import type { DiceOverlayData } from "@/app/components/dice-3d/dice-overlay";
import type { DiceType } from "@/lib/types/dados";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Solo carga three/fiber cuando hay una tirada ajena que reproducir.
const DiceOverlay = dynamic(() => import("@/app/components/dice-3d/dice-overlay"), { ssr: false });
// Igual con el conjuro: la escena baja la primera vez que alguien lanza uno.
const ConjuroOverlay = dynamic(() => import("@/app/components/conjuro-overlay"), { ssr: false });

// La tirada del DM llega por broadcast: los espectadores reproducen la misma
// animación con el resultado ya comprometido en el servidor.
function overlayFromEvento(ev: EventoDadoTirado): DiceOverlayData {
  return {
    tipoDado: ev.tipoDado as DiceType,
    recompensaNombre: ev.recompensaNombre,
    personajeNombre: ev.personajeNombre,
    result: {
      resultados: ev.resultados,
      tipoResultado: ev.tipoResultado as DiceOverlayData["result"]["tipoResultado"],
      objeto: ev.objeto,
      cantidadOro: ev.cantidadOro,
      lutResultados: ev.lutResultados,
      entregas: ev.entregas,
    },
  };
}

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
  // Tirada de otro cliente pendiente de reproducir; key fuerza remontar el
  // overlay si llega otra tirada mientras la anterior sigue abierta.
  // `reveal` = el espectador es el destinatario de la recompensa: solo él ve el
  // panel de premio; el resto ve caer el dado y lee el detalle en el log.
  const [spectatorRoll, setSpectatorRoll] = useState<{ key: number; data: DiceOverlayData; reveal: boolean } | null>(null);
  // Descanso pendiente de escenificar (fogata a pantalla completa)
  const [restEvent, setRestEvent] = useState<EventoDescansoLargo | EventoDescansoCorto | null>(null);
  // Overlays dramáticos que ve toda la sala; key remonta si llega otro evento
  // mientras el anterior sigue abierto.
  const [caidaFx, setCaidaFx] = useState<{ key: number; ev: EventoCaida } | null>(null);
  const [desmFx, setDesmFx] = useState<{ key: number; ev: EventoDesmembramiento } | null>(null);
  // Agotamiento y recuperación: solo los ve el jugador afectado.
  const [estadoFx, setEstadoFx] = useState<{ key: number; fx: EstadoFx } | null>(null);
  // Conjuro en escena; lo ve toda la sala. key remonta si encadenan lanzamientos.
  const [conjuroFx, setConjuroFx] = useState<{ key: number; ev: EventoConjuroLanzado } | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const esAdminRef = useRef(esAdmin);
  const miPersonajeIdRef = useRef<number | null>(null);

  // Aplica los resultados de un descanso al estado local de participantes.
  // Usa los valores por personaje del evento (cubre a los que no tenían
  // ración); los eventos antiguos sin esos campos caen al comportamiento previo.
  const aplicarDescansoLocal = useCallback((ev: EventoDescansoLargo | EventoDescansoCorto) => {
    const porId = new Map(ev.personajes.map((p) => [p.personajeId, p]));
    setParticipantes((prev) =>
      prev.map((p) => {
        const r = porId.get(p.personajeId);
        if (!r) return p;
        return {
          ...p,
          caidas: r.caidas ?? (ev.tipo === "descanso_largo" ? 0 : p.caidas),
          cansancio:
            r.cansancio ??
            (ev.tipo === "descanso_largo" ? Math.max(0, p.cansancio - 1) : p.cansancio),
        };
      }),
    );
  }, []);

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

  // Escenifica la caída o el desmembramiento para toda la sala (jugadores y DM);
  // solo los eventos que empeoran (marcar caída, perder miembro) montan el overlay.
  const triggerCaidaFx = useCallback((ev: EventoCaida) => {
    if (ev.delta > 0) setCaidaFx((p) => ({ key: (p?.key ?? 0) + 1, ev }));
  }, []);

  const triggerDesmFx = useCallback((ev: EventoDesmembramiento) => {
    if (ev.desmembrado) setDesmFx((p) => ({ key: (p?.key ?? 0) + 1, ev }));
  }, []);

  // Agotamiento (+1 cansancio) y recuperación (−1 caída): a diferencia de las
  // caídas, solo se escenifican para el dueño del personaje afectado.
  const triggerEstadoFx = useCallback((ev: EventoCaida | EventoCansancio) => {
    if (ev.personajeId !== miPersonajeIdRef.current) return;
    const fx: EstadoFx | null =
      ev.tipo === "cansancio" && ev.delta > 0
        ? { tipo: "cansancio", personajeNombre: ev.personajeNombre, cansancio: ev.cansancio }
        : ev.tipo === "caida" && ev.delta < 0
          ? { tipo: "recuperacion", personajeNombre: ev.personajeNombre, caidas: ev.caidas }
          : null;
    if (fx) setEstadoFx((p) => ({ key: (p?.key ?? 0) + 1, fx }));
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

  useEffect(() => {
    miPersonajeIdRef.current =
      !esAdmin && user
        ? participantes.find((p) => p.usuarioId === user.id)?.personajeId ?? null
        : null;
  }, [esAdmin, user, participantes]);

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
        // El emisor no recibe su propio broadcast: todo dado_tirado entrante
        // es de otro cliente y se reproduce con la animación completa.
        if (payload.tipo === "dado_tirado") {
          setSpectatorRoll((prev) => ({
            key: (prev?.key ?? 0) + 1,
            data: overlayFromEvento(payload),
            reveal: payload.personajeId === miPersonajeIdRef.current,
          }));
        }
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
          triggerCaidaFx(payload);
          triggerEstadoFx(payload);
          setParticipantes((prev) =>
            prev.map((p) =>
              p.personajeId === payload.personajeId
                ? {
                  ...p,
                  caidas: payload.caidas,
                  derrotado: payload.derrotado,
                  cansancio: payload.cansancio ?? p.cansancio,
                }
                : p,
            ),
          );
        }
      })
      .on("broadcast", { event: "cansancio" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
        if (payload.tipo === "cansancio") {
          triggerEstadoFx(payload);
          setParticipantes((prev) =>
            prev.map((p) =>
              p.personajeId === payload.personajeId
                ? { ...p, cansancio: payload.cansancio }
                : p,
            ),
          );
        }
      })
      .on("broadcast", { event: "descanso_largo" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
        if (payload.tipo === "descanso_largo") {
          setRestEvent(payload);
          aplicarDescansoLocal(payload);
        }
      })
      .on("broadcast", { event: "descanso_corto" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
        if (payload.tipo === "descanso_corto") {
          setRestEvent(payload);
          aplicarDescansoLocal(payload);
        }
      })
      .on("broadcast", { event: "sala_avanzada" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
      })
      .on("broadcast", { event: "conjuro_lanzado" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
        if (payload.tipo === "conjuro_lanzado") {
          setConjuroFx((p) => ({ key: (p?.key ?? 0) + 1, ev: payload }));
        }
      })
      .on("broadcast", { event: "desmembramiento" }, ({ payload }: { payload: SalaEvento }) => {
        appendEvento(payload);
        if (payload.tipo === "desmembramiento") {
          triggerDesmFx(payload);
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
  }, [partidaId, isAuthenticated, appendEvento, aplicarDescansoLocal, triggerCaidaFx, triggerDesmFx, triggerEstadoFx]);

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
      triggerCaidaFx(ev);
      triggerEstadoFx(ev);
      setParticipantes((prev) =>
        prev.map((p) =>
          p.personajeId === ev.personajeId
            ? {
              ...p,
              caidas: ev.caidas,
              derrotado: ev.derrotado,
              cansancio: ev.cansancio ?? p.cansancio,
            }
            : p,
        ),
      );
      return;
    }

    if (ev.tipo === "cansancio") {
      appendEvento(ev);
      triggerEstadoFx(ev);
      setParticipantes((prev) =>
        prev.map((p) =>
          p.personajeId === ev.personajeId ? { ...p, cansancio: ev.cansancio } : p,
        ),
      );
      return;
    }

    if (ev.tipo === "descanso_largo" || ev.tipo === "descanso_corto") {
      appendEvento(ev);
      setRestEvent(ev);
      aplicarDescansoLocal(ev);
      return;
    }

    if (ev.tipo === "conjuro_lanzado") {
      appendEvento(ev);
      setConjuroFx((p) => ({ key: (p?.key ?? 0) + 1, ev }));
      return;
    }

    if (ev.tipo === "desmembramiento") {
      appendEvento(ev);
      triggerDesmFx(ev);
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

      {/* Escena del descanso (jugadores y DM) */}
      {restEvent && (
        <DescansoOverlay
          tipo={restEvent.tipo === "descanso_corto" ? "corto" : "largo"}
          subtitulo={
            restEvent.tipo === "descanso_corto"
              ? "El grupo toma un respiro y comparte las raciones"
              : "El grupo acampa y recupera fuerzas"
          }
          personajes={restEvent.personajes}
          onDone={() => setRestEvent(null)}
        />
      )}

      {/* Tirada del DM reproducida en espectadores. El panel de premio solo se
          revela al destinatario; los demás ven la tirada y el detalle va al log. */}
      {spectatorRoll && (
        <DiceOverlay
          key={spectatorRoll.key}
          data={spectatorRoll.data}
          revealReward={spectatorRoll.reveal}
          onFinished={() => {}}
          onClose={() => setSpectatorRoll(null)}
        />
      )}

      {/* Caída / derrota escenificada para toda la sala */}
      {caidaFx && (
        <CaidasOverlay
          key={caidaFx.key}
          evento={caidaFx.ev}
          esPropio={caidaFx.ev.personajeId === myPersonajeId}
          onDone={() => setCaidaFx(null)}
        />
      )}

      {/* Agotamiento / recuperación: solo para el jugador afectado */}
      {estadoFx && (
        <EstadoOverlay key={estadoFx.key} fx={estadoFx.fx} onDone={() => setEstadoFx(null)} />
      )}

      {/* Conjuro lanzado: lo ve toda la sala, teñido por su escuela */}
      {conjuroFx && (
        <ConjuroOverlay
          key={conjuroFx.key}
          data={{
            personajeNombre: conjuroFx.ev.personajeNombre,
            conjuro: conjuroFx.ev.conjuro,
            spellLevel: conjuroFx.ev.spellLevel,
            escuela: conjuroFx.ev.escuela,
          }}
          onDone={() => setConjuroFx(null)}
        />
      )}

      {/* Desmembramiento escenificado para toda la sala */}
      {desmFx && (
        <DesmembramientoOverlay key={desmFx.key} evento={desmFx.ev} onDone={() => setDesmFx(null)} />
      )}

      {/* Cierre ceremonial: Partida finalizada (jugadores) */}
      {showFinalModal && partida && (
        <PartidaFinalOverlay
          titulo={partida.titulo}
          eventos={mySessionItems}
          onIrPartidas={() => {
            // Tras el cierre ceremonial: si el DM concedió niveles, ahora toca
            // la celebración de ascenso (GlobalLevelUp escucha este evento).
            window.dispatchEvent(new CustomEvent("profile:refresh"));
            router.push("/partidas");
          }}
          onPagarPosada={() => {
            window.dispatchEvent(new CustomEvent("profile:refresh"));
            router.push("/profile");
          }}
        />
      )}
    </div>
  );
}
