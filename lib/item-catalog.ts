export const ITEM_TYPE_OPTIONS = [
  "cabeza",
  "armadura",
  "guante",
  "botas",
  "collar",
  "anillo",
  "amuleto",
  "cinturón",
  "arma",
  "gema-arma",
  "gema-capa",
  "consumible",
  "ingrediente",
  "misc",
  "capa",
] as const;

export const ITEM_RARITY_OPTIONS = [
  "común",
  "poco común",
  "raro",
  "épico",
  "legendario",
] as const;

export type ItemRarity = (typeof ITEM_RARITY_OPTIONS)[number];

export const ITEM_RARITY_COLORS: Record<ItemRarity, string> = {
  común: "text-muted-foreground border-border",
  "poco común": "text-green-400 border-green-800",
  raro: "text-blue-400 border-blue-800",
  épico: "text-purple-400 border-purple-800",
  legendario: "text-gold border-gold-dim",
};

/** Hex de cada rareza, para halos y bordes que se pintan con style inline. */
export const ITEM_RARITY_HEX: Record<ItemRarity, string> = {
  común: "#94a3b8",
  "poco común": "#4ade80",
  raro: "#60a5fa",
  épico: "#c084fc",
  legendario: "#d4af37",
};

export const ITEM_RARITY_BADGES: Record<ItemRarity, string> = {
  común: "bg-secondary text-muted-foreground",
  "poco común": "bg-green-900/50 text-green-400",
  raro: "bg-blue-900/50 text-blue-400",
  épico: "bg-purple-900/50 text-purple-400",
  legendario: "bg-gold/10 text-gold",
};