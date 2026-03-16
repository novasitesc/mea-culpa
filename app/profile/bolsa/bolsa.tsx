"use client";

import { useState, useCallback } from "react";
import FantasyAlert from "@/components/ui/fantasy-alert";

// ─── Types (re-exported from your page, or paste here) ───────────────────────

type ItemType =
  | "cabeza"
  | "pecho"
  | "guante"
  | "botas"
  | "collar"
  | "anillo"
  | "amuleto"
  | "cinturón"
  | "arma"
  | "piernas"
  | "manos"
  | "colgante";

type Item = {
  name: string;
  type: ItemType;
  price?: number;
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
  armor: ArmorSlots;
  accessories: AccessorySlots;
  weapons: WeaponSlots;
  bag: Bag;
  // add other fields your Character type has
  [key: string]: unknown;
};

// ─── Slot configuration ───────────────────────────────────────────────────────

type SlotKey =
  | "cabeza"
  | "colgante"
  | "cinturon"
  | "pecho"
  | "manoizq"
  | "manoderecha"
  | "manos"
  | "anillo1"
  | "anillo2"
  | "piernas"
  | "pies";

const SLOT_CONFIG: Record<SlotKey, { accepts: ItemType[]; label: string; icon: string }> = {
  cabeza:      { accepts: ["cabeza"],                          label: "Cabeza",    icon: "👑" },
  colgante:    { accepts: ["collar", "amuleto", "colgante"],   label: "Colgante",  icon: "💎" },
  cinturon:    { accepts: ["cinturón"],                        label: "Cinturón",  icon: "🪢" },
  pecho:       { accepts: ["pecho"],                           label: "Pecho",     icon: "🧥" },
  manoizq:     { accepts: ["arma"],                            label: "Mano Izq",  icon: "🗡" },
  manoderecha: { accepts: ["arma"],                            label: "Mano Der",  icon: "🗡" },
  manos:       { accepts: ["guante", "manos"],                 label: "Manos",     icon: "🧤" },
  anillo1:     { accepts: ["anillo"],                          label: "Anillo 1",  icon: "✨" },
  anillo2:     { accepts: ["anillo"],                          label: "Anillo 2",  icon: "✨" },
  piernas:     { accepts: ["piernas", "botas"],                label: "Piernas",   icon: "🦺" },
  pies:        { accepts: ["botas"],                           label: "Pies",      icon: "🥾" },
};

const ITEM_ICONS: Partial<Record<ItemType, string>> = {
  arma: "⚔️", cabeza: "👑", pecho: "🧥", guante: "🧤", manos: "🧤",
  botas: "🥾", anillo: "💍", collar: "📿",
  amuleto: "🔮", colgante: "💎", piernas: "🦺",
  cinturón: "🪢",
};

// ─── Helper: build a flat equipped map from Character slots ──────────────────

type EquippedMap = Record<SlotKey, Item | null>;

function buildEquippedMap(character: Character): EquippedMap {
  return {
    cabeza:      character.armor.cabeza      ? { name: character.armor.cabeza,      type: "cabeza"   } : null,
    pecho:       character.armor.pecho       ? { name: character.armor.pecho,       type: "pecho"    } : null,
    manos:       character.armor.guante      ? { name: character.armor.guante,      type: "guante"   } : null,
    pies:        character.armor.botas       ? { name: character.armor.botas,       type: "botas"    } : null,
    colgante:    character.accessories.collar  ? { name: character.accessories.collar,  type: "collar"  } :
                 character.accessories.amuleto ? { name: character.accessories.amuleto, type: "amuleto" } : null,
    cinturon:    character.accessories.cinturon ? { name: character.accessories.cinturon, type: "cinturón" } : null,
    anillo1:     character.accessories.anillo1 ? { name: character.accessories.anillo1, type: "anillo"  } : null,
    anillo2:     character.accessories.anillo2 ? { name: character.accessories.anillo2, type: "anillo"  } : null,
    manoizq:     character.weapons.manoIzquierda ? { name: character.weapons.manoIzquierda, type: "arma" } : null,
    manoderecha: character.weapons.manoDerecha   ? { name: character.weapons.manoDerecha,   type: "arma" } : null,
    piernas:     null, // add your own legs field if you have one
  };
}

// ─── Helper: write equipped map back to Character format ─────────────────────

function equippedMapToCharacter(
  character: Character,
  equipped: EquippedMap
): Character {
  return {
    ...character,
    armor: {
      cabeza: equipped.cabeza?.name,
      pecho:  equipped.pecho?.name,
      guante: equipped.manos?.name,
      botas:  equipped.pies?.name,
    },
    accessories: {
      collar:  equipped.colgante?.type === "collar"  ? equipped.colgante.name : undefined,
      amuleto: equipped.colgante?.type === "amuleto" ? equipped.colgante.name : undefined,
      cinturon: equipped.cinturon?.name,
      anillo1: equipped.anillo1?.name,
      anillo2: equipped.anillo2?.name,
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
  readOnly = false,
  onReadOnlyAttempt,
}: {
  slotKey: SlotKey;
  item: Item | null;
  selected: boolean;
  onSelect: (key: SlotKey) => void;
  readOnly?: boolean;
  onReadOnlyAttempt?: () => void;
}) {
  const cfg = SLOT_CONFIG[slotKey];

  const positionStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = { position: "absolute" };
    const positions: Record<SlotKey, React.CSSProperties> = {
      cabeza:      { top: "6px",   left: "50%", transform: "translateX(-50%)" },
      colgante:    { top: "100px", left: "50%", transform: "translateX(-50%)" },
      cinturon:    { top: "272px", left: "50%", transform: "translateX(-50%)" },
      pecho:       { top: "150px", left: "50%", transform: "translateX(-50%)" },
      manoizq:     { top: "145px", left: "14px" },
      manoderecha: { top: "145px", right: "14px" },
      manos:       { top: "207px", left: "16px" },
      anillo1:     { top: "200px", right: "16px" },
      anillo2:     { top: "254px", right: "16px" },
      piernas:     { top: "240px", left: "50%", transform: "translateX(-50%)" },
      pies:        { top: "315px", left: "50%", transform: "translateX(-50%)" },
    };
    return { ...base, ...positions[slotKey] };
  })();

  return (
    <button
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
        "w-15 h-13 flex flex-col items-center justify-center gap-0.5",
        "rounded-lg border text-center transition-all duration-200",
        "font-sans",
        readOnly ? "cursor-default" : "cursor-pointer",
        selected
          ? "border-[#D4AF37] bg-[#1e1a0a] shadow-[0_0_12px_rgba(212,175,55,0.4)]"
          : item
          ? "border-[#4a5a20] bg-[#1e2010] hover:border-[#6a8a30]"
          : "border-[#3a3020] bg-[#141210] hover:border-[#8B7355] hover:bg-[#2a2518]",
      ].join(" ")}
    >
      <span className="text-lg leading-none">{cfg.icon}</span>
      <span className="text-[9px] text-[#8a7a5a] tracking-wide uppercase leading-none">
        {cfg.label}
      </span>
      {item && (
        <span className="text-[8px] text-[#D4AF37] leading-none max-w-13 truncate px-0.5">
          {item.name}
        </span>
      )}
    </button>
  );
}

// ─── Sub-component: item card in the bag ─────────────────────────────────────

const TYPE_TAG_COLORS: Partial<Record<ItemType, string>> = {
  arma:     "bg-red-900/30 text-red-400",
  cabeza:   "bg-blue-900/20 text-blue-300",
  pecho:    "bg-green-900/20 text-green-300",
  guante:   "bg-purple-900/20 text-purple-300",
  manos:    "bg-purple-900/20 text-purple-300",
  botas:    "bg-purple-900/20 text-purple-300",
  piernas:  "bg-purple-900/20 text-purple-300",
  anillo:   "bg-yellow-900/20 text-yellow-400",
  collar:   "bg-yellow-900/20 text-yellow-400",
  amuleto:  "bg-yellow-900/20 text-yellow-400",
  cinturón: "bg-yellow-900/20 text-yellow-400",
  colgante: "bg-yellow-900/20 text-yellow-400",
};

interface EquipmentPreviewProps {
  character: Character;
}

export function EquipmentPreview({ character }: EquipmentPreviewProps) {
  const equipped = buildEquippedMap(character);
  const bagItems = character.bag.items;
  const emptySlots = character.bag.maxSlots - bagItems.length;
  const [noticeId, setNoticeId] = useState(0);
  const notifyOpenBag = () => {
    setNoticeId((prev) => prev + 1);
  };

  return (
    <>
      <FantasyAlert
        key={noticeId}
        open={noticeId > 0}
        title="Modo solo lectura"
        message='Para editar, presiona "Abrir Bolsa".'
        variant="warning"
        onClose={() => setNoticeId(0)}
      />

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #1a1814 0%, #141210 100%)",
          border: "1px solid #8B7355",
        }}
      >
        <div
          className="px-4 py-3 border-b border-[#3a3020]"
          style={{
            background:
              "linear-gradient(90deg, #0f0e0c 0%, #1e1c14 50%, #0f0e0c 100%)",
          }}
        >
          <h3 className="text-xs tracking-[0.2em] uppercase text-[#D4AF37]">
            Equipo y Bolsa
          </h3>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[300px,1fr] gap-0">
          <div
            className="flex flex-col items-center gap-3 p-4 border-b xl:border-b-0 xl:border-r border-[#2a2518]"
            style={{ background: "rgba(0,0,0,0.15)" }}
          >
            <span className="text-[10px] tracking-[0.3em] uppercase text-[#8B7355] font-sans">
              Personaje
            </span>

            <div className="relative w-65 h-92.5">
              <svg
                viewBox="0 0 280 380"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 w-full h-full"
              >
                <defs>
                  <linearGradient id="bodyGradPreview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2a2618" />
                    <stop offset="100%" stopColor="#1a1610" />
                  </linearGradient>
                </defs>
                <circle cx="140" cy="62" r="34" fill="url(#bodyGradPreview)" stroke="#3a3020" strokeWidth="1.5" />
                <rect x="128" y="90" width="24" height="20" rx="4" fill="url(#bodyGradPreview)" stroke="#3a3020" strokeWidth="1" />
                <path d="M88 108 Q80 108 78 130 L76 205 Q76 215 88 218 L192 218 Q204 215 204 205 L202 130 Q200 108 192 108 Z" fill="url(#bodyGradPreview)" stroke="#3a3020" strokeWidth="1.5" />
                <path d="M88 112 Q72 114 68 130 L60 185 Q58 198 66 202 L80 200 L82 145 L90 118 Z" fill="url(#bodyGradPreview)" stroke="#3a3020" strokeWidth="1.2" />
                <path d="M192 112 Q208 114 212 130 L220 185 Q222 198 214 202 L200 200 L198 145 L190 118 Z" fill="url(#bodyGradPreview)" stroke="#3a3020" strokeWidth="1.2" />
                <ellipse cx="64" cy="208" rx="14" ry="10" fill="url(#bodyGradPreview)" stroke="#3a3020" strokeWidth="1.2" />
                <ellipse cx="216" cy="208" rx="14" ry="10" fill="url(#bodyGradPreview)" stroke="#3a3020" strokeWidth="1.2" />
                <path d="M100 218 L94 305 Q93 318 100 322 L118 322 Q124 318 122 305 L118 218 Z" fill="url(#bodyGradPreview)" stroke="#3a3020" strokeWidth="1.2" />
                <path d="M160 218 L158 305 Q156 318 162 322 L180 322 Q187 318 186 305 L180 218 Z" fill="url(#bodyGradPreview)" stroke="#3a3020" strokeWidth="1.2" />
                <ellipse cx="107" cy="328" rx="16" ry="9" fill="url(#bodyGradPreview)" stroke="#3a3020" strokeWidth="1.2" />
                <ellipse cx="173" cy="328" rx="16" ry="9" fill="url(#bodyGradPreview)" stroke="#3a3020" strokeWidth="1.2" />
                <line x1="140" y1="110" x2="140" y2="218" stroke="#3a3020" strokeWidth="0.5" strokeDasharray="4 3" />
              </svg>

              {(Object.keys(SLOT_CONFIG) as SlotKey[]).map((key) => (
                <SlotButton
                  key={key}
                  slotKey={key}
                  item={equipped[key]}
                  selected={false}
                  onSelect={() => {}}
                  readOnly
                  onReadOnlyAttempt={notifyOpenBag}
                />
              ))}
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs tracking-[0.2em] uppercase text-[#8B7355] font-sans">
                ⚜ Bolsa
              </h3>
              <span className="text-xs text-[#8a7a5a] font-sans">
                {bagItems.length} / {character.bag.maxSlots} espacios
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2">
              {bagItems.map((item, idx) => (
                <BagItemCard
                  key={`${item.name}-${idx}`}
                  item={item}
                  selectedSlot={null}
                  onEquip={() => {}}
                  readOnly
                  onReadOnlyAttempt={notifyOpenBag}
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
        </div>
      </div>
    </>
  );
}

function BagItemCard({
  item,
  selectedSlot,
  onEquip,
  readOnly = false,
  onReadOnlyAttempt,
}: {
  item: Item;
  selectedSlot: SlotKey | null;
  onEquip: (item: Item) => void;
  readOnly?: boolean;
  onReadOnlyAttempt?: () => void;
}) {
  const isCompatible =
    selectedSlot !== null &&
    SLOT_CONFIG[selectedSlot].accepts.includes(item.type);

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
        }
      }}
      title={
        selectedSlot
          ? isCompatible
            ? `Equipar en ${SLOT_CONFIG[selectedSlot].label}`
            : `No compatible con ${SLOT_CONFIG[selectedSlot].label}`
          : item.name
      }
      className={[
        "flex flex-col items-center justify-center gap-1 rounded-lg border p-2 min-h-20",
        "transition-all duration-200",
        isCompatible
          ? "cursor-pointer border-[#D4AF37] bg-[#1e1a0a] animate-pulse-gold"
          : readOnly
          ? "border-[#3a3020] bg-[#141210] hover:border-[#8B7355] hover:bg-[#2a2518] cursor-pointer"
          : selectedSlot
          ? "opacity-40 cursor-not-allowed border-[#3a3020] bg-[#141210]"
          : "border-[#3a3020] bg-[#141210] hover:border-[#8B7355] hover:bg-[#2a2518] cursor-default",
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
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[11px] text-[#e8d8b0] text-center leading-tight max-w-18">
        {item.name}
      </span>
      <span className="text-[10px] text-[#D4AF37] leading-none">
        {(item.price ?? 0).toLocaleString()} 🪙
      </span>
      <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize tracking-wide ${tagColor}`}>
        {item.type}
      </span>
    </div>
  );
}

// ─── Main EquipmentModal component ───────────────────────────────────────────

interface EquipmentModalProps {
  character: Character;
  onClose: () => void;
  onSave: (updatedCharacter: Character, updatedBagItems: Item[]) => Promise<void>;
}

export default function EquipmentModal({
  character,
  onClose,
  onSave,
}: EquipmentModalProps) {
  const [equipped, setEquipped] = useState<EquippedMap>(() =>
    buildEquippedMap(character)
  );
  const [bagItems, setBagItems] = useState<Item[]>(character.bag.items);
  const [selectedSlot, setSelectedSlot] = useState<SlotKey | null>(null);
  const [statusMsg, setStatusMsg] = useState("Sin cambios pendientes");
  const [isSaving, setIsSaving] = useState(false);

  const selectSlot = useCallback(
    (slotKey: SlotKey) => {
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
          setBagItems((prev) => [...prev, item]);
          setStatusMsg(`↩ ${item.name} devuelto a la bolsa`);
        }
        setSelectedSlot(null);
        return;
      }
      setSelectedSlot(slotKey);
      const cfg = SLOT_CONFIG[slotKey];
      setStatusMsg(
        `Slot ${cfg.label} seleccionado — elige un objeto compatible`
      );
    },
    [selectedSlot, equipped, bagItems.length, character.bag.maxSlots]
  );

  const equipItem = useCallback(
    (item: Item) => {
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
        newMap[selectedSlot] = item;
        return newMap;
      });
      setBagItems((prev) => prev.filter((b) => b.name !== item.name));
      setStatusMsg(`✓ ${item.name} equipado en ${cfg.label}`);
      setSelectedSlot(null);
    },
    [selectedSlot]
  );

  const handleSave = async () => {
    setIsSaving(true);
    const updatedCharacter = equippedMapToCharacter(character, equipped);
    try {
      await onSave(updatedCharacter, bagItems);
      setStatusMsg("✓ Cambios guardados exitosamente");
    } catch {
      setStatusMsg("✗ Error al guardar. Inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
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
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* Modal */}
        <div
          className="relative w-full max-w-4xl rounded-xl flex flex-col overflow-hidden max-h-[92vh]"
          style={{
            background: "linear-gradient(160deg, #1a1814 0%, #141210 100%)",
            border: "1px solid #8B7355",
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
              <h2 className="font-serif text-sm tracking-[0.2em] uppercase text-[#D4AF37]">
                ⚔ Equipo de {character.name}
              </h2>
              <p className="text-xs text-[#8a7a5a] mt-0.5">
                Haz clic en un slot del personaje para equipar o desequipar objetos
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded text-[#8a7a5a] hover:text-[#e8d8b0] hover:bg-white/5 transition-all text-lg"
            >
              ×
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex overflow-hidden flex-1 min-h-0">
            {/* LEFT: Character figure */}
            <div
              className="w-75 shrink-0 flex flex-col items-center gap-3 p-4 border-r border-[#2a2518] overflow-y-auto"
              style={{ background: "rgba(0,0,0,0.15)" }}
            >
              <span className="text-[10px] tracking-[0.3em] uppercase text-[#8B7355] font-sans">
                Personaje
              </span>

              {/* Figure */}
              <div className="relative w-65 h-92.5">
                {/* SVG silhouette */}
                <svg
                  viewBox="0 0 280 380"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute inset-0 w-full h-full"
                >
                  <defs>
                    <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2a2618" />
                      <stop offset="100%" stopColor="#1a1610" />
                    </linearGradient>
                  </defs>
                  {/* Head */}
                  <circle cx="140" cy="62" r="34" fill="url(#bodyGrad)" stroke="#3a3020" strokeWidth="1.5" />
                  {/* Neck */}
                  <rect x="128" y="90" width="24" height="20" rx="4" fill="url(#bodyGrad)" stroke="#3a3020" strokeWidth="1" />
                  {/* Torso */}
                  <path d="M88 108 Q80 108 78 130 L76 205 Q76 215 88 218 L192 218 Q204 215 204 205 L202 130 Q200 108 192 108 Z" fill="url(#bodyGrad)" stroke="#3a3020" strokeWidth="1.5" />
                  {/* Left arm */}
                  <path d="M88 112 Q72 114 68 130 L60 185 Q58 198 66 202 L80 200 L82 145 L90 118 Z" fill="url(#bodyGrad)" stroke="#3a3020" strokeWidth="1.2" />
                  {/* Right arm */}
                  <path d="M192 112 Q208 114 212 130 L220 185 Q222 198 214 202 L200 200 L198 145 L190 118 Z" fill="url(#bodyGrad)" stroke="#3a3020" strokeWidth="1.2" />
                  {/* Hands */}
                  <ellipse cx="64" cy="208" rx="14" ry="10" fill="url(#bodyGrad)" stroke="#3a3020" strokeWidth="1.2" />
                  <ellipse cx="216" cy="208" rx="14" ry="10" fill="url(#bodyGrad)" stroke="#3a3020" strokeWidth="1.2" />
                  {/* Legs */}
                  <path d="M100 218 L94 305 Q93 318 100 322 L118 322 Q124 318 122 305 L118 218 Z" fill="url(#bodyGrad)" stroke="#3a3020" strokeWidth="1.2" />
                  <path d="M160 218 L158 305 Q156 318 162 322 L180 322 Q187 318 186 305 L180 218 Z" fill="url(#bodyGrad)" stroke="#3a3020" strokeWidth="1.2" />
                  {/* Feet */}
                  <ellipse cx="107" cy="328" rx="16" ry="9" fill="url(#bodyGrad)" stroke="#3a3020" strokeWidth="1.2" />
                  <ellipse cx="173" cy="328" rx="16" ry="9" fill="url(#bodyGrad)" stroke="#3a3020" strokeWidth="1.2" />
                  {/* Center line */}
                  <line x1="140" y1="110" x2="140" y2="218" stroke="#3a3020" strokeWidth="0.5" strokeDasharray="4 3" />
                </svg>

                {/* Slot buttons */}
                {(Object.keys(SLOT_CONFIG) as SlotKey[]).map((key) => (
                  <SlotButton
                    key={key}
                    slotKey={key}
                    item={equipped[key]}
                    selected={selectedSlot === key}
                    onSelect={selectSlot}
                  />
                ))}
              </div>
            </div>

            {/* RIGHT: Bag */}
            <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto min-w-0">
              {/* Bag header */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs tracking-[0.2em] uppercase text-[#8B7355] font-sans">
                  ⚜ Bolsa
                </h3>
                <span className="text-xs text-[#8a7a5a] font-sans">
                  {bagItems.length} / {character.bag.maxSlots} espacios
                </span>
              </div>

              {/* Hint */}
              <div
                className="text-xs text-center py-2 px-3 rounded-md italic font-serif transition-all duration-300"
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
                  : "Selecciona un slot del personaje para activarlo"}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-4 gap-2">
                {bagItems.map((item, idx) => (
                  <BagItemCard
                    key={`${item.name}-${idx}`}
                    item={item}
                    selectedSlot={selectedSlot}
                    onEquip={equipItem}
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
          </div>

          {/* ── Footer ── */}
          <div
            className="flex items-center gap-3 px-5 py-3 border-t border-[#3a3020]"
            style={{
              background:
                "linear-gradient(90deg, #0f0e0c 0%, #1a1814 50%, #0f0e0c 100%)",
            }}
          >
            <p className="flex-1 text-xs text-[#8a7a5a] italic font-serif">
              {statusMsg}
            </p>
            <p className="text-[10px] text-[#5a5040] font-sans hidden sm:block">
              Clic en slot equipado para desequipar
            </p>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="font-sans text-xs tracking-[0.15em] uppercase font-bold py-2.5 px-7 rounded-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: isSaving ? "#6a6030" : "#D4AF37",
                color: "#0a0a08",
              }}
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}