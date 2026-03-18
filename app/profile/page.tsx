"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "../components/header";
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
  | "arma";

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

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
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

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let isMounted = true;

    fetch(`/api/profile?userId=${user.id}`)
      .then((res) => res.json())
      .then((data: ProfileResponse) => {
        if (isMounted) {
          // Sobrescribir con datos del usuario autenticado
          setProfile({
            ...data,
            player: {
              name: user.name,
              role: user.role,
              level: user.level,
              home: data.player.home,
              oro: user.oro,
            },
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user, isAuthenticated]);

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
                  disabled={characters.length >= 2}
                  onClick={() => setShowCreateModal(true)}
                  className={`px-4 py-2 rounded font-semibold text-sm transition-all ${
                    characters.length >= 2
                      ? "bg-secondary text-muted-foreground cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white shadow hover:shadow-lg"
                  }`}
                  title={
                    characters.length >= 2
                      ? "Límite de la cuenta gratuita (2/2). Próximamente: plan premium"
                      : "Crear nuevo personaje"
                  }
                >
                  {characters.length >= 2
                    ? "Límite alcanzado 🔒"
                    : "Crear Personaje"}
                </button>
              </div>
            </div>
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