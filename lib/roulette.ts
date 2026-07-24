// Matemáticas de la ruleta. Módulo puro: sin base de datos, sin red — solo
// tablas y cálculo. Por eso es trivial de leer y de probar.
//
// La rueda tiene 100 casillas. Cuántas casillas ocupa cada categoría ES la
// probabilidad: 1 de jackpot = 1%, 65 de premio pequeño = 65%. Cambiar los
// números de SLOT_COUNTS cambia el balance del juego.
//
// El coste NO es fijo: sigue un ciclo de 6 pasos que alterna oro y dinero real,
// y la posición dentro del ciclo depende de cuántas veces haya tirado ya el
// usuario. El premio concreto de cada categoría no se decide aquí, sino en
// rouletteRewards.ts (esos sí salen de la base de datos y el admin los edita).
export type RouletteCategory =
  | "jackpot"
  | "muy_grande"
  | "nada"
  | "grande"
  | "mediano"
  | "pequeno";

export type RouletteCostType = "oro" | "usd";

export type RouletteCostStep = {
  step: number;
  type: RouletteCostType;
  amount: number;
};

export type RouletteSpinResult = {
  slot: number;
  category: RouletteCategory;
  rewardLabel: string;
};

const SLOT_COUNTS: Array<{ category: RouletteCategory; count: number }> = [
  { category: "jackpot", count: 1 },
  { category: "muy_grande", count: 4 },
  { category: "nada", count: 5 },
  { category: "grande", count: 10 },
  { category: "mediano", count: 15 },
  { category: "pequeno", count: 65 },
];

const COST_CYCLE: Array<{ type: RouletteCostType; amount: number }> = [
  { type: "oro", amount: 500 },
  { type: "usd", amount: 3 },
  { type: "usd", amount: 3 },
  { type: "oro", amount: 500 },
  { type: "usd", amount: 3 },
  { type: "oro", amount: 250 },
];

// Las cuentas de SLOT_COUNTS se despliegan en un array de 100 posiciones:
// SLOT_TABLE[0] = "jackpot", SLOT_TABLE[1..4] = "muy_grande", etc. Sortear es
// entonces elegir un índice al azar.
const SLOT_TABLE: RouletteCategory[] = SLOT_COUNTS.flatMap(({ category, count }) =>
  Array.from({ length: count }, () => category),
);

// Red de seguridad: si alguien edita SLOT_COUNTS y las cuentas no suman 100,
// las probabilidades quedarían mal. Falla al arrancar, no en silencio.
if (SLOT_TABLE.length !== 100) {
  throw new Error("La ruleta debe tener exactamente 100 slots");
}

const REWARD_LABELS: Record<RouletteCategory, string> = {
  jackpot: "Jackpot",
  muy_grande: "Premio muy grande",
  nada: "Sin premio",
  grande: "Premio grande",
  mediano: "Premio mediano",
  pequeno: "Premio pequeno",
};

/** Copia de las 100 casillas, para que la UI pinte la rueda. La copia evita
 *  que un componente modifique la tabla real por accidente. */
export function getRouletteSlots(): RouletteCategory[] {
  return [...SLOT_TABLE];
}

/** El ciclo de costes completo, numerado del 1 al 6 (para mostrarlo al jugador). */
export function getCostCycle(): RouletteCostStep[] {
  return COST_CYCLE.map((entry, index) => ({
    step: index + 1,
    type: entry.type,
    amount: entry.amount,
  }));
}

/**
 * Cuánto cuesta la SIGUIENTE tirada, según cuántas lleve ya el usuario.
 * Tirada 0 → paso 1, tirada 6 → vuelve al paso 1, y así indefinidamente.
 */
export function getNextSpinCost(totalSpins: number): RouletteCostStep {
  // El doble módulo protege de un totalSpins negativo (dato corrupto): en JS
  // -1 % 6 vale -1, y un índice negativo daría `undefined`.
  const index = ((totalSpins % COST_CYCLE.length) + COST_CYCLE.length) % COST_CYCLE.length;
  const current = COST_CYCLE[index];
  return {
    step: index + 1,
    type: current.type,
    amount: current.amount,
  };
}

/**
 * El sorteo. Devuelve la casilla (1-100) y su categoría.
 *
 * `randomSource` es inyectable solo para poder forzar un resultado concreto en
 * pruebas; en producción siempre es Math.random.
 */
export function rollRoulette(randomSource: () => number = Math.random): RouletteSpinResult {
  const random = randomSource();
  const normalized = Number.isFinite(random) ? random : 0;
  // [0,1) → 1..100, y el clamp cubre el borde exacto de 1.0.
  const rawSlot = Math.floor(normalized * 100) + 1;
  const slot = Math.min(100, Math.max(1, rawSlot));
  const category = SLOT_TABLE[slot - 1];

  return {
    slot,
    category,
    rewardLabel: REWARD_LABELS[category],
  };
}

export function categoryToLabel(category: RouletteCategory): string {
  return REWARD_LABELS[category];
}
