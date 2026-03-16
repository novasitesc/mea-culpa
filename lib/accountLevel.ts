export const MIN_ACCOUNT_LEVEL = 1;
export const MAX_ACCOUNT_LEVEL = 4;

const ACCOUNT_LEVEL_TITLES: Record<number, string> = {
  1: "Aventuero Iniciado",
  2: "Aventurero Exprimentado",
  3: "Aventurero Maestro",
  4: "Aventurero Legenda",
};

export function normalizeAccountLevel(level: unknown): number {
  const parsed = Number(level);
  if (!Number.isFinite(parsed)) return MIN_ACCOUNT_LEVEL;

  const intLevel = Math.trunc(parsed);
  return Math.min(MAX_ACCOUNT_LEVEL, Math.max(MIN_ACCOUNT_LEVEL, intLevel));
}

export function getAccountLevelTitle(level: unknown): string {
  const normalizedLevel = normalizeAccountLevel(level);
  return ACCOUNT_LEVEL_TITLES[normalizedLevel] ?? ACCOUNT_LEVEL_TITLES[MIN_ACCOUNT_LEVEL];
}