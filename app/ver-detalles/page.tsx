"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { CooldownBanner } from "@/app/components/cooldown-timer";
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
  joinedCharacterIds: number[];
};

type Character = {
  id: number;
  name: string;
  lifeStatus: "vivo" | "muerto";
  portrait?: string | null;
  multiclass?: { className: string; level: number }[];
};

function VerDetallesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, isLoading, isAuthenticated } = useAuth();
  const [game, setGame] = useState<OpenPartida | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string>("");

  const partidaId = searchParams.get("id");

  const isAlreadyJoined = useMemo(
    () => !!game?.joinedCharacterIds?.length,
    [game?.joinedCharacterIds],
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

  const loadDetails = useCallback(async () => {
    if (!token || !user?.id) return;
    setError("");
    setLoading(true);

    if (!partidaId) {
      setError("No se encontró el id de la partida.");
      setLoading(false);
      return;
    }

    try {
      const [gamesResponse, charactersResponse] = await Promise.all([
        fetch("/api/partidas", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/profile?userId=${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const gamesData = await gamesResponse.json();
      const charactersData = await charactersResponse.json();

      if (!gamesResponse.ok) {
        throw new Error((gamesData as { error?: string }).error ?? "No se pudieron cargar las partidas.");
      }

      if (!charactersResponse.ok) {
        throw new Error(
          (charactersData as { error?: string }).error ?? "No se pudieron cargar los personajes.",
        );
      }

      const matched = (gamesData as OpenPartida[]).find(
        (entry) => String(entry.id) === String(partidaId),
      );

      if (!matched) {
        setError("No se encontró la partida.");
        setGame(null);
        setCharacters((charactersData as { characters?: Character[] }).characters ?? []);
        setLoading(false);
        return;
      }

      setGame(matched);
      const loadedCharacters = (charactersData as { characters?: Character[] }).characters ?? [];
      console.log("charactersData:", charactersData);
      console.log("loadedCharacters:", loadedCharacters);
      setCharacters(loadedCharacters);
      if (!selectedCharacter) {
        const firstAlive = loadedCharacters.find((character) => character.lifeStatus !== "muerto");
        if (firstAlive) {
          setSelectedCharacter(String(firstAlive.id));
        }
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Se produjo un error al cargar los detalles.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, user?.id, partidaId]);

  const joinGame = useCallback(async () => {
    if (!token || !game) return;
    if (!selectedCharacter) {
      setError("Selecciona un personaje para unirte.");
      return;
    }

    setError("");
    setJoining(true);

    try {
      const response = await fetch("/api/partidas/join", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          partidaId: game.id,
          characterId: Number(selectedCharacter),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((result as { error?: string }).error ?? "No se pudo unir a la partida.");
      }

      await loadDetails();
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "No se pudo unir a la partida.");
    } finally {
      setJoining(false);
    }
  }, [game, selectedCharacter, token, loadDetails]);

  const leaveGame = useCallback(async () => {
    if (!token || !game) return;

    setError("");
    setLeaving(true);

    try {
      const response = await fetch("/api/partidas/leave", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ partidaId: game.id }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((result as { error?: string }).error ?? "No se pudo salir de la partida.");
      }

      await loadDetails();
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "No se pudo salir de la partida.");
    } finally {
      setLeaving(false);
    }
  }, [game, token, loadDetails]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated || !token || !user?.id) return;
    void loadDetails();
  }, [isAuthenticated, token, user?.id, loadDetails]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      }} />

      <div className="relative z-10 max-w-3xl mx-auto p-4 mt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-[#6b531f]/70 bg-[#1a1611] px-3 py-2 text-sm text-[#f5e6b0] transition hover:bg-[#2a2318]"
        >
          <ArrowLeft className="h-4 w-4 text-[#D4AF37]" />
          Volver
        </button>

        {!game ? (
          <div className="rounded-[1.5rem] border border-[#5f4b2f] bg-[#0d0b07]/95 p-6 text-center">
            <p className="text-[#d4c391]">{error || "No se encontró la partida."}</p>
          </div>
        ) : (
          <>
            
            <article className="relative overflow-hidden rounded-[1.5rem] border border-[#5f4b2f] bg-[#0d0b07]/95 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.8)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.08),_transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.04),_transparent_35%)] pointer-events-none" />
            
            <div className="relative space-y-4 px-4 py-4 sm:px-5 sm:py-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#4c3d1f]/50">
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-[#b99d42]/80">Partida pública</p>
                  <h1 className="text-lg font-serif leading-tight text-white">{game.title}</h1>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] bg-[#1d1914] text-[#D4AF37] border border-[#6b531f]/80">
                    Tier {game.tier}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] ${
                    game.isFull
                      ? "bg-[#5d1515] text-rose-200 border border-red-500/30"
                      : game.inCooldown
                      ? "bg-[#4b3810] text-amber-200 border border-amber-500/30"
                      : "bg-[#16311d] text-emerald-200 border border-emerald-500/30"
                  }`}>
                    {game.isFull ? "Llena" : game.inCooldown ? "Cooldown" : "Abierta"}
                  </span>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-[#b99d42]/80 mb-2">
                  Descripción
                </p>
                <p className="text-sm leading-6 text-[#d4c391]">
                  {game.comment?.trim()
                    ? game.comment
                    : "No se agregó una descripción para esta partida."}
                </p>
              </div>

              {/* Información Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-2 py-2.5">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[#c8b78e] font-medium">Piso</p>
                  <p className="text-sm font-semibold text-[#D4AF37] mt-1">{game.floor}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-2 py-2.5">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[#c8b78e] font-medium">Jugadores</p>
                  <p className="text-sm font-semibold text-[#D4AF37] mt-1">{game.participantCount}/{game.maxPlayers}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-2 py-2.5">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[#c8b78e] font-medium">Fecha</p>
                  <p className="text-[11px] font-semibold text-[#D4AF37] mt-1">
                    {game.startTime ? new Date(game.startTime).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "Por definir"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-2 py-2.5">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[#c8b78e] font-medium">Hora</p>
                  <p className="text-[11px] font-semibold text-[#D4AF37] mt-1">
                    {game.startTime ? new Date(game.startTime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "Por definir"}
                  </p>
                </div>
              </div>

              {/* Progreso */}
              {game.participantCount > 0 && (
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-[#c8b78e] mb-1.5">
                    <span>Progreso</span>
                    <span>{Math.min(100, Math.round((game.participantCount / game.maxPlayers) * 100))}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#12100b] border border-white/10">
                    <div
                      className={`h-full rounded-full ${
                        game.participantCount === game.maxPlayers
                          ? "bg-red-500"
                          : "bg-gradient-to-r from-[#D4AF37] via-[#B8860B] to-[#8B7355]"
                      }`}
                      style={{ width: `${Math.min(100, Math.round((game.participantCount / game.maxPlayers) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Cooldown activo: contador hasta poder unirse de nuevo */}
              {game.inCooldown && game.cooldownSecondsRemaining > 0 && !isAlreadyJoined && (
                <CooldownBanner
                  secondsRemaining={game.cooldownSecondsRemaining}
                  onExpire={() => void loadDetails()}
                />
              )}

              {/* Personaje y Botón */}
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

                  {/* Previsualización del personaje seleccionado */}
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

                <button
                  type="button"
                  onClick={game.joinedCharacterIds?.length ? leaveGame : joinGame}
                  disabled={
                    (!game.joinedCharacterIds?.length && (!selectedCharacter || !characters.length)) ||
                    (!game.joinedCharacterIds?.length && game.inCooldown) ||
                    joining ||
                    leaving ||
                    game.isFull
                  }
                  className="w-full rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#C29431] to-[#8B7355] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#121011] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)] transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                >
                  {joining || leaving
                    ? "Procesando..."
                    : game.joinedCharacterIds?.length
                    ? "Salir"
                    : game.isFull
                    ? "Llena"
                    : game.inCooldown
                    ? "En descanso"
                    : "Unirse"}
                </button>
              </div>

              {error && (
                <p className="rounded-2xl border border-rose-500/30 bg-[#2b1814] px-3 py-2 text-xs text-rose-200">
                  {error}
                </p>
              )}
            </div>
          </article>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerDetallesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
      </div>
    }>
      <VerDetallesContent />
    </Suspense>
  );
}