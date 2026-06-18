export const LIMBS = [
  { key: "brazo_izquierdo", label: "Brazo izquierdo" },
  { key: "brazo_derecho", label: "Brazo derecho" },
  { key: "pie_izquierdo", label: "Pie izquierdo" },
  { key: "pie_derecho", label: "Pie derecho" },
] as const;

export type LimbKey = (typeof LIMBS)[number]["key"];

export const VALID_LIMB_KEYS = new Set(LIMBS.map((l) => l.key));

export function applyLimbUpdate(
  current: Record<string, boolean> | null | undefined,
  miembro: string,
  desmembrado: boolean,
): Record<string, boolean> {
  const ex = { ...(current ?? {}) };
  if (desmembrado) {
    ex[miembro] = false;
  } else {
    delete ex[miembro];
  }
  return ex;
}
