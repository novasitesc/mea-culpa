"use client";

// Tarjeta de un personaje: retrato, clases, nivel, estado de vida y accesos a
// sus acciones. La unidad visual que más se repite en el perfil.

/**
 * CharacterCard — Tarjeta compacta de personaje con panel de detalle expandible.
 *
 * Creado como componente hijo para desacoplar la presentación de cada personaje
 * del page.tsx monolítico. Vive en app/profile/components/ junto a los demás
 * componentes del perfil (portrait-picker, spells-registry).
 *
 * Usa Radix UI Collapsible para el expand/collapse accesible y CSS nativo
 * (grid-template-rows trick) para animar height de 0→auto sin JS.
 */

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { motion } from "framer-motion";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
  ChevronDown,
  Sword,
  Shield,
  Heart,
  Skull,
  Sparkles,
  Backpack,
  Zap,
  ExternalLink,
  Save,
  Loader2,
  Swords,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import EjercitoModal from "./ejercito-modal";
import { totalTropas, type UnidadEjercito } from "@/lib/ejercito";
import { EquipmentStrip } from "../bolsa/bolsa";
import CaidasTracker from "@/app/components/caidas-tracker";
import { MAX_CANSANCIO, EFECTOS_CANSANCIO } from "@/lib/caidas";
import SpellsRegistry from "./spells-registry";
import PortraitPicker from "./portrait-picker";
import { type SpellEntry } from "@/lib/spells";
import { playUiHoverSfx } from "@/lib/sfx";

// Carga diferida: `three` no tiene por qué entrar en el bundle del perfil sólo
// porque una tarjeta lleve un botón con brasas.
const DeleteCharacterButton = dynamic(() => import("./delete-character-button"), {
  ssr: false,
});

// ─── Types ────────────────────────────────────────────────────────────────────
// Re-use the types from the parent. They are not exported from page.tsx so we
// replicate the minimal subset needed. TODO: extract shared types to a
// dedicated file (e.g. lib/types/character.ts) if page.tsx props change.

type ClassEntry = {
  className: string;
  level: number;
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

type CapeSlot = {
  capa?: string;
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

type SpellEntryLocal = SpellEntry;

export type Character = {
  id: number;
  userId?: string;
  name: string;
  nivel20Url: string | null;
  multiclass: ClassEntry[];
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
  /** La capa: ranura propia, con sus tres engarces en `capeSockets`. */
  cape?: CapeSlot;
  weaponSockets?: WeaponSockets;
  capeSockets?: CapeSockets;
  knownSpells?: SpellEntryLocal[];
  /** Conjuros ya gastados (claves en minúsculas); el descanso largo los devuelve. */
  usedSpells?: string[];
  bag: Bag;
  /** Inventario de ejército (5 casillas); llega de GET /api/profile. */
  army?: { units: UnidadEjercito[]; maxSlots: number };
  equipmentRequiresTwoHandsByName?: Record<string, boolean>;
  puntoCansancio: number;
  /** Caídas acumuladas en expedición (0-3); se restauran con un descanso largo. */
  caidas: number;
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CharacterCardProps {
  character: Character;
  index: number;
  /** Current auth user (for PortraitPicker) */
  user: { id: string } | null;
  /** Auth token for SpellsRegistry and nivel20 link */
  token: string;
  /** Callbacks passed down from page.tsx */
  onOpenBag: (character: Character) => void;
  onDeleteCharacter: (character: Character) => void;
  onPortraitUpdated: (characterId: number, portrait: string) => void;
  onNivel20Updated: (characterId: number, url: string | null) => void;
  isDeleting: boolean;
  onAlert: (title: string, message: string, variant: "info" | "success" | "warning" | "error") => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CharacterCard({
  character,
  index,
  user,
  token,
  onOpenBag,
  onDeleteCharacter,
  onPortraitUpdated,
  onNivel20Updated,
  isDeleting,
  onAlert,
}: CharacterCardProps) {
  const [open, setOpen] = useState(false);
  const [nivel20Input, setNivel20Input] = useState(character.nivel20Url ?? "");
  const [savingNivel20, setSavingNivel20] = useState(false);
  const [hasNewBagItems, setHasNewBagItems] = useState(false);
  const [armyOpen, setArmyOpen] = useState(false);

  const armyUnits = character.army?.units ?? [];
  const armyTroops = totalTropas(armyUnits);

  useEffect(() => {
    if (!character?.id) return;
    const currentCount = character.bag?.items?.length || 0;
    const stored = localStorage.getItem(`mc_bag_last_count_${character.id}`);
    if (stored === null) {
      localStorage.setItem(`mc_bag_last_count_${character.id}`, currentCount.toString());
      setHasNewBagItems(false);
    } else {
      const lastCount = parseInt(stored, 10) || 0;
      if (currentCount > lastCount) {
        setHasNewBagItems(true);
      } else if (currentCount < lastCount) {
        localStorage.setItem(`mc_bag_last_count_${character.id}`, currentCount.toString());
        setHasNewBagItems(false);
      } else {
        setHasNewBagItems(false);
      }
    }
  }, [character?.id, character.bag?.items?.length]);

  const handleOpenBagClick = () => {
    if (character?.id) {
      const currentCount = character.bag?.items?.length || 0;
      localStorage.setItem(`mc_bag_last_count_${character.id}`, currentCount.toString());
      setHasNewBagItems(false);
    }
    onOpenBag(character);
  };

  const saveNivel20 = async () => {
    if (!token) return;
    setSavingNivel20(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          characterId: character.id,
          nivel20Url: nivel20Input.trim() || null,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        nivel20Url?: string | null;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo guardar el enlace");
      }

      const persistedValue = data.nivel20Url ?? (nivel20Input.trim() || null);
      setNivel20Input(persistedValue ?? "");
      onNivel20Updated(character.id, persistedValue);
      onAlert(
        "Ficha actualizada",
        persistedValue
          ? "Enlace de Nivel20 guardado correctamente."
          : "Enlace de Nivel20 eliminado.",
        "success",
      );
    } catch (error) {
      onAlert(
        "No se pudo guardar",
        error instanceof Error ? error.message : "Error desconocido",
        "error",
      );
    } finally {
      setSavingNivel20(false);
    }
  };

  const totalLevel = character.multiclass.reduce((acc, c) => acc + c.level, 0);
  const primaryClass = character.multiclass[0]?.className ?? "Sin clase";
  const isAlive = character.lifeStatus === "vivo";
  const spellCount = character.knownSpells?.length ?? 0;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <motion.article
        layout
        onHoverStart={playUiHoverSfx}
        transition={{ layout: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } }}
        exit={{
          opacity: 0,
          scale: 0.88,
          filter: "blur(6px)",
          transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] },
        }}
        className={`character-card-enter rounded-xl border-2 border-[#8B7355]/60 bg-card/80 backdrop-blur-sm overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-[#D4AF37]/40 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] ${open ? "md:col-span-2" : "hover:scale-[1.02]"}`}
        style={{ "--card-index": index } as React.CSSProperties}
      >
        {/* ─── Compact Summary (always visible) ─── */}
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="w-full text-left p-4 flex items-center gap-4 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/50 focus-visible:ring-inset rounded-xl"
          >
            {/* Avatar */}
            <div className="relative w-16 h-16 shrink-0 rounded-lg border-2 border-[#8B7355]/40 overflow-hidden bg-secondary/40">
              <Image
                src={character.portrait || "/characters/profileplaceholder.webp"}
                alt={`${character.name} portrait`}
                fill
                sizes="64px"
                className="object-cover"
              />
              {/* Status indicator dot */}
              <div
                className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                  isAlive ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-serif text-[#D4AF37] tracking-wide break-words leading-tight line-clamp-2">
                {character.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground tracking-[0.15em] uppercase">
                  {character.race}
                </span>
                <span className="text-[10px] text-[#8B7355]">·</span>
                <span className="text-xs text-muted-foreground">
                  {primaryClass}
                </span>
                {character.multiclass.length > 1 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    +{character.multiclass.length - 1}
                  </span>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Level badge */}
              <div className="flex flex-col items-center px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border/40">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  Nv
                </span>
                <span className="text-lg font-bold text-[#D4AF37] font-serif leading-none">
                  {totalLevel}
                </span>
              </div>

              {/* Status badge */}
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                  isAlive
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-300 border border-red-500/20"
                }`}
              >
                {isAlive ? (
                  <Heart className="w-3 h-3" />
                ) : (
                  <Skull className="w-3 h-3" />
                )}
                <span className="hidden sm:inline">
                  {isAlive ? "Vivo" : "Muerto"}
                </span>
              </div>

              {/* Expand chevron */}
              <ChevronDown
                className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>
        </Collapsible.Trigger>

        {/* Quick stats bar (always visible, below trigger) */}
        <div className="px-4 pb-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Sword className="w-3 h-3 text-[#8B7355]" />
            {character.weapons.manoIzquierda || character.weapons.manoDerecha
              ? (character.weapons.manoIzquierda ?? character.weapons.manoDerecha)
              : "Sin arma"}
          </span>
          <span className="text-[#8B7355]">·</span>
          <span className="inline-flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#8B7355]" />
            {character.armor.armadura || character.armor.pecho || "Sin armadura"}
          </span>
          {spellCount > 0 && (
            <>
              <span className="text-[#8B7355]">·</span>
              <span className="inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#8B7355]" />
                {spellCount} conjuro{spellCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
          <span className="text-[#8B7355]">·</span>
          <span
            className={`inline-flex items-center gap-1 ${
              character.puntoCansancio >= MAX_CANSANCIO - 2 ? "text-red-400" : ""
            }`}
            title={EFECTOS_CANSANCIO[Math.min(MAX_CANSANCIO, Math.max(0, character.puntoCansancio))]}
          >
            <Zap className={`w-3 h-3 ${character.puntoCansancio >= MAX_CANSANCIO - 2 ? "text-red-500" : "text-[#8B7355]"}`} />
            Cansancio: {character.puntoCansancio}/{MAX_CANSANCIO}
          </span>
          {armyUnits.length > 0 && (
            <>
              <span className="text-[#8B7355]">·</span>
              <span className="inline-flex items-center gap-1" title="Soldados bajo su mando">
                <Swords className="w-3 h-3 text-[#8B7355]" />
                {armyTroops.toLocaleString("es-ES")} soldados
              </span>
            </>
          )}
          {character.caidas > 0 && (
            <>
              <span className="text-[#8B7355]">·</span>
              <CaidasTracker caidas={character.caidas} size="sm" showLabel animated={false} />
            </>
          )}
        </div>

        {/* ─── Expandable Detail Panel ─── */}
        <Collapsible.Content className="collapsible-content">
          <div className="border-t border-[#8B7355]/30 px-4 py-5 space-y-6">
              {/* Character info header */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Portrait + picker */}
                <div className="space-y-3 sm:w-72 shrink-0">
                  <div className="relative aspect-square w-full max-w-64 mx-auto rounded border-2 border-[#8B7355] overflow-hidden bg-secondary/40">
                    <Image
                      src={character.portrait || "/characters/profileplaceholder.webp"}
                      alt={`${character.name} portrait`}
                      fill
                      sizes="(max-width: 640px) 100vw, 256px"
                      className="object-cover"
                    />
                  </div>
                  {user && (
                    <PortraitPicker
                      userId={user.id}
                      characterId={character.id}
                      currentPortrait={character.portrait}
                      onPortraitUpdated={onPortraitUpdated}
                      onAlert={onAlert}
                    />
                  )}

                  {/* Alignment */}
                  <div className="px-3 py-2 rounded bg-[#8B7355] text-background text-center text-sm">
                    {character.alignment}
                  </div>

                  {/* Status details */}
                  {character.lifeStatus === "muerto" && character.deadAt && (
                    <p className="text-xs text-red-200/80 text-center">
                      Murió: {new Date(character.deadAt).toLocaleString("es-ES")}
                    </p>
                  )}

                  {character.hasDismemberedLimb && (
                    <div className="text-xs font-semibold uppercase tracking-wider text-orange-300 text-center">
                      <p>Miembros desmembrados:</p>
                      <p className="mt-1 text-[11px] font-medium text-orange-200/90">
                        {character.dismemberedLimbs.length > 0
                          ? character.dismemberedLimbs.join(", ")
                          : "No especificado"}
                      </p>
                    </div>
                  )}

                  {/* Multiclass detail */}
                  <div className="space-y-1">
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

                  {/* Delete button */}
                  <div className="flex justify-center pt-2 pb-4">
                    <DeleteCharacterButton
                      onDelete={() => onDeleteCharacter(character)}
                      disabled={isDeleting}
                    />
                  </div>

                  {/* Nivel20 Link per character */}
                  <div className="mt-3 pt-3 border-t border-[#8B7355]/20 space-y-2">
                    <label className="block text-[10px] tracking-[0.2em] uppercase text-[#B8860B] font-semibold">
                      Ficha Nivel20
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={nivel20Input}
                        onChange={(e) => setNivel20Input(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveNivel20();
                          }
                        }}
                        placeholder="https://nivel20.com/games/dnd-5/..."
                        className="flex-1 px-2.5 py-1.5 text-xs rounded border border-border/60 bg-secondary/30 text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] placeholder:text-muted-foreground/40"
                      />
                      <button
                        type="button"
                        onClick={saveNivel20}
                        disabled={savingNivel20}
                        className="px-3 py-1.5 rounded bg-[#D4AF37] text-background text-xs font-semibold shadow hover:bg-[#B8860B] transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        {savingNivel20 ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    {character.nivel20Url && (
                      <a
                        href={character.nivel20Url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] text-[#D4AF37] hover:text-[#B8860B] underline underline-offset-2 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Abrir ficha en Nivel20
                      </a>
                    )}
                  </div>
                </div>

                {/* Stats + Equipment + Spells */}
                <div className="flex-1 space-y-6 min-w-0">
                  {/* Stats grid */}
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

                  {/* Resumen de equipo. El muñeco con las ranuras grandes vive
                      dentro de la bolsa, que es donde se edita; aquí solo se
                      consulta, y una fila de casillas basta para eso. */}
                  <EquipmentStrip
                    character={character}
                    onOpenBag={
                      character.lifeStatus === "muerto" ? undefined : handleOpenBagClick
                    }
                  />

                  {/* Open Bag / Ejército buttons */}
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      className="relative px-4 py-2 rounded border border-[#8B7355] bg-[#1a1610] text-[#e8d8b0] font-semibold shadow transition hover:border-[#D4AF37] hover:bg-[#241d13] hover:text-[#D4AF37] inline-flex items-center gap-2"
                      onClick={() => setArmyOpen(true)}
                      title="Regimientos que comanda este personaje"
                    >
                      <Swords className="w-4 h-4" />
                      Ejército
                      <span className="rounded-full border border-[#8B7355]/60 bg-black/40 px-1.5 py-0.5 text-[10px] leading-none tabular-nums text-[#D4AF37]">
                        {armyUnits.length > 0 ? armyTroops.toLocaleString("es-ES") : "0"}
                      </span>
                    </button>
                    <button
                      className="relative px-4 py-2 rounded bg-[#D4AF37] text-background font-semibold shadow hover:bg-[#B8860B] transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      onClick={handleOpenBagClick}
                      disabled={character.lifeStatus === "muerto"}
                    >
                      {hasNewBagItems && character.lifeStatus !== "muerto" && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 z-10" title="¡Nuevos objetos en la bolsa!">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600 border-2 border-[#1a1814]"></span>
                        </span>
                      )}
                      <Backpack className="w-4 h-4" />
                      {character.lifeStatus === "muerto"
                        ? "Personaje muerto"
                        : "Abrir Bolsa"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Spells Registry (Full Width) */}
              <SpellsRegistry character={character} token={token} />
            </div>
        </Collapsible.Content>

        <AnimatePresence>
          {armyOpen && (
            <EjercitoModal
              key="ejercito-modal"
              nombrePersonaje={character.name}
              unidades={armyUnits}
              onClose={() => setArmyOpen(false)}
            />
          )}
        </AnimatePresence>
      </motion.article>
    </Collapsible.Root>
  );
}
