"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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

type CatalogSpell = {
  nombre: string;
  nivel: number;
  escuela: string;
  categoria: string;
  alcance: string;
  duracion: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [catalog, setCatalog] = useState<CatalogSpell[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pendingSpell, setPendingSpell] = useState<CatalogSpell | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const multiclass: ClassEntry[] = character.multiclass || [];

  const casterClasses = multiclass.filter(
    (c) => getCasterType(c.className) !== "none",
  );

  // Calcular topes
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

  // Cerrar dropdown al clicar fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtrar conjuros del catálogo
  const filteredSpells = useMemo(() => {
    const alreadyKnownKeys = new Set(
      knownSpells.map((s) => s.name.toLowerCase().trim()),
    );

    return catalog.filter((spell) => {
      // Excluir los ya conocidos
      if (alreadyKnownKeys.has(spell.nombre.toLowerCase().trim())) return false;
      // Filtrar por búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          spell.nombre.toLowerCase().includes(q) ||
          spell.escuela.toLowerCase().includes(q) ||
          spell.categoria.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [catalog, knownSpells, searchQuery]);

  // Cerrar modal con animación de salida
  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setPendingSpell(null);
      setIsClosing(false);
    }, 200);
  };

  // Agregar conjuro desde el catálogo (abre modal)
  const handleSelectSpell = (spell: CatalogSpell) => {
    if (isCapped) {
      setErrorMsg(
        `Has alcanzado el límite de ${totalMaxKnown} conjuros conocidos.`,
      );
      return;
    }

    setErrorMsg("");
    setShowDropdown(false);
    setIsClosing(false);
    setPendingSpell(spell);
  };

  // Confirmar y guardar el conjuro en Supabase
  const confirmAddSpell = async () => {
    if (!pendingSpell) return;
    const spell = pendingSpell;
    
    // Iniciar animación de salida y guardar
    setIsClosing(true);
    setTimeout(async () => {
      setPendingSpell(null);
      setIsClosing(false);
      setSearchQuery("");

      const newSpell: SpellEntry = {
        name: spell.nombre,
        spellLevel: spell.nivel,
      };
      const newSpellList = [...knownSpells, newSpell];

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
                .map((spell, idx) => {
                  const catalogInfo = catalogByName.get(spell.name.toLowerCase().trim());
                  const colorClass = catalogInfo
                    ? (schoolColors[catalogInfo.escuela] ?? "text-blue-300")
                    : "text-blue-300";

                  return (
                    <li
                      key={idx}
                      className="px-3 py-1.5 text-sm bg-secondary/50 rounded flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className={colorClass}>✧</span> {spell.name}
                        {catalogInfo && (
                          <span className="text-[10px] text-muted-foreground/70">
                            {catalogInfo.escuela}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground bg-black/20 px-2 py-0.5 rounded">
                        Nivel {spell.spellLevel}
                      </span>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No hay conjuros registrados aún.
            </p>
          )}

          {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}

          {!isCapped ? (
            <div className="relative" ref={dropdownRef}>
              <div className="relative flex items-center mt-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  disabled={isSaving || isLoadingCatalog}
                  placeholder={
                    isLoadingCatalog
                      ? "Cargando catálogo..."
                      : "Buscar conjuro por nombre, escuela o categoría..."
                  }
                  className="flex-1 px-3 py-1.5 pr-10 rounded border border-[#8B7355]/50 bg-background text-sm focus:ring-1 focus:ring-[#D4AF37] focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  disabled={isSaving || isLoadingCatalog}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition focus:outline-none"
                  title="Mostrar todos los conjuros"
                >
                  <svg
                    className={`w-4 h-4 transform transition-transform duration-200 ${
                      showDropdown ? "rotate-180 text-[#D4AF37]" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>

              {/* Dropdown de resultados */}
              {showDropdown && !isLoadingCatalog && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#8B7355]/60 bg-[#1a1510] shadow-xl">
                  {filteredSpells.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground italic text-center">
                      {searchQuery.trim()
                        ? "No se encontraron conjuros con esa búsqueda."
                        : "No hay más conjuros disponibles."}
                    </p>
                  ) : (
                    filteredSpells.map((spell) => {
                      const colorClass =
                        schoolColors[spell.escuela] ?? "text-blue-300";
                      return (
                        <button
                          key={spell.nombre}
                          type="button"
                          onClick={() => handleSelectSpell(spell)}
                          disabled={isSaving}
                          className="w-full text-left px-3 py-2 hover:bg-[#D4AF37]/10 transition border-b border-[#8B7355]/20 last:border-b-0 disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`${colorClass} shrink-0`}>✧</span>
                              <span className="text-sm text-foreground truncate">
                                {spell.nombre}
                              </span>
                              <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                {spell.escuela}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground bg-black/20 px-2 py-0.5 rounded shrink-0">
                              Nv. {spell.nivel}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-amber-200 mt-2">
              🔒 Has alcanzado el límite de conjuros para tu nivel. Podrás
              aprender más al subir de nivel.
            </p>
          )}
        </div>
      )}
        {/* Modal de Confirmación Premium */}
      {pendingSpell && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 ${
          isClosing ? "custom-animate-fade-out" : "custom-animate-fade-in"
        }`}>
          <div className={`w-full max-w-sm bg-[#18130f] border-2 border-[#8B7355] rounded-xl p-6 shadow-2xl text-center relative overflow-hidden ${
            isClosing ? "custom-animate-scale-down" : "custom-animate-scale-up"
          }`}>
            {/* Detalle decorativo superior tipo fantasía */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
            
            <div className="mx-auto w-12 h-12 rounded-full border-2 border-[#D4AF37]/50 flex items-center justify-center mb-3 bg-[#241c16]">
              <span className="text-[#D4AF37] text-lg font-serif">✧</span>
            </div>
            
            <h4 className="text-lg font-serif text-[#D4AF37] mb-2 tracking-wide">
              ¿Aprender conjuro?
            </h4>
            
            <p className="text-sm text-foreground mb-4">
              ¿Estás seguro de que deseas aprender <span className="font-bold text-amber-100 font-serif">"{pendingSpell.nombre}"</span>?
            </p>
            
            <div className="flex gap-2 justify-center text-[11px] text-muted-foreground mb-5 bg-[#0f0b08]/80 py-2.5 px-3 rounded-lg border border-[#8B7355]/30">
              <span className="border-r border-[#8B7355]/20 pr-3">
                <strong>Nivel:</strong> {pendingSpell.nivel}
              </span>
              <span className="border-r border-[#8B7355]/20 pr-3 pl-1">
                <strong>Escuela:</strong> {pendingSpell.escuela}
              </span>
              <span className="pl-1">
                <strong>Alcance:</strong> {pendingSpell.alcance}
              </span>
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
      `}</style>
    </div>
  );
}
