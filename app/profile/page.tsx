"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "../components/header";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useAuth } from "@/lib/useAuth";
import { getAccountLevelTitle } from "@/lib/accountLevel";
import EquipmentModal, { EquipmentPreview } from "./bolsa/bolsa";
import FantasyAlert from "@/components/ui/fantasy-alert";
import PortraitPicker from "./components/portrait-picker";

type Player = {
  name: string;
  role: string;
  level: number;
  home: string;
  oro: number;
  maxCharacterSlots: number;
  nivel20Url: string | null;
};

type ArmorSlots = {
  cabeza?: string;
  armadura?: string;
  pecho?: string;
  guante?: string;
  botas?: string;
};

type AccessorySlots = {
  collar?: string;
  anillo1?: string;
  anillo2?: string;
  amuleto?: string;
  cinturon?: string;
};

type WeaponSlots = {
  manoIzquierda?: string;
  manoDerecha?: string;
};

type ItemType =
  | "cabeza"
  | "armadura"
  | "pecho"
  | "guante"
  | "botas"
  | "collar"
  | "anillo"
  | "amuleto"
  | "cinturón"
  | "capa"
  | "arma"
  | "accesorio-arma"
  | "accesorio-capa";

type Item = {
  name: string;
  type: ItemType;
  price?: number;
};

type Bag = {
  items: Item[];
  maxSlots: number;
};

type ClassEntry = {
  className: string;
  level: number;
};

type Character = {
  id: number;
  name: string;
  multiclass: ClassEntry[]; // máximo 3 clases
  race: string;
  alignment: string;
  portrait: string;
  stats: Record<string, number>;
  armor: ArmorSlots;
  accessories: AccessorySlots;
  weapons: WeaponSlots;
  bag: Bag;
};

type ProfileResponse = {
  player: Player;
  characters: Character[];
};

type ProfileAlert = {
  id: number;
  title: string;
  message: string;
  variant: "info" | "success" | "warning" | "error";
};

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

type SleepOption = {
  id: string;
  name: string;
  description: string;
  cost: number;
  homeLabel: string;
};

type SleepPendingCharacter = {
  pendingId: string;
  characterId: number;
  characterName: string;
  partidaId: string | null;
  partidaTitle: string;
  requiredAt: string | null;
  partidaFinalizedAt: string | null;
};

type SleepStatusResponse = {
  playerGold: number;
  options: SleepOption[];
  pendingCharacters: SleepPendingCharacter[];
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, token } = useAuth();
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [openBagModal, setOpenBagModal] = useState<number | null>(null);
  const [bagItems, setBagItems] = useState<Item[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(
    null,
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [profileAlert, setProfileAlert] = useState<ProfileAlert | null>(null);
  const [openGames, setOpenGames] = useState<OpenPartida[]>([]);
  const [loadingOpenGames, setLoadingOpenGames] = useState(false);
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);
  const [selectedCharacterByGame, setSelectedCharacterByGame] = useState<
    Record<string, number>
  >({});
  const [sleepStatus, setSleepStatus] = useState<SleepStatusResponse | null>(null);
  const [loadingSleepStatus, setLoadingSleepStatus] = useState(false);
  const [resolvingSleep, setResolvingSleep] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [slotUpgradeMessage, setSlotUpgradeMessage] = useState<string | null>(null);
  const [isUpgradingSlots, setIsUpgradingSlots] = useState(false);
  const [nivel20UrlInput, setNivel20UrlInput] = useState("");
  const [savingNivel20Url, setSavingNivel20Url] = useState(false);
  const [newCharacter, setNewCharacter] = useState<{
    name: string;
    race: string;
    multiclass: ClassEntry[];
    alignment: string;
  }>({
    name: "",
    race: "",
    multiclass: [{ className: "", level: 1 }],
    alignment: "",
  });

  const showProfileAlert = (
    title: string,
    message: string,
    variant: ProfileAlert["variant"],
  ) => {
    setProfileAlert({
      id: Date.now(),
      title,
      message,
      variant,
    });
  };

  const formatCooldown = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    const res = await fetch(`/api/profile?userId=${user.id}`);
    const data = (await res.json()) as ProfileResponse;

    setProfile({
      ...data,
      player: {
        name: user.name,
        role: user.role,
        level: user.level,
        home: data.player.home,
        oro: user.oro,
        maxCharacterSlots: data.player.maxCharacterSlots ?? 2,
        nivel20Url: data.player.nivel20Url ?? null,
      },
    });

    setNivel20UrlInput(data.player.nivel20Url ?? "");
  }, [isAuthenticated, user]);

  const normalizeNivel20UrlForClient = (rawValue: string): {
    value: string | null;
    error: string | null;
  } => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return { value: null, error: null };
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { value: null, error: "Ingresa una URL valida" };
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return {
        value: null,
        error: "La URL debe iniciar con http:// o https://",
      };
    }

    const hostname = parsed.hostname.toLowerCase();
    const isNivel20Domain =
      hostname === "nivel20.com" || hostname.endsWith(".nivel20.com");

    if (!isNivel20Domain) {
      return {
        value: null,
        error: "Solo se permiten enlaces de nivel20.com",
      };
    }

    return { value: parsed.toString(), error: null };
  };

  const saveNivel20Url = async () => {
    if (!token || !profile) return;

    const normalized = normalizeNivel20UrlForClient(nivel20UrlInput);
    if (normalized.error) {
      showProfileAlert("URL invalida", normalized.error, "warning");
      return;
    }

    setSavingNivel20Url(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nivel20Url: normalized.value }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        nivel20Url?: string | null;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo guardar el enlace de Nivel20");
      }

      const persistedValue = data.nivel20Url ?? normalized.value;
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              player: {
                ...prev.player,
                nivel20Url: persistedValue,
              },
            }
          : prev,
      );
      setNivel20UrlInput(persistedValue ?? "");

      window.dispatchEvent(new CustomEvent("auth:refresh", { detail: {} }));
      showProfileAlert(
        "Perfil actualizado",
        persistedValue
          ? "Enlace de Nivel20 guardado correctamente."
          : "Enlace de Nivel20 eliminado.",
        "success",
      );
    } catch (error) {
      console.error("Error saving Nivel20 URL:", error);
      showProfileAlert(
        "No se pudo guardar",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
      );
    } finally {
      setSavingNivel20Url(false);
    }
  };

  const loadSleepStatus = useCallback(async () => {
    if (!isAuthenticated || !token) return;

    setLoadingSleepStatus(true);
    try {
      const res = await fetch("/api/profile/sleep-options", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("No se pudo cargar el estado de descanso");
      }

      const data = (await res.json()) as SleepStatusResponse;
      setSleepStatus(data);
    } catch (error) {
      console.error("Error loading sleep status:", error);
    } finally {
      setLoadingSleepStatus(false);
    }
  }, [isAuthenticated, token]);

  const resolveSleepDecision = async (
    pendingId: string,
    action: "pay" | "decline",
    optionId?: string,
  ) => {
    if (!token) return;

    setResolvingSleep(true);
    try {
      const res = await fetch("/api/profile/sleep-options", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pendingId, action, optionId: optionId ?? null }),
      });

      const data = await res.json().catch(() => ({}));
      const message = String(data.message ?? "No se pudo resolver el descanso");

      if (!res.ok && !data.eliminated) {
        throw new Error(String(data.error ?? message));
      }

      showProfileAlert(
        data.eliminated ? "Personaje eliminado" : "Descanso resuelto",
        message,
        data.eliminated ? "error" : "success",
      );

      setShowDeleteConfirmModal(false);

      if (typeof data.newGold === "number") {
        window.dispatchEvent(
          new CustomEvent("auth:refresh", {
            detail: { oro: data.newGold },
          }),
        );
      }

      await Promise.all([loadSleepStatus(), loadProfile(), loadOpenGames()]);
    } catch (error) {
      console.error("Error resolving sleep decision:", error);
      showProfileAlert(
        "No se pudo resolver",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
      );
    } finally {
      setResolvingSleep(false);
    }
  };

  const loadOpenGames = useCallback(async () => {
    if (!token) return;

    setLoadingOpenGames(true);
    try {
      const res = await fetch("/api/partidas", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("No se pudieron cargar las partidas");
      }

      const data = (await res.json()) as OpenPartida[];
      setOpenGames(data);
    } catch (error) {
      console.error("Error loading open games:", error);
      showProfileAlert(
        "Error",
        "No se pudieron cargar las partidas activas.",
        "error",
      );
    } finally {
      setLoadingOpenGames(false);
    }
  }, [token]);

  const joinGame = async (gameId: string) => {
    if (!token) return;
    const characterId = selectedCharacterByGame[gameId];

    if (!characterId) {
      showProfileAlert(
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo unir a la partida");
      }

      showProfileAlert(
        "Inscripción completada",
        "Te uniste correctamente a la partida.",
        "success",
      );
      await loadOpenGames();
    } catch (error) {
      console.error("Error joining game:", error);
      showProfileAlert(
        "No se pudo unir",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
      );
    } finally {
      setJoiningGameId(null);
    }
  };

  const saveBagChanges = async (
    characterId: number,
    updatedCharacter?: Character,
    updatedBagItems?: Item[],
  ) => {
    const characterToSave = updatedCharacter ?? currentCharacter;
    const itemsToSave = updatedBagItems ?? bagItems;

    if (!profile || !user || !characterToSave) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile/update-bag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          characterId,
          bagItems: itemsToSave,
          armor: characterToSave.armor,
          accessories: characterToSave.accessories,
          weapons: characterToSave.weapons,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update bag");
      }

      // Actualizar el estado local solo si la API responde exitosamente
      setProfile({
        ...profile,
        characters: profile.characters.map((char) =>
          char.id === characterId
            ? {
                ...char,
                ...(updatedCharacter ?? {}),
                bag: { ...char.bag, items: itemsToSave },
                armor: characterToSave.armor,
                accessories: characterToSave.accessories,
                weapons: characterToSave.weapons,
              }
            : char,
        ),
      });
      setOpenBagModal(null);
    } catch (error) {
      console.error("Error saving bag changes:", error);
      showProfileAlert(
        "Error al guardar",
        "Error al guardar los cambios. Inténtalo de nuevo.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const createCharacter = async () => {
    if (!user || !profile) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/profile/create-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          characterData: newCharacter,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create character");
      }

      setProfile({
        ...profile,
        characters: [...profile.characters, data.character],
      });

      setNewCharacter({
        name: "",
        race: "",
        multiclass: [{ className: "", level: 1 }],
        alignment: "",
      });
      setShowCreateModal(false);
      showProfileAlert(
        "Personaje creado",
        "¡Personaje creado exitosamente!",
        "success",
      );
    } catch (error) {
      console.error("Error creating character:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      showProfileAlert(
        "Error al crear personaje",
        `Error al crear el personaje: ${errorMessage}`,
        "error",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const createSlotUnlockOrder = async (): Promise<string> => {
    if (!token) {
      throw new Error("No autorizado");
    }

    const res = await fetch("/api/profile/slots-paypal/create-order", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await res.json()) as {
      orderId?: string;
      fromSlots?: number;
      toSlots?: number;
      error?: string;
    };

    if (!res.ok || !data.orderId) {
      throw new Error(data.error ?? "No se pudo crear la orden PayPal");
    }

    return data.orderId;
  };

  const captureSlotUnlockOrder = async (orderId: string) => {
    if (!token) {
      throw new Error("No autorizado");
    }

    const res = await fetch("/api/profile/slots-paypal/capture-order", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    });

    const data = (await res.json()) as {
      success?: boolean;
      status?: string;
      alreadyCaptured?: boolean;
      newMaxCharacterSlots?: number;
      error?: string;
    };

    if (!res.ok) {
      throw new Error(data.error ?? "No se pudo capturar el pago");
    }

    if (data.success) {
      const slotsLabel = data.newMaxCharacterSlots
        ? `${data.newMaxCharacterSlots}/5`
        : "actualizado";
      setSlotUpgradeMessage(
        data.alreadyCaptured
          ? `Este pago ya estaba confirmado. Slots: ${slotsLabel}.`
          : `Upgrade confirmado. Slots actuales: ${slotsLabel}.`,
      );
    }

    await loadProfile();
  };

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    loadOpenGames();
    loadSleepStatus();
  }, [isAuthenticated, token, loadOpenGames, loadSleepStatus]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const intervalId = window.setInterval(() => {
      loadSleepStatus();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, token, loadSleepStatus]);

  // Mostrar loading mientras se verifica autenticación
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground mt-4">Cargando...</p>
        </div>
      </div>
    );
  }

  const player = profile?.player;
  const characters = profile?.characters ?? [];
  const maxCharacterSlots = player?.maxCharacterSlots ?? 2;
  const reachedCharacterLimit = characters.length >= maxCharacterSlots;
  const canUnlockMoreSlots = maxCharacterSlots < 5;
  const nextSlotTarget = Math.min(5, maxCharacterSlots + 1);
  const pendingSleepCharacter = sleepStatus?.pendingCharacters?.[0] ?? null;
  const hasPendingSleep = !!pendingSleepCharacter;

  return (
    <div className="min-h-screen bg-background">
      {profileAlert && (
        <FantasyAlert
          key={profileAlert.id}
          open
          title={profileAlert.title}
          message={profileAlert.message}
          variant={profileAlert.variant}
          onClose={() => setProfileAlert(null)}
        />
      )}

      {/* Background texture */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto p-4">
        <Header />

        <div className="space-y-10 mt-6">
          <section className="rounded-lg border-2 border-[#8B7355] bg-card/80 backdrop-blur-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-[#B8860B] text-xs tracking-[0.3em] uppercase">
                  Perfil del Jugador
                </p>
                <h1 className="text-3xl font-serif text-[#D4AF37] tracking-wide mt-2">
                  {player?.name ?? "Cargando..."}
                </h1>
                <p className="text-muted-foreground mt-2">
                  {player
                    ? `${player.role} · ${getAccountLevelTitle(player.level)} (Nivel ${player.level}) · ${player.home}`
                    : "Obteniendo datos del perfil"}
                </p>
                {player && (
                  <div className="flex items-center gap-1.5 mt-3">
                    <span className="text-xl">🪙</span>
                    <span className="text-2xl font-bold text-yellow-400 font-serif">
                      {(player.oro ?? 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-widest self-end mb-1">
                      oro
                    </span>
                  </div>
                )}

                <div className="mt-4 space-y-3 max-w-2xl">
                  <label className="block text-xs tracking-[0.2em] uppercase text-[#B8860B]">
                    Link de Nivel20
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={nivel20UrlInput}
                      onChange={(e) => setNivel20UrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveNivel20Url();
                        }
                      }}
                      placeholder="https://nivel20.com/games/dnd-5"
                      className="w-full px-3 py-2 rounded border border-border bg-secondary/30 text-foreground focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={saveNivel20Url}
                      disabled={savingNivel20Url}
                      className="px-4 py-2 rounded bg-[#D4AF37] text-background font-semibold shadow hover:bg-[#B8860B] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingNivel20Url ? "Guardando..." : "Guardar"}
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Se permite nivel20.com y subdominios (por ejemplo www.nivel20.com).
                  </p>

                  {player?.nivel20Url && (
                    <a
                      href={player.nivel20Url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-[#D4AF37] hover:text-[#B8860B] underline underline-offset-4"
                    >
                      Abrir mi partida en Nivel20
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded border border-[#B8860B] text-[#B8860B] text-xs uppercase">
                  {characters.length} personaje
                  {characters.length === 1 ? "" : "s"}
                </span>
                <span className="px-3 py-1 rounded bg-secondary text-foreground text-xs uppercase">
                  Activo
                </span>
                <button
                  disabled={reachedCharacterLimit}
                  onClick={() => setShowCreateModal(true)}
                  className={`px-4 py-2 rounded font-semibold text-sm transition-all ${
                    reachedCharacterLimit
                      ? "bg-secondary text-muted-foreground cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white shadow hover:shadow-lg"
                  }`}
                  title={
                    reachedCharacterLimit
                      ? `Limite alcanzado (${characters.length}/${maxCharacterSlots}).`
                      : "Crear nuevo personaje"
                  }
                >
                  {reachedCharacterLimit
                    ? "Límite alcanzado 🔒"
                    : "Crear Personaje"}
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Slots de personaje: <span className="text-foreground font-semibold">{characters.length}/{maxCharacterSlots}</span>
              </p>

              <div className="rounded-lg border border-amber-400/40 bg-amber-900/20 p-3 space-y-3">
                {canUnlockMoreSlots ? (
                  <p className="text-sm text-amber-200">
                    Desbloquea +1 slot por $10.00 USD. Pasaras de {maxCharacterSlots} a {nextSlotTarget} slots.
                  </p>
                ) : (
                  <p className="text-sm text-emerald-200">
                    Ya tienes el maximo de slots desbloqueados (5/5).
                  </p>
                )}

                {!paypalClientId ? (
                  <p className="text-xs text-amber-300">
                    Configura NEXT_PUBLIC_PAYPAL_CLIENT_ID para habilitar el pago.
                  </p>
                ) : (
                  <PayPalScriptProvider
                    options={{
                      clientId: paypalClientId,
                      "client-id": paypalClientId,
                      currency: "USD",
                      intent: "capture",
                    }}
                  >
                    <PayPalButtons
                      style={{
                        layout: "horizontal",
                        label: "paypal",
                        color: "gold",
                        tagline: false,
                      }}
                      disabled={isUpgradingSlots || !canUnlockMoreSlots}
                      createOrder={async () => {
                        setSlotUpgradeMessage(null);
                        setIsUpgradingSlots(true);
                        try {
                          return await createSlotUnlockOrder();
                        } catch (error: unknown) {
                          setIsUpgradingSlots(false);
                          throw error;
                        }
                      }}
                      onApprove={async (data) => {
                        if (!data.orderID) {
                          showProfileAlert(
                            "Error de pago",
                            "PayPal no devolvio orderID.",
                            "error",
                          );
                          setIsUpgradingSlots(false);
                          return;
                        }

                        try {
                          await captureSlotUnlockOrder(data.orderID);
                          showProfileAlert(
                            "Pago confirmado",
                            "Tu slot adicional ya fue activado.",
                            "success",
                          );
                        } catch (error: unknown) {
                          showProfileAlert(
                            "Error de pago",
                            error instanceof Error ? error.message : "No se pudo confirmar el pago",
                            "error",
                          );
                        } finally {
                          setIsUpgradingSlots(false);
                        }
                      }}
                      onCancel={() => {
                        setSlotUpgradeMessage("Pago cancelado por el usuario.");
                        setIsUpgradingSlots(false);
                      }}
                      onError={(error) => {
                        showProfileAlert(
                          "Error de PayPal",
                          error instanceof Error ? error.message : "No se pudo procesar el pago",
                          "error",
                        );
                        setIsUpgradingSlots(false);
                      }}
                    />
                  </PayPalScriptProvider>
                )}

                {slotUpgradeMessage && (
                  <p className="text-xs text-amber-200">{slotUpgradeMessage}</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border-2 border-[#8B7355] bg-card/80 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[#B8860B] text-xs tracking-[0.3em] uppercase">
                  Partidas Públicas
                </p>
                <h2 className="text-xl font-serif text-[#D4AF37] mt-1">
                  Únete a una partida activa
                </h2>
              </div>
              <button
                type="button"
                onClick={loadOpenGames}
                disabled={loadingOpenGames}
                className="px-3 py-2 rounded border border-border text-sm hover:bg-secondary/60 disabled:opacity-60"
              >
                {loadingOpenGames ? "Cargando..." : "Actualizar"}
              </button>
            </div>

            {loadingOpenGames ? (
              <p className="text-sm text-muted-foreground">Buscando partidas activas...</p>
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
                          <h3 className="text-lg font-semibold text-foreground">{game.title}</h3>
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
                          {game.inCooldown
                            ? "En cooldown"
                            : game.isFull
                              ? "Completa"
                              : "Abierta"}
                        </span>
                      </div>

                      {game.comment && (
                        <p className="text-sm text-muted-foreground">{game.comment}</p>
                      )}

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
                          disabled={!canJoin || characters.length === 0}
                          className="px-3 py-2 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#D4AF37] disabled:opacity-60 [&>option]:bg-background [&>option]:text-foreground"
                        >
                          <option value="">Selecciona personaje</option>
                          {characters.map((character) => (
                            <option
                              key={character.id}
                              value={character.id}
                              disabled={game.joinedCharacterIds.includes(character.id)}
                            >
                              {character.name}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => joinGame(game.id)}
                          disabled={!canJoin || joiningGameId === game.id || characters.length === 0}
                          className="px-4 py-2 rounded bg-[#D4AF37] text-background font-semibold hover:bg-[#B8860B] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {joiningGameId === game.id
                            ? "Uniéndote..."
                            : alreadyJoined
                              ? "Ya estás inscrito"
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

          <section className="space-y-6">
            {characters.map((character) => (
              <article
                key={character.id}
                className="rounded-lg border-2 border-[#8B7355] bg-card/80 p-6 grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6"
              >
                <div className="space-y-4">
                  <div className="relative aspect-square w-64 md:w-72 mx-auto rounded border-2 border-[#8B7355] overflow-hidden bg-secondary/40">
                    <Image
                      src={character.portrait || "/characters/profileplaceholder.webp"}
                      alt={`${character.name} portrait`}
                      fill
                      quality={100}
                      className="object-cover"
                    />
                  </div>
                  {user && (
                    <PortraitPicker
                      userId={user.id}
                      characterId={character.id}
                      currentPortrait={character.portrait}
                      onPortraitUpdated={(characterId, portrait) => {
                        setProfile((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            characters: prev.characters.map((char) =>
                              char.id === characterId
                                ? { ...char, portrait }
                                : char,
                            ),
                          };
                        });

                        setCurrentCharacter((prev) =>
                          prev && prev.id === characterId
                            ? { ...prev, portrait }
                            : prev,
                        );
                      }}
                      onAlert={showProfileAlert}
                    />
                  )}
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground tracking-[0.3em] uppercase">
                      {character.race}
                    </p>
                    <h2 className="text-2xl font-serif text-[#D4AF37] tracking-wide">
                      {character.name}
                    </h2>
                    <div className="mt-2 space-y-1">
                      {(character.multiclass ?? []).map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-center gap-2"
                        >
                          <span className="text-sm text-muted-foreground">
                            {entry.className}{" "}
                            <span className="text-[#D4AF37] font-semibold">
                              Nv.{entry.level}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="px-3 py-2 rounded bg-[#8B7355] text-background text-center text-sm">
                      {character.alignment}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(character.stats).map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded border border-border/60 bg-secondary/40 p-3 text-center"
                      >
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">
                          {label}
                        </p>
                        <p className="text-2xl font-semibold text-foreground mt-1">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <EquipmentPreview character={character} />

                  <div className="flex justify-end mt-2">
                    <button
                      className="px-4 py-2 rounded bg-[#D4AF37] text-background font-semibold shadow hover:bg-[#B8860B] transition"
                      onClick={() => {
                        setOpenBagModal(character.id);
                        setCurrentCharacter(character);
                        setBagItems(character.bag.items);
                      }}
                    >
                      Abrir Bolsa
                    </button>
                  </div>
                  {openBagModal === character.id && (
                    <EquipmentModal
                      userId={user?.id ?? ""}
                      character={character}
                      onClose={() => setOpenBagModal(null)}
                      onSave={async (updatedCharacter, updatedBagItems) => {
                        const nextCharacter = updatedCharacter as Character;
                        const nextBagItems = updatedBagItems as Item[];

                        setCurrentCharacter(nextCharacter);
                        setBagItems(nextBagItems);
                        await saveBagChanges(
                          character.id,
                          nextCharacter,
                          nextBagItems,
                        );
                      }}
                      onGoldUpdate={(newGold) => {
                        setProfile((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            player: {
                              ...prev.player,
                              oro: newGold,
                            },
                          };
                        });

                        window.dispatchEvent(
                          new CustomEvent("auth:refresh", {
                            detail: { oro: newGold },
                          }),
                        );
                      }}
                    />
                  )}
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>

      {hasPendingSleep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border-2 border-[#8B7355] bg-[#12100d] p-6 shadow-2xl space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#B8860B]">
                Descanso Obligatorio
              </p>
              <h2 className="text-2xl font-serif text-[#D4AF37] mt-2">
                {pendingSleepCharacter.characterName} debe elegir donde dormir
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                La partida "{pendingSleepCharacter.partidaTitle}" finalizo. Si no pagas descanso,
                el personaje sera eliminado de la base de datos.
              </p>
            </div>

            <div className="rounded border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
              Oro disponible: <span className="text-yellow-400 font-semibold">{(sleepStatus?.playerGold ?? 0).toLocaleString()}</span>
            </div>

            <div className="space-y-3">
              {(sleepStatus?.options ?? []).map((option) => {
                const canPay = (sleepStatus?.playerGold ?? 0) >= option.cost;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      resolveSleepDecision(
                        pendingSleepCharacter.pendingId,
                        "pay",
                        option.id,
                      )
                    }
                    disabled={resolvingSleep || loadingSleepStatus}
                    className="w-full text-left rounded border border-border bg-background/60 p-4 hover:border-[#D4AF37] hover:bg-background transition disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-foreground">{option.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#D4AF37] font-bold">{option.cost} oro</p>
                        {!canPay && <p className="text-xs text-red-400">No alcanza</p>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(true)}
                disabled={resolvingSleep || loadingSleepStatus}
                className="w-full px-4 py-2 rounded border border-red-700/60 text-red-300 hover:bg-red-900/20 transition disabled:opacity-60"
              >
                No pagar (eliminar personaje de la base de datos)
              </button>
            </div>
          </div>

          {showDeleteConfirmModal && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70">
              <div className="w-full max-w-md rounded-xl border border-red-700/70 bg-[#1b0f0d] p-5 shadow-2xl space-y-4">
                <h3 className="text-lg font-semibold text-red-300">
                  Confirmar eliminación
                </h3>
                <p className="text-sm text-red-100/90 leading-relaxed">
                  El personaje va a ser eliminado permanentemente, ¿estás seguro?
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirmModal(false)}
                    disabled={resolvingSleep}
                    className="flex-1 px-4 py-2 rounded border border-border text-foreground hover:bg-secondary/40 transition disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      resolveSleepDecision(pendingSleepCharacter.pendingId, "decline")
                    }
                    disabled={resolvingSleep}
                    className="flex-1 px-4 py-2 rounded bg-red-700 text-white hover:bg-red-800 transition disabled:opacity-60"
                  >
                    Sí, eliminar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Crear Personaje */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/20 p-4">
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-2xl relative">
            <button
              className="absolute top-4 right-4 text-2xl text-muted-foreground hover:text-foreground w-8 h-8 flex items-center justify-center rounded hover:bg-secondary"
              onClick={() => setShowCreateModal(false)}
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-6 text-[#D4AF37] uppercase tracking-wider">
              Crear Nuevo Personaje
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nombre del Personaje
                </label>
                <input
                  type="text"
                  value={newCharacter.name}
                  onChange={(e) =>
                    setNewCharacter({ ...newCharacter, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded border border-border bg-secondary/30 text-foreground focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  placeholder="Ej: Aragorn"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Raza
                  </label>
                  <input
                    type="text"
                    value={newCharacter.race}
                    onChange={(e) =>
                      setNewCharacter({ ...newCharacter, race: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded border border-border bg-secondary/30 text-foreground focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    placeholder="Ej: Elfo, Humano, Semiorco..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Alineamiento
                  </label>
                  <select
                    value={newCharacter.alignment}
                    onChange={(e) =>
                      setNewCharacter({
                        ...newCharacter,
                        alignment: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded border border-border bg-[#1a1a1a] text-foreground focus:outline-none focus:ring-2 focus:ring-[#D4AF37] [&>option]:bg-[#1a1a1a] [&>option]:text-foreground"
                  >
                    <option value="">Selecciona un alineamiento</option>
                    <option value="Legal Bueno">Legal Bueno</option>
                    <option value="Legal Neutral">Legal Neutral</option>
                    <option value="Legal Malo">Legal Malo</option>
                    <option value="Neutral Bueno">Neutral Bueno</option>
                    <option value="Neutral">Neutral</option>
                    <option value="Neutral Malo">Neutral Malo</option>
                    <option value="Caótico Bueno">Caótico Bueno</option>
                    <option value="Caótico Neutral">Caótico Neutral</option>
                    <option value="Caótico Malo">Caótico Malo</option>
                  </select>
                </div>
              </div>

              {/* Multiclase - máximo 3 clases */}
              <div>
                <div className="flex items-center mb-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Clases{" "}
                    <span className="text-xs text-muted-foreground/60">
                      ({newCharacter.multiclass.length}/3)
                    </span>
                  </label>
                </div>
                <div className="space-y-2">
                  {newCharacter.multiclass.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={entry.className}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewCharacter((prev) => ({
                            ...prev,
                            multiclass: prev.multiclass.map((c, i) =>
                              i === idx ? { ...c, className: val } : c,
                            ),
                          }));
                        }}
                        className="flex-1 px-3 py-2 rounded border border-border bg-[#1a1a1a] text-foreground focus:outline-none focus:ring-2 focus:ring-[#D4AF37] [&>option]:bg-[#1a1a1a] [&>option]:text-foreground"
                      >
                        <option value="">Selecciona una clase</option>
                        {[
                          { value: "Bárbaro", label: "Bárbaro" },
                          { value: "Bardo", label: "Bardo" },
                          { value: "Clérigo", label: "Clérigo" },
                          { value: "Druida", label: "Druida" },
                          { value: "Guerrero", label: "Guerrero" },
                          { value: "Monje", label: "Monje" },
                          { value: "Paladín", label: "Paladín" },
                          { value: "Explorador", label: "Explorador" },
                          { value: "Pícaro", label: "Pícaro" },
                          { value: "Hechicero", label: "Hechicero" },
                          { value: "Brujo", label: "Brujo" },
                          { value: "Mago", label: "Mago" },
                        ]
                          .filter(
                            (cls) =>
                              cls.value === entry.className ||
                              !newCharacter.multiclass.some(
                                (c, i) =>
                                  i !== idx && c.className === cls.value,
                              ),
                          )
                          .map((cls) => (
                            <option key={cls.value} value={cls.value}>
                              {cls.label}
                            </option>
                          ))}
                      </select>

                      {newCharacter.multiclass.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setNewCharacter((prev) => ({
                              ...prev,
                              multiclass: prev.multiclass.filter(
                                (_, i) => i !== idx,
                              ),
                            }))
                          }
                          className="px-2 py-2 text-red-500 hover:bg-red-500/10 rounded transition text-sm"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {newCharacter.multiclass.length < 3 && (
                  <button
                    type="button"
                    onClick={() =>
                      setNewCharacter((prev) => ({
                        ...prev,
                        multiclass: [
                          ...prev.multiclass,
                          { className: "", level: 1 },
                        ],
                      }))
                    }
                    className="mt-2 w-full text-xs px-2 py-1.5 rounded border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10 transition"
                  >
                    + Añadir clase
                  </button>
                )}
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-4">
                  📝 Nota: Los atributos y equipo inicial se generarán
                  automáticamente según la clase seleccionada.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewCharacter({
                        name: "",
                        race: "",
                        multiclass: [{ className: "", level: 1 }],
                        alignment: "",
                      });
                    }}
                    disabled={isCreating}
                    className="flex-1 px-4 py-2 rounded border border-border bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={createCharacter}
                    disabled={isCreating}
                    className="flex-1 px-4 py-2 rounded bg-[#D4AF37] text-background font-semibold shadow hover:bg-[#B8860B] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? "Creando..." : "Crear Personaje"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}