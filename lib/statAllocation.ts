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

/**
 * Modificador de una característica: lo que de verdad se suma a las tiradas.
 * 10-11 → +0, y ±1 por cada 2 puntos. Un 16 da +3, un 8 da −1.
 */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** El modificador con signo para mostrarlo en pantalla: "+3", "-1". */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Puntos gastados por un reparto en compra de puntos. Subir no es lineal: de 13
 * a 14 cuesta 2 puntos y de 14 a 15 cuesta 2 más, para desincentivar los picos.
 * Un valor fuera de la tabla devuelve Infinity y así la validación lo rechaza
 * en vez de contarlo como gratis.
 */
export function totalPointBuyCost(stats: StatsBlock): number {
  return ABILITY_KEYS.reduce(
    (sum, key) => sum + (POINT_BUY_COST[stats[key]] ?? Number.POSITIVE_INFINITY),
    0,
  );
}

/** ¿Vienen las seis características y todas son enteros? Primer filtro de todo lo que llega del cliente. */
function isCompleteStatsBlock(stats: unknown): stats is StatsBlock {
  if (!stats || typeof stats !== "object") return false;
  return ABILITY_KEYS.every((key) => {
    const value = (stats as Record<string, unknown>)[key];
    return typeof value === "number" && Number.isInteger(value);
  });
}

export type StatValidation = { ok: true; stats: StatsBlock } | { ok: false; error: string };

// ── Validadores: uno por método de reparto ───────────────────────────────────
// Los tres se ejecutan EN EL SERVIDOR al crear el personaje, aunque el modal ya
// haya validado en el navegador. El cliente puede mandar lo que quiera; sin
// esta comprobación cualquiera se crearía un personaje con seis 18.

/** Compra de puntos: cada valor entre 8 y 15, y el coste total dentro de los 27 puntos. */
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

/**
 * Matriz estándar: deben usarse exactamente los valores 15/14/13/12/10/8, en el
 * orden que quiera el jugador. Por eso se comparan ordenados: importa el
 * conjunto, no a qué característica fue cada uno.
 */
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

/**
 * Tirada de dados: aquí solo se comprueba el rango posible de 4d6 quitando el
 * menor (3-18). La comprobación fuerte —que sean EXACTAMENTE los valores que
 * tiró el servidor— la hace el token HMAC de statRollToken.ts.
 */
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
