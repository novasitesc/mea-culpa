"use client";

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

import { useState } from "react";
import Image from "next/image";
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
} from "lucide-react";
import { EquipmentPreview } from "../bolsa/bolsa";
import SpellsRegistry from "./spells-registry";
import PortraitPicker from "./portrait-picker";
import { type SpellEntry } from "@/lib/spells";

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
  weaponSockets?: WeaponSockets;
  capeSockets?: CapeSockets;
  knownSpells?: SpellEntryLocal[];
  bag: Bag;
  equipmentRequiresTwoHandsByName?: Record<string, boolean>;
  puntoCansancio: number;
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CharacterCardProps {
  character: Character;
  index: number;
  /** Current auth user (for PortraitPicker) */
  user: { id: string } | null;
  /** Auth token for SpellsRegistry */
  token: string;
  /** Callbacks passed down from page.tsx */
  onOpenBag: (character: Character) => void;
  onDeleteCharacter: (character: Character) => void;
  onPortraitUpdated: (characterId: number, portrait: string) => void;
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
  isDeleting,
  onAlert,
}: CharacterCardProps) {
  const [open, setOpen] = useState(false);

  const totalLevel = character.multiclass.reduce((acc, c) => acc + c.level, 0);
  const primaryClass = character.multiclass[0]?.className ?? "Sin clase";
  const isAlive = character.lifeStatus === "vivo";
  const spellCount = character.knownSpells?.length ?? 0;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <article
        className={`character-card-enter rounded-xl border-2 border-[#8B7355]/60 bg-card/80 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-[#D4AF37]/40 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] ${open ? "md:col-span-2" : "hover:scale-[1.02]"}`}
        /**
         * Staggered animation: cada tarjeta usa un --card-index para retrasar
         * su @keyframes de entrada. La clase .character-card-enter en globals.css
         * aplica el animation con delay = calc(var(--card-index) * 80ms).
         */
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
              <h2 className="text-lg font-serif text-[#D4AF37] tracking-wide truncate">
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
          <span className="inline-flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#8B7355]" />
            Cansancio: {character.puntoCansancio}
          </span>
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
                  <div className="flex justify-center pt-2">
                    <button
                      className="text-[11px] font-medium text-muted-foreground/50 hover:text-red-400/80 transition-colors uppercase tracking-widest border-b border-transparent hover:border-red-400/80 pb-0.5"
                      onClick={() => onDeleteCharacter(character)}
                      disabled={isDeleting}
                      title="Eliminar o matar a este personaje"
                    >
                      Eliminar personaje
                    </button>
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

                  {/* Equipment Preview */}
                  <EquipmentPreview character={character} />

                  {/* Open Bag button */}
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      className="px-4 py-2 rounded bg-[#D4AF37] text-background font-semibold shadow hover:bg-[#B8860B] transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      onClick={() => onOpenBag(character)}
                      disabled={character.lifeStatus === "muerto"}
                    >
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
      </article>
    </Collapsible.Root>
  );
}
