"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "../components/header";
import { useAuth } from "@/lib/useAuth";

type Player = {
  name: string;
  role: string;
  level: number;
  home: string;
};

type ArmorSlots = {
  cabeza?: string;
  pecho?: string;
  guante?: string;
  botas?: string;
};

type AccessorySlots = {
  collar?: string;
  anillo1?: string;
  anillo2?: string;
  amuleto?: string;
};

type WeaponSlots = {
  manoIzquierda?: string;
  manoDerecha?: string;
};

type ItemType =
  | "cabeza"
  | "pecho"
  | "guante"
  | "botas"
  | "collar"
  | "anillo"
  | "amuleto"
  | "arma";

type Item = {
  name: string;
  type: ItemType;
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

  const saveBagChanges = async (characterId: number) => {
    if (!profile || !user || !currentCharacter) return;

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
          bagItems,
          armor: currentCharacter.armor,
          accessories: currentCharacter.accessories,
          weapons: currentCharacter.weapons,
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
                bag: { ...char.bag, items: bagItems },
                armor: currentCharacter.armor,
                accessories: currentCharacter.accessories,
                weapons: currentCharacter.weapons,
              }
            : char,
        ),
      });
      setOpenBagModal(null);
    } catch (error) {
      console.error("Error saving bag changes:", error);
      alert("Error al guardar los cambios. Inténtalo de nuevo.");
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
      alert("¡Personaje creado exitosamente!");
    } catch (error) {
      console.error("Error creating character:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      alert(`Error al crear el personaje: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  const equipItem = (item: Item) => {
    if (!currentCharacter) return;

    const updatedCharacter = { ...currentCharacter };
    let equipped = false;

    switch (item.type) {
      case "cabeza":
        if (!updatedCharacter.armor.cabeza) {
          updatedCharacter.armor = {
            ...updatedCharacter.armor,
            cabeza: item.name,
          };
          equipped = true;
        }
        break;
      case "pecho":
        if (!updatedCharacter.armor.pecho) {
          updatedCharacter.armor = {
            ...updatedCharacter.armor,
            pecho: item.name,
          };
          equipped = true;
        }
        break;
      case "guante":
        if (!updatedCharacter.armor.guante) {
          updatedCharacter.armor = {
            ...updatedCharacter.armor,
            guante: item.name,
          };
          equipped = true;
        }
        break;
      case "botas":
        if (!updatedCharacter.armor.botas) {
          updatedCharacter.armor = {
            ...updatedCharacter.armor,
            botas: item.name,
          };
          equipped = true;
        }
        break;
      case "collar":
        if (!updatedCharacter.accessories.collar) {
          updatedCharacter.accessories = {
            ...updatedCharacter.accessories,
            collar: item.name,
          };
          equipped = true;
        }
        break;
      case "anillo":
        if (!updatedCharacter.accessories.anillo1) {
          updatedCharacter.accessories = {
            ...updatedCharacter.accessories,
            anillo1: item.name,
          };
          equipped = true;
        } else if (!updatedCharacter.accessories.anillo2) {
          updatedCharacter.accessories = {
            ...updatedCharacter.accessories,
            anillo2: item.name,
          };
          equipped = true;
        }
        break;
      case "amuleto":
        if (!updatedCharacter.accessories.amuleto) {
          updatedCharacter.accessories = {
            ...updatedCharacter.accessories,
            amuleto: item.name,
          };
          equipped = true;
        }
        break;
      case "arma":
        if (!updatedCharacter.weapons.manoDerecha) {
          updatedCharacter.weapons = {
            ...updatedCharacter.weapons,
            manoDerecha: item.name,
          };
          equipped = true;
        } else if (!updatedCharacter.weapons.manoIzquierda) {
          updatedCharacter.weapons = {
            ...updatedCharacter.weapons,
            manoIzquierda: item.name,
          };
          equipped = true;
        }
        break;
    }

    if (equipped) {
      setCurrentCharacter(updatedCharacter);
      setBagItems((prev) => prev.filter((i) => i.name !== item.name));
    } else {
      alert(`No hay espacio disponible para equipar ${item.name}`);
    }
  };

  const unequipItem = (
    slotType: "armor" | "accessories" | "weapons",
    slotName: string,
    itemName: string,
    itemType: ItemType,
  ) => {
    if (!currentCharacter) return;

    // Verificar si hay espacio en la bolsa
    if (bagItems.length >= currentCharacter.bag.maxSlots) {
      alert("La bolsa está llena. No puedes desequipar este item.");
      return;
    }

    const updatedCharacter = { ...currentCharacter };

    if (slotType === "armor") {
      updatedCharacter.armor = {
        ...updatedCharacter.armor,
        [slotName]: undefined,
      };
    } else if (slotType === "accessories") {
      updatedCharacter.accessories = {
        ...updatedCharacter.accessories,
        [slotName]: undefined,
      };
    } else if (slotType === "weapons") {
      updatedCharacter.weapons = {
        ...updatedCharacter.weapons,
        [slotName]: undefined,
      };
    }

    setCurrentCharacter(updatedCharacter);
    setBagItems((prev) => [...prev, { name: itemName, type: itemType }]);
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
                    ? `${player.role} · Nivel ${player.level} · ${player.home}`
                    : "Obteniendo datos del perfil"}
                </p>
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
                  disabled={characters.length >= 5}
                  onClick={() => setShowCreateModal(true)}
                  className={`px-4 py-2 rounded font-semibold text-sm transition-all ${
                    characters.length >= 5
                      ? "bg-secondary text-muted-foreground cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white shadow hover:shadow-lg"
                  }`}
                  title={
                    characters.length >= 5
                      ? "Límite de personajes alcanzado (5/5)"
                      : "Crear nuevo personaje"
                  }
                >
                  Crear Personaje
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
                      src={character.portrait}
                      alt={`${character.name} portrait`}
                      fill
                      className="object-cover"
                    />
                  </div>
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
                          <button
                            title="Subir nivel de clase"
                            className="text-xs px-1.5 py-0.5 rounded border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition leading-none"
                            onClick={() => {
                              const updated = (character.multiclass ?? []).map(
                                (c, i) =>
                                  i === idx
                                    ? { ...c, level: Math.min(20, c.level + 1) }
                                    : c,
                              );
                              setProfile({
                                ...profile!,
                                characters: profile!.characters.map((ch) =>
                                  ch.id === character.id
                                    ? { ...ch, multiclass: updated }
                                    : ch,
                                ),
                              });
                            }}
                          >
                            +
                          </button>
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

                  <div>
                    <h3 className="text-sm text-[#D4AF37] uppercase tracking-[0.3em] mb-3">
                      Armadura
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {Object.entries(character.armor).map(([slot, item]) => (
                        <div
                          key={slot}
                          className="rounded border border-border/60 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground"
                        >
                          <span className="font-bold">
                            {slot.toUpperCase()}
                          </span>
                          : {item || "Vacío"}
                        </div>
                      ))}
                    </div>

                    <h3 className="text-sm text-[#D4AF37] uppercase tracking-[0.3em] mb-3">
                      Accesorios
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {Object.entries(character.accessories).map(
                        ([slot, item]) => (
                          <div
                            key={slot}
                            className="rounded border border-border/60 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground"
                          >
                            <span className="font-bold">
                              {slot.toUpperCase()}
                            </span>
                            : {item || "Vacío"}
                          </div>
                        ),
                      )}
                    </div>

                    <h3 className="text-sm text-[#D4AF37] uppercase tracking-[0.3em] mb-3">
                      Armas
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {Object.entries(character.weapons).map(([slot, item]) => (
                        <div
                          key={slot}
                          className="rounded border border-border/60 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground"
                        >
                          <span className="font-bold">
                            {slot.toUpperCase()}
                          </span>
                          : {item || "Vacío"}
                        </div>
                      ))}
                    </div>

                    <h3 className="text-sm text-[#D4AF37] uppercase tracking-[0.3em] mb-3">
                      Bolsa
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                      {character.bag.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded border border-border/60 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground"
                        >
                          {item.name}
                        </div>
                      ))}
                      {[
                        ...Array(
                          character.bag.maxSlots - character.bag.items.length,
                        ),
                      ].map((_, idx) => (
                        <div
                          key={"empty-" + idx}
                          className="rounded border border-border/60 bg-secondary/10 px-3 py-2 text-sm text-muted-foreground"
                        >
                          Vacío
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Espacios: {character.bag.items.length} /{" "}
                      {character.bag.maxSlots}
                    </div>
                  </div>

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
                    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/20 p-4">
                      <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-4xl relative max-h-[90vh] overflow-y-auto">
                        <button
                          className="absolute top-4 right-4 text-2xl text-muted-foreground hover:text-foreground w-8 h-8 flex items-center justify-center rounded hover:bg-secondary"
                          onClick={() => setOpenBagModal(null)}
                        >
                          ×
                        </button>
                        <h2 className="text-2xl font-bold mb-6 text-[#D4AF37] uppercase tracking-wider">
                          Bolsa de {character.name}
                        </h2>

                        <div className="mb-4">
                          <button
                            className="px-6 py-2 rounded bg-[#D4AF37] text-background font-semibold shadow hover:bg-[#B8860B] transition w-full disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => saveBagChanges(character.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? "Guardando..." : "Guardar Cambios"}
                          </button>
                        </div>

                        {currentCharacter && (
                          <div className="mb-6 p-4 rounded border border-[#8B7355] bg-secondary/20">
                            <h3 className="text-sm text-[#D4AF37] uppercase tracking-[0.3em] mb-3">
                              Equipo Actual
                            </h3>

                            <div className="space-y-4">
                              <div>
                                <h4 className="text-xs text-muted-foreground uppercase mb-2">
                                  Armadura
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {Object.entries(currentCharacter.armor).map(
                                    ([slot, item]) => (
                                      <div
                                        key={slot}
                                        className="rounded border border-border/60 bg-background/50 p-2"
                                      >
                                        <div className="text-xs text-muted-foreground capitalize mb-1">
                                          {slot}
                                        </div>
                                        {item ? (
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-medium truncate">
                                              {item}
                                            </span>
                                            <button
                                              className="text-xs px-1 py-0.5 text-red-600 hover:bg-red-600/10 rounded"
                                              onClick={() =>
                                                unequipItem(
                                                  "armor",
                                                  slot,
                                                  item,
                                                  slot as ItemType,
                                                )
                                              }
                                            >
                                              ×
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">
                                            Vacío
                                          </span>
                                        )}
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="text-xs text-muted-foreground uppercase mb-2">
                                  Accesorios
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {Object.entries(
                                    currentCharacter.accessories,
                                  ).map(([slot, item]) => {
                                    const itemType: ItemType = slot.includes(
                                      "anillo",
                                    )
                                      ? "anillo"
                                      : (slot as ItemType);
                                    return (
                                      <div
                                        key={slot}
                                        className="rounded border border-border/60 bg-background/50 p-2"
                                      >
                                        <div className="text-xs text-muted-foreground capitalize mb-1">
                                          {slot}
                                        </div>
                                        {item ? (
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-medium truncate">
                                              {item}
                                            </span>
                                            <button
                                              className="text-xs px-1 py-0.5 text-red-600 hover:bg-red-600/10 rounded"
                                              onClick={() =>
                                                unequipItem(
                                                  "accessories",
                                                  slot,
                                                  item,
                                                  itemType,
                                                )
                                              }
                                            >
                                              ×
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">
                                            Vacío
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div>
                                <h4 className="text-xs text-muted-foreground uppercase mb-2">
                                  Armas
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                  {Object.entries(currentCharacter.weapons).map(
                                    ([slot, item]) => (
                                      <div
                                        key={slot}
                                        className="rounded border border-border/60 bg-background/50 p-2"
                                      >
                                        <div className="text-xs text-muted-foreground capitalize mb-1">
                                          {slot}
                                        </div>
                                        {item ? (
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-medium truncate">
                                              {item}
                                            </span>
                                            <button
                                              className="text-xs px-1 py-0.5 text-red-600 hover:bg-red-600/10 rounded"
                                              onClick={() =>
                                                unequipItem(
                                                  "weapons",
                                                  slot,
                                                  item,
                                                  "arma",
                                                )
                                              }
                                            >
                                              ×
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">
                                            Vacío
                                          </span>
                                        )}
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mb-6">
                          <h3 className="text-sm text-[#D4AF37] uppercase tracking-[0.3em] mb-3">
                            Bolsa
                          </h3>
                          <div className="text-xs text-muted-foreground mb-3">
                            Espacios: {bagItems.length} /{" "}
                            {currentCharacter?.bag.maxSlots ||
                              character.bag.maxSlots}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {bagItems.map((item) => (
                              <div
                                key={`bag-${item.name}`}
                                className="rounded border border-border/60 bg-secondary/30 p-3 text-sm text-muted-foreground flex flex-col gap-2"
                              >
                                <div className="font-medium text-foreground text-center">
                                  {item.name}
                                </div>
                                <div className="text-xs text-muted-foreground text-center capitalize">
                                  {item.type}
                                </div>
                                <button
                                  className="w-full px-2 py-1 text-xs text-green-600 hover:text-white bg-green-600/10 hover:bg-green-600 rounded transition"
                                  onClick={() => equipItem(item)}
                                >
                                  Equipar
                                </button>
                              </div>
                            ))}
                            {[
                              ...Array(
                                (currentCharacter?.bag.maxSlots ||
                                  character.bag.maxSlots) - bagItems.length,
                              ),
                            ].map((_, idx) => (
                              <div
                                key={"empty-" + idx}
                                className="rounded border border-dashed border-border/40 bg-secondary/10 p-3 text-sm text-muted-foreground flex items-center justify-center min-h-20"
                              >
                                <span className="text-xs">Vacío</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
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
                    <option value="Lawful Good">Legal Bueno</option>
                    <option value="Neutral Good">Neutral Bueno</option>
                    <option value="Chaotic Good">Caótico Bueno</option>
                    <option value="Lawful Neutral">Legal Neutral</option>
                    <option value="True Neutral">Neutral Puro</option>
                    <option value="Chaotic Neutral">Caótico Neutral</option>
                    <option value="Lawful Evil">Legal Malvado</option>
                    <option value="Neutral Evil">Neutral Malvado</option>
                    <option value="Chaotic Evil">Caótico Malvado</option>
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
                          { value: "Barbarian", label: "Bárbaro" },
                          { value: "Bard", label: "Bardo" },
                          { value: "Cleric", label: "Clérigo" },
                          { value: "Druid", label: "Druida" },
                          { value: "Fighter", label: "Guerrero" },
                          { value: "Monk", label: "Monje" },
                          { value: "Paladin", label: "Paladín" },
                          { value: "Ranger", label: "Explorador" },
                          { value: "Rogue", label: "Pícaro" },
                          { value: "Sorcerer", label: "Hechicero" },
                          { value: "Warlock", label: "Brujo" },
                          { value: "Wizard", label: "Mago" },
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
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                          Nv.
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={entry.level}
                          onChange={(e) => {
                            const val = Math.max(
                              1,
                              Math.min(20, Number(e.target.value)),
                            );
                            setNewCharacter((prev) => ({
                              ...prev,
                              multiclass: prev.multiclass.map((c, i) =>
                                i === idx ? { ...c, level: val } : c,
                              ),
                            }));
                          }}
                          className="w-14 px-2 py-2 rounded border border-border bg-secondary/30 text-foreground text-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        />
                      </div>
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
