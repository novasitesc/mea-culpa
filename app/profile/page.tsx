"use client";

// Perfil (/profile): la pantalla central del jugador.
// Carga todo de un tirón desde GET /api/profile (perfil, oro, personajes con
// clases, estadísticas, equipo y bolsa) y reparte esos datos entre la rejilla de
// personajes, la bolsa y los modales.
// Es la única pantalla accesible cuando todos los personajes están muertos.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reduceMotion, useSmoothScroll } from "@/lib/useSmoothScroll";
import Header from "../components/header";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { initMercadoPago } from "@mercadopago/sdk-react";
import { useAuth } from "@/lib/useAuth";
import { getAccountLevelTitle } from "@/lib/accountLevel";
import EquipmentModal from "./bolsa/bolsa";
import FantasyAlert from "@/components/ui/fantasy-alert";
import CharacterGrid from "./components/character-grid";
import PartidasHistorial from "./components/partidas-historial";
import AnimatedNumber from "../components/animated-number";
import CreateCharacterModal, {
  type CreateCharacterPayload,
} from "./components/create-character-modal";
import { type SpellEntry } from "@/lib/spells";
import { type UnidadEjercito } from "@/lib/ejercito";
import { Coins, HeartPulse, Lock, Plus, UserPlus } from "lucide-react";

type Player = {
  name: string;
  role: string;
  level: number;
  home: string;
  oro: number;
  maxCharacterSlots: number;
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
  anillo3?: string;
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
  | "gema-arma"
  | "gema-capa"
  | "accesorio-arma"
  | "accesorio-capa";

type Item = {
  name: string;
  type: ItemType;
  price?: number;
  description?: string | null;
  requiresTwoHands?: boolean;
};

type WeaponSocketKey = "manoizq" | "manoderecha";
type WeaponSockets = Record<WeaponSocketKey, [Item | null, Item | null, Item | null]>;
type CapeSockets = [Item | null, Item | null, Item | null];

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
  userId?: string;
  name: string;
  nivel20Url: string | null;
  multiclass: ClassEntry[]; // máximo 3 clases
  race: string;
  alignment: string;
  portrait: string;
  lifeStatus: "vivo" | "muerto";
  deadAt: string | null;
  revivedAt: string | null;
  hasDismemberedLimb: boolean;
  dismemberedLimbs: string[];
  stats: Record<string, number>;
  armor: ArmorSlots;
  accessories: AccessorySlots;
  weapons: WeaponSlots;
  weaponSockets?: WeaponSockets;
  capeSockets?: CapeSockets;
  knownSpells?: SpellEntry[];
  /** Conjuros ya gastados (claves en minúsculas); el descanso largo los devuelve. */
  usedSpells?: string[];
  bag: Bag;
  /** Inventario de ejército (5 casillas), aparte de la mochila. */
  army?: { units: UnidadEjercito[]; maxSlots: number };
  equipmentRequiresTwoHandsByName?: Record<string, boolean>;
  puntoCansancio: number;
  caidas: number;
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

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, token } = useAuth();
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
  const mpPublicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";

  useEffect(() => {
    if (mpPublicKey) {
      initMercadoPago(mpPublicKey, { locale: "es-MX" });
    }
  }, [mpPublicKey]);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [openBagModal, setOpenBagModal] = useState<number | null>(null);
  const [bagItems, setBagItems] = useState<Item[]>([]);
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(
    null,
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [profileAlert, setProfileAlert] = useState<ProfileAlert | null>(null);
  const [slotUpgradeMessage, setSlotUpgradeMessage] = useState<string | null>(null);
  const [isUpgradingSlots, setIsUpgradingSlots] = useState(false);
  const [selectedDeadCharacterId, setSelectedDeadCharacterId] = useState<number | null>(null);
  const [isRevivingCharacter, setIsRevivingCharacter] = useState(false);
  const [reviveMessage, setReviveMessage] = useState<string | null>(null);
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Los pagos viven plegados: son la sección más alta de la página y la que
  // menos veces se usa. Solo puede haber una abierta a la vez.
  const [tienda, setTienda] = useState<"slots" | "revive" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useSmoothScroll();
  const [deleteStep, setDeleteStep] = useState<"confirm" | "transfer">("confirm");
  const [transferTarget, setTransferTarget] = useState<{ type: "character" | "guild" | "none"; targetId?: number }>({ type: "none" });

  const openDeleteModal = (char: Character) => {
    setCharacterToDelete(char);
    setDeleteStep("confirm");
    // Por defecto si hay otros personajes, preseleccionar el primero
    const otherChars = (profile?.characters ?? []).filter(c => c.id !== char.id);
    if (otherChars.length > 0) {
      setTransferTarget({ type: "character", targetId: otherChars[0].id });
    } else {
      setTransferTarget({ type: "guild" });
    }
  };

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
      },
    });
  }, [isAuthenticated, user]);


  const handleDeleteCharacter = async (transferType = "none", targetId?: number) => {
    if (!characterToDelete || !token) return;
    setIsDeleting(true);
    try {
      let url = `/api/profile/delete-character?characterId=${characterToDelete.id}&transferTargetType=${transferType}`;
      if (targetId) url += `&transferTargetId=${targetId}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar el personaje");

      showProfileAlert(
        "Personaje Eliminado",
        data.message || `Tu personaje ${characterToDelete.name} fue eliminado permanentemente y su slot fue liberado.`,
        "success"
      );
      setCharacterToDelete(null);
      await loadProfile();
    } catch (err: any) {
      showProfileAlert("Error", err.message, "error");
    } finally {
      setIsDeleting(false);
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

    try {
      const response = await fetch("/api/profile/update-bag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          characterId,
          bagItems: itemsToSave,
          armor: characterToSave.armor,
          accessories: characterToSave.accessories,
          weapons: characterToSave.weapons,
          weaponSockets: characterToSave.weaponSockets,
          capeSockets: characterToSave.capeSockets,
        }),
      });

      if (!response.ok) {
        // La ruta manda `error`, `detail` y el código de Postgres. Repetirlos
        // aquí evita que un fallo de inventario llegue como "Failed to update
        // bag" y haya que adivinar cuál de sus siete escrituras se rompió.
        const body = await response.json().catch(() => ({}));
        throw new Error(
          [body?.error ?? "Failed to update bag", body?.detail, body?.code && `(${body.code})`]
            .filter(Boolean)
            .join(" — "),
        );
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
    }
  };

  const createCharacter = async (
    characterData: CreateCharacterPayload,
  ): Promise<boolean> => {
    if (!user || !profile) return false;

    setIsCreating(true);
    try {
      const payload = {
        ...characterData,
        knownSpells: [],
      };

      const response = await fetch("/api/profile/create-character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          characterData: payload,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create character");
      }

      setProfile({
        ...profile,
        // Un personaje recién creado siempre nace vivo; el spread conserva el
        // valor del servidor si viene incluido.
        characters: [
          ...profile.characters,
          { lifeStatus: "vivo", ...data.character },
        ],
      });

      setShowCreateModal(false);
      showProfileAlert(
        "Personaje creado",
        "¡Personaje creado exitosamente!",
        "success",
      );
      return true;
    } catch (error) {
      console.error("Error creating character:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      showProfileAlert(
        "Error al crear personaje",
        `Error al crear el personaje: ${errorMessage}`,
        "error",
      );
      return false;
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

  const createReviveOrder = async (characterId: number): Promise<string> => {
    if (!token) {
      throw new Error("No autorizado");
    }

    const res = await fetch("/api/profile/revive-paypal/create-order", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ characterId }),
    });

    const data = (await res.json()) as {
      orderId?: string;
      error?: string;
    };

    if (!res.ok || !data.orderId) {
      throw new Error(data.error ?? "No se pudo crear la orden de revive");
    }

    return data.orderId;
  };

  const captureReviveOrder = async (orderId: string) => {
    if (!token) {
      throw new Error("No autorizado");
    }

    const res = await fetch("/api/profile/revive-paypal/capture-order", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    });

    const data = (await res.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!res.ok || !data.success) {
      throw new Error(data.error ?? "No se pudo confirmar el revive");
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
    const handler = () => loadProfile();
    window.addEventListener("profile:refresh", handler);
    return () => window.removeEventListener("profile:refresh", handler);
  }, [loadProfile]);

  useEffect(() => {
    const deadOnly = (profile?.characters ?? []).filter(
      (character) => character.lifeStatus === "muerto",
    );
    if (deadOnly.length === 0) {
      setSelectedDeadCharacterId(null);
      return;
    }

    setSelectedDeadCharacterId((prev) => {
      if (prev && deadOnly.some((character) => character.id === prev)) {
        return prev;
      }
      return deadOnly[0].id;
    });
  }, [profile?.characters]);

  // Entradas con GSAP. `gsap.context` acota los selectores a este árbol y hace
  // el `revert()` solo; el `ScrollTrigger` revela las secciones de abajo según
  // llegas a ellas en vez de animarlas todas de golpe al cargar.
  useLayoutEffect(() => {
    if (!profile || reduceMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from("[data-anim='pf-head']", {
        y: 16,
        opacity: 0,
        duration: 0.55,
        stagger: 0.07,
        ease: "power3.out",
      });
      gsap.utils.toArray<HTMLElement>("[data-anim='pf-reveal']").forEach((el) => {
        gsap.from(el, {
          y: 24,
          opacity: 0,
          duration: 0.55,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        });
      });
    }, rootRef);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [profile]);

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
  const deadCharacters = characters.filter((character) => character.lifeStatus === "muerto");
  const maxCharacterSlots = player?.maxCharacterSlots ?? 2;
  const reachedCharacterLimit = characters.length >= maxCharacterSlots;
  const canUnlockMoreSlots = maxCharacterSlots < 5;
  const nextSlotTarget = Math.min(5, maxCharacterSlots + 1);
  const hasAllDead = characters.length > 0 && deadCharacters.length === characters.length;

  const selectedDeadCharacter = deadCharacters.find(
    (character) => character.id === selectedDeadCharacterId,
  );

  const reviveTargetCharacter = selectedDeadCharacter ?? deadCharacters[0] ?? null;

  return (
    <div ref={rootRef} className="min-h-screen bg-background">
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
          <section
            data-anim="pf-reveal"
            className="relative overflow-hidden rounded-lg border-2 border-[#8B7355] bg-card/80 p-6 backdrop-blur-sm"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gold/5 blur-3xl"
            />

            <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p data-anim="pf-head" className="text-xs uppercase tracking-[0.3em] text-[#B8860B]">
                  Perfil del Jugador
                </p>
                <h1
                  data-anim="pf-head"
                  className="mt-2 truncate font-serif text-3xl tracking-wide text-[#D4AF37]"
                >
                  {player?.name ?? "Cargando..."}
                </h1>
                <p data-anim="pf-head" className="mt-2 font-sans text-sm text-muted-foreground">
                  {player
                    ? `${player.role} · ${getAccountLevelTitle(player.level)} (Nivel ${player.level}) · ${player.home}`
                    : "Obteniendo datos del perfil"}
                </p>
                {player && (
                  <div data-anim="pf-head" className="mt-3 flex items-center gap-1.5">
                    <Coins className="h-6 w-6 text-yellow-500" />
                    <AnimatedNumber
                      value={player.oro ?? 0}
                      className="font-serif text-2xl font-bold text-yellow-400 tabular-nums"
                    />
                    <span className="mb-1 self-end text-xs uppercase tracking-widest text-muted-foreground">
                      oro
                    </span>
                  </div>
                )}
              </div>

              {/* Slots como medidor: se lee de un vistazo cuántos te quedan sin
                  necesidad de la línea de texto que había debajo. */}
              <div data-anim="pf-head" className="flex flex-col gap-3 md:items-end">
                <div className="w-full md:w-52">
                  <div className="flex items-baseline justify-between">
                    <span className="font-sans text-[10px] uppercase tracking-widest text-foreground/40">
                      Personajes
                    </span>
                    <span className="font-serif text-sm tabular-nums text-gold">
                      {characters.length}
                      <span className="text-foreground/30">/{maxCharacterSlots}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {Array.from({ length: maxCharacterSlots }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                          i < characters.length ? "bg-gold" : "bg-white/8"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  disabled={reachedCharacterLimit}
                  onClick={() => setShowCreateModal(true)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2 font-sans text-sm font-semibold transition-all active:scale-95 ${
                    reachedCharacterLimit
                      ? "cursor-not-allowed border-border bg-secondary text-muted-foreground"
                      : "border-emerald-500/50 bg-emerald-900/25 text-emerald-200 hover:bg-emerald-900/50"
                  }`}
                  title={
                    reachedCharacterLimit
                      ? `Limite alcanzado (${characters.length}/${maxCharacterSlots}).`
                      : "Crear nuevo personaje"
                  }
                >
                  {reachedCharacterLimit ? (
                    <>
                      Límite alcanzado <Lock className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Crear personaje
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {hasAllDead && (
                <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-200">
                  Todos tus personajes están muertos. Solo puedes usar esta sección de Perfil hasta revivir al menos uno.
                </div>
              )}

              {/* ── Tienda de cuenta ──────────────────────────────────────
                  Dos acciones en una fila; el formulario de pago solo baja
                  cuando lo pides. Antes ocupaba media pantalla en reposo. */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTienda((t) => (t === "slots" ? null : "slots"))}
                  aria-expanded={tienda === "slots"}
                  disabled={!canUnlockMoreSlots}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 font-sans text-xs transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                    tienda === "slots"
                      ? "border-amber-400/60 bg-amber-900/30 text-amber-100"
                      : "border-amber-400/30 bg-amber-900/10 text-amber-200/80 hover:border-amber-400/50 hover:bg-amber-900/20"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {canUnlockMoreSlots ? (
                    <>
                      Desbloquear slot
                      <span className="text-amber-300/60">· $10 USD</span>
                    </>
                  ) : (
                    "Slots al máximo (5/5)"
                  )}
                </button>

                {deadCharacters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTienda((t) => (t === "revive" ? null : "revive"))}
                    aria-expanded={tienda === "revive"}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 font-sans text-xs transition-all active:scale-95 ${
                      tienda === "revive"
                        ? "border-red-500/60 bg-red-900/30 text-red-100"
                        : "border-red-600/30 bg-red-900/10 text-red-200/80 hover:border-red-500/50 hover:bg-red-900/20"
                    }`}
                  >
                    <HeartPulse className="h-3.5 w-3.5" />
                    Revivir personaje
                    <span className="text-red-300/60">· $10 USD</span>
                    <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] text-red-200">
                      {deadCharacters.length}
                    </span>
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {tienda === "slots" && (
                  <motion.div
                    key="slots"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 rounded-lg border border-amber-400/40 bg-amber-900/20 p-3">
                      <p className="font-sans text-sm text-amber-200">
                        Desbloquea +1 slot por $10.00 USD. Pasarás de {maxCharacterSlots} a{" "}
                        {nextSlotTarget} slots.
                      </p>

                      <div className="flex flex-col md:flex-row gap-4 items-start">
                  <div className="flex-1 w-full max-w-50">
                    {!paypalClientId ? (
                      <p className="text-xs text-amber-300">
                        Configura NEXT_PUBLIC_PAYPAL_CLIENT_ID.
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
                            height: 48,
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
                  </div>

                  <div className="flex-1 w-full max-w-[200px] flex items-center justify-center">
                    <button
                      disabled={isUpgradingSlots || !canUnlockMoreSlots}
                      className="w-full h-12 rounded flex items-center justify-center font-bold text-white transition disabled:opacity-50 hover:opacity-90"
                      style={{ backgroundColor: "#009ee3" }}
                      onClick={() => showProfileAlert("Mercado Pago", "La integración con Mercado Pago estará disponible pronto.", "info")}
                    >
                      <img src="/mercado-pago.png" alt="Mercado Pago" className="h-10 object-contain" />
                    </button>
                  </div>
                </div>

                      {slotUpgradeMessage && (
                        <p className="text-xs text-amber-200">{slotUpgradeMessage}</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {tienda === "revive" && deadCharacters.length > 0 && (
                  <motion.div
                    key="revive"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 rounded-lg border border-red-700/50 bg-red-900/20 p-3">
                      <p className="font-sans text-sm text-red-100">
                        Revivir personaje muerto:{" "}
                        <span className="font-semibold">$10.00 USD</span>
                      </p>

                      <select
                      value={selectedDeadCharacterId ?? ""}
                      onChange={(e) =>
                        setSelectedDeadCharacterId(e.target.value ? Number(e.target.value) : null)
                      }
                      className="w-full px-3 py-2 rounded border border-red-600/40 bg-[#2a1212] text-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 [&>option]:bg-[#2a1212] [&>option]:text-red-100"
                    >
                      <option value="">Selecciona personaje muerto</option>
                      {deadCharacters.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-col md:flex-row gap-4 items-start">
                      <div className="flex-1 w-full max-w-50">
                        {!paypalClientId ? (
                          <p className="text-xs text-red-200/80">
                            Configura NEXT_PUBLIC_PAYPAL_CLIENT_ID.
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
                                height: 48,
                              }}
                              disabled={isRevivingCharacter || !reviveTargetCharacter}
                              createOrder={async () => {
                                if (!reviveTargetCharacter) {
                                  throw new Error("Selecciona un personaje muerto");
                                }

                                setReviveMessage(null);
                                setIsRevivingCharacter(true);
                                try {
                                  return await createReviveOrder(reviveTargetCharacter.id);
                                } catch (error: unknown) {
                                  setIsRevivingCharacter(false);
                                  throw error;
                                }
                              }}
                              onApprove={async (data) => {
                                if (!data.orderID) {
                                  showProfileAlert(
                                    "Error de pago",
                                    "PayPal no devolvió orderID.",
                                    "error",
                                  );
                                  setIsRevivingCharacter(false);
                                  return;
                                }

                                try {
                                  await captureReviveOrder(data.orderID);
                                  setReviveMessage("Revivir confirmado. Tu personaje volvió a la vida.");
                                  showProfileAlert("Personaje revivido", "El revive se aplicó correctamente.", "success");
                                } catch (error: unknown) {
                                  showProfileAlert(
                                    "Error de revive",
                                    error instanceof Error ? error.message : "No se pudo confirmar el revive",
                                    "error",
                                  );
                                } finally {
                                  setIsRevivingCharacter(false);
                                }
                              }}
                              onCancel={() => {
                                setReviveMessage("Pago cancelado por el usuario.");
                                setIsRevivingCharacter(false);
                              }}
                              onError={(error) => {
                                showProfileAlert(
                                  "Error de PayPal",
                                  error instanceof Error ? error.message : "No se pudo procesar el pago",
                                  "error",
                                );
                                setIsRevivingCharacter(false);
                              }}
                            />
                          </PayPalScriptProvider>
                        )}
                      </div>

                      <div className="flex-1 w-full max-w-[200px] flex items-center justify-center">
                        <button
                          disabled={isRevivingCharacter || !reviveTargetCharacter}
                          className="w-full h-12 rounded flex items-center justify-center font-bold text-white transition disabled:opacity-50 hover:opacity-90"
                          style={{ backgroundColor: "#009ee3" }}
                          onClick={() => showProfileAlert("Mercado Pago", "La integración con Mercado Pago estará disponible pronto.", "info")}
                        >
                          <img src="/mercado-pago.png" alt="Mercado Pago" className="h-10 object-contain" />
                        </button>
                      </div>
                    </div>

                      {reviveMessage && (
                        <p className="text-xs text-red-100/90">{reviveMessage}</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Character Grid — Compact cards with expand/collapse */}
          <div data-anim="pf-reveal">
          <CharacterGrid
            characters={profile ? characters : null}
            user={user}
            token={token}
            onOpenBag={(character) => {
              setOpenBagModal(character.id);
              setCurrentCharacter(character);
              setBagItems(character.bag.items);
            }}
            onDeleteCharacter={openDeleteModal}
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
            onNivel20Updated={(characterId, url) => {
              setProfile((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  characters: prev.characters.map((char) =>
                    char.id === characterId
                      ? { ...char, nivel20Url: url }
                      : char,
                  ),
                };
              });
            }}
            isDeleting={isDeleting}
            onAlert={showProfileAlert}
          />
          </div>

          <div data-anim="pf-reveal">
            <PartidasHistorial token={token} />
          </div>

          <AnimatePresence>
            {openBagModal !== null && currentCharacter && (
              <EquipmentModal
                key="equipment-modal"
                userId={user?.id ?? ""}
                character={currentCharacter}
                characters={characters}
                onClose={() => setOpenBagModal(null)}
                onRefreshProfile={loadProfile}
                onSave={async (updatedCharacter, updatedBagItems) => {
                  const nextCharacter = updatedCharacter as Character;
                  const nextBagItems = updatedBagItems as Item[];

                  setCurrentCharacter(nextCharacter);
                  setBagItems(nextBagItems);
                  await saveBagChanges(openBagModal, nextCharacter, nextBagItems);
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
          </AnimatePresence>
        </div>
      </div>

      {/* Modal de Crear Personaje */}
      <CreateCharacterModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createCharacter}
        isCreating={isCreating}
        authToken={token}
      />

      {/* Modal Confirmar Eliminar Personaje */}
      <AnimatePresence>
        {characterToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{
                scale: 1,
                opacity: 1,
                y: 0,
                transition: { type: "spring", damping: 25, stiffness: 300 },
              }}
              exit={{
                scale: 0.94,
                opacity: 0,
                y: 15,
                transition: { duration: 0.18, ease: "easeInOut" },
              }}
              className="w-full max-w-md bg-[#18130f] border-2 border-[#8B7355] rounded-xl p-6 shadow-2xl text-left relative overflow-hidden"
            >
              {deleteStep === "confirm" ? (
                <>
                  <h4 className="text-xl font-serif text-red-400 mb-2 tracking-wide text-center">
                    Eliminar Personaje
                  </h4>
                  <p className="text-sm text-foreground mb-4 text-center">
                    ¿Estás seguro que quieres eliminar a <span className="font-bold text-amber-100 font-serif">"{characterToDelete.name}"</span>?
                    <br /><br />
                    <span className="text-red-300 font-semibold">Esta opción es permanente e irreversible y el personaje NO se podrá revivir.</span>
                    <br /><br />
                    Al eliminarlo, su slot quedará liberado inmediatamente para crear un nuevo personaje.
                  </p>
                  <div className="flex justify-center gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setCharacterToDelete(null)}
                      disabled={isDeleting}
                      className="px-4 py-2 text-sm font-semibold rounded border border-[#8B7355]/40 hover:bg-[#8B7355]/10 text-muted-foreground hover:text-foreground transition duration-500"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const itemCount = characterToDelete.bag?.items?.length ?? 0;
                        if (itemCount > 0) {
                          setDeleteStep("transfer");
                        } else {
                          handleDeleteCharacter("none");
                        }
                      }}
                      disabled={isDeleting}
                      className="px-5 py-2 text-sm font-semibold rounded bg-red-700 hover:bg-red-800 text-white shadow-lg transition duration-1100"
                    >
                      Continuar para Eliminar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h4 className="text-xl font-serif text-[#D4AF37] mb-2 tracking-wide text-center">
                    Transferencia de Objetos
                  </h4>
                  <p className="text-sm text-foreground mb-4">
                    <span className="font-bold text-amber-100">"{characterToDelete.name}"</span> tiene <span className="font-bold text-yellow-400">{characterToDelete.bag?.items?.length ?? 0}</span> objeto(s) en su bolsa. ¿A dónde deseas enviarlos antes de eliminar al personaje?
                  </p>

                  <div className="space-y-3 my-4">
                    {/* Opción 1: Otro personaje */}
                    {(profile?.characters ?? []).filter(c => c.id !== characterToDelete.id).length > 0 && (
                      <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${transferTarget.type === "character" ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-border/60 bg-secondary/20"}`}>
                        <input
                          type="radio"
                          name="transferTarget"
                          checked={transferTarget.type === "character"}
                          onChange={() => {
                            const otherChars = (profile?.characters ?? []).filter(c => c.id !== characterToDelete.id);
                            setTransferTarget({ type: "character", targetId: otherChars[0]?.id });
                          }}
                          className="accent-[#D4AF37]"
                        />
                        <div className="flex-1 text-sm">
                          <p className="font-semibold text-foreground">Enviar a otro personaje</p>
                          {transferTarget.type === "character" && (
                            <select
                              value={transferTarget.targetId}
                              onChange={(e) => setTransferTarget({ type: "character", targetId: Number(e.target.value) })}
                              className="mt-2 w-full p-1.5 rounded bg-background border border-[#8B7355] text-sm text-foreground focus:outline-none"
                            >
                              {(profile?.characters ?? []).filter(c => c.id !== characterToDelete.id).map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.race})</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </label>
                    )}

                    {/* Opción 2: Gremio */}
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${transferTarget.type === "guild" ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-border/60 bg-secondary/20"}`}>
                      <input
                        type="radio"
                        name="transferTarget"
                        checked={transferTarget.type === "guild"}
                        onChange={() => setTransferTarget({ type: "guild" })}
                        className="accent-[#D4AF37]"
                      />
                      <div className="text-sm">
                        <p className="font-semibold text-foreground">Enviar a la Bóveda del Gremio</p>
                        <p className="text-xs text-muted-foreground">Si estás en un gremio, los objetos irán al baúl.</p>
                      </div>
                    </label>

                    {/* Opción 3: Descartar */}
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${transferTarget.type === "none" ? "border-red-500 bg-red-500/10" : "border-border/60 bg-secondary/20"}`}>
                      <input
                        type="radio"
                        name="transferTarget"
                        checked={transferTarget.type === "none"}
                        onChange={() => setTransferTarget({ type: "none" })}
                        className="accent-red-500"
                      />
                      <div className="text-sm">
                        <p className="font-semibold text-red-300">No transferir (descartar objetos)</p>
                        <p className="text-xs text-muted-foreground">Los objetos se perderán al eliminar el personaje.</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-center gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setDeleteStep("confirm")}
                      disabled={isDeleting}
                      className="px-4 py-2 text-sm font-semibold rounded border border-[#8B7355]/40 hover:bg-[#8B7355]/10 text-muted-foreground hover:text-foreground transition duration-200"
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCharacter(transferTarget.type, transferTarget.targetId)}
                      disabled={isDeleting}
                      className="px-5 py-2 text-sm font-semibold rounded bg-red-700 hover:bg-red-800 text-white shadow-lg transition duration-200"
                    >
                      {isDeleting ? "Procesando..." : "Confirmar Eliminación"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}