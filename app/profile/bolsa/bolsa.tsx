"use client";

// Bolsa y equipamiento: arrastrar y soltar entre las ranuras de equipo y los
// huecos de la bolsa.
//
// Aquí solo está la interacción; TODAS las reglas (qué entra en qué ranura, las
// armas a dos manos, las gemas, la capacidad máxima) las decide el servidor en
// POST /api/profile/update-bag. La pantalla propone, la ruta dispone.

import { useState, useCallback, useEffect } from "react";
import { AlertTriangle, CheckCircle2, XCircle, Undo2, Coins, Swords, ShoppingBag, X, Lock } from "lucide-react";
import { getIconForString } from "@/lib/iconMapper";
import { getSupabase } from "@/lib/supabase";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { playBagOpenSfx, playItemSelectSfx } from "@/lib/sfx";

// ─── Types (re-exported from your page, or paste here) ───────────────────────

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
  | "accesorio-capa"
  | "pies"
  | "manos"
  | "colgante";

type Item = {
  name: string;
  type: ItemType;
  price?: number;
  description?: string | null;
  requiresTwoHands?: boolean;
  fueComerciado?: boolean;
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

type Bag = {
  items: Item[];
  maxSlots: number;
};

type Character = {
  id: number;
  name: string;
  race?: string;
  portrait?: string;
  lifeStatus?: "vivo" | "muerto";
  armor: ArmorSlots;
  accessories: AccessorySlots;
  weapons: WeaponSlots;
  equipmentRequiresTwoHandsByName?: Record<string, boolean>;
  bag: Bag;
  // add other fields your Character type has
  [key: string]: unknown;
};

// ─── Slot configuration ───────────────────────────────────────────────────────

type SlotKey =
  | "cabeza"
  | "colgante"
  | "amuleto"
  | "capa"
  | "cinturon"
  | "pecho"
  | "manoizq"
  | "manoderecha"
  | "manos"
  | "anillo1"
  | "anillo2"
  | "anillo3"
  | "pies";

type WeaponSlotKey = "manoizq" | "manoderecha";

type WeaponSocketItem = Item | null;

type WeaponSockets = Record<WeaponSlotKey, [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem]>;
type CapeSockets = [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem];

const SIMULATED_WEAPON_LEVEL_BY_NAME: Record<string, number> = {
  "Espada Corta": 2,
  "Espada Larga": 4,
  "Hacha de Batalla": 5,
  "Espada Corta +1": 6,
  "Escudo de Hierro": 3,
  "Varilla de Fuerza": 6,
};

const SIMULATED_CAPE_LEVEL_BY_NAME: Record<string, number> = {
  "Capa de Evasión": 4,
  "Capa Sombría": 5,
  "Capa del Errante": 2,
};

const DEFAULT_SIMULATED_WEAPON_LEVEL = 1;
const DEFAULT_SIMULATED_CAPE_LEVEL = 1;

function getUnlockedWeaponSocketCount(weaponLevel: number): number {
  if (weaponLevel >= 5) return 3;
  if (weaponLevel >= 3) return 2;
  return 1;
}

function getUnlockedCapeSocketCount(capeLevel: number): number {
  if (capeLevel >= 5) return 3;
  if (capeLevel >= 3) return 2;
  return 1;
}

function getCapeNameFromEquipped(equipped: EquippedMap): string | undefined {
  return equipped.capa?.name;
}

function getWeaponNameFromEquipped(
  equipped: EquippedMap,
  weaponSlot: WeaponSlotKey,
): string | undefined {
  return weaponSlot === "manoizq"
    ? equipped.manoizq?.name
    : equipped.manoderecha?.name;
}

function getWeaponLevelForSlot(
  character: Character,
  equipped: EquippedMap,
  weaponSlot: WeaponSlotKey,
): number {
  const weaponName = getWeaponNameFromEquipped(equipped, weaponSlot);
  if (!weaponName) return 0;

  // Future backend hook: expose weapon levels in this field to replace the simulation.
  const backendWeaponLevelByName =
    (character as { weaponLevelByName?: Record<string, number> }).weaponLevelByName ??
    {};
  const backendLevel = backendWeaponLevelByName[weaponName];
  if (typeof backendLevel === "number" && backendLevel > 0) {
    return backendLevel;
  }

  return (
    SIMULATED_WEAPON_LEVEL_BY_NAME[weaponName] ?? DEFAULT_SIMULATED_WEAPON_LEVEL
  );
}

function getCapeLevel(character: Character, equipped: EquippedMap): number {
  const capeName = getCapeNameFromEquipped(equipped);
  if (!capeName) return 0;

  const backendCapeLevelByName =
    (character as { capeLevelByName?: Record<string, number> }).capeLevelByName ??
    {};
  const backendLevel = backendCapeLevelByName[capeName];
  if (typeof backendLevel === "number" && backendLevel > 0) {
    return backendLevel;
  }

  return SIMULATED_CAPE_LEVEL_BY_NAME[capeName] ?? DEFAULT_SIMULATED_CAPE_LEVEL;
}

function buildWeaponSockets(character: Character): WeaponSockets {
  const raw =
    (character as {
      weaponSockets?: Partial<Record<WeaponSlotKey, Array<Item | null | undefined>>>;
    }).weaponSockets ?? {};

  const toFixed3 = (
    arr: Array<Item | null | undefined> | undefined,
  ): [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem] => [
    arr?.[0] ?? null,
    arr?.[1] ?? null,
    arr?.[2] ?? null,
  ];

  return {
    manoizq: toFixed3(raw.manoizq),
    manoderecha: toFixed3(raw.manoderecha),
  };
}

function buildCapeSockets(character: Character): CapeSockets {
  const raw =
    (character as {
      capeSockets?: Array<Item | null | undefined>;
    }).capeSockets ?? [];

  return [raw[0] ?? null, raw[1] ?? null, raw[2] ?? null];
}

function isTwoHandedWeapon(item: Item | null | undefined): boolean {
  return Boolean(item && item.type === "arma" && item.requiresTwoHands);
}

function getOppositeWeaponSlot(weaponSlot: WeaponSlotKey): WeaponSlotKey {
  return weaponSlot === "manoizq" ? "manoderecha" : "manoizq";
}

const SLOT_CONFIG: Record<SlotKey, { accepts: ItemType[]; label: string; icon: string }> = {
  cabeza:      { accepts: ["cabeza"],                          label: "Cabeza",    icon: "👑" },
  colgante:    { accepts: ["collar", "colgante"],              label: "Colgante",  icon: "💎" },
  amuleto:     { accepts: ["amuleto"],                          label: "Amuleto",   icon: "🔮" },
  capa:        { accepts: ["capa"],                            label: "Capa",      icon: "🧥" },
  cinturon:    { accepts: ["cinturón"],                        label: "Cinturón",  icon: "🪢" },
  pecho:       { accepts: ["armadura", "pecho"],              label: "Armadura",  icon: "👕" },
  manoizq:     { accepts: ["arma"],                            label: "Mano Izq",  icon: "🗡" },
  manoderecha: { accepts: ["arma"],                            label: "Mano Der",  icon: "🗡" },
  manos:       { accepts: ["guante", "manos"],                 label: "Manos",     icon: "🧤" },
  anillo1:     { accepts: ["anillo"],                          label: "Anillo 1",  icon: "💍" },
  anillo2:     { accepts: ["anillo"],                          label: "Anillo 2",  icon: "💍" },
  anillo3:     { accepts: ["anillo"],                          label: "Anillo 3",  icon: "💍" },
  pies:        { accepts: ["botas"],                           label: "Pies",      icon: "🥾" },
};

const ITEM_ICONS: Partial<Record<ItemType, string>> = {
  arma: "⚔️", cabeza: "👑", armadura: "👕", pecho: "👕", guante: "🧤", manos: "🧤",
  botas: "🥾", pies: "🥾", anillo: "💍", collar: "📿",
  amuleto: "🔮", colgante: "💎", capa: "🧥",
  cinturón: "🪢", "gema-arma": "💠", "gema-capa": "🪶", "accesorio-arma": "🔩", "accesorio-capa": "🪶",
};

// ─── Helper: build a flat equipped map from Character slots ──────────────────

type EquippedMap = Record<SlotKey, Item | null>;

function buildEquippedMap(character: Character): EquippedMap {
  const equipmentPriceByName =
    ((character as { equipmentPriceByName?: Record<string, number> })
      .equipmentPriceByName ?? {}) as Record<string, number>;
  const equipmentRequiresTwoHandsByName =
    character.equipmentRequiresTwoHandsByName ?? {};

  return {
    cabeza:      character.armor.cabeza      ? { name: character.armor.cabeza,      type: "cabeza",   price: equipmentPriceByName[character.armor.cabeza] } : null,
    capa:        ((character as { cape?: { capa?: string } }).cape?.capa)
                 ? {
                     name: (character as { cape?: { capa?: string } }).cape!.capa!,
                     type: "capa",
                     price:
                       equipmentPriceByName[
                         (character as { cape?: { capa?: string } }).cape!.capa!
                       ],
                   }
                 : null,
    pecho:       (character.armor.armadura ?? character.armor.pecho)
                 ? {
                     name: character.armor.armadura ?? character.armor.pecho!,
                     type: "armadura",
                     price: equipmentPriceByName[character.armor.armadura ?? character.armor.pecho!],
                   }
                 : null,
    manos:       character.armor.guante      ? { name: character.armor.guante,      type: "guante",   price: equipmentPriceByName[character.armor.guante] } : null,
    pies:        character.armor.botas       ? { name: character.armor.botas,       type: "botas",    price: equipmentPriceByName[character.armor.botas] } : null,
    colgante:    character.accessories.collar ? { name: character.accessories.collar, type: "collar",  price: equipmentPriceByName[character.accessories.collar] } : null,
    amuleto:     character.accessories.amuleto ? { name: character.accessories.amuleto, type: "amuleto", price: equipmentPriceByName[character.accessories.amuleto] } : null,
    cinturon:    character.accessories.cinturon ? { name: character.accessories.cinturon, type: "cinturón", price: equipmentPriceByName[character.accessories.cinturon] } : null,
    anillo1:     character.accessories.anillo1 ? { name: character.accessories.anillo1, type: "anillo",  price: equipmentPriceByName[character.accessories.anillo1] } : null,
    anillo2:     character.accessories.anillo2 ? { name: character.accessories.anillo2, type: "anillo",  price: equipmentPriceByName[character.accessories.anillo2] } : null,
    anillo3:     character.accessories.anillo3 ? { name: character.accessories.anillo3, type: "anillo",  price: equipmentPriceByName[character.accessories.anillo3] } : null,
    manoizq:     character.weapons.manoIzquierda ? { name: character.weapons.manoIzquierda, type: "arma", price: equipmentPriceByName[character.weapons.manoIzquierda], requiresTwoHands: equipmentRequiresTwoHandsByName[character.weapons.manoIzquierda] } : null,
    manoderecha: character.weapons.manoDerecha   ? { name: character.weapons.manoDerecha,   type: "arma", price: equipmentPriceByName[character.weapons.manoDerecha], requiresTwoHands: equipmentRequiresTwoHandsByName[character.weapons.manoDerecha] } : null,
  };
}

// ─── Helper: write equipped map back to Character format ─────────────────────

function equippedMapToCharacter(
  character: Character,
  equipped: EquippedMap
): Character {
  return {
    ...character,
    cape: {
      capa: equipped.capa?.name,
    },
    armor: {
      cabeza: equipped.cabeza?.name,
      armadura: equipped.pecho?.name,
      guante: equipped.manos?.name,
      botas:  equipped.pies?.name,
    },
    accessories: {
      collar: equipped.colgante?.name,
      amuleto: equipped.amuleto?.name,
      cinturon: equipped.cinturon?.name,
      anillo1: equipped.anillo1?.name,
      anillo2: equipped.anillo2?.name,
      anillo3: equipped.anillo3?.name,
    },
    weapons: {
      manoIzquierda: equipped.manoizq?.name,
      manoDerecha:   equipped.manoderecha?.name,
    },
  };
}

// ─── Sub-component: a single slot button on the figure ───────────────────────

function SlotButton({
  slotKey,
  item,
  selected,
  onSelect,
  weaponLevel,
  weaponSocketItems,
  weaponSelectedSocketIndex,
  onSelectWeaponSocket,
  capeLevel,
  capeSocketItems,
  capeSelectedSocketIndex,
  onSelectCapeSocket,
  readOnly = false,
  onReadOnlyAttempt,
  layoutMode = "absolute",
}: {
  slotKey: SlotKey;
  item: Item | null;
  selected: boolean;
  onSelect: (key: SlotKey) => void;
  weaponLevel?: number;
  weaponSocketItems?: [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem];
  weaponSelectedSocketIndex?: number | null;
  onSelectWeaponSocket?: (weaponSlot: WeaponSlotKey, socketIndex: number) => void;
  capeLevel?: number;
  capeSocketItems?: CapeSockets;
  capeSelectedSocketIndex?: number | null;
  onSelectCapeSocket?: (socketIndex: number) => void;
  readOnly?: boolean;
  onReadOnlyAttempt?: () => void;
  layoutMode?: "absolute" | "grid";
}) {
  const cfg = SLOT_CONFIG[slotKey];
  const isWeaponSlot = slotKey === "manoizq" || slotKey === "manoderecha";
  const isCapeSlot = slotKey === "capa";
  const unlockedWeaponSockets = getUnlockedWeaponSocketCount(weaponLevel ?? 0);
  const unlockedCapeSockets = getUnlockedCapeSocketCount(capeLevel ?? 0);

  const positionStyle: React.CSSProperties = (() => {
    if (layoutMode === "grid") return {};
    const base: React.CSSProperties = { position: "absolute" };
    const positions: Record<SlotKey, React.CSSProperties> = {
      cabeza:      { top: "6px",   left: "50%", transform: "translateX(-50%)" },
      colgante:    { top: "95px", left: "50%", transform: "translateX(-50%)" },
      amuleto:     { top: "50px", right: "16px" },
      capa:        { top: "40px", right: "-190px" },
      cinturon:    { top: "220px", left: "50%", transform: "translateX(-50%)" },
      pecho:       { top: "150px", left: "50%", transform: "translateX(-50%)" },
      manoizq:     { top: "40px", left: "-375px" },
      manoderecha: { top: "40px", left: "-200px" },
      manos:       { top: "207px", left: "16px" },
      anillo1:     { top: "200px", right: "16px" },
      anillo2:     { top: "254px", right: "16px" },
      anillo3:     { top: "308px", right: "16px" },
      pies:        { top: "315px", left: "50%", transform: "translateX(-50%)" },
    };
    return { ...base, ...positions[slotKey] };
  })();

  return (
    <button
      type="button"
      onClick={() => {
        if (readOnly) {
          onReadOnlyAttempt?.();
        } else {
          onSelect(slotKey);
        }
      }}
      title={item ? item.name : cfg.label}
      style={positionStyle}
      className={[
        layoutMode === "grid"
          ? "w-full min-h-[78px] flex flex-col items-center justify-center gap-1.5 p-2.5"
          : isWeaponSlot || isCapeSlot
          ? "w-36 h-72 flex flex-col items-center justify-start gap-3 pt-8"
          : "w-15 h-13 flex flex-col items-center justify-center gap-0.5",
        "rounded-lg border text-center transition-all duration-200",
        readOnly ? "cursor-default" : "cursor-pointer",
        selected
          ? "border-[#D4AF37] bg-[#1e1a0a] shadow-[0_0_12px_rgba(212,175,55,0.4)]"
          : item
          ? "border-[#4a5a20] bg-[#1e2010] hover:border-[#6a8a30]"
          : "border-[#3a3020] bg-[#141210] hover:border-[#8B7355] hover:bg-[#2a2518]",
      ].join(" ")}
    >
      <span className={isWeaponSlot || isCapeSlot && layoutMode !== "grid" ? "shrink-0 flex items-center justify-center text-[#D4AF37]" : "shrink-0 flex items-center justify-center text-[#D4AF37]"}>
        {getIconForString(item ? item.name : cfg.icon, isWeaponSlot || isCapeSlot ? (layoutMode === "grid" ? "w-7 h-7" : "w-10 h-10") : "w-6 h-6", cfg.icon)}
      </span>
      <span
        className={
          (isWeaponSlot || isCapeSlot) && layoutMode !== "grid"
            ? "text-sm text-[#8a7a5a] tracking-[0.18em] uppercase leading-none shrink-0"
            : "text-[9px] text-[#8a7a5a] tracking-wide uppercase leading-none font-semibold"
        }
      >
        {cfg.label}
      </span>
      {item && (
        <span
          className={
            (isWeaponSlot || isCapeSlot) && layoutMode !== "grid"
              ? "block w-full max-w-28 shrink-0 text-center text-sm text-[#D4AF37] leading-snug px-2 overflow-hidden text-ellipsis whitespace-nowrap font-medium"
              : "text-[10px] text-[#D4AF37] leading-tight max-w-full truncate px-0.5 font-medium"
          }
        >
          {item.name}
        </span>
      )}
      {isWeaponSlot && (
        <div className={layoutMode === "grid" ? "mt-1 w-full rounded border border-[#4a3e22] bg-[#0f0e0c]/80 p-1.5 flex flex-col gap-1" : "mt-auto mb-4 w-28 shrink-0 rounded-md border border-[#4a3e22] bg-[#0f0e0c]/70 px-2 py-2 flex flex-col gap-1.5"}>
          <span className="text-[9px] tracking-[0.12em] uppercase text-[#8a7a5a]">
            Nv. {weaponLevel ?? 0} · {unlockedWeaponSockets}/3
          </span>
          <div className={layoutMode === "grid" ? "grid grid-cols-3 gap-1 w-full" : "flex flex-col gap-1.5"}>
            {[0, 1, 2].map((i) => {
              const unlocked = i < unlockedWeaponSockets;
              const socketItem = weaponSocketItems?.[i] ?? null;
              const isSelected = weaponSelectedSocketIndex === i;

              return (
                <div
                  key={`${slotKey}-socket-${i}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (readOnly) {
                      onReadOnlyAttempt?.();
                      return;
                    }
                    if (!unlocked) {
                      return;
                    }
                    onSelectWeaponSocket?.(slotKey, i);
                  }}
                  className={[
                    "h-7 rounded border text-[8px] flex items-center justify-center px-1 text-center truncate",
                    unlocked
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-45",
                    isSelected
                      ? "border-[#D4AF37] bg-[#1e1a0a] text-[#D4AF37]"
                      : unlocked
                      ? "border-[#6b5a2a] bg-black/20 text-[#cbb58a] hover:border-[#8B7355]"
                      : "border-[#3a3020] bg-black/20 text-[#6b5a2a]",
                  ].join(" ")}
                  title={
                    unlocked
                      ? socketItem
                        ? socketItem.name
                        : "Slot vacío"
                      : "Bloqueado por nivel de arma"
                  }
                >
                  {!unlocked
                    ? `Bloq.`
                    : socketItem
                    ? socketItem.name
                    : `Vacío`}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {isCapeSlot && (
        <div className={layoutMode === "grid" ? "mt-1 w-full rounded border border-[#4a3e22] bg-[#0f0e0c]/80 p-1.5 flex flex-col gap-1" : "mt-auto mb-4 w-28 shrink-0 rounded-md border border-[#4a3e22] bg-[#0f0e0c]/70 px-2 py-2 flex flex-col gap-1.5"}>
          <span className="text-[9px] tracking-[0.12em] uppercase text-[#8a7a5a]">
            Nv. {capeLevel ?? 0} · {unlockedCapeSockets}/3
          </span>
          <div className={layoutMode === "grid" ? "grid grid-cols-3 gap-1 w-full" : "flex flex-col gap-1.5"}>
            {[0, 1, 2].map((i) => {
              const unlocked = i < unlockedCapeSockets;
              const socketItem = capeSocketItems?.[i] ?? null;
              const isSelected = capeSelectedSocketIndex === i;

              return (
                <div
                  key={`${slotKey}-cape-socket-${i}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (readOnly) {
                      onReadOnlyAttempt?.();
                      return;
                    }
                    if (!unlocked) return;
                    onSelectCapeSocket?.(i);
                  }}
                  className={[
                    "h-7 rounded border text-[8px] flex items-center justify-center px-1 text-center truncate",
                    unlocked
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-45",
                    isSelected
                      ? "border-[#D4AF37] bg-[#1e1a0a] text-[#D4AF37]"
                      : unlocked
                      ? "border-[#6b5a2a] bg-black/20 text-[#cbb58a] hover:border-[#8B7355]"
                      : "border-[#3a3020] bg-black/20 text-[#6b5a2a]",
                  ].join(" ")}
                  title={
                    unlocked
                      ? socketItem
                        ? socketItem.name
                        : "Slot vacío"
                      : "Bloqueado por nivel de capa"
                  }
                >
                  {!unlocked
                    ? `Bloq.`
                    : socketItem
                    ? socketItem.name
                    : `Vacío`}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </button>
  );
}

// ─── Sub-component: item card in the bag ─────────────────────────────────────

const TYPE_TAG_COLORS: Partial<Record<ItemType, string>> = {
  arma:     "bg-red-900/30 text-red-400",
  "gema-arma":     "bg-sky-900/30 text-sky-300",
  "gema-capa":     "bg-teal-900/30 text-teal-300",
  "accesorio-arma": "bg-orange-900/30 text-orange-300",
  "accesorio-capa": "bg-cyan-900/30 text-cyan-300",
  capa:     "bg-indigo-900/30 text-indigo-300",
  cabeza:   "bg-blue-900/20 text-blue-300",
  armadura: "bg-green-900/20 text-green-300",
  pecho:    "bg-green-900/20 text-green-300",
  guante:   "bg-purple-900/20 text-purple-300",
  manos:    "bg-purple-900/20 text-purple-300",
  botas:    "bg-purple-900/20 text-purple-300",
  pies:     "bg-purple-900/20 text-purple-300",
  anillo:   "bg-yellow-900/20 text-yellow-400",
  collar:   "bg-yellow-900/20 text-yellow-400",
  amuleto:  "bg-yellow-900/20 text-yellow-400",
  cinturón: "bg-yellow-900/20 text-yellow-400",
  colgante: "bg-yellow-900/20 text-yellow-400",
};

// ─── Sub-component: tira compacta de equipo ──────────────────────────────────
//
// Sustituye a la vista previa del muñeco (280×380 px de SVG más 13 ranuras
// grandes) que se pintaba dentro de la tarjeta de personaje. El muñeco es el
// editor y vive donde se edita: dentro de la bolsa. Aquí fuera basta con SABER
// qué llevas puesto, y eso cabe en una fila.
//
// Cada casilla es un botón que abre la bolsa: el resumen es también el camino
// al editor, en vez de un aviso de "esto es solo lectura".

interface EquipmentStripProps {
  character: Character;
  /** Abrir la bolsa. Cualquier casilla lleva ahí. */
  onOpenBag?: () => void;
}

export function EquipmentStrip({ character, onOpenBag }: EquipmentStripProps) {
  const equipped = buildEquippedMap(character);
  const slots = Object.keys(SLOT_CONFIG) as SlotKey[];
  const equippedCount = slots.filter((key) => equipped[key]).length;

  // Un resumen de trece casillas vacías no resume nada: solo mete ruido en la
  // tarjeta de un personaje recién creado. La barra de arriba ya dice "Sin arma
  // · Sin armadura", y el botón de la bolsa está justo debajo.
  if (equippedCount === 0) return null;

  return (
    <div className="rounded-xl border border-[#8B7355]/60 bg-gradient-to-b from-[#1a1814] to-[#141210] p-3">
      <div className="flex items-center gap-2.5">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37]">Equipo</h3>
        <div className="h-px flex-1 bg-[#3a3020]" />
        <span className="font-sans text-[10px] tabular-nums text-[#8B7355]">
          {equippedCount}/{slots.length}
        </span>
      </div>

      {/* Medidor: cuánto del equipo está cubierto, de un vistazo. */}
      <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-black/40">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#8B7355] to-[#D4AF37]"
          initial={{ width: 0 }}
          animate={{ width: `${(equippedCount / slots.length) * 100}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {slots.map((key, i) => {
          const item = equipped[key];
          const { label, icon } = SLOT_CONFIG[key];

          return (
            <motion.button
              key={key}
              type="button"
              onClick={onOpenBag}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.025, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.94 }}
              aria-label={item ? `${label}: ${item.name}. Abrir bolsa` : `${label}: vacío. Abrir bolsa`}
              className={`group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60 ${
                item
                  ? "border-[#D4AF37]/45 bg-[#D4AF37]/8 text-[#D4AF37] hover:border-[#D4AF37]"
                  : "border-dashed border-[#3a3020] bg-black/25 text-[#8B7355] opacity-40 hover:opacity-75"
              }`}
            >
              {/* Mismo mapeador que el resto de la app: resuelve el nombre del
                  objeto por palabra clave y, si no encaja con ninguna, cae al
                  emoji de la ranura, que su tabla también traduce a icono. */}
              <span aria-hidden>
                {item
                  ? getIconForString(item.name, "h-4 w-4", icon)
                  : getIconForString(icon, "h-4 w-4")}
              </span>

              {/* Tooltip en CSS puro: sin estado ni dependencia, y aparece
                  igual con el foco del teclado que con el ratón. */}
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 max-w-40 -translate-x-1/2 scale-95 truncate rounded-md border border-[#8B7355]/60 bg-[#0f0e0c] px-2 py-1 text-center opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
              >
                <span className="block text-[9px] uppercase tracking-widest text-[#8B7355]">
                  {label}
                </span>
                <span
                  className={`block text-[10px] ${item ? "text-[#e8d8b0]" : "italic text-[#6b5a2a]"}`}
                >
                  {item ? item.name : "Vacío"}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] text-[#8B7355]/70">
        Pulsa una casilla para equipar en la bolsa.
      </p>
    </div>
  );
}

function BagItemCard({
  item,
  selectedSlot,
  selectedFromBag = false,
  onEquip,
  onSelectFromBag,
  readOnly = false,
  onReadOnlyAttempt,
}: {
  item: Item;
  selectedSlot: SlotKey | null;
  selectedFromBag?: boolean;
  onEquip: (item: Item) => void;
  onSelectFromBag?: () => void;
  readOnly?: boolean;
  onReadOnlyAttempt?: () => void;
}) {
  const isCompatible =
    selectedSlot !== null &&
    SLOT_CONFIG[selectedSlot].accepts.includes(item.type);
  const gemDescription =
    item.type === "gema-arma" || item.type === "gema-capa"
      ? item.description?.trim() || "Sin descripcion."
      : null;

  const icon = ITEM_ICONS[item.type] ?? "📦";
  const tagColor = TYPE_TAG_COLORS[item.type] ?? "bg-gray-800 text-gray-400";

  return (
    <div
      onClick={() => {
        if (readOnly) {
          onReadOnlyAttempt?.();
          return;
        }
        if (isCompatible) {
          onEquip(item);
          return;
        }
        if (!selectedSlot) onSelectFromBag?.();
      }}
      title={
        selectedSlot
          ? isCompatible
            ? `Equipar en ${SLOT_CONFIG[selectedSlot].label}`
            : `No compatible con ${SLOT_CONFIG[selectedSlot].label}`
          : item.name
      }
      className={[
        "group relative flex flex-col items-center justify-center gap-1 rounded-lg border p-2 min-h-20",
        "transition-all duration-200",
        isCompatible
          ? "cursor-pointer border-[#D4AF37] bg-[#1e1a0a] animate-pulse-gold"
          : selectedFromBag
          ? "cursor-pointer border-[#D4AF37] bg-[#1e1a0a]"
          : readOnly
          ? "border-[#3a3020] bg-[#141210] hover:border-[#8B7355] hover:bg-[#2a2518] cursor-pointer"
          : selectedSlot
          ? "opacity-40 cursor-not-allowed border-[#3a3020] bg-[#141210]"
          : "border-[#3a3020] bg-[#141210] hover:border-[#8B7355] hover:bg-[#2a2518] cursor-pointer",
      ].join(" ")}
      style={
        isCompatible
          ? {
              animation: "pulseGold 1s ease-in-out infinite",
              boxShadow: "0 0 8px rgba(212,175,55,0.3)",
            }
          : undefined
      }
    >
      <span className="flex items-center justify-center leading-none text-[#D4AF37]">{getIconForString(item.name, "w-6 h-6", icon)}</span>
      <span className="text-[11px] text-[#e8d8b0] text-center leading-tight max-w-18">
        {item.name}
      </span>
      <span className="text-[10px] text-[#D4AF37] leading-none flex items-center gap-1">
        {(item.price ?? 0).toLocaleString()} <Coins className="w-2.5 h-2.5" />
      </span>
      <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize tracking-wide ${tagColor}`}>
        {item.type}
      </span>
      {item.type === "arma" && item.requiresTwoHands && (
        <span className="text-[9px] px-1.5 py-0.5 rounded border border-[#8B7355] bg-[#1a1610] text-[#e8d8b0] tracking-wide uppercase">
          2 manos
        </span>
      )}
      {gemDescription && (
        <div
          className="pointer-events-none absolute inset-x-1 bottom-1 z-20 rounded-md border border-[#8B7355] bg-[#11100d]/95 px-2 py-1.5 text-left text-[10px] leading-snug text-[#e8d8b0] opacity-0 translate-y-1 shadow-[0_8px_16px_rgba(0,0,0,0.45)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100"
          aria-hidden="true"
        >
          {gemDescription}
        </div>
      )}
    </div>
  );
}

// ─── Paperdoll de escritorio (xl+) ───────────────────────────────────────────
//
// El muñeco anterior colocaba las trece ranuras con píxeles absolutos, tres de
// ellos NEGATIVOS (`left:-375px` para el arma izquierda, `right:-190px` para la
// capa) compensados con un `ml-72` en el contenedor. Cualquier cambio de tamaño
// lo rompía, y los paneles de arma y capa flotaban a 300px del cuerpo sin nada
// que los atara a él.
//
// Tres cambios:
//   1. Todo va en PORCENTAJES sobre una caja con aspect-ratio fijo, así que el
//      conjunto escala entero. Cero píxeles mágicos, cero offsets negativos.
//   2. Cada ranura tiene una línea que la ata a su parte del cuerpo, y esa parte
//      se ilumina cuando la ranura está activa o acepta lo que llevas en la mano.
//   3. El muñeco SE VISTE: al equipar, la pieza aparece dibujada sobre la
//      silueta. Es la diferencia entre una lista de ranuras y un personaje.
//
// Las armas y la capa tienen tres sub-huecos cada una: no caben como chip, así
// que el chip enseña tres pips (lleno / vacío / bloqueado) para el vistazo y
// despliega el panel completo al pulsarlo. Divulgación progresiva: el detalle
// aparece cuando lo pides, no antes.
//
// Debajo de xl no se monta nada de esto: la rejilla de móvil sigue intacta.

type DollAnchor = {
  /** Centro del chip, en % de la caja. */
  x: number;
  y: number;
  /** Punto del chip del que sale la línea guía. */
  tx: number;
  ty: number;
  /** Punto del cuerpo al que llega la línea guía. */
  ax: number;
  ay: number;
  /** Hacia dónde mira el chip: el icono va siempre del lado del cuerpo. */
  side: "left" | "right" | "center";
};

// Las coordenadas del cuerpo salen del viewBox 280×380 de la silueta, que ocupa
// el 43.8% del ancho y el 85% del alto de la caja, centrada y arrancando al 9%.
// Convertir a mano una vez es más barato que medirlo en runtime con refs y un
// ResizeObserver: la caja tiene aspect-ratio fijo, así que la relación no cambia.
//
// `ty` arranca siempre en el BORDE del chip, no en su centro: los chips altos
// (los de la fila de abajo miden 74px) se comían su propia línea guía.
const DOLL_LAYOUT: Record<SlotKey, DollAnchor> = {
  cabeza:      { x: 50, y: 6.5, tx: 50, ty: 12.5, ax: 50.0, ay: 17.9, side: "center" },
  capa:        { x: 11, y: 18,  tx: 21, ty: 18.0, ax: 43.0, ay: 35.8, side: "left" },
  pecho:       { x: 11, y: 36,  tx: 21, ty: 36.0, ax: 46.0, ay: 45.9, side: "left" },
  manos:       { x: 11, y: 54,  tx: 21, ty: 54.0, ax: 38.1, ay: 55.5, side: "left" },
  cinturon:    { x: 11, y: 72,  tx: 21, ty: 72.0, ax: 46.0, ay: 56.5, side: "left" },
  colgante:    { x: 89, y: 16,  tx: 79, ty: 16.0, ax: 51.6, ay: 32.5, side: "right" },
  amuleto:     { x: 89, y: 32,  tx: 79, ty: 32.0, ax: 54.4, ay: 40.3, side: "right" },
  anillo1:     { x: 89, y: 48,  tx: 79, ty: 48.0, ax: 61.9, ay: 53.5, side: "right" },
  anillo2:     { x: 89, y: 62,  tx: 79, ty: 62.0, ax: 63.0, ay: 55.5, side: "right" },
  anillo3:     { x: 89, y: 76,  tx: 79, ty: 76.0, ax: 61.9, ay: 57.5, side: "right" },
  manoizq:     { x: 16, y: 90,  tx: 16, ty: 82.8, ax: 38.1, ay: 57.5, side: "center" },
  pies:        { x: 50, y: 93,  tx: 50, ty: 87.0, ax: 50.0, ay: 82.4, side: "center" },
  manoderecha: { x: 84, y: 90,  tx: 84, ty: 82.8, ax: 61.9, ay: 57.5, side: "center" },
};

/** Zonas del cuerpo que se encienden por ranura, en coords del viewBox 280×380. */
const BODY_GLOW: Record<SlotKey, Array<[number, number, number, number]>> = {
  cabeza:      [[140, 62, 42, 42]],
  colgante:    [[140, 106, 26, 22]],
  amuleto:     [[140, 140, 32, 26]],
  capa:        [[140, 225, 118, 126]],
  pecho:       [[140, 163, 70, 60]],
  cinturon:    [[140, 208, 70, 18]],
  manos:       [[64, 208, 22, 20], [216, 208, 22, 20]],
  manoizq:     [[64, 208, 24, 22]],
  manoderecha: [[216, 208, 24, 22]],
  anillo1:     [[216, 208, 24, 22]],
  anillo2:     [[216, 208, 24, 22]],
  anillo3:     [[216, 208, 24, 22]],
  pies:        [[140, 328, 62, 20]],
};

/** Ranuras con sub-huecos: las únicas que despliegan panel. */
type SocketedSlot = "manoizq" | "manoderecha" | "capa";

function isSocketedSlot(key: SlotKey): key is SocketedSlot {
  return key === "manoizq" || key === "manoderecha" || key === "capa";
}

// ─── Silueta ─────────────────────────────────────────────────────────────────
//
// El cuerpo, las piezas que lleva puestas y el resplandor de la zona activa.
// Todo en el mismo viewBox para que las piezas caigan donde tienen que caer sin
// una sola coordenada calculada en JS.

function Silhouette({
  equipped,
  highlighted,
  reduced,
}: {
  equipped: EquippedMap;
  highlighted: Set<SlotKey>;
  reduced: boolean;
}) {
  // Una pieza equipada entra dibujándose; si el usuario pidió menos movimiento,
  // simplemente aparece.
  const piece = reduced
    ? {}
    : {
        initial: { opacity: 0, scale: 0.82 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.82 },
        transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
        style: { transformBox: "fill-box" as const, transformOrigin: "center" },
      };

  const glowZones = [...highlighted].flatMap((key) =>
    BODY_GLOW[key].map((zone, i) => [`${key}-${i}`, zone] as const),
  );

  return (
    <svg
      viewBox="0 0 280 380"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute left-1/2 top-[9%] h-[85%] w-auto -translate-x-1/2"
      aria-hidden="true"
    >
      <defs>
        {/* El cuerpo desnudo tiene que leerse sobre el fondo del modal: con el
            gris casi negro de antes, brazos y piernas sin equipo desaparecían. */}
        <linearGradient id="dollBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3c3526" />
          <stop offset="100%" stopColor="#221d16" />
        </linearGradient>
        <linearGradient id="dollSteel" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#8f9aa6" />
          <stop offset="55%" stopColor="#5d6773" />
          <stop offset="100%" stopColor="#3a424c" />
        </linearGradient>
        {/* Las armas necesitan su propio acero, más claro: con el del peto se
            fundían con el pecho y no se veía que el muñeco empuñaba nada. */}
        <linearGradient id="dollBlade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e8eef5" />
          <stop offset="45%" stopColor="#aab6c4" />
          <stop offset="100%" stopColor="#69747f" />
        </linearGradient>
        <linearGradient id="dollCloth" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#5c2531" />
          <stop offset="100%" stopColor="#280f18" />
        </linearGradient>
        <linearGradient id="dollGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d67a" />
          <stop offset="100%" stopColor="#a8801f" />
        </linearGradient>
        <radialGradient id="dollFloor" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </radialGradient>
        <filter id="dollGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Halo del suelo: ancla el muñeco para que no flote en el vacío. */}
      <ellipse cx="140" cy="346" rx="104" ry="20" fill="url(#dollFloor)" />

      {/* Resplandor de la zona activa, por debajo del cuerpo para que lo bañe
          en vez de taparlo. */}
      <AnimatePresence>
        {glowZones.map(([id, [cx, cy, rx, ry]]) => (
          <motion.ellipse
            key={id}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill="#D4AF37"
            filter="url(#dollGlow)"
            initial={{ opacity: 0 }}
            animate={reduced ? { opacity: 0.16 } : { opacity: [0.09, 0.24, 0.09] }}
            exit={{ opacity: 0 }}
            transition={
              reduced
                ? { duration: 0.2 }
                : { duration: 2.1, repeat: Infinity, ease: "easeInOut" }
            }
          />
        ))}
      </AnimatePresence>

      {/* Capa: va detrás del cuerpo, que es donde va una capa. */}
      <AnimatePresence>
        {equipped.capa && (
          <motion.g key="capa" {...piece}>
            {/* Estrecha y con dobladillo ondulado: ancha y con el borde recto
                tapaba las piernas y parecía una falda, no una capa. */}
            <path
              d="M99 114 C72 158 56 244 52 316 Q96 334 140 323 Q184 334 228 316 C224 244 208 158 181 114 Z"
              fill="url(#dollCloth)"
              stroke="#7a3340"
              strokeWidth="1"
              opacity="0.55"
            />
            <path d="M140 118 L140 322" stroke="#00000055" strokeWidth="2" />
          </motion.g>
        )}
      </AnimatePresence>

      {/* Cuerpo */}
      <circle cx="140" cy="62" r="34" fill="url(#dollBody)" stroke="#4a4028" strokeWidth="1.5" />
      <rect x="128" y="90" width="24" height="20" rx="4" fill="url(#dollBody)" stroke="#4a4028" strokeWidth="1" />
      <path d="M88 108 Q80 108 78 130 L76 205 Q76 215 88 218 L192 218 Q204 215 204 205 L202 130 Q200 108 192 108 Z" fill="url(#dollBody)" stroke="#4a4028" strokeWidth="1.5" />
      <path d="M88 112 Q72 114 68 130 L60 185 Q58 198 66 202 L80 200 L82 145 L90 118 Z" fill="url(#dollBody)" stroke="#4a4028" strokeWidth="1.2" />
      <path d="M192 112 Q208 114 212 130 L220 185 Q222 198 214 202 L200 200 L198 145 L190 118 Z" fill="url(#dollBody)" stroke="#4a4028" strokeWidth="1.2" />
      <ellipse cx="64" cy="208" rx="14" ry="10" fill="url(#dollBody)" stroke="#4a4028" strokeWidth="1.2" />
      <ellipse cx="216" cy="208" rx="14" ry="10" fill="url(#dollBody)" stroke="#4a4028" strokeWidth="1.2" />
      <path d="M100 218 L94 305 Q93 318 100 322 L118 322 Q124 318 122 305 L118 218 Z" fill="url(#dollBody)" stroke="#4a4028" strokeWidth="1.2" />
      <path d="M160 218 L158 305 Q156 318 162 322 L180 322 Q187 318 186 305 L180 218 Z" fill="url(#dollBody)" stroke="#4a4028" strokeWidth="1.2" />
      <ellipse cx="107" cy="328" rx="16" ry="9" fill="url(#dollBody)" stroke="#4a4028" strokeWidth="1.2" />
      <ellipse cx="173" cy="328" rx="16" ry="9" fill="url(#dollBody)" stroke="#4a4028" strokeWidth="1.2" />

      {/* Piezas equipadas */}
      <AnimatePresence>
        {equipped.pecho && (
          <motion.g key="pecho" {...piece}>
            {/* Escote en V y hombreras aparte: el peto rectangular de antes se
                comía cuello y brazos y el muñeco quedaba en un bulto gris. */}
            <path
              d="M96 114 Q90 116 89 134 L88 192 Q88 200 97 202 L183 202 Q192 200 192 192 L191 134 Q190 116 184 114 L152 114 Q140 130 128 114 Z"
              fill="url(#dollSteel)"
              stroke="#a4b0bd"
              strokeWidth="1.1"
            />
            <path d="M86 110 Q66 112 62 133 L79 139 Q83 118 93 116 Z" fill="url(#dollSteel)" stroke="#a4b0bd" strokeWidth="1" />
            <path d="M194 110 Q214 112 218 133 L201 139 Q197 118 187 116 Z" fill="url(#dollSteel)" stroke="#a4b0bd" strokeWidth="1" />
            <path d="M140 118 L140 200" stroke="#2b323a" strokeWidth="1.8" />
            <path d="M100 150 L180 150 M100 174 L180 174" stroke="#2b323a" strokeWidth="1.2" opacity="0.55" />
          </motion.g>
        )}

        {equipped.cabeza && (
          <motion.g key="cabeza" {...piece}>
            <path d="M107 62 A33 33 0 0 1 173 62 Z" fill="url(#dollSteel)" stroke="#a4b0bd" strokeWidth="1.1" />
            <rect x="104" y="57" width="72" height="9" rx="3" fill="url(#dollGold)" stroke="#7a5c14" strokeWidth="0.7" />
            <rect x="137" y="64" width="6" height="22" rx="2" fill="url(#dollSteel)" stroke="#a4b0bd" strokeWidth="0.7" />
            {/* Carrilleras: dejan hueco para la cara, y así se lee un yelmo en
                una cabeza en vez de una cúpula sobre un borrón. */}
            <path d="M108 64 Q105 85 114 94 L123 91 Q116 78 118 64 Z" fill="url(#dollSteel)" stroke="#a4b0bd" strokeWidth="0.8" />
            <path d="M172 64 Q175 85 166 94 L157 91 Q164 78 162 64 Z" fill="url(#dollSteel)" stroke="#a4b0bd" strokeWidth="0.8" />
          </motion.g>
        )}

        {equipped.manos && (
          <motion.g key="manos" {...piece}>
            <ellipse cx="64" cy="208" rx="16" ry="12" fill="url(#dollSteel)" stroke="#a4b0bd" strokeWidth="1" />
            <ellipse cx="216" cy="208" rx="16" ry="12" fill="url(#dollSteel)" stroke="#a4b0bd" strokeWidth="1" />
          </motion.g>
        )}

        {equipped.cinturon && (
          <motion.g key="cinturon" {...piece}>
            <rect x="84" y="200" width="112" height="14" rx="3" fill="#43301c" stroke="#77542c" strokeWidth="1" />
            <rect x="132" y="197" width="16" height="20" rx="3" fill="url(#dollGold)" stroke="#7a5c14" strokeWidth="0.8" />
          </motion.g>
        )}

        {equipped.pies && (
          <motion.g key="pies" {...piece}>
            <path d="M96 300 L120 300 L122 320 Q130 323 130 331 Q130 338 118 338 L98 338 Q90 336 91 322 Z" fill="#43301c" stroke="#77542c" strokeWidth="1.1" />
            <path d="M184 300 L160 300 L158 320 Q150 323 150 331 Q150 338 162 338 L182 338 Q190 336 189 322 Z" fill="#43301c" stroke="#77542c" strokeWidth="1.1" />
          </motion.g>
        )}

        {equipped.colgante && (
          <motion.g key="colgante" {...piece}>
            <path d="M126 112 Q140 136 154 112" stroke="url(#dollGold)" strokeWidth="2.2" fill="none" />
            <circle cx="140" cy="133" r="4.5" fill="url(#dollGold)" />
          </motion.g>
        )}

        {equipped.amuleto && (
          <motion.g key="amuleto" {...piece}>
            <circle cx="140" cy="160" r="7" fill="#6a48a8" stroke="url(#dollGold)" strokeWidth="1.8" />
          </motion.g>
        )}

        {equipped.manoizq && (
          <motion.g key="manoizq" {...piece}>
            <rect x="54" y="112" width="12" height="86" rx="2" fill="url(#dollBlade)" stroke="#cfd8e2" strokeWidth="0.8" />
            <path d="M54 112 L60 96 L66 112 Z" fill="url(#dollBlade)" stroke="#cfd8e2" strokeWidth="0.8" />
            <path d="M60 116 L60 194" stroke="#7c8896" strokeWidth="1" />
            <rect x="42" y="198" width="36" height="7" rx="2.5" fill="url(#dollGold)" stroke="#7a5c14" strokeWidth="0.6" />
            <rect x="56" y="205" width="8" height="16" rx="2" fill="#43301c" />
            <circle cx="60" cy="223" r="4" fill="url(#dollGold)" />
          </motion.g>
        )}

        {equipped.manoderecha && (
          <motion.g key="manoderecha" {...piece}>
            <rect x="214" y="112" width="12" height="86" rx="2" fill="url(#dollBlade)" stroke="#cfd8e2" strokeWidth="0.8" />
            <path d="M214 112 L220 96 L226 112 Z" fill="url(#dollBlade)" stroke="#cfd8e2" strokeWidth="0.8" />
            <path d="M220 116 L220 194" stroke="#7c8896" strokeWidth="1" />
            <rect x="202" y="198" width="36" height="7" rx="2.5" fill="url(#dollGold)" stroke="#7a5c14" strokeWidth="0.6" />
            <rect x="216" y="205" width="8" height="16" rx="2" fill="#43301c" />
            <circle cx="220" cy="223" r="4" fill="url(#dollGold)" />
          </motion.g>
        )}

        {/* Los tres anillos comparten mano: se apilan como puntos de oro. */}
        {(["anillo1", "anillo2", "anillo3"] as const).map((key, i) =>
          equipped[key] ? (
            <motion.circle
              key={key}
              cx={224 - i * 7}
              cy={214 - i * 5}
              r="3.4"
              fill="url(#dollGold)"
              stroke="#4a3410"
              strokeWidth="0.8"
              {...piece}
            />
          ) : null,
        )}
      </AnimatePresence>
    </svg>
  );
}

// ─── Chip de ranura ──────────────────────────────────────────────────────────

type ChipState = "selected" | "compatible" | "dimmed" | "filled" | "empty";

function DollChip({
  slotKey,
  item,
  state,
  pips,
  index,
  reduced,
  onSelect,
}: {
  slotKey: SlotKey;
  item: Item | null;
  state: ChipState;
  /** Sólo para armas y capa: estado de los tres sub-huecos. */
  pips?: Array<"filled" | "empty" | "locked">;
  index: number;
  reduced: boolean;
  onSelect: () => void;
}) {
  const cfg = SLOT_CONFIG[slotKey];
  const { x, y, side } = DOLL_LAYOUT[slotKey];

  const skin: Record<ChipState, string> = {
    selected:   "border-[#D4AF37] bg-[#241d09] text-[#f3e3b4] shadow-[0_0_0_1px_rgba(212,175,55,0.5),0_0_22px_rgba(212,175,55,0.35)]",
    compatible: "border-[#D4AF37]/70 border-dashed bg-[#1a1608]/80 text-[#e8d8b0]",
    dimmed:     "border-[#2f2a1e] bg-[#111010]/70 text-[#7a705a] opacity-55",
    filled:     "border-[#6d7a3a] bg-[#191c11]/90 text-[#e8d8b0] hover:border-[#93a54c]",
    empty:      "border-dashed border-[#3a3020] bg-[#100f0d]/70 text-[#7d7057] hover:border-[#8B7355] hover:bg-[#1c1913]/80",
  };

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-label={`${cfg.label}: ${item ? item.name : "vacío"}`}
      aria-pressed={state === "selected"}
      initial={reduced ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: reduced ? 0 : index * 0.03, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      style={{ left: `${x}%`, top: `${y}%` }}
      className={[
        // Atenuado no es lo mismo que desactivado: pulsar una ranura que no
        // acepta el objeto sigue explicando POR QUÉ no lo acepta, así que el
        // cursor tiene que seguir invitando a pulsarla.
        "absolute z-20 -translate-x-1/2 -translate-y-1/2 w-[19%] cursor-pointer rounded-xl border px-2 py-1.5",
        "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/70",
        skin[state],
      ].join(" ")}
    >
      {/* Anillo de "aquí puedes soltar": late para separarse visualmente de la
          ranura que está seleccionada, que es fija. Antes ambas se pintaban
          igual y no había forma de distinguirlas. */}
      {state === "compatible" && !reduced && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-xl border border-[#D4AF37]"
          animate={{ opacity: [0.25, 0.9, 0.25], boxShadow: [
            "0 0 0px rgba(212,175,55,0)",
            "0 0 16px rgba(212,175,55,0.55)",
            "0 0 0px rgba(212,175,55,0)",
          ] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <span
        className={[
          "flex items-center gap-1.5",
          side === "center" ? "flex-col" : side === "left" ? "flex-row-reverse" : "flex-row",
        ].join(" ")}
      >
        <span className="shrink-0 text-[#D4AF37]">
          {getIconForString(item ? item.name : cfg.icon, "w-5 h-5", cfg.icon)}
        </span>
        <span
          className={[
            "min-w-0 flex-1 leading-tight",
            side === "center" ? "text-center" : side === "left" ? "text-right" : "text-left",
          ].join(" ")}
        >
          <span className="block truncate text-[8px] font-semibold uppercase tracking-[0.14em] text-[#8a7a5a]">
            {cfg.label}
          </span>
          <span className="block truncate text-[10px] font-medium">
            {item ? item.name : "—"}
          </span>
        </span>
      </span>

      {pips && (
        <span className="mt-1.5 flex items-center justify-center gap-1" aria-hidden>
          {pips.map((p, i) => (
            <span
              key={i}
              className={[
                "h-1.5 w-1.5 rounded-full",
                p === "filled"
                  ? "bg-[#D4AF37] shadow-[0_0_5px_rgba(212,175,55,0.8)]"
                  : p === "empty"
                  ? "border border-[#6b5a2a] bg-transparent"
                  : "bg-[#3a3020]",
              ].join(" ")}
            />
          ))}
        </span>
      )}
    </motion.button>
  );
}

// ─── Panel de sub-huecos ─────────────────────────────────────────────────────

function SocketPanel({
  slotKey,
  item,
  level,
  unlocked,
  sockets,
  selectedIndex,
  reduced,
  onSelectSocket,
}: {
  slotKey: SocketedSlot;
  item: Item | null;
  level: number;
  unlocked: number;
  sockets: readonly WeaponSocketItem[];
  selectedIndex: number | null;
  reduced: boolean;
  onSelectSocket: (index: number) => void;
}) {
  // Carril fijo bajo el cinturón: es la única banda de la caja que no pisa ni
  // un chip ni la mitad alta del cuerpo, así que cabeza, peto y ambas armas
  // siguen viéndose mientras engarzas. El panel nace del lado de su chip —
  // sólo cambia el origen de la animación — y así se ve de dónde ha salido sin
  // tener que dibujar un conector.
  const origin: Record<SocketedSlot, string> = {
    capa: "top left",
    manoizq: "bottom left",
    manoderecha: "bottom right",
  };

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 6 }}
      transition={{ type: "spring", damping: 24, stiffness: 340 }}
      style={{ transformOrigin: origin[slotKey] }}
      className="absolute left-[28%] right-[28%] top-[59%] z-30 rounded-xl border border-[#8B7355] bg-[#0f0e0c]/95 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-[#D4AF37]">
          {SLOT_CONFIG[slotKey].label}
        </span>
        <span className="shrink-0 font-sans text-[9px] tabular-nums text-[#8a7a5a]">
          Nv. {level} · {unlocked}/3
        </span>
      </div>

      <p className="mt-0.5 truncate text-[11px] text-[#e8d8b0]">
        {item ? item.name : <span className="italic text-[#6b5a2a]">Ranura vacía</span>}
      </p>

      {/* Medidor de huecos abiertos: el nivel del objeto es lo que los abre. */}
      <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-black/50">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#8B7355] to-[#D4AF37]"
          initial={{ width: 0 }}
          animate={{ width: `${(unlocked / 3) * 100}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => {
          const open = i < unlocked;
          const socketItem = sockets[i] ?? null;
          const active = selectedIndex === i;

          return (
            <button
              key={i}
              type="button"
              disabled={!open}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSocket(i);
              }}
              title={open ? socketItem?.name ?? "Hueco vacío" : "Bloqueado por nivel"}
              className={[
                "flex h-14 flex-col items-center justify-center gap-1 rounded-lg border px-1 text-center transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/70",
                !open
                  ? "cursor-not-allowed border-[#2f2a1e] bg-black/40 text-[#5a4f36]"
                  : active
                  ? "cursor-pointer border-[#D4AF37] bg-[#241d09] text-[#f3e3b4] shadow-[0_0_14px_rgba(212,175,55,0.4)]"
                  : socketItem
                  ? "cursor-pointer border-[#6b5a2a] bg-[#17150f] text-[#cbb58a] hover:border-[#D4AF37]"
                  : "cursor-pointer border-dashed border-[#4a3e22] bg-black/25 text-[#7d7057] hover:border-[#8B7355]",
              ].join(" ")}
            >
              {!open ? (
                <Lock className="h-3.5 w-3.5" />
              ) : socketItem ? (
                <span className="text-[#D4AF37]">{getIconForString(socketItem.name, "w-4 h-4", "💠")}</span>
              ) : (
                <span className="text-base leading-none opacity-50">◇</span>
              )}
              <span className="w-full truncate text-[8px] uppercase tracking-wide">
                {!open ? "Bloq." : socketItem?.name ?? "Vacío"}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Composición ─────────────────────────────────────────────────────────────

function PaperDoll({
  character,
  equipped,
  selectedSlot,
  selectedBagItem,
  weaponSockets,
  capeSockets,
  selectedWeaponSocket,
  selectedCapeSocket,
  onSelectSlot,
  onSelectWeaponSocket,
  onSelectCapeSocket,
}: {
  character: Character;
  equipped: EquippedMap;
  selectedSlot: SlotKey | null;
  selectedBagItem: Item | null;
  weaponSockets: WeaponSockets;
  capeSockets: CapeSockets;
  selectedWeaponSocket: { weaponSlot: WeaponSlotKey; socketIndex: number } | null;
  selectedCapeSocket: number | null;
  onSelectSlot: (key: SlotKey) => void;
  onSelectWeaponSocket: (weaponSlot: WeaponSlotKey, socketIndex: number) => void;
  onSelectCapeSocket: (socketIndex: number) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const slots = Object.keys(SLOT_CONFIG) as SlotKey[];

  const compatible = (key: SlotKey) =>
    !!selectedBagItem && SLOT_CONFIG[key].accepts.includes(selectedBagItem.type);

  const stateOf = (key: SlotKey): ChipState => {
    if (selectedSlot === key) return "selected";
    if (selectedBagItem) return compatible(key) ? "compatible" : "dimmed";
    return equipped[key] ? "filled" : "empty";
  };

  // El cuerpo se ilumina donde puedes actuar: la ranura activa, o todas las que
  // aceptan el objeto que acabas de coger de la bolsa.
  const highlighted = new Set<SlotKey>(
    selectedBagItem ? slots.filter(compatible) : selectedSlot ? [selectedSlot] : [],
  );

  const levelOf = (key: SocketedSlot) =>
    key === "capa"
      ? getCapeLevel(character, equipped)
      : getWeaponLevelForSlot(character, equipped, key);

  // Sin objeto en la ranura no hay dónde engarzar: `selectWeaponSocket` ya lo
  // rechaza ("Equipa un arma primero"), así que los pips y el panel no pueden
  // anunciar un hueco libre que al pulsarlo da un aviso. Ojo: la cuenta base
  // devuelve 1 incluso a nivel 0, de ahí el corte.
  const unlockedOf = (key: SocketedSlot) =>
    !equipped[key]
      ? 0
      : key === "capa"
      ? getUnlockedCapeSocketCount(levelOf(key))
      : getUnlockedWeaponSocketCount(levelOf(key));

  const socketsOf = (key: SocketedSlot): readonly WeaponSocketItem[] =>
    key === "capa" ? capeSockets : weaponSockets[key];

  const pipsOf = (key: SocketedSlot): Array<"filled" | "empty" | "locked"> => {
    const open = unlockedOf(key);
    const items = socketsOf(key);
    return [0, 1, 2].map((i) => (i >= open ? "locked" : items[i] ? "filled" : "empty"));
  };

  // El panel sigue abierto mientras trabajes dentro de él: seleccionar un
  // sub-hueco vacía `selectedSlot`, así que hay que mirar también los otros dos.
  const openPanel: SocketedSlot | null = selectedWeaponSocket
    ? selectedWeaponSocket.weaponSlot
    : selectedCapeSocket !== null
    ? "capa"
    : selectedSlot && isSocketedSlot(selectedSlot)
    ? selectedSlot
    : null;

  return (
    <motion.div
      className="relative mx-auto aspect-10/7 w-full max-w-190"
      // Respira en reposo y se queda quieto en cuanto empiezas a trabajar: un
      // blanco que se mueve bajo el cursor es un blanco peor.
      animate={reduced || selectedSlot || selectedBagItem ? { y: 0 } : { y: [0, -5, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Líneas guía: cada ranura atada a su parte del cuerpo. Sin ellas, trece
          cajas alrededor de una silueta son trece cajas, no un personaje. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {slots.map((key, i) => {
          const { tx, ty, ax, ay } = DOLL_LAYOUT[key];
          const hot = highlighted.has(key);
          return (
            <motion.path
              key={key}
              d={`M ${tx} ${ty} Q ${(tx + ax) / 2} ${ty} ${ax} ${ay}`}
              fill="none"
              stroke={hot ? "#D4AF37" : "#4a4028"}
              strokeWidth={hot ? 1.4 : 0.8}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              initial={reduced ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: hot ? 0.95 : 0.5 }}
              transition={{ duration: 0.5, delay: reduced ? 0 : i * 0.03, ease: "easeOut" }}
            />
          );
        })}
        {slots.map((key) => {
          const { ax, ay } = DOLL_LAYOUT[key];
          const hot = highlighted.has(key);
          return (
            <circle
              key={`${key}-dot`}
              cx={ax}
              cy={ay}
              r={hot ? 0.9 : 0.6}
              fill={hot ? "#D4AF37" : "#6b5a2a"}
              opacity={hot ? 1 : 0.6}
            />
          );
        })}
      </svg>

      <Silhouette equipped={equipped} highlighted={highlighted} reduced={reduced} />

      {slots.map((key, i) => (
        <DollChip
          key={key}
          slotKey={key}
          item={equipped[key]}
          state={stateOf(key)}
          pips={isSocketedSlot(key) ? pipsOf(key) : undefined}
          index={i}
          reduced={reduced}
          onSelect={() => onSelectSlot(key)}
        />
      ))}

      <AnimatePresence>
        {openPanel && (
          <SocketPanel
            key={openPanel}
            slotKey={openPanel}
            item={equipped[openPanel]}
            level={levelOf(openPanel)}
            unlocked={unlockedOf(openPanel)}
            sockets={socketsOf(openPanel)}
            selectedIndex={
              openPanel === "capa"
                ? selectedCapeSocket
                : selectedWeaponSocket?.weaponSlot === openPanel
                ? selectedWeaponSocket.socketIndex
                : null
            }
            reduced={reduced}
            onSelectSocket={(i) =>
              openPanel === "capa"
                ? onSelectCapeSocket(i)
                : onSelectWeaponSocket(openPanel, i)
            }
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main EquipmentModal component ───────────────────────────────────────────

interface EquipmentModalProps {
  userId: string;
  character: Character;
  characters?: Character[];
  onClose: () => void;
  onSave: (updatedCharacter: Character, updatedBagItems: Item[]) => Promise<void>;
  onGoldUpdate?: (newGold: number) => void;
  onRefreshProfile?: () => Promise<void>;
}

export default function EquipmentModal({
  userId,
  character,
  characters = [],
  onClose,
  onSave,
  onGoldUpdate,
  onRefreshProfile,
}: EquipmentModalProps) {
  const [equipped, setEquipped] = useState<EquippedMap>(() =>
    buildEquippedMap(character)
  );
  const [bagItems, setBagItems] = useState<Item[]>(character.bag.items);
  const [selectedSlot, setSelectedSlot] = useState<SlotKey | null>(null);
  const [selectedBagIndex, setSelectedBagIndex] = useState<number | null>(null);
  const [weaponSockets, setWeaponSockets] = useState<WeaponSockets>(() =>
    buildWeaponSockets(character),
  );
  const [capeSockets, setCapeSockets] = useState<CapeSockets>(() =>
    buildCapeSockets(character),
  );
  const [selectedWeaponSocket, setSelectedWeaponSocket] = useState<{
    weaponSlot: WeaponSlotKey;
    socketIndex: number;
  } | null>(null);
  const [selectedCapeSocket, setSelectedCapeSocket] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState("Sin cambios pendientes");

  // Sonido de cuero al abrir la bolsa (el modal se monta al abrirse).
  useEffect(() => {
    playBagOpenSfx();
  }, []);

  const renderStatusMessage = (msg: string) => {
    if (msg.startsWith("⚠")) {
      return <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-500" />{msg.slice(1).trim()}</span>;
    }
    if (msg.startsWith("✓")) {
      return <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{msg.slice(1).trim()}</span>;
    }
    if (msg.startsWith("✗")) {
      return <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4 text-red-500" />{msg.slice(1).trim()}</span>;
    }
    if (msg.startsWith("↩")) {
      return <span className="flex items-center gap-1.5"><Undo2 className="w-4 h-4 text-blue-400" />{msg.slice(1).trim()}</span>;
    }
    if (msg.startsWith("💰")) {
      return <span className="flex items-center gap-1.5"><Coins className="w-4 h-4 text-yellow-400" />{msg.slice(1).trim()}</span>;
    }
    return msg;
  };
  const [isSaving, setIsSaving] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [showSellConfirm, setShowSellConfirm] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedTargetCharacterId, setSelectedTargetCharacterId] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    if (character?.id) {
      localStorage.setItem(`mc_bag_last_count_${character.id}`, bagItems.length.toString());
    }
  }, [character?.id, bagItems.length]);

  const selectedBagItem =
    selectedBagIndex !== null ? bagItems[selectedBagIndex] : null;
  const selectedBagItemSaleGold = Math.max(
    0,
    Math.floor((selectedBagItem?.price ?? 0) / 2),
  );
  const sellConcept = "venta_objeto";

  const moveSocketItemsToBag = useCallback(
    (weaponSlot: WeaponSlotKey, targetBag: Item[]) => {
      for (const socketItem of weaponSockets[weaponSlot]) {
        if (socketItem) targetBag.push(socketItem);
      }
    },
    [weaponSockets],
  );

  const moveCapeSocketItemsToBag = useCallback(
    (targetBag: Item[]) => {
      for (const socketItem of capeSockets) {
        if (socketItem) targetBag.push(socketItem);
      }
    },
    [capeSockets],
  );

  const equipWeaponFromBag = useCallback(
    (weaponSlot: WeaponSlotKey, item: Item, bagIndex: number) => {
      if (item.type !== "arma") {
        setStatusMsg('⚠ Este slot solo acepta items de tipo "arma".');
        return false;
      }

      const oppositeSlot = getOppositeWeaponSlot(weaponSlot);
      const targetNeedsBothHands = isTwoHandedWeapon(item);
      const oppositeNeedsBothHands = isTwoHandedWeapon(equipped[oppositeSlot]);
      const shouldClearOpposite = targetNeedsBothHands || oppositeNeedsBothHands;
      const slotsToClear = shouldClearOpposite
        ? [weaponSlot, oppositeSlot]
        : [weaponSlot];

      const returnedItems: Item[] = [];
      for (const slot of slotsToClear) {
        const equippedItem = equipped[slot];
        if (equippedItem) returnedItems.push(equippedItem);
        for (const socketItem of weaponSockets[slot]) {
          if (socketItem) returnedItems.push(socketItem);
        }
      }

      const projectedBagSize = bagItems.length - 1 + returnedItems.length;
      if (projectedBagSize > character.bag.maxSlots) {
        setStatusMsg("⚠ La bolsa está llena. No puedes equipar este arma.");
        return false;
      }

      const newBag = bagItems.filter((_, idx) => idx !== bagIndex);
      newBag.push(...returnedItems);

      setEquipped((prev) => {
        const next = { ...prev, [weaponSlot]: item };
        if (shouldClearOpposite) {
          next[oppositeSlot] = null;
        }
        return next;
      });

      setWeaponSockets((prev) => {
        const copy: WeaponSockets = {
          manoizq: [...prev.manoizq] as [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem],
          manoderecha: [...prev.manoderecha] as [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem],
        };
        copy[weaponSlot] = [null, null, null];
        if (shouldClearOpposite) {
          copy[oppositeSlot] = [null, null, null];
        }
        return copy;
      });

      setBagItems(newBag);
      setSelectedBagIndex(null);
      setSelectedSlot(null);
      setSelectedWeaponSocket(null);
      setSelectedCapeSocket(null);
      setStatusMsg(
        `✓ ${item.name} equipado en ${SLOT_CONFIG[weaponSlot].label}${
          targetNeedsBothHands ? " (dos manos)" : ""
        }`,
      );
      return true;
    },
    [bagItems, character.bag.maxSlots, equipped, weaponSockets],
  );

  const selectWeaponSocket = useCallback(
    (weaponSlot: WeaponSlotKey, socketIndex: number) => {
      const weaponName = getWeaponNameFromEquipped(equipped, weaponSlot);
      if (!weaponName) {
        setStatusMsg("⚠ Equipa un arma primero para usar sus slots.");
        return;
      }

      const weaponLevel = getWeaponLevelForSlot(character, equipped, weaponSlot);
      const unlocked = getUnlockedWeaponSocketCount(weaponLevel);
      if (socketIndex >= unlocked) {
        setStatusMsg(
          `⚠ Slot bloqueado. El arma es nivel ${weaponLevel} y solo habilita ${unlocked} slot(s).`,
        );
        return;
      }

      if (selectedBagIndex !== null) {
        const bagItem = bagItems[selectedBagIndex];
        if (!bagItem) {
          setSelectedBagIndex(null);
          return;
        }
        if (bagItem.type !== "accesorio-arma" && bagItem.type !== "gema-arma") {
          setStatusMsg("⚠ Este slot solo acepta items de tipo gema-arma.");
          return;
        }

        const newBag = bagItems.filter((_, idx) => idx !== selectedBagIndex);
        const oldSocketItem = weaponSockets[weaponSlot][socketIndex];
        if (oldSocketItem) newBag.push(oldSocketItem);

        setWeaponSockets((prev) => {
          const copy: WeaponSockets = {
            manoizq: [...prev.manoizq] as [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem],
            manoderecha: [...prev.manoderecha] as [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem],
          };
          copy[weaponSlot][socketIndex] = bagItem;
          return copy;
        });

        setBagItems(newBag);
        setSelectedBagIndex(null);
        setSelectedSlot(null);
        setSelectedWeaponSocket(null);
        setSelectedCapeSocket(null);
        setStatusMsg(`✓ ${bagItem.name} insertado en slot ${socketIndex + 1} de ${SLOT_CONFIG[weaponSlot].label}`);
        return;
      }

      if (
        selectedWeaponSocket?.weaponSlot === weaponSlot &&
        selectedWeaponSocket.socketIndex === socketIndex
      ) {
        const current = weaponSockets[weaponSlot][socketIndex];
        if (!current) {
          setSelectedWeaponSocket(null);
          setStatusMsg("Sin cambios pendientes");
          return;
        }

        if (bagItems.length >= character.bag.maxSlots) {
          setStatusMsg("⚠ La bolsa está llena. No puedes retirar el accesorio.");
          return;
        }

        setWeaponSockets((prev) => {
          const copy: WeaponSockets = {
            manoizq: [...prev.manoizq] as [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem],
            manoderecha: [...prev.manoderecha] as [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem],
          };
          copy[weaponSlot][socketIndex] = null;
          return copy;
        });
        setBagItems((prev) => [...prev, current]);
        setSelectedWeaponSocket(null);
        setStatusMsg(`↩ ${current.name} devuelto a la bolsa`);
        return;
      }

      setSelectedSlot(null);
      setSelectedCapeSocket(null);
      setSelectedWeaponSocket({ weaponSlot, socketIndex });
      setStatusMsg(
        `Slot de arma ${socketIndex + 1} activo — elige una gema-arma`,
      );
    },
    [
      equipped,
      character,
      selectedBagIndex,
      bagItems,
      weaponSockets,
      selectedWeaponSocket,
    ],
  );

  const selectCapeSocket = useCallback(
    (socketIndex: number) => {
      const capeName = getCapeNameFromEquipped(equipped);
      if (!capeName) {
        setStatusMsg("⚠ Equipa una capa primero para usar sus slots.");
        return;
      }

      const capeLevel = getCapeLevel(character, equipped);
      const unlocked = getUnlockedCapeSocketCount(capeLevel);
      if (socketIndex >= unlocked) {
        setStatusMsg(
          `⚠ Slot bloqueado. La capa es nivel ${capeLevel} y solo habilita ${unlocked} slot(s).`,
        );
        return;
      }

      if (selectedBagIndex !== null) {
        const bagItem = bagItems[selectedBagIndex];
        if (!bagItem) {
          setSelectedBagIndex(null);
          return;
        }
        if (bagItem.type !== "accesorio-capa" && bagItem.type !== "gema-capa") {
          setStatusMsg("⚠ Este slot solo acepta items de tipo gema-capa.");
          return;
        }

        const newBag = bagItems.filter((_, idx) => idx !== selectedBagIndex);
        const oldSocketItem = capeSockets[socketIndex];
        if (oldSocketItem) newBag.push(oldSocketItem);

        setCapeSockets((prev) => {
          const copy: CapeSockets = [...prev] as CapeSockets;
          copy[socketIndex] = bagItem;
          return copy;
        });

        setBagItems(newBag);
        setSelectedBagIndex(null);
        setSelectedSlot(null);
        setSelectedWeaponSocket(null);
        setSelectedCapeSocket(null);
        setStatusMsg(`✓ ${bagItem.name} insertado en slot ${socketIndex + 1} de Capa`);
        return;
      }

      if (selectedCapeSocket === socketIndex) {
        const current = capeSockets[socketIndex];
        if (!current) {
          setSelectedCapeSocket(null);
          setStatusMsg("Sin cambios pendientes");
          return;
        }

        if (bagItems.length >= character.bag.maxSlots) {
          setStatusMsg("⚠ La bolsa está llena. No puedes retirar el accesorio.");
          return;
        }

        setCapeSockets((prev) => {
          const copy: CapeSockets = [...prev] as CapeSockets;
          copy[socketIndex] = null;
          return copy;
        });
        setBagItems((prev) => [...prev, current]);
        setSelectedCapeSocket(null);
        setStatusMsg(`↩ ${current.name} devuelto a la bolsa`);
        return;
      }

      setSelectedSlot(null);
      setSelectedWeaponSocket(null);
      setSelectedCapeSocket(socketIndex);
      setStatusMsg(
        `Slot de capa ${socketIndex + 1} activo — elige un item de tipo gema-capa`,
      );
    },
    [
      equipped,
      character,
      selectedBagIndex,
      bagItems,
      capeSockets,
      selectedCapeSocket,
    ],
  );

  const selectSlot = useCallback(
    (slotKey: SlotKey) => {
      if (selectedBagIndex !== null) {
        const item = bagItems[selectedBagIndex];
        if (!item) {
          setSelectedBagIndex(null);
          return;
        }
        const cfg = SLOT_CONFIG[slotKey];
        if (!cfg.accepts.includes(item.type)) {
          setStatusMsg(`⚠ ${item.name} no es compatible con ${cfg.label}`);
          return;
        }

        const oldItem = equipped[slotKey];
        const newBag = bagItems.filter((_, idx) => idx !== selectedBagIndex);
        if (oldItem) newBag.push(oldItem);

        if (slotKey === "manoizq" || slotKey === "manoderecha") {
          const handled = equipWeaponFromBag(slotKey, item, selectedBagIndex);
          if (handled) {
            return;
          }
          return;
        }
        if (slotKey === "capa") {
          moveCapeSocketItemsToBag(newBag);
          setCapeSockets([null, null, null]);
        }

        setEquipped((prev) => ({ ...prev, [slotKey]: item }));
        setBagItems(newBag);
        setSelectedBagIndex(null);
        setSelectedSlot(null);
        setSelectedWeaponSocket(null);
        setSelectedCapeSocket(null);
        setStatusMsg(`✓ ${item.name} equipado en ${cfg.label}`);
        return;
      }

      if (selectedSlot === slotKey) {
        // Toggle off, or unequip if something is there
        if (equipped[slotKey]) {
          // Unequip
          if (bagItems.length >= character.bag.maxSlots) {
            setStatusMsg("⚠ La bolsa está llena. No puedes desequipar.");
            return;
          }
          const item = equipped[slotKey]!;
          setEquipped((prev) => ({ ...prev, [slotKey]: null }));
          setBagItems((prev) => {
            const nextBag = [...prev, item];
            if (slotKey === "manoizq" || slotKey === "manoderecha") {
              moveSocketItemsToBag(slotKey, nextBag);
              setWeaponSockets((socketPrev) => ({
                ...socketPrev,
                [slotKey]: [null, null, null],
              }));
            }
            if (slotKey === "capa") {
              moveCapeSocketItemsToBag(nextBag);
              setCapeSockets([null, null, null]);
            }
            return nextBag;
          });
          setStatusMsg(`↩ ${item.name} devuelto a la bolsa`);
        }
        setSelectedSlot(null);
        setSelectedWeaponSocket(null);
        setSelectedCapeSocket(null);
        return;
      }
      setSelectedCapeSocket(null);
      setSelectedWeaponSocket(null);
      setSelectedSlot(slotKey);
      const cfg = SLOT_CONFIG[slotKey];
      setStatusMsg(
        `Slot ${cfg.label} seleccionado — elige un objeto compatible`
      );
    },
    [
      selectedSlot,
      selectedBagIndex,
      equipped,
      bagItems,
      character.bag.maxSlots,
      moveSocketItemsToBag,
      moveCapeSocketItemsToBag,
      equipWeaponFromBag,
    ]
  );

  const selectBagItem = useCallback(
    (index: number) => {
      if (selectedSlot && !selectedWeaponSocket && selectedCapeSocket === null) return;
      if (selectedBagIndex === index) {
        setSelectedBagIndex(null);
        setStatusMsg("Sin cambios pendientes");
        return;
      }
      setSelectedBagIndex(index);
      playItemSelectSfx();
      if (selectedWeaponSocket) {
        setStatusMsg("Objeto seleccionado — haz clic en el sub-slot del arma para insertarlo");
        return;
      }
      if (selectedCapeSocket !== null) {
        setStatusMsg("Objeto seleccionado — haz clic en el sub-slot de la capa para insertarlo");
        return;
      }
      setStatusMsg("Objeto seleccionado — haz clic en un slot para equiparlo");
    },
    [selectedBagIndex, selectedSlot, selectedWeaponSocket, selectedCapeSocket]
  );

  const equipItem = useCallback(
    (item: Item) => {
      if (selectedWeaponSocket) {
        if (item.type !== "accesorio-arma" && item.type !== "gema-arma") {
          setStatusMsg('⚠ Este slot solo acepta items de tipo "accesorio-arma" o "gema-arma".');
          return;
        }

        const bagIndex = bagItems.findIndex((b) => b.name === item.name);
        if (bagIndex === -1) {
          setStatusMsg("⚠ No se encontró el item en la bolsa.");
          return;
        }

        const { weaponSlot, socketIndex } = selectedWeaponSocket;
        const newBag = bagItems.filter((_, idx) => idx !== bagIndex);
        const oldSocketItem = weaponSockets[weaponSlot][socketIndex];
        if (oldSocketItem) newBag.push(oldSocketItem);

        setWeaponSockets((prev) => {
          const copy: WeaponSockets = {
            manoizq: [...prev.manoizq] as [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem],
            manoderecha: [...prev.manoderecha] as [WeaponSocketItem, WeaponSocketItem, WeaponSocketItem],
          };
          copy[weaponSlot][socketIndex] = item;
          return copy;
        });
        setBagItems(newBag);
        setSelectedBagIndex(null);
        setSelectedWeaponSocket(null);
        setSelectedCapeSocket(null);
        setStatusMsg(`✓ ${item.name} insertado en slot ${socketIndex + 1}`);
        return;
      }

      if (selectedCapeSocket !== null) {
        if (item.type !== "accesorio-capa" && item.type !== "gema-capa") {
          setStatusMsg("⚠ Este slot solo acepta items de tipo gema-capa.");
          return;
        }

        const bagIndex = bagItems.findIndex((b) => b.name === item.name);
        if (bagIndex === -1) {
          setStatusMsg("⚠ No se encontró el item en la bolsa.");
          return;
        }

        const newBag = bagItems.filter((_, idx) => idx !== bagIndex);
        const oldSocketItem = capeSockets[selectedCapeSocket];
        if (oldSocketItem) newBag.push(oldSocketItem);

        setCapeSockets((prev) => {
          const copy: CapeSockets = [...prev] as CapeSockets;
          copy[selectedCapeSocket] = item;
          return copy;
        });
        setBagItems(newBag);
        setSelectedBagIndex(null);
        setSelectedCapeSocket(null);
        setStatusMsg(`✓ ${item.name} insertado en slot de capa ${selectedCapeSocket + 1}`);
        return;
      }

      if (selectedSlot === "manoizq" || selectedSlot === "manoderecha") {
        const bagIndex = bagItems.findIndex((b) => b.name === item.name);
        if (bagIndex === -1) {
          setStatusMsg("⚠ No se encontró el item en la bolsa.");
          return;
        }

        equipWeaponFromBag(selectedSlot, item, bagIndex);
        return;
      }

      if (!selectedSlot) return;
      const cfg = SLOT_CONFIG[selectedSlot];
      if (!cfg.accepts.includes(item.type)) {
        setStatusMsg(`⚠ ${item.name} no es compatible con ${cfg.label}`);
        return;
      }

      setEquipped((prev) => {
        const newMap = { ...prev };
        // Return old item to bag if slot was occupied
        if (newMap[selectedSlot]) {
          setBagItems((b) => [...b, newMap[selectedSlot]!]);
        }

        if (selectedSlot === "capa") {
          const capeSocketItems = capeSockets.filter(Boolean) as Item[];
          if (capeSocketItems.length > 0) {
            setBagItems((bagPrev) => [...bagPrev, ...capeSocketItems]);
          }
          setCapeSockets([null, null, null]);
        }

        newMap[selectedSlot] = item;
        return newMap;
      });
      setBagItems((prev) => prev.filter((b) => b.name !== item.name));
      setStatusMsg(`✓ ${item.name} equipado en ${cfg.label}`);
      setSelectedSlot(null);
      setSelectedBagIndex(null);
      setSelectedWeaponSocket(null);
      setSelectedCapeSocket(null);
    },
    [selectedSlot, selectedWeaponSocket, selectedCapeSocket, bagItems, weaponSockets, capeSockets, equipWeaponFromBag]
  );

  const handleSave = async () => {
    setIsSaving(true);
    const updatedCharacter = {
      ...equippedMapToCharacter(character, equipped),
      weaponSockets,
      capeSockets,
    };
    try {
      await onSave(updatedCharacter, bagItems);
      setStatusMsg("✓ Cambios guardados exitosamente");
    } catch {
      setStatusMsg("✗ Error al guardar. Inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSellSelected = async () => {
    if (selectedBagIndex === null || !selectedBagItem) {
      setStatusMsg("⚠ Selecciona un objeto de la bolsa para vender");
      return;
    }

    setIsSelling(true);
    setShowSellConfirm(false);
    try {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();

      const response = await fetch("/api/profile/sell-item", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          userId,
          characterId: character.id,
          bagIndex: selectedBagIndex,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo vender el objeto");
      }

      const soldItemName = data?.itemName ?? bagItems[selectedBagIndex]?.name ?? "objeto";
      const gainedGold = Number(data?.saleGold ?? 0);
      const concept = String(data?.concepto ?? sellConcept);

      setBagItems((prev) => prev.filter((_, idx) => idx !== selectedBagIndex));
      setSelectedBagIndex(null);
      setSelectedSlot(null);
      setSelectedCapeSocket(null);
      setStatusMsg(
        `💰 Venta: ${soldItemName} por +${gainedGold} oro (concepto: ${concept})`,
      );

      if (typeof data?.oro === "number") {
        onGoldUpdate?.(data.oro);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo vender";
      setStatusMsg(`✗ ${message}`);
    } finally {
      setIsSelling(false);
    }
  };

  const handleMoveItem = async (targetCharacterId: number) => {
    if (selectedBagIndex === null || !selectedBagItem) {
      setStatusMsg("⚠ Selecciona un objeto de la bolsa para mover");
      return;
    }

    if (selectedBagItem?.fueComerciado) {
      setMoveError("No puedes mover este objeto. Ya fue transferido anteriormente y cada objeto solo puede comerciarse una vez.");
      return;
    }

    setIsMoving(true);
    setMoveError(null);
    // 1. Guardar cambios pendientes (auto-guardado)
    const updatedCharacter = {
      ...equippedMapToCharacter(character, equipped),
      weaponSockets,
      capeSockets,
    };
    try {
      await onSave(updatedCharacter, bagItems);

      // 2. Realizar el movimiento en la base de datos
      const {
        data: { session },
      } = await getSupabase().auth.getSession();

      const response = await fetch("/api/profile/move-item", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          userId,
          fromCharacterId: character.id,
          toCharacterId: targetCharacterId,
          bagIndex: selectedBagIndex,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMoveError(data?.error || "No se pudo mover el objeto");
        setIsMoving(false);
        return;
      }

      setStatusMsg(`✓ ${data.itemName} movido a ${data.targetCharacterName} con éxito.`);
      
      // 3. Resetear selección y recargar perfil
      setShowMoveModal(false);
      setSelectedTargetCharacterId(null);
      setSelectedBagIndex(null);
      setSelectedSlot(null);
      setSelectedCapeSocket(null);
      setSelectedWeaponSocket(null);

      if (onRefreshProfile) {
        await onRefreshProfile();
      }
      onClose(); // Cerrar modal porque el estado de origen cambió sustancialmente
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo mover el objeto";
      setStatusMsg(`✗ ${message}`);
    } finally {
      setIsMoving(false);
    }
  };

  const emptySlots = character.bag.maxSlots - bagItems.length;

  return (
    <>
      {/* Keyframe for bag item pulse */}
      <style>{`
        @keyframes pulseGold {
          0%, 100% { box-shadow: 0 0 8px rgba(212,175,55,0.3); }
          50%       { box-shadow: 0 0 18px rgba(212,175,55,0.65); }
        }
      `}</style>

      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md bg-black/60 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {/* Modal */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{
            scale: 1,
            opacity: 1,
            y: 0,
            transition: { type: "spring", damping: 26, stiffness: 320 },
          }}
          exit={{
            scale: 0.94,
            opacity: 0,
            y: 15,
            transition: { duration: 0.18, ease: "easeInOut" },
          }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[1400px] rounded-xl flex flex-col overflow-hidden max-h-[92vh] my-auto shadow-2xl border border-[#8B7355]"
          style={{
            background: "linear-gradient(160deg, #1a1814 0%, #141210 100%)",
          }}
        >
          {/* ── Header ── */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b border-[#3a3020]"
            style={{
              background:
                "linear-gradient(90deg, #0f0e0c 0%, #1e1c14 50%, #0f0e0c 100%)",
            }}
          >
            <div>
              <h2 className="text-sm tracking-[0.2em] uppercase text-[#D4AF37] flex items-center gap-2 font-bold">
                <Swords className="w-4 h-4" /> Equipo de {character.name}
              </h2>
              <p className="text-xs text-[#8a7a5a] mt-0.5">
                Haz clic en un slot para equipar o desequipar objetos
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[#8a7a5a] hover:text-[#e8d8b0] hover:bg-white/10 transition-all cursor-pointer z-20"
              title="Cerrar bolsa"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden flex-1 min-h-0">
            {/* LEFT / TOP: Bag */}
            <div className="w-full xl:w-140 shrink-0 flex flex-col p-4 gap-3 overflow-y-auto min-w-0 border-b xl:border-b-0 xl:border-r border-[#2a2518]">
              {/* Bag header */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs tracking-[0.2em] uppercase text-[#8B7355] flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" /> Bolsa
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedBagIndex === null || !selectedBagItem) {
                        setStatusMsg("⚠ Selecciona un objeto de la bolsa para vender");
                        return;
                      }
                      setShowSellConfirm(true);
                    }}
                    disabled={selectedBagIndex === null || isSelling || isSaving}
                    className="text-[10px] tracking-[0.12em] uppercase font-bold py-1.5 px-3 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: selectedBagIndex === null || isSelling || isSaving ? "#5a5040" : "#8B5E34",
                      color: "#f5e6c8",
                    }}
                    title="Vender objeto seleccionado por la mitad de su precio"
                  >
                    {isSelling ? "Vendiendo..." : "Vender seleccionado"}
                  </button>
                  <button
                    onClick={() => {
                      if (selectedBagIndex === null || !selectedBagItem) {
                        setStatusMsg("⚠ Selecciona un objeto de la bolsa para mover");
                        return;
                      }
                      setShowMoveModal(true);
                    }}
                    disabled={selectedBagIndex === null || isSelling || isSaving || isMoving}
                    className="text-[10px] tracking-[0.12em] uppercase font-bold py-1.5 px-3 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: selectedBagIndex === null || isSelling || isSaving || isMoving ? "#5a5040" : "#8B5E34",
                      color: "#f5e6c8",
                    }}
                    title="Mover objeto seleccionado a otro de tus personajes"
                  >
                    {isMoving ? "Moviendo..." : "Mover item"}
                  </button>
                  <span className="text-xs text-[#8a7a5a]">
                    {bagItems.length} / {character.bag.maxSlots} espacios
                  </span>
                </div>
              </div>

              {/* Hint */}
              <div
                className="text-xs text-center py-2 px-3 rounded-md italic transition-all duration-300"
                style={{
                  border: selectedSlot
                    ? "1px solid rgba(212,175,55,0.4)"
                    : "1px solid rgba(212,175,55,0.12)",
                  background: selectedSlot
                    ? "rgba(212,175,55,0.06)"
                    : "rgba(0,0,0,0.2)",
                  color: selectedSlot ? "#c8a820" : "#8a7a5a",
                }}
              >
                {selectedSlot
                  ? `Slot activo: ${SLOT_CONFIG[selectedSlot].label} — elige un objeto compatible o haz clic en el slot para desequipar`
                  : selectedWeaponSocket
                    ? "Sub-slot de arma activo — elige una gema-arma o un item de tipo accesorio-arma"
                  : selectedCapeSocket !== null
                  ? "Sub-slot de capa activo — elige una gema-capa o un item de tipo accesorio-capa"
                    : "Selecciona un slot del personaje para activarlo"}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-4 gap-2">
                {bagItems.map((item, idx) => (
                  <BagItemCard
                    key={`${item.name}-${idx}`}
                    item={item}
                    selectedSlot={selectedSlot}
                    selectedFromBag={selectedBagIndex === idx}
                    onEquip={equipItem}
                    onSelectFromBag={() => selectBagItem(idx)}
                  />
                ))}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center justify-center min-h-20 rounded-lg border border-dashed border-[#2a2518]/60"
                    style={{ background: "rgba(20,18,16,0.4)" }}
                  >
                    <span className="text-[10px] text-[#3a3020]">Vacío</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT / BOTTOM: Character figure */}
            <div
              className="w-full xl:flex-1 xl:min-w-0 flex flex-col items-center gap-3 p-4 overflow-y-auto"
              style={{ background: "rgba(0,0,0,0.15)" }}
            >
              <div className="flex w-full max-w-190 items-center gap-3">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3a3020]" />
                <span className="text-[10px] tracking-[0.3em] uppercase text-[#8B7355] font-semibold">
                  Slots de Personaje
                </span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3a3020]" />
              </div>

              {/* Escritorio (xl+): muñeco nuevo. Debajo de xl no se monta. */}
              <div className="hidden w-full xl:block">
                <PaperDoll
                  character={character}
                  equipped={equipped}
                  selectedSlot={selectedSlot}
                  selectedBagItem={selectedBagItem}
                  weaponSockets={weaponSockets}
                  capeSockets={capeSockets}
                  selectedWeaponSocket={selectedWeaponSocket}
                  selectedCapeSocket={selectedCapeSocket}
                  onSelectSlot={selectSlot}
                  onSelectWeaponSocket={selectWeaponSocket}
                  onSelectCapeSocket={selectCapeSocket}
                />
              </div>

              {/* Mobile Grid (<xl) */}
              <div className="xl:hidden w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                {(Object.keys(SLOT_CONFIG) as SlotKey[]).map((key) => (
                  (() => {
                    const weaponSlot =
                      key === "manoizq" || key === "manoderecha" ? key : null;
                    const isCompatible =
                      !!selectedBagItem && SLOT_CONFIG[key].accepts.includes(selectedBagItem.type);
                    return (
                      <SlotButton
                        key={key}
                        slotKey={key}
                        item={equipped[key]}
                        selected={selectedSlot === key || isCompatible}
                        onSelect={() => selectSlot(key)}
                        weaponLevel={
                          weaponSlot
                            ? getWeaponLevelForSlot(character, equipped, weaponSlot)
                            : undefined
                        }
                        weaponSocketItems={
                          weaponSlot ? weaponSockets[weaponSlot] : undefined
                        }
                        weaponSelectedSocketIndex={
                          weaponSlot && selectedWeaponSocket?.weaponSlot === weaponSlot
                            ? selectedWeaponSocket.socketIndex
                            : null
                        }
                        onSelectWeaponSocket={selectWeaponSocket}
                        capeLevel={key === "capa" ? getCapeLevel(character, equipped) : undefined}
                        capeSocketItems={key === "capa" ? capeSockets : undefined}
                        capeSelectedSocketIndex={key === "capa" ? selectedCapeSocket : null}
                        onSelectCapeSocket={selectCapeSocket}
                        layoutMode="grid"
                      />
                    );
                  })()
                ))}
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div
            className="flex items-center gap-3 px-5 py-3 border-t border-[#3a3020]"
            style={{
              background:
                "linear-gradient(90deg, #0f0e0c 0%, #1a1814 50%, #0f0e0c 100%)",
            }}
          >
            <div className="flex-1 text-xs text-[#8a7a5a] italic">
              {renderStatusMessage(statusMsg)}
            </div>
            <p className="text-[10px] text-[#5a5040] hidden sm:block">
              Clic en slot equipado para desequipar
            </p>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs tracking-[0.15em] uppercase font-bold py-2.5 px-7 rounded-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: isSaving ? "#6a6030" : "#D4AF37",
                color: "#0a0a08",
              }}
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {showSellConfirm && selectedBagItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-xl border border-[#8B7355] p-5 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
            style={{ background: "linear-gradient(160deg, #1a1814 0%, #141210 100%)" }}
          >
            <h3 className="text-sm tracking-[0.18em] uppercase text-[#D4AF37] mb-3">
              Confirmar Venta
            </h3>
            <p className="text-sm text-[#e8d8b0] leading-relaxed">
              Vas a vender <strong>{selectedBagItem.name}</strong> por la mitad de su valor.
            </p>
            <div className="mt-3 rounded-md border border-[#3a3020] bg-black/20 p-3 text-xs text-[#cbb58a] space-y-1">
              <p>Precio base: {(selectedBagItem.price ?? 0).toLocaleString()} oro</p>
              <p>Recibirás: {selectedBagItemSaleGold.toLocaleString()} oro (50%)</p>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSellConfirm(false)}
                disabled={isSelling}
                className="px-3 py-2 rounded-md border border-[#5a5040] text-xs text-[#cbb58a] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={handleSellSelected}
                disabled={isSelling}
                className="px-3 py-2 rounded-md text-xs font-semibold disabled:opacity-60"
                style={{ background: "#8B5E34", color: "#f5e6c8" }}
              >
                {isSelling ? "Vendiendo..." : "Confirmar venta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveModal && selectedBagItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-xl border border-[#8B7355] p-5 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
            style={{ background: "linear-gradient(160deg, #1a1814 0%, #141210 100%)" }}
          >
            <h3 className="text-sm tracking-[0.18em] uppercase text-[#D4AF37] mb-3 font-serif">
              Mover Objeto
            </h3>
            <p className="text-sm text-[#e8d8b0] leading-relaxed">
              Selecciona el personaje al que deseas mover <strong>{selectedBagItem.name}</strong>:
            </p>

            <div className="mt-3 max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {(characters ?? [])
                .filter((char) => char.id !== character.id && char.lifeStatus !== "muerto")
                .map((char) => {
                  const isFull = (char.bag?.items?.length ?? 0) >= (char.bag?.maxSlots ?? 10);
                  const isSelected = selectedTargetCharacterId === char.id;

                  return (
                    <button
                      key={char.id}
                      disabled={isFull || isMoving}
                      onClick={() => setSelectedTargetCharacterId(char.id)}
                      className={[
                        "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all duration-200",
                        isFull
                          ? "opacity-50 cursor-not-allowed border-[#2a2018] bg-black/10"
                          : isSelected
                          ? "border-[#D4AF37] bg-[#1e1a0a] shadow-[0_0_8px_rgba(212,175,55,0.3)] cursor-pointer"
                          : "border-[#3a3020] bg-black/20 hover:border-[#8B7355] hover:bg-[#2a2518] cursor-pointer",
                      ].join(" ")}
                    >
                      <div className="relative w-10 h-10 rounded border border-[#8B7355] overflow-hidden bg-secondary/40 shrink-0">
                        <img
                          src={char.portrait || "/characters/profileplaceholder.webp"}
                          alt={char.name}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[#8a7a5a] uppercase tracking-wider leading-none">
                          {char.race}
                        </p>
                        <p className="text-sm font-serif text-[#e8d8b0] truncate mt-0.5">
                          {char.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="text-[10px] text-[#8a7a5a]">
                          {(char.bag?.items?.length ?? 0)} / {(char.bag?.maxSlots ?? 10)} slots
                        </span>
                        {isFull && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded border border-red-700/50 bg-red-950/30 text-red-400 font-semibold uppercase leading-none">
                            Lleno
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              {(!characters ||
                characters.filter((char) => char.id !== character.id && char.lifeStatus !== "muerto").length === 0) && (
                <p className="text-xs text-[#8a7a5a] italic text-center py-4">
                  No tienes otros personajes vivos disponibles para recibir este objeto.
                </p>
              )}
            </div>

            {selectedBagItem?.fueComerciado && (
              <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/20 px-3 py-2 text-xs text-red-400 text-center">
                No puedes mover este objeto. Ya fue transferido anteriormente y cada objeto solo puede comerciarse una vez.
              </div>
            )}

            {moveError && (
              <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/20 px-3 py-2 text-xs text-red-400 text-center">
                {moveError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setSelectedTargetCharacterId(null);
                  setMoveError(null);
                }}
                disabled={isMoving}
                className="px-3 py-2 rounded-md border border-[#5a5040] text-xs text-[#cbb58a] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={() => selectedTargetCharacterId && handleMoveItem(selectedTargetCharacterId)}
                disabled={isMoving || !selectedTargetCharacterId || selectedBagItem?.fueComerciado}
                className="px-3 py-2 rounded-md text-xs font-semibold disabled:opacity-60 transition-all"
                style={{
                  background: selectedTargetCharacterId && !isMoving && !selectedBagItem?.fueComerciado ? "#D4AF37" : "#5a5040",
                  color: selectedTargetCharacterId && !isMoving && !selectedBagItem?.fueComerciado ? "#0a0a08" : "#8a7a5a",
                }}
              >
                {isMoving ? "Moviendo..." : "Confirmar movimiento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}