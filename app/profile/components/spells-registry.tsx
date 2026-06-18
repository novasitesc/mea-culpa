"use client";

import { useState } from "react";
import {
  getCasterType,
  getPreparedSpellsCount,
  getMaxKnownSpells,
  getMaxSpellLevel,
  type SpellEntry,
} from "@/lib/spells";

type ClassEntry = { className: string; level: number };
type SpellCharacter = {
  id: number;
  multiclass: ClassEntry[];
  stats: Record<string, number>;
  knownSpells?: SpellEntry[];
};

export default function SpellsRegistry({
  character,
  token,
}: {
  character: SpellCharacter;
  token: string;
}) {
  const [knownSpells, setKnownSpells] = useState<SpellEntry[]>(
    character.knownSpells || [],
  );
  const [newSpellInput, setNewSpellInput] = useState("");
  const [newSpellLevel, setNewSpellLevel] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const multiclass: ClassEntry[] = character.multiclass || [];

  const casterClasses = multiclass.filter(
    (c) => getCasterType(c.className) !== "none",
  );

  if (casterClasses.length === 0) {
    return null;
  }

  let totalMaxKnown = 0;
  let maxSpellLevelOverall = 0;

  casterClasses.forEach((c) => {
    if (getCasterType(c.className) === "known") {
      totalMaxKnown += getMaxKnownSpells(c.className, c.level);
    }
    const maxLv = getMaxSpellLevel(c.className, c.level);
    if (maxLv > maxSpellLevelOverall) {
      maxSpellLevelOverall = maxLv;
    }
  });

  const hasKnownCaster = totalMaxKnown > 0;
  const isCapped = knownSpells.length >= totalMaxKnown;

  const handleAddSpell = async () => {
    const spellName = newSpellInput.trim();
    if (!spellName) return;

    if (
      knownSpells.some((s) => s.name.toLowerCase() === spellName.toLowerCase())
    ) {
      setErrorMsg("El conjuro ya está registrado.");
      return;
    }
    if (isCapped) {
      setErrorMsg(
        `Has alcanzado el límite de ${totalMaxKnown} conjuros conocidos.`,
      );
      return;
    }
    if (newSpellLevel < 1 || newSpellLevel > maxSpellLevelOverall) {
      setErrorMsg(`Nivel de conjuro inválido (${newSpellLevel}).`);
      return;
    }
    setErrorMsg("");

    const newSpell: SpellEntry = {
      name: spellName,
      spellLevel: newSpellLevel,
    };
    const newSpellList = [...knownSpells, newSpell];

    setKnownSpells(newSpellList);
    setNewSpellInput("");

    setIsSaving(true);
    try {
      const res = await fetch("/api/profile/update-spells", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          characterId: character.id,
          newSpells: newSpellList,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al guardar");
      }
      if (data.spells) {
        setKnownSpells(data.spells);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      // Revertir
      setKnownSpells(knownSpells);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-[#8B7355]/40 bg-[#15110d] p-4 space-y-4">
      <h3 className="text-xl font-serif text-[#D4AF37]">
        Registro de Conjuros
      </h3>

      {/* Lanzadores Preparados */}
      {casterClasses
        .filter((c) => getCasterType(c.className) === "prepared")
        .map((c, i) => {
          const preparedCount = getPreparedSpellsCount(
            c.className,
            c.level,
            character.stats,
          );
          return (
            <div
              key={`prepared-${i}`}
              className="text-sm text-emerald-200/90 p-2 bg-emerald-900/10 border border-emerald-800/30 rounded"
            >
              <strong>{c.className} (Preparador):</strong> Puede preparar un
              máximo de{" "}
              <span className="font-bold text-emerald-400">
                {preparedCount}
              </span>{" "}
              conjuros por descanso largo según su nivel ({c.level}) y
              modificador.
            </div>
          );
        })}

      {/* Lanzadores Conocidos */}
      {hasKnownCaster && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Conjuros Conocidos:
            </span>
            <span
              className={`text-sm font-semibold ${
                isCapped ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {knownSpells.length} / {totalMaxKnown}
            </span>
          </div>

          {knownSpells.length > 0 ? (
            <ul className="space-y-1">
              {knownSpells
                .sort((a, b) => a.spellLevel - b.spellLevel || a.name.localeCompare(b.name))
                .map((spell, idx) => (
                  <li
                    key={idx}
                    className="px-3 py-1.5 text-sm bg-secondary/50 rounded flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-blue-300">✧</span> {spell.name}
                    </div>
                    <span className="text-xs text-muted-foreground bg-black/20 px-2 py-0.5 rounded">
                      Nivel {spell.spellLevel}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No hay conjuros registrados aún.
            </p>
          )}

          {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}

          {!isCapped ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newSpellInput}
                onChange={(e) => setNewSpellInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSpell();
                }}
                disabled={isSaving}
                placeholder="Nombre del conjuro..."
                className="flex-1 px-3 py-1.5 rounded border border-[#8B7355]/50 bg-background text-sm focus:ring-1 focus:ring-[#D4AF37] focus:outline-none disabled:opacity-50"
              />
              <select
                value={newSpellLevel}
                onChange={(e) => setNewSpellLevel(Number(e.target.value))}
                disabled={isSaving || maxSpellLevelOverall < 1}
                className="px-2 py-1.5 rounded border border-[#8B7355]/50 bg-background text-sm focus:ring-1 focus:ring-[#D4AF37] focus:outline-none disabled:opacity-50"
                title="Nivel de conjuro"
              >
                {Array.from({ length: maxSpellLevelOverall }, (_, i) => i + 1).map(
                  (lv) => (
                    <option key={lv} value={lv}>
                      Nv. {lv}
                    </option>
                  )
                )}
              </select>
              <button
                onClick={handleAddSpell}
                disabled={!newSpellInput.trim() || isSaving}
                className="px-3 py-1.5 rounded bg-[#D4AF37] text-background font-semibold text-sm hover:bg-[#B8860B] transition disabled:opacity-50 shrink-0"
              >
                {isSaving ? "Guardando..." : "Agregar"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-200 mt-2">
              🔒 Has alcanzado el límite de conjuros para tu nivel. Podrás
              aprender más al subir de nivel.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
