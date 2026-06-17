/**
 * Mapeo de clases de personaje a sus retratos permitidos
 * Las claves soportan tanto nombres en inglés como en español (sin acentos).
 */
export const CHARACTER_PORTRAITS_BY_CLASS: Record<string, string> = {
  barbarian: "/characters/barbaro.webp",
  barbaro: "/characters/barbaro.webp",

  bard: "/characters/bardo.webp",
  bardo: "/characters/bardo.webp",

  warlock: "/characters/brujo.webp",
  brujo: "/characters/brujo.webp",

  cleric: "/characters/clerigo.webp",
  clerigo: "/characters/clerigo.webp",

  druid: "/characters/druida.webp",
  druida: "/characters/druida.webp",

  ranger: "/characters/explorador.webp",
  explorador: "/characters/explorador.webp",

  fighter: "/characters/guerrero.webp",
  guerrero: "/characters/guerrero.webp",

  sorcerer: "/characters/hechicero.webp",
  hechicero: "/characters/hechicero.webp",

  wizard: "/characters/mago.webp",
  mago: "/characters/mago.webp",

  monk: "/characters/monje.webp",
  monje: "/characters/monje.webp",

  paladin: "/characters/paladin.webp",

  rogue: "/characters/picaro.webp",
  picaro: "/characters/picaro.webp",
};

/**
 * Retrato por defecto si la clase no existe o es vacía
 */
export const DEFAULT_CHARACTER_PORTRAIT = "/characters/profileplaceholder.webp";

/**
 * Normaliza el nombre de la clase para búsqueda consistente
 * - Convierte a minúsculas
 * - Elimina acentos y diacríticos
 * - Recorta espacios
 */
export function normalizeCharacterClass(value?: string | null): string | null {
  if (!value) return null;
  
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Obtiene el retrato correspondiente a una clase de personaje
 * Si la clase no existe o es vacía, retorna el retrato por defecto
 */
export function getCharacterPortraitByClass(characterClass?: string | null): string {
  const normalizedClass = normalizeCharacterClass(characterClass);

  if (!normalizedClass) {
    return DEFAULT_CHARACTER_PORTRAIT;
  }

  return CHARACTER_PORTRAITS_BY_CLASS[normalizedClass] ?? DEFAULT_CHARACTER_PORTRAIT;
}
