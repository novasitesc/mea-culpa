"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  getCasterType,
  getPreparedSpellsCount,
  getMaxSpellLevel,
  getEffectiveMaxSpellLevel,
  getMulticlassCasterLevel,
  getMaxRegistrableSpells,
  normalizeUsedSpells,
  spellKey,
  type SpellEntry,
} from "@/lib/spells";
import SpellSearchModal from "./spell-search-modal";
import * as Popover from "@radix-ui/react-popover";
import DOMPurify from "isomorphic-dompurify";
import { Info, Sparkles, Lock, Flame } from "lucide-react";

// Etiquetas de formato permitidas en las descripciones de conjuros.
// Sin atributos: elimina on*, href, src, style y demás vectores de XSS.
const SPELL_ALLOWED_TAGS = ["p", "br", "ul", "ol", "li", "em", "strong", "i", "b"];

type ClassEntry = { className: string; level: number };
type SpellCharacter = {
  id: number;
  multiclass: ClassEntry[];
  stats: Record<string, number>;
  knownSpells?: SpellEntry[];
  usedSpells?: string[];
};

type CatalogSpell = {
  nombre: string;
  nivel: number;
  escuela: string;
  categoria: string;
  alcance: string;
  duracion: string;
  description?: string | null;
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
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [catalog, setCatalog] = useState<CatalogSpell[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [pendingSpells, setPendingSpells] = useState<CatalogSpell[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  // Conjuros gastados: SOLO lectura aquí. Se lanzan durante la expedición
  // (sala de partida) y el descanso largo los devuelve (D&D 5e 2014, PHB p.186).
  // La ficha únicamente refleja el estado para consultarlo antes de salir.
  const usedSpells = useMemo(
    () => normalizeUsedSpells(character.usedSpells),
    [character.usedSpells],
  );
  const usedSet = useMemo(() => new Set(usedSpells), [usedSpells]);

  const multiclass: ClassEntry[] = character.multiclass || [];

  const casterClasses = multiclass.filter(
    (c) => getCasterType(c.className) !== "none",
  );

  // ── Bug #4 fix: niveles explícitos ──
  // Nivel total del personaje = suma de niveles de todas las clases
  const characterLevel = multiclass.reduce((sum, c) => sum + c.level, 0);
  // Nivel de caster combinado para multiclase (PHB p.165)
  const multiclassCasterLevel = getMulticlassCasterLevel(casterClasses);

  // ── Bug #1 fix: nivel máximo de conjuro con tabla multiclase ──
  // Usa el caster level combinado en vez de max() de niveles individuales
  const maxSpellLevelOverall = getEffectiveMaxSpellLevel(casterClasses);

  // ── Bug #2 fix: tope de registrables para TODAS las clases caster ──
  // Incluye tanto "known" casters como "prepared" casters (Mago, Clérigo, etc.)
  let totalMaxRegistrable = 0;
  let isUnlimited = false; // Clérigo/Druida/Paladín conocen toda su lista

  casterClasses.forEach((c) => {
    const max = getMaxRegistrableSpells(c.className, c.level);
    if (max === -1) {
      isUnlimited = true; // Al menos una clase tiene acceso ilimitado
    } else {
      totalMaxRegistrable += max;
    }
  });

  const isCapped = !isUnlimited && totalMaxRegistrable > 0 && knownSpells.length >= totalMaxRegistrable;

  // Cargar catálogo de conjuros desde Supabase
  useEffect(() => {
    if (casterClasses.length === 0) return;

    const classNames = casterClasses.map((c) => c.className);

    const fetchCatalog = async () => {
      setIsLoadingCatalog(true);
      try {
        const params = new URLSearchParams();
        params.set("clases", classNames.join(","));
        if (maxSpellLevelOverall > 0) {
          params.set("maxLevel", String(maxSpellLevelOverall));
        }

        const res = await fetch(`/api/spells?${params.toString()}`);
        const data = await res.json();
        if (res.ok && data.spells) {
          setCatalog(data.spells);
        }
      } catch {
        // Silenciar — el catálogo no se cargó
      } finally {
        setIsLoadingCatalog(false);
      }
    };

    fetchCatalog();
  }, [casterClasses.map((c) => `${c.className}:${c.level}`).join(","), maxSpellLevelOverall]);

  // Cerrar modal con animación de salida
  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setPendingSpells([]);
      setIsClosing(false);
    }, 200);
  };

  // Agregar conjuros desde el catálogo (abre modal)
  const handleSelectSpells = (spells: CatalogSpell[]) => {
    if (isCapped && spells.length > 0) {
      setErrorMsg(
        `Has alcanzado el límite de ${totalMaxRegistrable} conjuros registrables.`,
      );
      return;
    }

    setErrorMsg("");
    setIsClosing(false);
    setPendingSpells(spells);
  };

  // Confirmar y guardar el conjuro en Supabase
  const confirmAddSpell = async () => {
    if (pendingSpells.length === 0) return;
    const spells = pendingSpells;
    
    // Iniciar animación de salida y guardar
    setIsClosing(true);
    setTimeout(async () => {
      setPendingSpells([]);
      setIsClosing(false);

      const newSpells: SpellEntry[] = spells.map(spell => ({
        name: spell.nombre,
        spellLevel: spell.nivel,
      }));
      const newSpellList = [...knownSpells, ...newSpells];

      setKnownSpells(newSpellList);

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
        setErrorMsg(err.message || "Error al guardar el conjuro. Inténtalo de nuevo.");
        // Revertir
        setKnownSpells(knownSpells);
      } finally {
        setIsSaving(false);
      }
    }, 200);
  };

  // Mapa de colores por escuela
  const schoolColors: Record<string, string> = {
    "Abjuración": "text-blue-300",
    "Conjuración": "text-yellow-300",
    "Adivinación": "text-cyan-300",
    "Encantamiento": "text-pink-300",
    "Evocación": "text-red-300",
    "Ilusión": "text-purple-300",
    "Nigromancia": "text-gray-300",
    "Transmutación": "text-green-300",
  };

  // Mapa para encontrar datos del catálogo de un conjuro ya conocido
  const catalogByName = useMemo(() => {
    const map = new Map<string, CatalogSpell>();
    for (const s of catalog) {
      map.set(s.nombre.toLowerCase().trim(), s);
    }
    return map;
  }, [catalog]);

  if (casterClasses.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 rounded-lg border border-[#8B7355]/40 bg-[#15110d] p-4 space-y-4">
      <h3 className="text-xl font-serif text-[#D4AF37]">
        Registro de Conjuros
      </h3>

      {/* ── Info de clases caster y niveles (Bug #4: distinción explícita) ── */}
      {casterClasses.length > 1 && (
        <div className="text-xs text-muted-foreground/80 p-2 bg-[#1a1510] border border-[#8B7355]/20 rounded space-y-1">
          <p className="font-semibold text-[#D4AF37]/70">Multiclase — Niveles de caster:</p>
          {casterClasses.map((c, i) => (
            <p key={i}>
              {c.className} Nv.{c.level}
              <span className="text-muted-foreground/50 ml-1">
                ({getCasterType(c.className) === "prepared" ? "preparador" : "conocidos"}
                {c.className === "Brujo" ? ", Pact Magic" : ""})
              </span>
            </p>
          ))}
          <p className="text-[#D4AF37]/50 pt-1 border-t border-[#8B7355]/10">
            Nivel de personaje: {characterLevel} · Caster level combinado: {multiclassCasterLevel}
            {casterClasses.some(c => c.className === "Brujo") ? " (+ Brujo aparte)" : ""}
            {" · "}Conjuros hasta nivel {maxSpellLevelOverall}
          </p>
        </div>
      )}

      {/* Lanzadores Preparados — info de preparación */}
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
              <strong>{c.className} (Preparador, Nv.{c.level}):</strong> Puede preparar un
              máximo de{" "}
              <span className="font-bold text-emerald-400">
                {preparedCount}
              </span>{" "}
              conjuros por descanso largo según su nivel y
              modificador.
            </div>
          );
        })}

      {/* ── Registro de Conjuros (ahora disponible para TODOS los casters) ── */}
      <div className="space-y-3">
        {usedSpells.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-200/90 p-2 bg-amber-900/10 border border-amber-800/30 rounded">
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span>
              {usedSpells.length} conjuro{usedSpells.length === 1 ? "" : "s"} gastado
              {usedSpells.length === 1 ? "" : "s"} en expedición. Un descanso largo los devuelve.
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Conjuros Registrados:
          </span>
          {!isUnlimited && totalMaxRegistrable > 0 ? (
            <span
              className={`text-sm font-semibold ${
                isCapped ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {knownSpells.length} / {totalMaxRegistrable}
            </span>
          ) : (
            <span className="text-sm font-semibold text-emerald-400">
              {knownSpells.length}
              {isUnlimited && (
                <span className="text-muted-foreground/60 text-xs ml-1">(sin límite)</span>
              )}
            </span>
          )}
        </div>

        {knownSpells.length > 0 ? (
          <div className="space-y-4">
            {Array.from(new Set(knownSpells.map((s) => s.spellLevel)))
              .sort((a, b) => a - b)
              .map((level) => {
                const spellsInLevel = knownSpells
                  .filter((s) => s.spellLevel === level)
                  .sort((a, b) => a.name.localeCompare(b.name));

                return (
                  <div key={level} className="space-y-2">
                    <div className="flex items-center gap-2 border-b border-[#8B7355]/20 pb-1">
                      <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider font-serif">
                        {level === 0 ? "Trucos" : `Nivel ${level}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-black/30 px-1.5 py-0.5 rounded font-mono">
                        {spellsInLevel.length}
                      </span>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {spellsInLevel.map((spell, idx) => {
                        const catalogInfo = catalogByName.get(spell.name.toLowerCase().trim());
                        const colorClass = catalogInfo
                          ? (schoolColors[catalogInfo.escuela] ?? "text-blue-300")
                          : "text-blue-300";
                        const isUsed = level > 0 && usedSet.has(spellKey(spell.name));

                        return (
                          <li
                            key={idx}
                            className={`relative overflow-hidden px-3 py-2 text-sm border rounded-md flex items-center justify-between gap-2 transition-colors group ${
                              isUsed
                                ? "bg-[#130f0c] border-[#8B7355]/10 opacity-55"
                                : "bg-[#1a1510] border-[#8B7355]/20 hover:border-[#D4AF37]/40"
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isUsed ? "text-muted-foreground/50" : colorClass}`} />
                              <span className={`truncate font-medium ${isUsed ? "line-through text-muted-foreground" : ""}`}>
                                {spell.name}
                              </span>
                              {catalogInfo && (
                                <span className="text-[10px] text-muted-foreground/70">
                                  {catalogInfo.escuela}
                                </span>
                              )}
                              {catalogInfo?.description && (
                                <Popover.Root modal={false}>
                                  <Popover.Trigger asChild>
                                    <button
                                      type="button"
                                      className="p-1 -ml-1 rounded-full text-muted-foreground hover:text-[#D4AF37] hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                                      title="Ver descripción"
                                    >
                                      <Info className="w-3.5 h-3.5" />
                                    </button>
                                  </Popover.Trigger>
                                  <Popover.Portal>
                                    <Popover.Content
                                      side="top"
                                      sideOffset={5}
                                      onWheel={(e) => e.stopPropagation()}
                                      onTouchMove={(e) => e.stopPropagation()}
                                      className="z-[60] w-[320px] sm:w-[350px] max-w-[90vw] max-h-[280px] overflow-y-auto overscroll-contain p-3.5 rounded-lg border border-[#8B7355]/40 bg-[#120e0b]/95 backdrop-blur-md shadow-2xl custom-scrollbar data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 pointer-events-auto"
                                    >
                                      <div className="flex flex-col gap-2">
                                        <div className="border-b border-[#8B7355]/20 pb-1.5">
                                          <span className="text-sm font-bold text-[#D4AF37] font-serif">{spell.name}</span>
                                        </div>
                                        <div 
                                          className="text-xs text-muted-foreground prose prose-invert prose-p:my-1 prose-strong:text-amber-100/90 leading-relaxed select-text"
                                          dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(catalogInfo.description ?? "", {
                                              ALLOWED_TAGS: SPELL_ALLOWED_TAGS,
                                              ALLOWED_ATTR: [],
                                            }),
                                          }}
                                        />
                                      </div>
                                      <Popover.Arrow className="fill-[#8B7355]/40" />
                                    </Popover.Content>
                                  </Popover.Portal>
                                </Popover.Root>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isUsed && (
                                <span
                                  title="Gastado en expedición; vuelve con un descanso largo"
                                  className="text-amber-400/70"
                                >
                                  <Flame className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground bg-black/20 px-2 py-0.5 rounded">
                                {level === 0 ? "Truco" : `Nivel ${level}`}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No hay conjuros registrados aún.
          </p>
        )}

        {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}

        {!isCapped ? (
          <SpellSearchModal
            catalog={catalog}
            isLoading={isLoadingCatalog}
            onSelectSpells={handleSelectSpells}
            disabled={isSaving}
            alreadyKnownKeys={new Set(knownSpells.map(s => s.name.toLowerCase().trim()))}
            maxSelectable={isUnlimited ? Infinity : Math.max(0, totalMaxRegistrable - knownSpells.length)}
          />
        ) : (
          <p className="text-xs text-amber-200 mt-2">
            <Lock className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" /> Has alcanzado el límite de conjuros para tu nivel. Podrás
            aprender más al subir de nivel.
          </p>
        )}
      </div>
        {/* Modal de Confirmación Premium */}
      {pendingSpells.length > 0 && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 ${
          isClosing ? "custom-animate-fade-out" : "custom-animate-fade-in"
        }`}>
          <div className={`w-full max-w-sm bg-[#18130f] border-2 border-[#8B7355] rounded-xl p-6 shadow-2xl text-center relative overflow-hidden ${
            isClosing ? "custom-animate-scale-down" : "custom-animate-scale-up"
          }`}>
            {/* Detalle decorativo superior tipo fantasía */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
            
            <div className="mx-auto w-12 h-12 rounded-full border-2 border-[#D4AF37]/50 flex items-center justify-center mb-3 bg-[#241c16]">
              <Sparkles className="text-[#D4AF37] w-5 h-5" />
            </div>
            
            <h4 className="text-lg font-serif text-[#D4AF37] mb-2 tracking-wide">
              ¿Aprender conjuro{pendingSpells.length !== 1 ? 's' : ''}?
            </h4>
            
            <p className="text-sm text-foreground mb-4">
              ¿Estás seguro de que deseas aprender <span className="font-bold text-amber-100 font-serif">{pendingSpells.length} conjuro{pendingSpells.length !== 1 ? 's' : ''}</span>?
            </p>
            
            <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto mb-5 text-[11px] text-muted-foreground bg-[#0f0b08]/80 py-2.5 px-3 rounded-lg border border-[#8B7355]/30 custom-scrollbar">
              {pendingSpells.map((s, i) => (
                <div key={i} className="flex items-center gap-2 justify-center pb-1.5 border-b border-[#8B7355]/10 last:border-0 last:pb-0">
                  <span className="border-r border-[#8B7355]/20 pr-2 truncate max-w-[120px] text-[#D4AF37] font-semibold">{s.nombre}</span>
                  <span className="border-r border-[#8B7355]/20 pr-2">{s.nivel === 0 ? "Truco" : `Nv. ${s.nivel}`}</span>
                  <span className="truncate">{s.escuela}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-xs font-semibold rounded border border-[#8B7355]/40 hover:bg-[#8B7355]/10 text-muted-foreground hover:text-foreground transition duration-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmAddSpell}
                className="px-5 py-2 text-xs font-semibold rounded bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black shadow-lg font-serif transition duration-200"
              >
                Aprender
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos para animación premium en página */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(4px); }
        }
        @keyframes fadeOut {
          from { opacity: 1; backdrop-filter: blur(4px); }
          to { opacity: 0; backdrop-filter: blur(0px); }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes scaleDown {
          from { transform: scale(1); opacity: 1; }
          to { transform: scale(0.95); opacity: 0; }
        }
        .custom-animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .custom-animate-fade-out {
          animation: fadeOut 0.2s ease-in forwards;
        }
        .custom-animate-scale-up {
          animation: scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .custom-animate-scale-down {
          animation: scaleDown 0.2s ease-in forwards;
        }

        /* Utilidad para la scrollbar de los popovers */
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(212, 175, 55, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 175, 55, 0.5);
        }
      `}</style>
    </div>
  );
}
