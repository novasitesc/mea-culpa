export const LIMBS = [
  { key: "cabeza", label: "Cabeza" },
  { key: "brazo_izquierdo", label: "Brazo izquierdo" },
  { key: "brazo_derecho", label: "Brazo derecho" },
  { key: "mano_izquierda", label: "Mano izquierda" },
  { key: "mano_derecha", label: "Mano derecha" },
  { key: "pierna_izquierda", label: "Pierna izquierda" },
  { key: "pierna_derecha", label: "Pierna derecha" },
  { key: "pie_izquierdo", label: "Pie izquierdo" },
  { key: "pie_derecho", label: "Pie derecho" },
  { key: "torso", label: "Torso" },
] as const;

export type LimbKey = (typeof LIMBS)[number]["key"];
