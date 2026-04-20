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

const SLOT_TABLE: RouletteCategory[] = SLOT_COUNTS.flatMap(({ category, count }) =>
  Array.from({ length: count }, () => category),
);

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

export function getRouletteSlots(): RouletteCategory[] {
  return [...SLOT_TABLE];
}

export function getCostCycle(): RouletteCostStep[] {
  return COST_CYCLE.map((entry, index) => ({
    step: index + 1,
    type: entry.type,
    amount: entry.amount,
  }));
}

export function getNextSpinCost(totalSpins: number): RouletteCostStep {
  const index = ((totalSpins % COST_CYCLE.length) + COST_CYCLE.length) % COST_CYCLE.length;
  const current = COST_CYCLE[index];
  return {
    step: index + 1,
    type: current.type,
    amount: current.amount,
  };
}

export function rollRoulette(randomSource: () => number = Math.random): RouletteSpinResult {
  const random = randomSource();
  const normalized = Number.isFinite(random) ? random : 0;
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
