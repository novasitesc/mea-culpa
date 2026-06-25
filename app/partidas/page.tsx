"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Shield, Dices } from "lucide-react";
import Header from "@/app/components/header";
import Sidebar from "@/app/components/sidebar";
import FantasyAlert from "@/components/ui/fantasy-alert";
import { useAuth } from "@/lib/useAuth";
import { getCharacterPortraitByClass } from "@/lib/constantes_img_personajes";

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
  esDmDe?: boolean;
  joinedCharacterIds: number[];
};

type Character = {
  id: number;
  name: string;
  lifeStatus: "vivo" | "muerto";
  portrait?: string | null;
  multiclass?: { className: string; level: number }[];
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
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedGameDetail, setSelectedGameDetail] = useState<OpenPartida | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [joiningDetail, setJoiningDetail] = useState(false);
  const [leavingDetail, setLeavingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string>("");

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

  const loadOpenGames = useCallback(async (): Promise<OpenPartida[]> => {
    if (!token) return [];

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

      const games = data as OpenPartida[];
      setOpenGames(games);
      return games;
    } catch (error) {
      showAlert(
        "Error",
        error instanceof Error ? error.message : "No se pudieron cargar las partidas activas",
        "error",
      );
      return [];
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

  const loadGameDetail = useCallback(
    async (gameId: string) => {
      if (!token) return;
      setDetailError("");
      setLoadingDetail(true);
      setSelectedGameId(gameId);

      try {
        const matched = openGames.find((game) => game.id === gameId);
        if (!matched) {
          setDetailError("No se encontró la partida.");
          setSelectedGameDetail(null);
          setLoadingDetail(false);
          return;
        }

        setSelectedGameDetail(matched);
        const firstAlive = characters.find((character) => character.lifeStatus !== "muerto");
        if (firstAlive) {
          setSelectedCharacter(String(firstAlive.id));
        }
      } catch (error) {
        setDetailError(
          error instanceof Error ? error.message : "Error al cargar los detalles.",
        );
      } finally {
        setLoadingDetail(false);
      }
    },
    [token, openGames, characters],
  );

  const joinGameDetail = useCallback(async () => {
    if (!token || !selectedGameDetail) return;
    if (!selectedCharacter) {
      setDetailError("Selecciona un personaje para unirte.");
      return;
    }

    setDetailError("");
    setJoiningDetail(true);

    try {
      const response = await fetch("/api/partidas/join", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          partidaId: selectedGameDetail.id,
          characterId: Number(selectedCharacter),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((result as { error?: string }).error ?? "No se pudo unir a la partida.");
      }

      showAlert("Inscripción completada", "Te uniste correctamente a la partida.", "success");
      const freshGames = await loadOpenGames();
      const freshDetail = freshGames.find((g) => g.id === selectedGameDetail.id);
      if (freshDetail) setSelectedGameDetail(freshDetail);
    } catch (postError) {
      setDetailError(postError instanceof Error ? postError.message : "No se pudo unir a la partida.");
    } finally {
      setJoiningDetail(false);
    }
  }, [selectedGameDetail, selectedCharacter, token, loadOpenGames, showAlert]);

  const leaveGameDetail = useCallback(async () => {
    if (!token || !selectedGameDetail) return;

    setDetailError("");
    setLeavingDetail(true);

    try {
      const response = await fetch("/api/partidas/leave", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ partidaId: selectedGameDetail.id }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((result as { error?: string }).error ?? "No se pudo salir de la partida.");
      }

      showAlert("Salida completada", "Saliste correctamente de la partida.", "success");
      const freshGames = await loadOpenGames();
      const freshDetail = freshGames.find((g) => g.id === selectedGameDetail.id);
      if (freshDetail) setSelectedGameDetail(freshDetail);
    } catch (postError) {
      setDetailError(postError instanceof Error ? postError.message : "No se pudo salir de la partida.");
    } finally {
      setLeavingDetail(false);
    }
  }, [selectedGameDetail, token, loadOpenGames, showAlert]);

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

  const selectedCharacterData = useMemo(
    () => characters.find((character) => String(character.id) === selectedCharacter),
    [characters, selectedCharacter],
  );

  const selectedCharacterPortrait = useMemo(() => {
    if (
      selectedCharacterData?.portrait &&
      selectedCharacterData.portrait !== "/characters/profileplaceholder.webp"
    ) {
      return selectedCharacterData.portrait;
    }
    const primaryClass = selectedCharacterData?.multiclass?.[0]?.className ?? null;
    return getCharacterPortraitByClass(primaryClass);
  }, [selectedCharacterData]);

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
            {selectedGameId && selectedGameDetail ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGameId(null);
                      setSelectedGameDetail(null);
                      setSelectedCharacter("");
                      setDetailError("");
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#6b531f]/70 bg-[#1a1611] px-3 py-2 text-sm text-[#f5e6b0] transition hover:bg-[#2a2318]"
                  >
                    ← Volver
                  </button>
                </div>

                <article className="relative overflow-hidden rounded-[1.5rem] border border-[#5f4b2f] bg-[#0d0b07]/95 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.8)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.08),_transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.04),_transparent_35%)] pointer-events-none" />
                  <div className="relative space-y-4 px-4 py-4 sm:px-5 sm:py-5">
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#4c3d1f]/50">
                      <div className="flex-1">
                        <p className="text-[10px] uppercase tracking-[0.35em] text-[#b99d42]/80">Partida pública</p>
                        <h1 className="text-lg font-serif leading-tight text-white">{selectedGameDetail.title}</h1>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] bg-[#1d1914] text-[#D4AF37] border border-[#6b531f]/80">
                          Tier {["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][selectedGameDetail.tier]}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] ${selectedGameDetail.isFull
                            ? "bg-[#5d1515] text-rose-200 border border-red-500/30"
                            : selectedGameDetail.inCooldown
                              ? "bg-[#4b3810] text-amber-200 border border-amber-500/30"
                              : "bg-[#16311d] text-emerald-200 border border-emerald-500/30"
                          }`}>
                          {selectedGameDetail.isFull ? "Llena" : selectedGameDetail.inCooldown ? "En progreso" : "Abierta"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-[#b99d42]/80 mb-2">Descripción</p>
                      <p className="text-sm leading-6 text-[#d4c391]">
                        {selectedGameDetail.comment?.trim()
                          ? selectedGameDetail.comment
                          : "No se agregó una descripción para esta partida."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-2 py-2.5">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-[#c8b78e] font-medium">Piso</p>
                        <p className="text-sm font-semibold text-[#D4AF37] mt-1">{selectedGameDetail.floor}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-2 py-2.5">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-[#c8b78e] font-medium">Jugadores</p>
                        <p className="text-sm font-semibold text-[#D4AF37] mt-1">{selectedGameDetail.participantCount}/{selectedGameDetail.maxPlayers}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-2 py-2.5">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-[#c8b78e] font-medium">Fecha</p>
                        <p className="text-[11px] font-semibold text-[#D4AF37] mt-1">
                          {selectedGameDetail.startTime ? new Date(selectedGameDetail.startTime).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "Por definir"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-2 py-2.5">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-[#c8b78e] font-medium">Hora</p>
                        <p className="text-[11px] font-semibold text-[#D4AF37] mt-1">
                          {selectedGameDetail.startTime ? new Date(selectedGameDetail.startTime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "Por definir"}
                        </p>
                      </div>
                    </div>

                    {selectedGameDetail.participantCount > 0 && (
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-[#c8b78e] mb-1.5">
                          <span>Progreso</span>
                          <span>{Math.min(100, Math.round((selectedGameDetail.participantCount / selectedGameDetail.maxPlayers) * 100))}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#12100b] border border-white/10">
                          <div
                            className={`h-full rounded-full ${selectedGameDetail.participantCount === selectedGameDetail.maxPlayers
                                ? "bg-red-500"
                                : "bg-gradient-to-r from-[#D4AF37] via-[#B8860B] to-[#8B7355]"
                              }`}
                            style={{ width: `${Math.min(100, Math.round((selectedGameDetail.participantCount / selectedGameDetail.maxPlayers) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {selectedGameDetail.esDmDe ? (
                      /* Vista DM: acceso directo a sala sin selector de personaje */
                      <div className="pt-2">
                        <a
                          href={`/partidas/${selectedGameDetail.id}`}
                          className="inline-flex w-full justify-center rounded-2xl bg-linear-to-r from-[#D4AF37] via-[#C29431] to-[#8B7355] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#121011] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)] transition hover:brightness-110 sm:w-auto"
                        >
                          <span className="flex items-center justify-center gap-1.5"><Dices className="w-4 h-4" /> Ir a sala (DM)</span>
                        </a>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex-1">
                          <p className="text-[10px] uppercase tracking-[0.35em] text-[#b99d42]/80 mb-2">Selecciona personaje</p>
                          <select
                            value={selectedCharacter}
                            onChange={(event) => setSelectedCharacter(event.target.value)}
                            disabled={!characters.length}
                            className="w-full rounded-2xl border border-[#453b28] bg-[#11100c] px-3 py-2 text-sm text-foreground outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {characters.length ? (
                              <>
                                <option value="">Selecciona personaje</option>
                                {characters.map((character) => {
                                  const primaryClassName = character.multiclass?.[0]?.className;
                                  return (
                                    <option
                                      key={character.id}
                                      value={character.id}
                                      disabled={character.lifeStatus === "muerto"}
                                    >
                                      {character.name}
                                      {primaryClassName ? ` — ${primaryClassName}` : ""}
                                      {character.lifeStatus === "muerto" ? " (Muerto)" : ""}
                                    </option>
                                  );
                                })}
                              </>
                            ) : (
                              <option value="">No tienes personajes</option>
                            )}
                          </select>

                          {selectedCharacterData && (
                            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#453b28] bg-[#11100c] p-3">
                              <img
                                src={selectedCharacterPortrait}
                                alt={selectedCharacterData.name}
                                className="h-16 w-16 rounded-xl object-cover border border-[#6b531f]/70"
                              />
                              <div>
                                <p className="text-sm font-semibold text-[#D4AF37]">
                                  {selectedCharacterData.name}
                                </p>
                                <p className="text-xs text-[#c8b78e]">
                                  {selectedCharacterData.multiclass?.[0]?.className || "Clase no definida"}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {(selectedGameDetail.status === "en_progreso" || selectedGameDetail.status === "abierta") && selectedGameDetail.joinedCharacterIds?.length ? (
                          <a
                            href={`/partidas/${selectedGameDetail.id}`}
                            className="w-full rounded-2xl bg-linear-to-r from-[#D4AF37] via-[#C29431] to-[#8B7355] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#121011] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)] transition hover:brightness-110 text-center sm:w-auto"
                          >
                            <span className="flex items-center justify-center gap-1.5"><Dices className="w-4 h-4" /> Entrar a sala</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={selectedGameDetail.joinedCharacterIds?.length ? leaveGameDetail : joinGameDetail}
                            disabled={
                              (!selectedGameDetail.joinedCharacterIds?.length && (!selectedCharacter || !characters.length)) ||
                              joiningDetail ||
                              leavingDetail ||
                              selectedGameDetail.isFull
                            }
                            className="w-full rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#C29431] to-[#8B7355] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#121011] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)] transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                          >
                            {joiningDetail || leavingDetail
                              ? "Procesando..."
                              : selectedGameDetail.joinedCharacterIds?.length
                                ? "Salir"
                                : selectedGameDetail.isFull
                                  ? "Llena"
                                  : "Unirse"}
                          </button>
                        )}
                      </div>
                    )}

                    {detailError && (
                      <p className="rounded-2xl border border-rose-500/30 bg-[#2b1814] px-3 py-2 text-xs text-rose-200">
                        {detailError}
                      </p>
                    )}
                  </div>
                </article>
              </>
            ) : (
              <>
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
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {openGames.map((game) => {
                      const alreadyJoined = game.joinedCharacterIds.length > 0;
                      const canJoin = !game.isFull && !alreadyJoined && !game.inCooldown;
                      const progress = Math.min(100, Math.round((game.participantCount / game.maxPlayers) * 100));
                      const tierRoman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][game.tier];
                      const tierLabel = `Tier ${tierRoman}`;
                      const tierStyles =
                        game.tier === 1 ? "bg-[#1a2a17]/90 text-emerald-300 border border-emerald-600"
                          : game.tier === 2
                            ? "bg-[#15233c]/90 text-sky-300 border border-sky-600"
                            : "bg-[#3f1724]/90 text-rose-300 border border-rose-600";

                      return (
                        <article
                          key={game.id}
                          className="relative overflow-hidden rounded-[1.5rem] border border-[#5f4b2f] bg-[#0d0b07]/95 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.8)]"
                        >
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.08),_transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.04),_transparent_35%)] pointer-events-none" />

                          <div className="relative flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.35em] text-[#b99d42]/80">
                                  Partida pública
                                </p>
                                <h2 className="text-lg font-serif leading-tight text-white">
                                  {game.title}
                                </h2>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] ${tierStyles}`}
                              >
                                {tierLabel}
                              </span>

                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${game.isFull
                                    ? "bg-[#5d1515] text-rose-200 border border-red-500/30"
                                    : game.inCooldown
                                      ? "bg-[#4b3810] text-amber-200 border border-amber-500/30"
                                      : "bg-[#16311d] text-emerald-200 border border-emerald-500/30"
                                  }`}
                              >
                                {game.isFull ? "Llena" : game.inCooldown ? "Cooldown" : "Abierta"}
                              </span>
                            </div>

                            <div className="grid gap-2 text-sm text-muted-foreground">
                              <p className="line-clamp-3 text-sm leading-6 text-[#d4c391]">
                                {game.comment || "Partida sin descripción adicional."}
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-3 text-[12px] text-[#c8b78e]">
                              <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-white/5 px-3 py-2">
                                <Clock className="w-4 h-4 text-[#D4AF37]" />
                                <span>
                                  {game.startTime
                                    ? `${new Date(game.startTime).toLocaleDateString("es-ES", {
                                      day: "2-digit",
                                      month: "short",
                                    })} · ${new Date(game.startTime).toLocaleTimeString("es-ES", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}`
                                    : "Hora por definir"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-[#1a1b16] px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-[#d4af37] border border-[#59481f]/60">
                                  Piso {game.floor}
                                </span>

                                <span className="rounded-full bg-[#1a1b16] px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-[#d4af37] border border-[#59481f]/60">
                                  {game.participantCount}/{game.maxPlayers}
                                </span>
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                              {game.status === "en_progreso" && game.joinedCharacterIds.length > 0 ? (
                                <a
                                  href={`/partidas/${game.id}`}
                                  className="w-full rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#C29431] to-[#8B7355] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#121011] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)] transition hover:brightness-110 text-center sm:w-auto"
                                >
                                  <span className="flex items-center justify-center gap-1.5"><Dices className="w-4 h-4" /> Entrar a sala</span>
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void loadGameDetail(game.id)}
                                  className="w-full rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#C29431] to-[#8B7355] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#121011] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)] transition hover:brightness-110 sm:w-auto"
                                >
                                  Detalles
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}