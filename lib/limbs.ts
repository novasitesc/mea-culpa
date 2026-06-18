export const LIMBS = [
  { key: "brazo_izquierdo", label: "Brazo izquierdo" },
  { key: "brazo_derecho", label: "Brazo derecho" },
  { key: "pie_izquierdo", label: "Pie izquierdo" },
  { key: "pie_derecho", label: "Pie derecho" },
] as const;

export type LimbKey = (typeof LIMBS)[number]["key"];
