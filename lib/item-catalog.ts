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
  "gema",
  "consumible",
  "ingrediente",
  "misc",
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

export const ITEM_RARITY_BADGES: Record<ItemRarity, string> = {
  común: "bg-secondary text-muted-foreground",
  "poco común": "bg-green-900/50 text-green-400",
  raro: "bg-blue-900/50 text-blue-400",
  épico: "bg-purple-900/50 text-purple-400",
  legendario: "bg-gold/10 text-gold",
};