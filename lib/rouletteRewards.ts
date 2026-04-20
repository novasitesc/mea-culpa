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
    .select("id, categoria, tipo_recompensa, etiqueta, oro_monto, objeto_id, objeto_cantidad, activo, creado_en, objetos:objeto_id(nombre, icono)")
    .eq("categoria", category)
    .eq("activo", true)
    .order("creado_en", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => {
    const objectRow = Array.isArray(row.objetos) ? row.objetos[0] : row.objetos;
    return {
      id: row.id,
      categoria: row.categoria,
      tipo_recompensa: row.tipo_recompensa,
      etiqueta: row.etiqueta,
      oro_monto: row.oro_monto,
      objeto_id: row.objeto_id,
      objeto_cantidad: row.objeto_cantidad,
      activo: row.activo,
      creado_en: row.creado_en,
      objetos: objectRow
        ? {
            nombre: objectRow.nombre ?? null,
            icono: objectRow.icono ?? null,
          }
        : null,
    } satisfies RoulettePrizePoolRow;
  });
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
