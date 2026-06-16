export type CasterType = "prepared" | "known" | "none";

// Obtiene el modificador de un stat
export function getStatModifier(stat: number): number {
  return Math.floor((stat - 10) / 2);
}

// Clasificación de clases
export function getCasterType(className: string): CasterType {
  const prepared = ["Clérigo", "Druida", "Paladín", "Mago"];
  const known = ["Bardo", "Hechicero", "Brujo", "Explorador", "Pícaro", "Guerrero"]; // Asumiendo Pícaro=Arcane Trickster, Guerrero=Eldritch Knight si tienen conjuros

  if (prepared.includes(className)) return "prepared";
  if (known.includes(className)) return "known";
  return "none";
}

// Cálculo para lanzadores preparados
export function getPreparedSpellsCount(className: string, level: number, stats: Record<string, number>): number {
  if (className === "Clérigo") return Math.max(1, level + getStatModifier(stats.wis || 10));
  if (className === "Druida") return Math.max(1, level + getStatModifier(stats.wis || 10));
  if (className === "Paladín") return Math.max(1, Math.floor(level / 2) + getStatModifier(stats.chr || 10));
  if (className === "Mago") return Math.max(1, level + getStatModifier(stats.int || 10));
  return 0;
}

// Topes para lanzadores de conocidos (D&D 5e 2014)
export function getMaxKnownSpells(className: string, level: number): number {
  const l = Math.min(Math.max(1, level), 20);

  if (className === "Bardo") {
    const table = [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22];
    return table[l];
  }
  if (className === "Hechicero") {
    const table = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15];
    return table[l];
  }
  if (className === "Brujo") {
    const table = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];
    return table[l];
  }
  if (className === "Explorador") {
    const table = [0, 0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11];
    return table[l];
  }
  if (className === "Pícaro") { // Arcane Trickster
    const table = [0, 0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
    return Math.min(13, table[l]); // Capped at 13 based on prompt
  }
  if (className === "Guerrero") { // Eldritch Knight
    const table = [0, 0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
    return Math.min(13, table[l]); // Capped at 13 based on prompt
  }

  return 0;
}
