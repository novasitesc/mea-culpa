// Tipos compartidos para personajes
// Estos tipos serán usados tanto en frontend como en backend

export type ItemType =
  | "cabeza"
  | "armadura"
  | "pecho"
  | "guante"
  | "botas"
  | "collar"
  | "anillo"
  | "amuleto"
  | "cinturón"
  | "arma"
  | "gema";

export type Item = {
  name: string;
  type: ItemType;
};

export type ArmorSlots = {
  cabeza?: string;
  armadura?: string;
  pecho?: string;
  guante?: string;
  botas?: string;
};

export type AccessorySlots = {
  collar?: string;
  anillo1?: string;
  anillo2?: string;
  anillo3?: string;
  amuleto?: string;
  cinturon?: string;
};

export type WeaponSlots = {
  manoIzquierda?: string;
  manoDerecha?: string;
};

export type CharacterStats = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  chr: number;
};

export type Bag = {
  items: Item[];
  maxSlots: number;
};

export type ClassEntry = {
  className: string;
  level: number;
};

export type Character = {
  id: number;
  userId: string;
  name: string;
  multiclass: ClassEntry[]; // máximo 3 clases
  race: string;
  alignment: string;
  portrait: string;
  stats: CharacterStats;
  armor: ArmorSlots;
  accessories: AccessorySlots;
  weapons: WeaponSlots;
  bag: Bag;
};

export type CreateCharacterInput = {
  name: string;
  race: string;
  multiclass: ClassEntry[];
  alignment: string;
};

export type UpdateCharacterEquipmentInput = {
  armor?: ArmorSlots;
  accessories?: AccessorySlots;
  weapons?: WeaponSlots;
  bag?: Bag;
};

// Constantes útiles
export const MAX_CHARACTERS_PER_USER = 5;
export const BASE_BAG_SLOTS = 10;

// Cada 2 puntos de fuerza otorgan +1 espacio sobre una base de 10.
export function calculateBagSlots(strength: number): number {
  const strModifier = Math.floor((strength - 10) / 2);
  const slots = BASE_BAG_SLOTS + strModifier;
  return slots > 0 ? slots : BASE_BAG_SLOTS;
}
