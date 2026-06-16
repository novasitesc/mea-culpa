"use client";

import { useState } from "react";
import { getCasterType, getPreparedSpellsCount, getMaxKnownSpells } from "@/lib/spells";
import { Character, ClassEntry } from "@/lib/types/character";

export default function SpellsRegistry({ character, token }: { character: Character, token: string }) {
  const [knownSpells, setKnownSpells] = useState<string[]>(character.knownSpells || []);
  const [newSpellInput, setNewSpellInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const multiclass: ClassEntry[] = character.multiclass || [];
  
  // Buscar la primera clase lanzadora (por simplicidad asumiremos que es el feature principal)
  // En un sistema real de D&D multiclass, cada clase maneja sus conjuros,
  // pero el requerimiento es mostrar formulario según la clase. Mostramos un bloque por cada clase lanzadora.
  const casterClasses = multiclass.filter(c => getCasterType(c.className) !== "none");

  if (casterClasses.length === 0) {
    return null;
  }

  // Calculamos el total de conjuros conocidos permitidos (suma de las clases de conocidos)
  let totalMaxKnown = 0;
  casterClasses.forEach(c => {
    if (getCasterType(c.className) === "known") {
      totalMaxKnown += getMaxKnownSpells(c.className, c.level);
    }
  });

  const hasKnownCaster = totalMaxKnown > 0;
  const isCapped = knownSpells.length >= totalMaxKnown;
  const initialKnownCount = character.knownSpells?.length || 0;

  const handleAddSpell = async () => {
    const spell = newSpellInput.trim();
    if (!spell) return;
    if (knownSpells.includes(spell)) {
      setErrorMsg("El conjuro ya está registrado.");
      return;
    }
    if (isCapped) {
      setErrorMsg(`Has alcanzado el límite de ${totalMaxKnown} conjuros conocidos.`);
      return;
    }
    setErrorMsg("");

    const newSpellList = [...knownSpells, spell];
    setKnownSpells(newSpellList);
    setNewSpellInput("");

    setIsSaving(true);
    try {
      const res = await fetch("/api/profile/update-spells", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ characterId: character.id, newSpells: newSpellList })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al guardar");
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
      <h3 className="text-xl font-serif text-[#D4AF37]">Registro de Conjuros</h3>
      
      {/* Lanzadores Preparados */}
      {casterClasses.filter(c => getCasterType(c.className) === "prepared").map((c, i) => {
        const preparedCount = getPreparedSpellsCount(c.className, c.level, character.stats);
        return (
          <div key={`prepared-${i}`} className="text-sm text-emerald-200/90 p-2 bg-emerald-900/10 border border-emerald-800/30 rounded">
            <strong>{c.className} (Preparador):</strong> Puede preparar un máximo de <span className="font-bold text-emerald-400">{preparedCount}</span> conjuros por descanso largo según su nivel ({c.level}) y modificador.
          </div>
        );
      })}

      {/* Lanzadores Conocidos */}
      {hasKnownCaster && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Conjuros Conocidos:</span>
            <span className={`text-sm font-semibold ${isCapped ? "text-amber-400" : "text-emerald-400"}`}>
              {knownSpells.length} / {totalMaxKnown}
            </span>
          </div>

          {knownSpells.length > 0 ? (
            <ul className="space-y-1">
              {knownSpells.map((spell, idx) => (
                <li key={idx} className="px-3 py-1.5 text-sm bg-secondary/50 rounded flex items-center gap-2">
                  <span className="text-blue-300">✧</span> {spell}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">No hay conjuros registrados aún.</p>
          )}

          {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}

          {!isCapped ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newSpellInput}
                onChange={e => setNewSpellInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleAddSpell();
                }}
                disabled={isSaving}
                placeholder="Nombre del conjuro..."
                className="flex-1 px-3 py-1.5 rounded border border-[#8B7355]/50 bg-background text-sm focus:ring-1 focus:ring-[#D4AF37] focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleAddSpell}
                disabled={!newSpellInput.trim() || isSaving}
                className="px-3 py-1.5 rounded bg-[#D4AF37] text-background font-semibold text-sm hover:bg-[#B8860B] transition disabled:opacity-50"
              >
                {isSaving ? "Guardando..." : "Agregar"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-200 mt-2">
              🔒 Has alcanzado el límite de conjuros para tu nivel. Podrás aprender más al subir de nivel.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
