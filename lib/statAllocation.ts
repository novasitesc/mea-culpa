// Reglas de asignación de estadísticas base — D&D 5e (2014), cap. 1 "Ability Scores"
// Compartido entre el modal de creación (cliente) y las rutas API (servidor).

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "chr";

export type StatsBlock = Record<AbilityKey, number>;

export type StatMethod = "recommended" | "pointbuy" | "standard" | "roll";

export const ABILITY_KEYS: AbilityKey[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "chr",
];

export const ABILITY_LABELS: Record<
  AbilityKey,
  { name: string; abbr: string; description: string }
> = {
  str: { name: "Fuerza", abbr: "FUE", description: "Poder físico y carga" },
  dex: { name: "Destreza", abbr: "DES", description: "Agilidad y reflejos" },
  con: { name: "Constitución", abbr: "CON", description: "Salud y aguante" },
  int: { name: "Inteligencia", abbr: "INT", description: "Razonamiento y memoria" },
  wis: { name: "Sabiduría", abbr: "SAB", description: "Percepción e intuición" },
  chr: { name: "Carisma", abbr: "CAR", description: "Presencia y persuasión" },
};

// ── Point Buy (PHB 2014, "Variant: Customizing Ability Scores") ──────────────
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

// ── Standard Array (PHB 2014) ────────────────────────────────────────────────
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// ── Tirada: 4d6 descartando el más bajo ──────────────────────────────────────
export const ROLL_MIN = 3;
export const ROLL_MAX = 18;
export const ROLL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_STATS: StatsBlock = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  chr: 10,
};

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function totalPointBuyCost(stats: StatsBlock): number {
  return ABILITY_KEYS.reduce(
    (sum, key) => sum + (POINT_BUY_COST[stats[key]] ?? Number.POSITIVE_INFINITY),
    0,
  );
}

function isCompleteStatsBlock(stats: unknown): stats is StatsBlock {
  if (!stats || typeof stats !== "object") return false;
  return ABILITY_KEYS.every((key) => {
    const value = (stats as Record<string, unknown>)[key];
    return typeof value === "number" && Number.isInteger(value);
  });
}

export type StatValidation = { ok: true; stats: StatsBlock } | { ok: false; error: string };

export function validatePointBuy(stats: unknown): StatValidation {
  if (!isCompleteStatsBlock(stats)) {
    return { ok: false, error: "Faltan estadísticas o tienen un formato inválido." };
  }
  for (const key of ABILITY_KEYS) {
    const value = stats[key];
    if (value < POINT_BUY_MIN || value > POINT_BUY_MAX) {
      return {
        ok: false,
        error: `${ABILITY_LABELS[key].name} debe estar entre ${POINT_BUY_MIN} y ${POINT_BUY_MAX} en compra de puntos.`,
      };
    }
  }
  const cost = totalPointBuyCost(stats);
  if (cost > POINT_BUY_BUDGET) {
    return {
      ok: false,
      error: `La compra de puntos excede el presupuesto: ${cost}/${POINT_BUY_BUDGET}.`,
    };
  }
  return { ok: true, stats };
}

export function validateStandardArray(stats: unknown): StatValidation {
  if (!isCompleteStatsBlock(stats)) {
    return { ok: false, error: "Faltan estadísticas o tienen un formato inválido." };
  }
  const submitted = ABILITY_KEYS.map((key) => stats[key]).sort((a, b) => b - a);
  const expected = [...STANDARD_ARRAY].sort((a, b) => b - a);
  const matches = submitted.every((value, i) => value === expected[i]);
  if (!matches) {
    return {
      ok: false,
      error: `La matriz estándar debe usar exactamente los valores ${STANDARD_ARRAY.join(", ")}.`,
    };
  }
  return { ok: true, stats };
}

export function validateRolledStats(stats: unknown): StatValidation {
  if (!isCompleteStatsBlock(stats)) {
    return { ok: false, error: "Faltan estadísticas o tienen un formato inválido." };
  }
  for (const key of ABILITY_KEYS) {
    const value = stats[key];
    if (value < ROLL_MIN || value > ROLL_MAX) {
      return {
        ok: false,
        error: `${ABILITY_LABELS[key].name} está fuera del rango de tirada (${ROLL_MIN}-${ROLL_MAX}).`,
      };
    }
  }
  return { ok: true, stats };
}

// Stats sugeridos por clase primaria (equivale al reparto 16/14/12 clásico).
export function recommendedStatsForClass(className: string): StatsBlock {
  const base: StatsBlock = { ...DEFAULT_STATS };
  switch (className.toLowerCase()) {
    case "barbarian":
    case "bárbaro":
    case "fighter":
    case "guerrero":
      return { ...base, str: 16, con: 14, dex: 12 };
    case "paladin":
    case "paladín":
      return { ...base, str: 16, chr: 14, con: 12 };
    case "ranger":
    case "explorador":
    case "monk":
    case "monje":
      return { ...base, dex: 16, wis: 14, con: 12 };
    case "rogue":
    case "pícaro":
      return { ...base, dex: 16, chr: 14, int: 12 };
    case "bard":
    case "bardo":
      return { ...base, chr: 16, dex: 14, con: 12 };
    case "cleric":
    case "clérigo":
      return { ...base, wis: 16, con: 14, str: 12 };
    case "druid":
    case "druida":
      return { ...base, wis: 16, con: 14, dex: 12 };
    case "sorcerer":
    case "hechicero":
    case "warlock":
    case "brujo":
      return { ...base, chr: 16, con: 14, dex: 12 };
    case "wizard":
    case "mago":
      return { ...base, int: 16, con: 14, dex: 12 };
    default:
      return base;
  }
}

// Mapeo a las columnas de `estadisticas_personaje`.
export function toDbStats(stats: StatsBlock) {
  return {
    fuerza: stats.str,
    destreza: stats.dex,
    constitucion: stats.con,
    inteligencia: stats.int,
    sabiduria: stats.wis,
    carisma: stats.chr,
  };
}
