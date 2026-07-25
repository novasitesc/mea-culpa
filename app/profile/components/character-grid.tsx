"use client";

// Rejilla de personajes del perfil: una tarjeta por personaje, más los huecos
// vacíos y bloqueados (los huecos extra se compran con PayPal).

/**
 * CharacterGrid — Grid de tarjetas de personaje con skeleton loading y
 * staggered entry animations.
 *
 * Este componente envuelve las CharacterCard en un grid responsive:
 * - 1 columna en móvil (<768px)
 * - 2 columnas en desktop (≥768px)
 *
 * Incluye un skeleton loading state para mientras se cargan los personajes
 * desde Supabase (cuando profile es null).
 */

import { AnimatePresence } from "framer-motion";
import CharacterCard, { type Character } from "./character-card";

// ─── Skeleton Component ───────────────────────────────────────────────────────

function CharacterCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="rounded-xl border-2 border-[#8B7355]/30 bg-card/60 overflow-hidden animate-pulse"
      style={{
        /**
         * Staggered skeleton shimmer: cada skeleton tiene un delay incremental
         * para que el efecto de pulse se vea escalonado, no sincronizado.
         */
        animationDelay: `${index * 150}ms`,
      }}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Avatar skeleton */}
        <div className="w-16 h-16 rounded-lg bg-secondary/60 shrink-0" />

        {/* Info skeleton */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-5 w-36 rounded bg-secondary/50" />
          <div className="h-3 w-24 rounded bg-secondary/40" />
        </div>

        {/* Badge skeletons */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-12 h-12 rounded-lg bg-secondary/50" />
          <div className="w-16 h-7 rounded-full bg-secondary/40" />
        </div>
      </div>

      {/* Quick stats skeleton */}
      <div className="px-4 pb-3 flex items-center gap-3">
        <div className="h-3 w-20 rounded bg-secondary/30" />
        <div className="h-3 w-24 rounded bg-secondary/30" />
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CharacterGridProps {
  /** null = still loading from Supabase, [] = loaded but empty */
  characters: Character[] | null;
  user: { id: string } | null;
  token: string;
  onOpenBag: (character: Character) => void;
  onDeleteCharacter: (character: Character) => void;
  onPortraitUpdated: (characterId: number, portrait: string) => void;
  onNivel20Updated: (characterId: number, url: string | null) => void;
  isDeleting: boolean;
  onAlert: (
    title: string,
    message: string,
    variant: "info" | "success" | "warning" | "error",
  ) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CharacterGrid({
  characters,
  user,
  token,
  onOpenBag,
  onDeleteCharacter,
  onPortraitUpdated,
  onNivel20Updated,
  isDeleting,
  onAlert,
}: CharacterGridProps) {
  // Loading state: show skeletons
  if (characters === null) {
    return (
      <section className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {Array.from({ length: 4 }).map((_, i) => (
            <CharacterCardSkeleton key={`skel-${i}`} index={i} />
          ))}
        </div>
      </section>
    );
  }

  // Empty state
  if (characters.length === 0) {
    return (
      <section className="rounded-xl border-2 border-dashed border-[#8B7355]/40 bg-card/40 p-12 text-center">
        <p className="text-muted-foreground text-sm">
          No tienes personajes aún. ¡Crea tu primer personaje!
        </p>
      </section>
    );
  }

  return (
    <section>
      {/**
       * Grid responsive:
       * - 1 columna en móvil (default)
       * - 2 columnas en md+ (≥768px)
       *
       * Cada CharacterCard se expande a full-width dentro de su columna.
       * El panel de detalle se despliega debajo de la tarjeta en ambos layouts.
       */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <AnimatePresence mode="popLayout">
          {characters.map((character, index) => (
            <CharacterCard
              key={character.id}
              character={character}
              index={index}
              user={user}
              token={token}
              onOpenBag={onOpenBag}
              onDeleteCharacter={onDeleteCharacter}
              onPortraitUpdated={onPortraitUpdated}
              onNivel20Updated={onNivel20Updated}
              isDeleting={isDeleting}
              onAlert={onAlert}
            />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
