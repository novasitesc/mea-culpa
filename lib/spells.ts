export type CasterType = "prepared" | "known" | "none";

// Estructura de un conjuro conocido con su nivel
export type SpellEntry = { name: string; spellLevel: number };

// Normaliza datos legacy (string[]) al nuevo formato SpellEntry[]
export function normalizeSpells(raw: unknown): SpellEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    if (typeof item === "string") return { name: item, spellLevel: 1 };
    if (item && typeof item === "object" && "name" in item) {
      const obj = item as Record<string, unknown>;
      return {
        name: String(obj.name ?? ""),
        spellLevel: Number(obj.spellLevel ?? 1),
      };
    }
    return { name: String(item), spellLevel: 1 };
  }).filter(s => s.name.trim().length > 0);
}

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

// Nivel máximo de conjuro accesible por clase y nivel de personaje (D&D 5e 2014)
export function getMaxSpellLevel(className: string, level: number): number {
  const l = Math.min(Math.max(1, level), 20);

  // Full casters: Bardo, Hechicero, Clérigo, Druida, Mago
  if (["Bardo", "Hechicero", "Clérigo", "Druida", "Mago"].includes(className)) {
    if (l >= 17) return 9;
    if (l >= 15) return 8;
    if (l >= 13) return 7;
    if (l >= 11) return 6;
    if (l >= 9) return 5;
    if (l >= 7) return 4;
    if (l >= 5) return 3;
    if (l >= 3) return 2;
    return 1;
  }
  // Half casters: Paladín, Explorador
  if (["Paladín", "Explorador"].includes(className)) {
    if (l >= 17) return 5;
    if (l >= 13) return 4;
    if (l >= 9) return 3;
    if (l >= 5) return 2;
    if (l >= 2) return 1;
    return 0;
  }
  // Warlock (Pact Magic, slots hasta nivel 5)
  if (className === "Brujo") {
    if (l >= 9) return 5;
    if (l >= 7) return 4;
    if (l >= 5) return 3;
    if (l >= 3) return 2;
    return 1;
  }
  // Third casters: Pícaro (Arcane Trickster), Guerrero (Eldritch Knight)
  if (["Pícaro", "Guerrero"].includes(className)) {
    if (l >= 19) return 4;
    if (l >= 13) return 3;
    if (l >= 7) return 2;
    if (l >= 3) return 1;
    return 0;
  }
  return 0;
}

// Distribución máxima teórica de conjuros por nivel de conjuro (caps del MD)
export function getSpellDistributionCaps(className: string): Record<number, number> {
  switch (className) {
    case "Bardo":
      return { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 7: 3, 8: 4, 9: 5 };
    case "Hechicero":
      return { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 3, 9: 3 };
    case "Explorador":
      return { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4 };
    case "Pícaro": // Arcane Trickster
      return { 1: 1, 2: 2, 3: 4, 4: 6 };
    case "Guerrero": // Eldritch Knight
      return { 1: 1, 2: 2, 3: 4, 4: 6 };
    case "Brujo":
      return { 1: 1, 2: 1, 3: 1, 4: 2, 5: 10 };
    default:
      return {};
  }
}

// Mystic Arcanum del Brujo: 1 conjuro de cada nivel 6-9 según nivel de personaje
export function getMysticArcanumCaps(level: number): Record<number, number> {
  const caps: Record<number, number> = {};
  if (level >= 11) caps[6] = 1;
  if (level >= 13) caps[7] = 1;
  if (level >= 15) caps[8] = 1;
  if (level >= 17) caps[9] = 1;
  return caps;
}

// Mínimo de conjuros garantizados del Mago por nivel (6 iniciales + 2 por nivel)
export function getWizardMinSpells(level: number): number {
  if (level < 1) return 0;
  return 6 + (Math.min(level, 20) - 1) * 2;
}

// Distribución mínima garantizada del Mago por nivel de conjuro
export function getWizardDistribution(): Record<number, number> {
  return { 1: 6, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 6 };
}

// ---------- Validación integral de conjuros ----------

export type SpellValidationResult = { valid: boolean; errors: string[] };

export function validateSpells(
  className: string,
  level: number,
  spells: SpellEntry[],
): SpellValidationResult {
  const errors: string[] = [];
  const casterType = getCasterType(className);

  if (casterType === "none") {
    if (spells.length > 0) errors.push(`${className} no puede lanzar conjuros.`);
    return { valid: errors.length === 0, errors };
  }

  const maxSpellLv = getMaxSpellLevel(className, level);

  // --- Duplicados ---
  const seen = new Set<string>();
  for (const s of spells) {
    const key = s.name.toLowerCase().trim();
    if (seen.has(key)) errors.push(`Conjuro duplicado: "${s.name}".`);
    seen.add(key);
  }

  // --- Nivel de conjuro válido y accesible ---
  const isWarlock = className === "Brujo";
  const arcanumCaps = isWarlock ? getMysticArcanumCaps(level) : {};

  for (const s of spells) {
    if (s.spellLevel < 1 || s.spellLevel > 9) {
      errors.push(`"${s.name}" tiene nivel inválido (${s.spellLevel}).`);
      continue;
    }
    if (isWarlock && s.spellLevel > 5) {
      // Mystic Arcanum: validar acceso al nivel
      if (!arcanumCaps[s.spellLevel]) {
        errors.push(
          `"${s.name}" (nv ${s.spellLevel}): Brujo nivel ${level} no tiene acceso a Mystic Arcanum de nivel ${s.spellLevel}.`,
        );
      }
    } else if (s.spellLevel > maxSpellLv) {
      errors.push(
        `"${s.name}" (nv ${s.spellLevel}): ${className} nivel ${level} solo accede hasta nivel ${maxSpellLv}.`,
      );
    }
  }

  // --- Validaciones para lanzadores de conocidos ---
  if (casterType === "known") {
    // Separar conjuros regulares de Mystic Arcanum (Brujo)
    const regularSpells = isWarlock ? spells.filter(s => s.spellLevel <= 5) : spells;
    const arcanumSpells = isWarlock ? spells.filter(s => s.spellLevel > 5) : [];

    // Tope total de conocidos
    const maxKnown = getMaxKnownSpells(className, level);
    if (regularSpells.length > maxKnown) {
      errors.push(
        `Excede el máximo de conjuros conocidos: ${regularSpells.length}/${maxKnown}.`,
      );
    }

    // Distribución por nivel de conjuro (caps del MD)
    const distCaps = getSpellDistributionCaps(className);
    const countByLevel: Record<number, number> = {};
    for (const s of regularSpells) {
      countByLevel[s.spellLevel] = (countByLevel[s.spellLevel] || 0) + 1;
    }
    for (const [lvStr, count] of Object.entries(countByLevel)) {
      const sl = Number(lvStr);
      const cap = distCaps[sl];
      if (cap !== undefined && count > cap) {
        errors.push(
          `Excede el máximo de conjuros de nivel ${sl}: ${count}/${cap}.`,
        );
      }
    }

    // Mystic Arcanum del Brujo
    if (isWarlock) {
      for (let sl = 6; sl <= 9; sl++) {
        const count = arcanumSpells.filter(s => s.spellLevel === sl).length;
        const cap = arcanumCaps[sl] || 0;
        if (count > cap) {
          errors.push(`Mystic Arcanum nivel ${sl}: ${count}/${cap}.`);
        }
      }
    }
  }

  // --- Validaciones para Mago (libro de conjuros) ---
  if (className === "Mago") {
    // El Mago no tiene límite práctico superior (puede copiar), pero validamos
    // que los niveles de conjuro sean accesibles (ya cubierto arriba).
    // No se aplican caps de distribución ya que puede copiar ilimitadamente.
  }

  return { valid: errors.length === 0, errors };
}
