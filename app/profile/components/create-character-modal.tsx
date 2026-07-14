"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  LayoutGrid,
  Scale,
  Sparkles,
  Swords,
  Wand2,
} from "lucide-react";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  POINT_BUY_BUDGET,
  POINT_BUY_COST,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  STANDARD_ARRAY,
  abilityModifier,
  formatModifier,
  recommendedStatsForClass,
  totalPointBuyCost,
  type AbilityKey,
  type StatMethod,
  type StatsBlock,
} from "@/lib/statAllocation";

export type CreateCharacterPayload = {
  name: string;
  race: string;
  alignment: string;
  multiclass: { className: string; level: number }[];
  statMethod: StatMethod;
  stats?: StatsBlock;
  rollToken?: string;
};

type DiceRoll = { dice: number[]; total: number };

type Assignment = Record<AbilityKey, number | null>;

const CLASSES = [
  "Bárbaro",
  "Bardo",
  "Clérigo",
  "Druida",
  "Guerrero",
  "Monje",
  "Paladín",
  "Explorador",
  "Pícaro",
  "Hechicero",
  "Brujo",
  "Mago",
];

const ALIGNMENTS = [
  "Legal Bueno",
  "Legal Neutral",
  "Legal Malo",
  "Neutral Bueno",
  "Neutral",
  "Neutral Malo",
  "Caótico Bueno",
  "Caótico Neutral",
  "Caótico Malo",
];

const METHODS: {
  id: StatMethod;
  name: string;
  description: string;
  icon: typeof Sparkles;
}[] = [
  {
    id: "recommended",
    name: "Recomendado",
    description: "Reparto sugerido según tu clase",
    icon: Sparkles,
  },
  {
    id: "pointbuy",
    name: "Compra de Puntos",
    description: "27 puntos, valores de 8 a 15",
    icon: Scale,
  },
  {
    id: "standard",
    name: "Matriz Estándar",
    description: "15, 14, 13, 12, 10, 8",
    icon: LayoutGrid,
  },
  {
    id: "roll",
    name: "Tirada de Dados",
    description: "4d6, se descarta el menor",
    icon: Dices,
  },
];

const emptyAssignment = (): Assignment => ({
  str: null,
  dex: null,
  con: null,
  int: null,
  wis: null,
  chr: null,
});

const initialPointBuy = (): StatsBlock => ({
  str: POINT_BUY_MIN,
  dex: POINT_BUY_MIN,
  con: POINT_BUY_MIN,
  int: POINT_BUY_MIN,
  wis: POINT_BUY_MIN,
  chr: POINT_BUY_MIN,
});

// Orden de prioridad de atributos para auto-asignar, según la clase.
function classPriority(className: string): AbilityKey[] {
  const rec = recommendedStatsForClass(className || "");
  return [...ABILITY_KEYS].sort((a, b) => rec[b] - rec[a]);
}

function ModifierChip({ score }: { score: number }) {
  const mod = abilityModifier(score);
  const tone =
    mod > 0
      ? "text-emerald-300 border-emerald-700/60 bg-emerald-950/40"
      : mod < 0
        ? "text-red-300 border-red-800/60 bg-red-950/40"
        : "text-muted-foreground border-border bg-secondary/40";
  return (
    <span
      className={`inline-flex items-center justify-center min-w-11 px-2 py-0.5 rounded-full border text-xs font-bold tabular-nums ${tone}`}
    >
      {formatModifier(mod)}
    </span>
  );
}

function AnimatedScore({ value, className = "" }: { value: number | string; className?: string }) {
  return (
    <span className={`relative inline-flex overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: -14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 14, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default function CreateCharacterModal({
  open,
  onClose,
  onSubmit,
  isCreating,
  authToken,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateCharacterPayload) => Promise<boolean>;
  isCreating: boolean;
  authToken: string | null;
}) {
  const [step, setStep] = useState<0 | 1>(0);
  const [identity, setIdentity] = useState({
    name: "",
    race: "",
    alignment: "",
    className: "",
  });
  const [method, setMethod] = useState<StatMethod>("recommended");
  const [pointBuy, setPointBuy] = useState<StatsBlock>(initialPointBuy());
  const [arrayAssign, setArrayAssign] = useState<Assignment>(emptyAssignment());
  const [rolls, setRolls] = useState<DiceRoll[] | null>(null);
  const [rollToken, setRollToken] = useState<string | null>(null);
  const [rollAssign, setRollAssign] = useState<Assignment>(emptyAssignment());
  const [isRolling, setIsRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reiniciar el formulario cada vez que se abre el modal
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setIdentity({ name: "", race: "", alignment: "", className: "" });
    setMethod("recommended");
    setPointBuy(initialPointBuy());
    setArrayAssign(emptyAssignment());
    setRolls(null);
    setRollToken(null);
    setRollAssign(emptyAssignment());
    setError(null);
  }, [open]);

  const identityComplete =
    identity.name.trim().length > 0 &&
    identity.race.trim().length > 0 &&
    identity.alignment.length > 0 &&
    identity.className.length > 0;

  const spentPoints = totalPointBuyCost(pointBuy);
  const remainingPoints = POINT_BUY_BUDGET - spentPoints;

  const finalStats: StatsBlock | null = useMemo(() => {
    switch (method) {
      case "recommended":
        return identity.className
          ? recommendedStatsForClass(identity.className)
          : null;
      case "pointbuy":
        return remainingPoints >= 0 ? pointBuy : null;
      case "standard": {
        if (ABILITY_KEYS.some((k) => arrayAssign[k] === null)) return null;
        return Object.fromEntries(
          ABILITY_KEYS.map((k) => [k, arrayAssign[k] as number]),
        ) as StatsBlock;
      }
      case "roll": {
        if (!rolls || ABILITY_KEYS.some((k) => rollAssign[k] === null))
          return null;
        return Object.fromEntries(
          ABILITY_KEYS.map((k) => [k, rolls[rollAssign[k] as number].total]),
        ) as StatsBlock;
      }
    }
  }, [method, identity.className, pointBuy, remainingPoints, arrayAssign, rolls, rollAssign]);

  const canForge = identityComplete && finalStats !== null && !isCreating;

  const adjustPointBuy = (key: AbilityKey, delta: 1 | -1) => {
    setPointBuy((prev) => {
      const next = prev[key] + delta;
      if (next < POINT_BUY_MIN || next > POINT_BUY_MAX) return prev;
      const candidate = { ...prev, [key]: next };
      if (totalPointBuyCost(candidate) > POINT_BUY_BUDGET) return prev;
      return candidate;
    });
  };

  const rollDice = async () => {
    if (!authToken || isRolling) return;
    setIsRolling(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/roll-stats", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudieron lanzar los dados");
      setRolls(data.rolls);
      setRollToken(data.token);
      setRollAssign(emptyAssignment());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron lanzar los dados");
    } finally {
      setIsRolling(false);
    }
  };

  const autoAssign = () => {
    const priority = classPriority(identity.className);
    if (method === "standard") {
      const values = [...STANDARD_ARRAY].sort((a, b) => b - a);
      const next = emptyAssignment();
      priority.forEach((key, i) => {
        next[key] = values[i];
      });
      setArrayAssign(next);
    } else if (method === "roll" && rolls) {
      const indices = rolls
        .map((r, i) => ({ i, total: r.total }))
        .sort((a, b) => b.total - a.total)
        .map((r) => r.i);
      const next = emptyAssignment();
      priority.forEach((key, i) => {
        next[key] = indices[i];
      });
      setRollAssign(next);
    }
  };

  const handleForge = async () => {
    if (!canForge || !finalStats) return;
    setError(null);
    const payload: CreateCharacterPayload = {
      name: identity.name,
      race: identity.race,
      alignment: identity.alignment,
      multiclass: [{ className: identity.className, level: 1 }],
      statMethod: method,
      ...(method !== "recommended" ? { stats: finalStats } : {}),
      ...(method === "roll" && rollToken ? { rollToken } : {}),
    };
    await onSubmit(payload);
  };

  const inputClass =
    "w-full px-3 py-2 rounded border border-border bg-secondary/30 text-foreground focus:outline-none focus:ring-2 focus:ring-[#D4AF37]";
  const selectClass =
    "w-full px-3 py-2 rounded border border-border bg-[#1a1a1a] text-foreground focus:outline-none focus:ring-2 focus:ring-[#D4AF37] [&>option]:bg-[#1a1a1a] [&>option]:text-foreground";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/70 p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isCreating) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{
              scale: 1,
              opacity: 1,
              y: 0,
              transition: { type: "spring", damping: 24, stiffness: 300 },
            }}
            exit={{
              scale: 0.94,
              opacity: 0,
              y: 15,
              transition: { duration: 0.18, ease: "easeInOut" },
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#141009] parchment-texture medieval-border candle-glow rounded-xl shadow-2xl w-full max-w-3xl relative my-auto overflow-hidden"
          >
            {/* Filigrana superior */}
            <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-70" />

            <div className="p-6 max-h-[88vh] overflow-y-auto">
              <button
                aria-label="Cerrar"
                className="absolute top-4 right-4 text-2xl text-muted-foreground hover:text-foreground w-8 h-8 flex items-center justify-center rounded hover:bg-secondary z-10"
                onClick={onClose}
                disabled={isCreating}
              >
                ×
              </button>

              {/* Cabecera + indicador de pasos */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-[#D4AF37] uppercase tracking-widest font-serif">
                  Forjar Nuevo Héroe
                </h2>
                <div className="flex items-center justify-center gap-3 mt-4 text-xs uppercase tracking-wider">
                  {["Identidad", "Atributos"].map((label, i) => (
                    <div key={label} className="flex items-center gap-3">
                      {i > 0 && (
                        <div className="w-16 h-px bg-gradient-to-r from-[#8B7355]/30 via-[#8B7355] to-[#8B7355]/30 relative overflow-hidden">
                          <motion.div
                            className="absolute inset-0 bg-[#D4AF37]"
                            initial={false}
                            animate={{ scaleX: step === 1 ? 1 : 0 }}
                            style={{ transformOrigin: "left" }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          />
                        </div>
                      )}
                      <div
                        className={`flex items-center gap-2 ${
                          step === i ? "text-[#D4AF37]" : "text-muted-foreground"
                        }`}
                      >
                        <motion.span
                          animate={{
                            scale: step === i ? 1.1 : 1,
                            boxShadow:
                              step === i
                                ? "0 0 12px rgba(212,175,55,0.5)"
                                : "0 0 0 rgba(0,0,0,0)",
                          }}
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-serif font-bold ${
                            step >= i
                              ? "border-[#D4AF37] bg-[#D4AF37]/10"
                              : "border-[#8B7355]/50"
                          }`}
                        >
                          {i === 0 ? "I" : "II"}
                        </motion.span>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {step === 0 ? (
                  /* ── Paso I: Identidad ─────────────────────────────── */
                  <motion.div
                    key="identity"
                    initial={{ x: -32, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -32, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Nombre del Personaje
                      </label>
                      <input
                        type="text"
                        value={identity.name}
                        onChange={(e) =>
                          setIdentity({ ...identity, name: e.target.value })
                        }
                        className={inputClass}
                        placeholder="Ej: Aragorn"
                        maxLength={60}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                          Raza
                        </label>
                        <input
                          type="text"
                          value={identity.race}
                          onChange={(e) =>
                            setIdentity({ ...identity, race: e.target.value })
                          }
                          className={inputClass}
                          placeholder="Ej: Elfo, Humano, Semiorco..."
                          maxLength={40}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                          Alineamiento
                        </label>
                        <select
                          value={identity.alignment}
                          onChange={(e) =>
                            setIdentity({ ...identity, alignment: e.target.value })
                          }
                          className={selectClass}
                        >
                          <option value="">Selecciona un alineamiento</option>
                          {ALIGNMENTS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Clase Inicial (Nivel 1)
                      </label>
                      <select
                        value={identity.className}
                        onChange={(e) =>
                          setIdentity({ ...identity, className: e.target.value })
                        }
                        className={selectClass}
                      >
                        <option value="">Selecciona una clase</option>
                        {CLASSES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-4 border-t border-border flex gap-3">
                      <button
                        onClick={onClose}
                        disabled={isCreating}
                        className="flex-1 px-4 py-2 rounded border border-border bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => setStep(1)}
                        disabled={!identityComplete}
                        className="flex-1 px-4 py-2 rounded bg-[#D4AF37] text-background font-semibold shadow hover:bg-[#B8860B] transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
                      >
                        Continuar <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  /* ── Paso II: Atributos ────────────────────────────── */
                  <motion.div
                    key="stats"
                    initial={{ x: 32, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 32, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="space-y-5"
                  >
                    {/* Selector de método */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {METHODS.map(({ id, name, description, icon: Icon }) => {
                        const active = method === id;
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              setMethod(id);
                              setError(null);
                            }}
                            className={`relative rounded-lg border p-3 text-left transition group ${
                              active
                                ? "border-[#D4AF37] bg-[#D4AF37]/10"
                                : "border-border bg-secondary/20 hover:border-[#8B7355]"
                            }`}
                          >
                            {active && (
                              <motion.div
                                layoutId="method-glow"
                                className="absolute inset-0 rounded-lg pointer-events-none"
                                style={{
                                  boxShadow: "0 0 18px rgba(212,175,55,0.35)",
                                }}
                                transition={{
                                  type: "spring",
                                  stiffness: 400,
                                  damping: 32,
                                }}
                              />
                            )}
                            <Icon
                              className={`w-5 h-5 mb-1.5 ${
                                active
                                  ? "text-[#D4AF37]"
                                  : "text-muted-foreground group-hover:text-foreground"
                              }`}
                            />
                            <div
                              className={`text-sm font-semibold leading-tight ${
                                active ? "text-[#D4AF37]" : "text-foreground"
                              }`}
                            >
                              {name}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                              {description}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Contenido del método */}
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={method}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.18 }}
                      >
                        {method === "recommended" && finalStats && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                              <Wand2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                              Reparto clásico 16 / 14 / 12 optimizado para{" "}
                              <span className="text-[#D4AF37] font-semibold">
                                {identity.className}
                              </span>
                              .
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {ABILITY_KEYS.map((key, i) => (
                                <motion.div
                                  key={key}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: i * 0.05 }}
                                  className="rounded-lg border border-[#8B7355]/40 bg-secondary/20 p-3 flex items-center justify-between"
                                >
                                  <div>
                                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                                      {ABILITY_LABELS[key].abbr}
                                    </div>
                                    <div className="text-sm text-foreground">
                                      {ABILITY_LABELS[key].name}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-2xl font-bold text-[#D4AF37] tabular-nums font-serif">
                                      {finalStats[key]}
                                    </span>
                                    <ModifierChip score={finalStats[key]} />
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        {method === "pointbuy" && (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs text-muted-foreground">
                                Cada valor cuesta puntos: 13→5, 14→7, 15→9. Gasta
                                hasta {POINT_BUY_BUDGET}.
                              </p>
                              <div className="text-sm font-semibold text-foreground shrink-0 ml-3">
                                Restantes:{" "}
                                <AnimatedScore
                                  value={remainingPoints}
                                  className={`font-serif text-lg ${
                                    remainingPoints === 0
                                      ? "text-emerald-300"
                                      : "text-[#D4AF37]"
                                  }`}
                                />
                                <span className="text-muted-foreground">
                                  {" "}
                                  / {POINT_BUY_BUDGET}
                                </span>
                              </div>
                            </div>
                            {/* Barra de presupuesto */}
                            <div className="h-1.5 rounded-full bg-secondary/50 mb-4 overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-[#8B7355] to-[#D4AF37]"
                                animate={{
                                  width: `${(spentPoints / POINT_BUY_BUDGET) * 100}%`,
                                }}
                                transition={{ type: "spring", stiffness: 200, damping: 25 }}
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {ABILITY_KEYS.map((key) => {
                                const score = pointBuy[key];
                                const nextCost =
                                  score < POINT_BUY_MAX
                                    ? POINT_BUY_COST[score + 1] - POINT_BUY_COST[score]
                                    : null;
                                const canRaise =
                                  nextCost !== null && nextCost <= remainingPoints;
                                return (
                                  <div
                                    key={key}
                                    className="rounded-lg border border-[#8B7355]/40 bg-secondary/20 px-3 py-2 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-foreground">
                                        {ABILITY_LABELS[key].name}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground truncate">
                                        {ABILITY_LABELS[key].description}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <ModifierChip score={score} />
                                      <button
                                        aria-label={`Reducir ${ABILITY_LABELS[key].name}`}
                                        onClick={() => adjustPointBuy(key, -1)}
                                        disabled={score <= POINT_BUY_MIN}
                                        className="w-7 h-7 rounded-full border border-[#8B7355]/60 text-foreground hover:border-[#D4AF37] hover:text-[#D4AF37] transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                                      >
                                        −
                                      </button>
                                      <AnimatedScore
                                        value={score}
                                        className="w-7 justify-center text-xl font-bold text-[#D4AF37] font-serif"
                                      />
                                      <button
                                        aria-label={`Aumentar ${ABILITY_LABELS[key].name}`}
                                        onClick={() => adjustPointBuy(key, 1)}
                                        disabled={!canRaise}
                                        className="w-7 h-7 rounded-full border border-[#8B7355]/60 text-foreground hover:border-[#D4AF37] hover:text-[#D4AF37] transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {method === "standard" && (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs text-muted-foreground">
                                Asigna cada valor de la matriz{" "}
                                <span className="text-[#D4AF37] font-semibold">
                                  {STANDARD_ARRAY.join(" · ")}
                                </span>{" "}
                                a un atributo.
                              </p>
                              <button
                                onClick={autoAssign}
                                className="text-xs px-2.5 py-1 rounded border border-[#8B7355]/60 text-muted-foreground hover:text-[#D4AF37] hover:border-[#D4AF37] transition shrink-0 ml-3 inline-flex items-center gap-1"
                              >
                                <Swords className="w-3 h-3" /> Auto-asignar
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {ABILITY_KEYS.map((key) => {
                                const used = ABILITY_KEYS.filter(
                                  (k) => k !== key && arrayAssign[k] !== null,
                                ).map((k) => arrayAssign[k]);
                                const available = STANDARD_ARRAY.filter(
                                  (v) => !used.includes(v),
                                );
                                const value = arrayAssign[key];
                                return (
                                  <div
                                    key={key}
                                    className="rounded-lg border border-[#8B7355]/40 bg-secondary/20 px-3 py-2 flex items-center justify-between gap-2"
                                  >
                                    <div className="text-sm font-semibold text-foreground">
                                      {ABILITY_LABELS[key].name}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {value !== null && <ModifierChip score={value} />}
                                      <select
                                        value={value ?? ""}
                                        onChange={(e) =>
                                          setArrayAssign((prev) => ({
                                            ...prev,
                                            [key]:
                                              e.target.value === ""
                                                ? null
                                                : Number(e.target.value),
                                          }))
                                        }
                                        className="px-2 py-1.5 rounded border border-border bg-[#1a1a1a] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] [&>option]:bg-[#1a1a1a]"
                                      >
                                        <option value="">—</option>
                                        {available.map((v) => (
                                          <option key={v} value={v}>
                                            {v}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {method === "roll" && (
                          <div>
                            {!rolls ? (
                              <div className="flex flex-col items-center gap-4 py-6">
                                <motion.button
                                  onClick={rollDice}
                                  disabled={isRolling || !authToken}
                                  whileHover={{ scale: 1.04 }}
                                  whileTap={{ scale: 0.96 }}
                                  className="px-6 py-3 rounded-lg bg-[#D4AF37] text-background font-bold shadow-lg hover:bg-[#B8860B] transition inline-flex items-center gap-2 disabled:opacity-50"
                                >
                                  <motion.span
                                    animate={
                                      isRolling
                                        ? { rotate: [0, -20, 20, -20, 20, 0] }
                                        : {}
                                    }
                                    transition={{
                                      duration: 0.6,
                                      repeat: isRolling ? Infinity : 0,
                                    }}
                                  >
                                    <Dices className="w-5 h-5" />
                                  </motion.span>
                                  {isRolling ? "Lanzando..." : "Lanzar los Dados"}
                                </motion.button>
                                <p className="text-xs text-muted-foreground text-center max-w-sm">
                                  Se lanzan 4d6 por atributo descartando el dado más
                                  bajo. El destino sella la tirada: no hay
                                  relanzamientos.
                                </p>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs text-muted-foreground">
                                    El destino ha hablado. Asigna cada resultado a un
                                    atributo.
                                  </p>
                                  <button
                                    onClick={autoAssign}
                                    className="text-xs px-2.5 py-1 rounded border border-[#8B7355]/60 text-muted-foreground hover:text-[#D4AF37] hover:border-[#D4AF37] transition shrink-0 ml-3 inline-flex items-center gap-1"
                                  >
                                    <Swords className="w-3 h-3" /> Auto-asignar
                                  </button>
                                </div>

                                {/* Resultados de la tirada */}
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                                  {rolls.map((roll, i) => {
                                    const lowestIdx = roll.dice.indexOf(
                                      Math.min(...roll.dice),
                                    );
                                    return (
                                      <motion.div
                                        key={i}
                                        initial={{ opacity: 0, rotate: -12, scale: 0.6 }}
                                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                        transition={{
                                          delay: i * 0.12,
                                          type: "spring",
                                          stiffness: 300,
                                          damping: 18,
                                        }}
                                        className="rounded-lg border border-[#8B7355]/50 bg-secondary/20 p-2 text-center"
                                      >
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          transition={{
                                            delay: i * 0.12 + 0.25,
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 15,
                                          }}
                                          className="text-2xl font-bold text-[#D4AF37] font-serif"
                                        >
                                          {roll.total}
                                        </motion.div>
                                        <div className="flex justify-center gap-0.5 mt-1">
                                          {roll.dice.map((d, j) => (
                                            <span
                                              key={j}
                                              className={`text-[10px] w-4 h-4 rounded-sm border flex items-center justify-center tabular-nums ${
                                                j === lowestIdx
                                                  ? "border-red-900/60 text-red-400/60 line-through"
                                                  : "border-[#8B7355]/50 text-muted-foreground"
                                              }`}
                                            >
                                              {d}
                                            </span>
                                          ))}
                                        </div>
                                      </motion.div>
                                    );
                                  })}
                                </div>

                                {/* Asignación */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {ABILITY_KEYS.map((key) => {
                                    const usedIdx = ABILITY_KEYS.filter(
                                      (k) => k !== key && rollAssign[k] !== null,
                                    ).map((k) => rollAssign[k]);
                                    const value = rollAssign[key];
                                    return (
                                      <div
                                        key={key}
                                        className="rounded-lg border border-[#8B7355]/40 bg-secondary/20 px-3 py-2 flex items-center justify-between gap-2"
                                      >
                                        <div className="text-sm font-semibold text-foreground">
                                          {ABILITY_LABELS[key].name}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {value !== null && (
                                            <ModifierChip score={rolls[value].total} />
                                          )}
                                          <select
                                            value={value ?? ""}
                                            onChange={(e) =>
                                              setRollAssign((prev) => ({
                                                ...prev,
                                                [key]:
                                                  e.target.value === ""
                                                    ? null
                                                    : Number(e.target.value),
                                              }))
                                            }
                                            className="px-2 py-1.5 rounded border border-border bg-[#1a1a1a] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] [&>option]:bg-[#1a1a1a]"
                                          >
                                            <option value="">—</option>
                                            {rolls.map((r, i) =>
                                              usedIdx.includes(i) ? null : (
                                                <option key={i} value={i}>
                                                  {r.total}
                                                </option>
                                              ),
                                            )}
                                          </select>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-red-400 text-center"
                      >
                        {error}
                      </motion.p>
                    )}

                    <div className="pt-4 border-t border-border flex gap-3">
                      <button
                        onClick={() => setStep(0)}
                        disabled={isCreating}
                        className="flex-1 px-4 py-2 rounded border border-border bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition disabled:opacity-50 inline-flex items-center justify-center gap-1"
                      >
                        <ChevronLeft className="w-4 h-4" /> Atrás
                      </button>
                      <button
                        onClick={handleForge}
                        disabled={!canForge}
                        className="flex-1 px-4 py-2 rounded bg-[#D4AF37] text-background font-semibold shadow hover:bg-[#B8860B] transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isCreating ? "Forjando..." : "⚔ Forjar Personaje"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
