import type { SupabaseClient } from "@supabase/supabase-js";
import type { RouletteCategory } from "@/lib/roulette";

export type RoulettePrizeType = "oro" | "objeto";

export type RoulettePrizePoolRow = {
  id: string;
  categoria: RouletteCategory;
  tipo_recompensa: RoulettePrizeType;
  etiqueta: string | null;
  oro_monto: number | null;
  objeto_id: number | null;
  objeto_cantidad: number | null;
  activo: boolean;
  orden: number;
  creado_en?: string | null;
  objetos?: {
    nombre: string | null;
    icono: string | null;
  } | null;
};

export type RoulettePrizeSelection = {
  poolId: string;
  category: RouletteCategory;
  type: RoulettePrizeType;
  label: string;
  goldAmount: number | null;
  objectId: number | null;
  objectQuantity: number;
  objectName: string | null;
  objectIcon: string | null;
};

export async function getActiveRoulettePool(
  db: SupabaseClient,
  category: RouletteCategory,
): Promise<RoulettePrizePoolRow[]> {
  const { data, error } = await db
    .from("ruleta_premios_pool")
    .select("id, categoria, tipo_recompensa, etiqueta, oro_monto, objeto_id, objeto_cantidad, activo, orden, creado_en, objetos:objeto_id(nombre, icono)")
    .eq("categoria", category)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("creado_en", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RoulettePrizePoolRow[];
}

export function pickRoulettePrize(
  pools: RoulettePrizePoolRow[],
): RoulettePrizePoolRow {
  if (pools.length === 0) {
    throw new Error("No hay premios configurados para esta categoria");
  }

  const index = Math.floor(Math.random() * pools.length);
  return pools[index];
}

export function resolveRoulettePrizeSelection(pool: RoulettePrizePoolRow): RoulettePrizeSelection {
  if (pool.tipo_recompensa === "oro") {
    const amount = Number(pool.oro_monto ?? 0);
    return {
      poolId: pool.id,
      category: pool.categoria,
      type: "oro",
      label: pool.etiqueta?.trim() || `Oro x${amount.toLocaleString("es-ES")}`,
      goldAmount: amount,
      objectId: null,
      objectQuantity: 0,
      objectName: null,
      objectIcon: null,
    };
  }

  return {
    poolId: pool.id,
    category: pool.categoria,
    type: "objeto",
    label: pool.etiqueta?.trim() || pool.objetos?.nombre?.trim() || "Objeto misterioso",
    goldAmount: null,
    objectId: Number(pool.objeto_id ?? 0) || null,
    objectQuantity: Number(pool.objeto_cantidad ?? 1) || 1,
    objectName: pool.objetos?.nombre ?? null,
    objectIcon: pool.objetos?.icono ?? null,
  };
}
