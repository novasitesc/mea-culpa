"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield } from "lucide-react";
import Header from "@/app/components/header";
import Sidebar from "@/app/components/sidebar";
import FantasyAlert from "@/components/ui/fantasy-alert";
import { useAuth } from "@/lib/useAuth";

type OpenPartida = {
  id: string;
  title: string;
  comment: string;
  status: string;
  minPlayers: number;
  maxPlayers: number;
  playerLimit: number;
  participantCount: number;
  slotsRemaining: number;
  floor: number;
  startTime: string | null;
  tier: number;
  isFull: boolean;
  inCooldown: boolean;
  cooldownEndsAt: string | null;
  cooldownSecondsRemaining: number;
  createdAt: string;
  createdBy: string | null;
  joinedCharacterIds: number[];
};

type Character = {
  id: number;
  name: string;
  lifeStatus: "vivo" | "muerto";
};

type ProfileResponse = {
  characters: Character[];
};

type AlertState = {
  open: boolean;
  title: string;
  message: string;
  variant: "info" | "success" | "warning" | "error";
};

const INITIAL_ALERT: AlertState = {
  open: false,
  title: "",
  message: "",
  variant: "info",
};

export default function PartidasPage() {
  const router = useRouter();
  const { user, token, isLoading, isAuthenticated } = useAuth();
  const [openGames, setOpenGames] = useState<OpenPartida[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingOpenGames, setLoadingOpenGames] = useState(false);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);
  const [selectedCharacterByGame, setSelectedCharacterByGame] = useState<Record<string, number>>({});
  const [alert, setAlert] = useState<AlertState>(INITIAL_ALERT);

  const showAlert = useCallback(
    (title: string, message: string, variant: AlertState["variant"]) => {
      setAlert({ open: true, title, message, variant });
    },
    [],
  );

  const formatCooldown = useCallback((seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    return `${hours}h ${mins}m`;
  }, []);

  const loadCharacters = useCallback(async () => {
    if (!token || !user?.id) return;

    setLoadingCharacters(true);
    try {
      const res = await fetch(`/api/profile?userId=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as ProfileResponse & { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "No se pudieron cargar los personajes");
      }

      setCharacters(data.characters ?? []);
    } catch (error) {
      showAlert(
        "Error",
        error instanceof Error ? error.message : "No se pudieron cargar los personajes",
        "error",
      );
    } finally {
      setLoadingCharacters(false);
    }
  }, [token, user?.id, showAlert]);

  const loadOpenGames = useCallback(async () => {
    if (!token) return;

    setLoadingOpenGames(true);
    try {
      const res = await fetch("/api/partidas", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as OpenPartida[] | { error?: string };

      if (!res.ok) {
        const err = data as { error?: string };
        throw new Error(err.error ?? "No se pudieron cargar las partidas activas");
      }

      setOpenGames(data as OpenPartida[]);
    } catch (error) {
      showAlert(
        "Error",
        error instanceof Error ? error.message : "No se pudieron cargar las partidas activas",
        "error",
      );
    } finally {
      setLoadingOpenGames(false);
    }
  }, [token, showAlert]);

  const joinGame = useCallback(
    async (gameId: string) => {
      if (!token) return;
      const characterId = selectedCharacterByGame[gameId];

      if (!characterId) {
        showAlert(
          "Selecciona personaje",
          "Debes elegir un personaje para unirte a la partida.",
          "warning",
        );
        return;
      }

      setJoiningGameId(gameId);
      try {
        const res = await fetch("/api/partidas/join", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ partidaId: gameId, characterId }),
        });

        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "No se pudo unir a la partida");
        }

        showAlert("Inscripcion completada", "Te uniste correctamente a la partida.", "success");
        await loadOpenGames();
      } catch (error) {
        showAlert(
          "No se pudo unir",
          error instanceof Error ? error.message : "Error desconocido",
          "error",
        );
      } finally {
        setJoiningGameId(null);
      }
    },
    [token, selectedCharacterByGame, loadOpenGames, showAlert],
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated || !token || !user?.id) return;
    void Promise.all([loadCharacters(), loadOpenGames()]);
  }, [isAuthenticated, token, user?.id, loadCharacters, loadOpenGames]);

  const hasAliveCharacters = useMemo(
    () => characters.some((character) => character.lifeStatus !== "muerto"),
    [characters],
  );

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <FantasyAlert
        open={alert.open}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
        onClose={() => setAlert(INITIAL_ALERT)}
      />

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

          <section className="rounded-lg border-2 border-[#8B7355] bg-card/80 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[#B8860B] text-xs tracking-[0.3em] uppercase">Partidas Publicas</p>
                <h1 className="text-2xl font-serif text-[#D4AF37] mt-1 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Unete a una partida activa
                </h1>
              </div>
              <button
                type="button"
                onClick={() => void loadOpenGames()}
                disabled={loadingOpenGames}
                className="px-3 py-2 rounded border border-border text-sm hover:bg-secondary/60 disabled:opacity-60"
              >
                {loadingOpenGames ? "Cargando..." : "Actualizar"}
              </button>
            </div>

            {loadingOpenGames || loadingCharacters ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando partidas...
              </div>
            ) : openGames.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay partidas abiertas en este momento.</p>
            ) : (
              <div className="space-y-3">
                {openGames.map((game) => {
                  const alreadyJoined = game.joinedCharacterIds.length > 0;
                  const canJoin = !game.isFull && !alreadyJoined && !game.inCooldown;

                  return (
                    <article
                      key={game.id}
                      className="rounded border border-border/70 bg-secondary/20 p-4 space-y-3"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">{game.title}</h2>
                          <p className="text-xs text-muted-foreground">
                            {game.participantCount}/{game.maxPlayers} jugadores · {game.slotsRemaining} cupos libres
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Min {game.minPlayers} · Piso {game.floor} · Tier {game.tier}
                            {game.startTime
                              ? ` · Inicio ${new Date(game.startTime).toLocaleString("es-ES")}`
                              : ""}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded border border-border text-muted-foreground">
                          {game.inCooldown ? "En cooldown" : game.isFull ? "Completa" : "Abierta"}
                        </span>
                      </div>

                      {game.comment && <p className="text-sm text-muted-foreground">{game.comment}</p>}

                      {game.inCooldown && (
                        <p className="text-sm text-amber-400">
                          Cooldown activo: puedes volver a unirte en {formatCooldown(game.cooldownSecondsRemaining)}.
                        </p>
                      )}

                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <select
                          value={selectedCharacterByGame[game.id] ?? ""}
                          onChange={(e) =>
                            setSelectedCharacterByGame((prev) => ({
                              ...prev,
                              [game.id]: e.target.value ? Number(e.target.value) : 0,
                            }))
                          }
                          disabled={!canJoin || !hasAliveCharacters}
                          className="px-3 py-2 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:opacity-60 [&>option]:bg-background [&>option]:text-foreground"
                        >
                          <option value="">Selecciona personaje</option>
                          {characters.map((character) => (
                            <option
                              key={character.id}
                              value={character.id}
                              disabled={
                                game.joinedCharacterIds.includes(character.id) ||
                                character.lifeStatus === "muerto"
                              }
                            >
                              {character.name}
                              {character.lifeStatus === "muerto" ? " (Muerto)" : ""}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => void joinGame(game.id)}
                          disabled={!canJoin || joiningGameId === game.id || !hasAliveCharacters}
                          className="px-4 py-2 rounded bg-[#D4AF37] text-background font-semibold hover:bg-[#B8860B] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {joiningGameId === game.id
                            ? "Uniendote..."
                            : alreadyJoined
                              ? "Ya estas inscrito"
                              : game.inCooldown
                                ? "Cooldown 24h"
                                : game.isFull
                                  ? "Partida completa"
                                  : "Unirme"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
