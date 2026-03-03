// Tipos compartidos para personajes
// Estos tipos serán usados tanto en frontend como en backend

export type ItemType = 
  | "cabeza" 
  | "pecho" 
  | "guante" 
  | "botas" 
  | "collar" 
  | "anillo" 
  | "amuleto" 
  | "arma";

export type Item = {
  name: string;
  type: ItemType;
};

export type ArmorSlots = {
  cabeza?: string;
  pecho?: string;
  guante?: string;
  botas?: string;
};

export type AccessorySlots = {
  collar?: string;
  anillo1?: string;
  anillo2?: string;
  amuleto?: string;
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

export type Character = {
  id: number;
  userId: string;
  name: string;
  className: string;
  race: string;
  alignment: string;
  background: string;
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
  className: string;
  background: string;
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

// Función helper para calcular slots de bolsa
export function calculateBagSlots(constitution: number): number {
  const conModifier = Math.floor((constitution - 10) / 2);
  const slots = BASE_BAG_SLOTS + conModifier;
  return slots > 0 ? slots : BASE_BAG_SLOTS;
}
