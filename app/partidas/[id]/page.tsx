"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
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
  const [eventos, setEventos] = useState<SalaEvento[]>(() => {
    if (typeof window === "undefined" || !partidaId) return [];
    try {
      const saved = localStorage.getItem(`sala-eventos-${partidaId}`);
      return saved ? (JSON.parse(saved) as SalaEvento[]) : [];
    } catch { return []; }
  });
  const [loadingData, setLoadingData] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

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

  // Persist feed to localStorage whenever eventos changes
  useEffect(() => {
    if (!partidaId) return;
    try {
      localStorage.setItem(`sala-eventos-${partidaId}`, JSON.stringify(eventos));
    } catch {}
  }, [eventos, partidaId]);

  // Supabase Realtime channel
  useEffect(() => {
    if (!partidaId || !isAuthenticated) return;

    const supabase = getSupabase();
    const channelName = `partida-sala-${partidaId}`;
    const channel = supabase.channel(channelName);

    channel
      .on("broadcast", { event: "dado_tirado" }, ({ payload }: { payload: SalaEvento }) => {
        setEventos((prev) => [...prev, payload]);
      })
      .on("broadcast", { event: "asignacion_manual" }, ({ payload }: { payload: SalaEvento }) => {
        setEventos((prev) => [...prev, payload]);
      })
      .on("broadcast", { event: "partida_cerrada" }, () => {
        try { localStorage.removeItem(`sala-eventos-${partidaId}`); } catch {}
        router.push("/partidas");
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [partidaId, isAuthenticated]);

  function handleEvent(ev: SalaEvento) {
    // Broadcast to all participants via Supabase Realtime
    channelRef.current?.send({
      type: "broadcast",
      event: ev.tipo,
      payload: ev,
    });

    if (ev.tipo === "partida_cerrada") {
      try { localStorage.removeItem(`sala-eventos-${partidaId}`); } catch {}
      router.push("/partidas");
      return;
    }

    setEventos((prev) => [...prev, ev]);
  }

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

          <section className="rounded-lg border-2 border-[#8B7355] bg-card/80 backdrop-blur-sm p-4 flex flex-col gap-4 min-h-[600px]">
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
                  />
                ) : (
                  <SalaPlayer
                    partida={partida}
                    participantes={participantes}
                    eventos={eventos}
                  />
                )}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
