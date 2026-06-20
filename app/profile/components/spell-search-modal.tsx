"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { Search, X, Filter, Sparkles, XCircle, Info } from "lucide-react";

export type CatalogSpell = {
  nombre: string;
  nivel: number;
  escuela: string;
  categoria: string;
  alcance: string;
  duracion: string;
  description?: string | null;
};

interface SpellSearchModalProps {
  catalog: CatalogSpell[];
  isLoading: boolean;
  onSelectSpells: (spells: CatalogSpell[]) => void;
  disabled?: boolean;
  alreadyKnownKeys: Set<string>;
  placeholder?: string;
  maxSelectable: number;
}

// Mapa de colores por escuela
const schoolColors: Record<string, string> = {
  "Abjuración": "text-blue-300 border-blue-300/30 bg-blue-900/20",
  "Conjuración": "text-yellow-300 border-yellow-300/30 bg-yellow-900/20",
  "Adivinación": "text-cyan-300 border-cyan-300/30 bg-cyan-900/20",
  "Encantamiento": "text-pink-300 border-pink-300/30 bg-pink-900/20",
  "Evocación": "text-red-300 border-red-300/30 bg-red-900/20",
  "Ilusión": "text-purple-300 border-purple-300/30 bg-purple-900/20",
  "Nigromancia": "text-gray-300 border-gray-300/30 bg-gray-900/20",
  "Transmutación": "text-green-300 border-green-300/30 bg-green-900/20",
};

const getSchoolColor = (escuela: string) => schoolColors[escuela] || "text-blue-300 border-blue-300/30 bg-blue-900/20";

const FilterChip = ({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) => {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-medium shadow-sm transition-all duration-200 ease-out custom-animate-chip-in">
      {label}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="hover:text-white hover:bg-[#D4AF37]/40 rounded-full transition-colors"
      >
        <X size={12} strokeWidth={3} />
      </button>
    </span>
  );
};

const SkeletonCard = () => {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#8B7355]/20 bg-[#1a1510] p-4 flex flex-col gap-3 min-h-[110px]">
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent shimmer-sweep" />
      <div className="flex justify-between items-start">
        <div className="h-5 w-3/4 bg-[#8B7355]/20 rounded-md" />
        <div className="h-5 w-10 bg-[#8B7355]/20 rounded-md" />
      </div>
      <div className="flex gap-2 mt-auto">
        <div className="h-4 w-1/3 bg-[#8B7355]/20 rounded-md" />
        <div className="h-4 w-1/4 bg-[#8B7355]/20 rounded-md" />
      </div>
    </div>
  );
};

const SpellCard = ({
  spell,
  onClick,
  index,
  isSelected,
  isShaking,
}: {
  spell: CatalogSpell;
  onClick: () => void;
  index: number;
  isSelected?: boolean;
  isShaking?: boolean;
}) => {
  const [animateIn, setAnimateIn] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimateIn(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const colorClass = getSchoolColor(spell.escuela);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`text-left group relative overflow-hidden rounded-xl border transition-all duration-300 p-4 flex flex-col gap-2 min-h-[110px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50
        ${animateIn ? "custom-animate-card-in" : ""}
        ${isSelected 
          ? "border-green-500/40 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.08)]" 
          : "border-[#8B7355]/30 bg-[#1a1510] hover:bg-[#241c16] hover:border-[#D4AF37]/50"
        }
        ${isShaking ? "animate-shake border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.35)]" : ""}
      `}
      style={animateIn ? { animationDelay: `${index * 30}ms` } : undefined}
    >
      {/* Decal top edge */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent 
        ${isShaking 
          ? 'via-red-500' 
          : isSelected 
            ? 'via-green-500/50' 
            : 'via-[#8B7355]/30 group-hover:via-[#D4AF37]/60'
        } 
        to-transparent transition-colors`} 
      />

      <div className="flex justify-between items-start gap-2">
        <h4 className={`text-sm font-bold font-serif leading-tight transition-colors line-clamp-2 
          ${isShaking 
            ? 'text-red-400' 
            : isSelected 
              ? 'text-white' 
              : 'text-foreground group-hover:text-[#D4AF37]'
          }
        `}>
          {spell.nombre}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          {spell.description && (
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded-full text-muted-foreground hover:text-[#D4AF37] hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  title="Ver descripción"
                >
                  <Info className="w-[14px] h-[14px]" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  side="top"
                  sideOffset={8}
                  onClick={(e) => e.stopPropagation()}
                  className="z-[60] w-[280px] max-w-[90vw] max-h-[250px] overflow-y-auto p-3 rounded-lg border border-[#8B7355]/40 bg-[#120e0b]/95 backdrop-blur-md shadow-2xl custom-scrollbar data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                >
                  <div className="flex flex-col gap-2">
                    <div className="border-b border-[#8B7355]/20 pb-1.5">
                      <span className="text-sm font-bold text-[#D4AF37] font-serif">{spell.nombre}</span>
                    </div>
                    <div 
                      className="text-xs text-muted-foreground prose prose-invert prose-p:my-1 prose-strong:text-amber-100/90 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: spell.description }} 
                    />
                  </div>
                  <Popover.Arrow className="fill-[#8B7355]/40" />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
          <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/40 border border-[#8B7355]/30 text-muted-foreground uppercase">
            Nv. {spell.nivel}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
        <span className={`text-[10px] px-2 py-0.5 rounded border ${colorClass} flex items-center gap-1`}>
          <span>✧</span> {spell.escuela}
        </span>
        {spell.duracion && (
          <span className="text-[10px] px-2 py-0.5 rounded border border-[#8B7355]/20 bg-black/20 text-muted-foreground/80 truncate max-w-[120px]">
            ⏱ {spell.duracion}
          </span>
        )}
      </div>
    </div>
  );
};

export default function SpellSearchModal({
  catalog,
  isLoading,
  onSelectSpells,
  disabled,
  alreadyKnownKeys,
  placeholder = "Buscar conjuro por nombre, escuela o categoría...",
  maxSelectable,
}: SpellSearchModalProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  const [selectedSpells, setSelectedSpells] = useState<Map<string, CatalogSpell>>(new Map());
  const [shakeKey, setShakeKey] = useState<string | null>(null);

  // Filters state
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set());
  const [selectedSchools, setSelectedSchools] = useState<Set<string>>(new Set());
  const [selectedDurations, setSelectedDurations] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus trap is handled by Radix Dialog
  // Auto-focus handled by Radix Dialog (focuses first focusable element by default)

  useEffect(() => {
    if (!open) {
      setSelectedSpells(new Map());
      setSearchQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Derived filter options from catalog (only from available spells)
  const availableSpells = useMemo(() => {
    return catalog.filter(
      (spell) => !alreadyKnownKeys.has(spell.nombre.toLowerCase().trim())
    );
  }, [catalog, alreadyKnownKeys]);

  const { availableLevels, availableSchools, availableDurations } = useMemo(() => {
    const levels = new Set<number>();
    const schools = new Set<string>();
    const durations = new Set<string>();

    availableSpells.forEach((s) => {
      levels.add(s.nivel);
      if (s.escuela) schools.add(s.escuela);
      if (s.duracion) durations.add(s.duracion);
    });

    return {
      availableLevels: Array.from(levels).sort((a, b) => a - b),
      availableSchools: Array.from(schools).sort(),
      availableDurations: Array.from(durations).sort(),
    };
  }, [availableSpells]);

  const filteredSpells = useMemo(() => {
    return availableSpells.filter((spell) => {
      // 1. Search filter
      if (debouncedQuery.trim()) {
        const q = debouncedQuery.toLowerCase().trim();
        const matchesName = spell.nombre.toLowerCase().includes(q);
        const matchesSchool = spell.escuela.toLowerCase().includes(q);
        const matchesCategory = spell.categoria?.toLowerCase().includes(q);
        if (!matchesName && !matchesSchool && !matchesCategory) return false;
      }

      // 2. Exact match filters
      if (selectedLevels.size > 0 && !selectedLevels.has(spell.nivel)) return false;
      if (selectedSchools.size > 0 && !selectedSchools.has(spell.escuela)) return false;
      if (selectedDurations.size > 0 && !selectedDurations.has(spell.duracion)) return false;

      return true;
    });
  }, [availableSpells, debouncedQuery, selectedLevels, selectedSchools, selectedDurations]);

  const handleToggleSpell = (spell: CatalogSpell) => {
    const key = spell.nombre;
    if (selectedSpells.has(key)) {
      const newMap = new Map(selectedSpells);
      newMap.delete(key);
      setSelectedSpells(newMap);
    } else {
      if (selectedSpells.size >= maxSelectable) {
        setShakeKey(key);
        setTimeout(() => setShakeKey(null), 500);
        return;
      }
      const newMap = new Map(selectedSpells);
      newMap.set(key, spell);
      setSelectedSpells(newMap);
    }
  };

  const toggleFilter = (set: Set<any>, setter: React.Dispatch<React.SetStateAction<Set<any>>>, value: any) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const removeFilter = (type: 'level' | 'school' | 'duration', value: any) => {
    if (type === 'level') toggleFilter(selectedLevels, setSelectedLevels, value);
    if (type === 'school') toggleFilter(selectedSchools, setSelectedSchools, value);
    if (type === 'duration') toggleFilter(selectedDurations, setSelectedDurations, value);
  };

  const activeFiltersCount = selectedLevels.size + selectedSchools.size + selectedDurations.size;

  // Render Trigger Button that replaces old input
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || isLoading}
        className="w-full relative flex items-center mt-2 px-3 py-2 rounded border border-[#8B7355]/50 bg-background text-sm text-muted-foreground hover:text-foreground hover:border-[#D4AF37]/50 transition-colors focus:ring-1 focus:ring-[#D4AF37] focus:outline-none disabled:opacity-50 text-left"
      >
        <Search className="w-4 h-4 mr-2 opacity-50" />
        {isLoading ? "Cargando catálogo..." : placeholder}
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[4px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-4xl max-h-[85vh] translate-x-[-50%] translate-y-[-50%] flex flex-col border border-[#8B7355]/40 bg-[#120e0b] shadow-2xl rounded-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 ease-out">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-[#8B7355]/20 bg-[#1a1510]">
              <Search className="w-5 h-5 text-[#D4AF37]" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Busca por nombre, escuela o categoría..."
                className="flex-1 bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground/60 text-lg"
                aria-label="Search spells"
              />
              <Dialog.Close className="p-2 rounded-full hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37] opacity-70 hover:opacity-100">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>

            {/* Filters Row */}
            <div className="px-4 py-3 border-b border-[#8B7355]/10 bg-[#15110d] flex flex-col gap-3 shrink-0">
              <div className="flex flex-wrap gap-x-6 gap-y-3 items-center text-sm">
                <div className="flex items-center gap-2 text-muted-foreground font-medium">
                  <Filter className="w-4 h-4" /> Filtros
                </div>

                {/* Niveles */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Nivel:</span>
                  <select
                    className="bg-[#1a1510] border border-[#8B7355]/30 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#D4AF37] outline-none"
                    value=""
                    onChange={(e) => toggleFilter(selectedLevels, setSelectedLevels, Number(e.target.value))}
                  >
                    <option value="" disabled>Seleccionar...</option>
                    {availableLevels.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl === 0 ? "Truco (0)" : lvl}</option>
                    ))}
                  </select>
                </div>

                {/* Escuelas */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Escuela:</span>
                  <select
                    className="bg-[#1a1510] border border-[#8B7355]/30 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#D4AF37] outline-none"
                    value=""
                    onChange={(e) => toggleFilter(selectedSchools, setSelectedSchools, e.target.value)}
                  >
                    <option value="" disabled>Seleccionar...</option>
                    {availableSchools.map(sch => (
                      <option key={sch} value={sch}>{sch}</option>
                    ))}
                  </select>
                </div>

                {/* Duración */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Duración:</span>
                  <select
                    className="bg-[#1a1510] border border-[#8B7355]/30 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#D4AF37] outline-none max-w-[150px] truncate"
                    value=""
                    onChange={(e) => toggleFilter(selectedDurations, setSelectedDurations, e.target.value)}
                  >
                    <option value="" disabled>Seleccionar...</option>
                    {availableDurations.map(dur => (
                      <option key={dur} value={dur}>{dur}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Filter Chips */}
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {Array.from(selectedLevels).map(lvl => (
                    <FilterChip key={`lvl-${lvl}`} label={`Nivel ${lvl === 0 ? 'Truco' : lvl}`} onRemove={() => removeFilter('level', lvl)} />
                  ))}
                  {Array.from(selectedSchools).map(sch => (
                    <FilterChip key={`sch-${sch}`} label={sch} onRemove={() => removeFilter('school', sch)} />
                  ))}
                  {Array.from(selectedDurations).map(dur => (
                    <FilterChip key={`dur-${dur}`} label={dur} onRemove={() => removeFilter('duration', dur)} />
                  ))}
                  <button 
                    onClick={() => { setSelectedLevels(new Set()); setSelectedSchools(new Set()); setSelectedDurations(new Set()); }}
                    className="text-xs text-muted-foreground hover:text-white underline ml-2 transition-colors"
                  >
                    Limpiar todos
                  </button>
                </div>
              )}
            </div>

            {/* Results Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#120e0b]">
              <Dialog.Title className="sr-only">Busca conjuros</Dialog.Title>
              <Dialog.Description className="sr-only">
                Encuentra y selecciona un conjuro para añadirlo a tu registro.
              </Dialog.Description>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : filteredSpells.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 rounded-full bg-[#1a1510] border border-[#8B7355]/30 flex items-center justify-center mb-4">
                    <XCircle className="w-8 h-8 text-[#8B7355]/60" />
                  </div>
                  <h3 className="text-lg font-serif text-[#D4AF37] mb-2">No se encontraron conjuros</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Intenta ajustar tu búsqueda o limpiar los filtros para ver más opciones.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredSpells.map((spell, i) => {
                    const isSelected = selectedSpells.has(spell.nombre);
                    const isShaking = shakeKey === spell.nombre;
                    return (
                      <SpellCard
                        key={`${spell.nombre}-${i}`}
                        spell={spell}
                        index={i}
                        isSelected={isSelected}
                        isShaking={isShaking}
                        onClick={() => handleToggleSpell(spell)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Footer with selection stats and actions */}
            <div className="p-4 border-t border-[#8B7355]/20 bg-[#15110d] flex justify-between items-center shrink-0">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#D4AF37]">
                  Seleccionados: <span className={selectedSpells.size > 0 ? "text-green-400" : ""}>{selectedSpells.size}</span> / {maxSelectable === Infinity ? "∞" : maxSelectable}
                </span>
                {shakeKey && selectedSpells.size >= maxSelectable && (
                  <span className="text-xs text-red-400 custom-animate-fade-in">
                    Límite máximo alcanzado
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <Dialog.Close className="px-4 py-2 text-xs font-semibold rounded border border-[#8B7355]/40 hover:bg-[#8B7355]/10 text-muted-foreground hover:text-white transition duration-200">
                  Cancelar
                </Dialog.Close>
                <button
                  type="button"
                  disabled={selectedSpells.size === 0}
                  onClick={() => {
                    setOpen(false);
                    onSelectSpells(Array.from(selectedSpells.values()));
                  }}
                  className="px-5 py-2 text-xs font-semibold rounded bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black shadow-lg font-serif transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Aprender {selectedSpells.size > 0 ? selectedSpells.size : ""} conjuro{selectedSpells.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <style>{`
        @keyframes shimmerSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .shimmer-sweep {
          animation: shimmerSweep 2s infinite;
        }

        @keyframes cardIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .custom-animate-card-in {
          animation: cardIn 0.4s ease-out both;
        }

        @keyframes chipIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .custom-animate-chip-in {
          animation: chipIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out !important;
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
    </>
  );
}
