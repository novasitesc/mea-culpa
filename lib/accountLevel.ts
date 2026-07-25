// Nivel de CUENTA (1-4), que no es el nivel del personaje (ese llega a 20).
// El nivel de cuenta es el rango del jugador y solo da título; se guarda en
// `perfiles.nivel`.
export const MIN_ACCOUNT_LEVEL = 1;
export const MAX_ACCOUNT_LEVEL = 4;

const ACCOUNT_LEVEL_TITLES: Record<number, string> = {
  1: "Aventuero Iniciado",
  2: "Aventurero Exprimentado",
  3: "Aventurero Maestro",
  4: "Aventurero Legenda",
};

/**
 * Convierte cualquier cosa que venga de la base de datos en un nivel válido:
 * recorta al rango 1-4 y cae a 1 si no es un número. Así ninguna pantalla tiene
 * que defenderse de un nivel raro.
 */
export function normalizeAccountLevel(level: unknown): number {
  const parsed = Number(level);
  if (!Number.isFinite(parsed)) return MIN_ACCOUNT_LEVEL;

  const intLevel = Math.trunc(parsed);
  return Math.min(MAX_ACCOUNT_LEVEL, Math.max(MIN_ACCOUNT_LEVEL, intLevel));
}

/** Título visible del rango ("Aventurero Maestro"…) a partir del nivel. */
export function getAccountLevelTitle(level: unknown): string {
  const normalizedLevel = normalizeAccountLevel(level);
  return ACCOUNT_LEVEL_TITLES[normalizedLevel] ?? ACCOUNT_LEVEL_TITLES[MIN_ACCOUNT_LEVEL];
}