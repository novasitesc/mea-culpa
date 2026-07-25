// Carga de configuración de recompensas para el motor: 2 queries constantes
// (recompensa+sublista+caras LUT, y las subtablas referidas), sin N+1.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ObjetoInfo, RewardConfig } from "./engine";
import type { LutCara, SublistaItem, SubtablaCara } from "../types/dados";

// Validación compartida por las dos rutas de roll (antes duplicada).
// cantidad inválida cae a 1 (misma tolerancia que el código anterior).
export const rollBodySchema = z.object({
  recompensa_id: z.number().int().positive(),
  cantidad: z.number().int().min(1).max(10).catch(1),
  personaje_id: z.number().int().positive().optional(),
  // Idempotencia: el cliente genera un UUID por tirada; sin él, el servidor crea uno.
  roll_id: z.string().uuid().optional(),
});

type LutCaraRow = {
  numero_cara: number;
  tipo: string;
  oro_min: number | null;
  oro_max: number | null;
  objeto_id: number | null;
  cantidad_min: number | null;
  cantidad_max: number | null;
  subtabla_id: number | null;
};

type SubtablaCaraRow = {
  numero_cara: number;
  tipo: string;
  objeto_id: number | null;
  cantidad_min: number | null;
  cantidad_max: number | null;
  oro_min: number | null;
  oro_max: number | null;
};

/** Recompensa activa con todas sus caras resueltas, o null si no existe. */
export async function loadRewardConfig(
  db: SupabaseClient,
  recompensaId: number,
): Promise<RewardConfig | null> {
  const { data: r, error } = await db
    .from("dados_recompensas")
    .select(
      `id, nombre, tipo, tipo_dado, costo_oro, objeto_id, cantidad_dados, multiplicador_oro,
       dados_sublista_items(objeto_id, valor_min, valor_max),
       dados_lut_caras!recompensa_id(numero_cara, tipo, oro_min, oro_max, objeto_id, cantidad_min, cantidad_max, subtabla_id)`,
    )
    .eq("id", recompensaId)
    .eq("activo", true)
    .maybeSingle();

  if (error || !r) {
    if (error) console.error("[dados/load] recompensa query error:", error);
    return null;
  }

  const lutRows = ((r as any).dados_lut_caras ?? []) as LutCaraRow[];

  const subtablaIds = [
    ...new Set(lutRows.map((c) => c.subtabla_id).filter((x): x is number => x != null)),
  ];
  const subtablas: RewardConfig["subtablas"] = {};
  if (subtablaIds.length > 0) {
    const { data: subs } = await db
      .from("dados_recompensas")
      .select(
        `id, nombre,
         dados_subtabla_caras(numero_cara, tipo, objeto_id, cantidad_min, cantidad_max, oro_min, oro_max)`,
      )
      .in("id", subtablaIds);

    for (const s of (subs ?? []) as any[]) {
      subtablas[s.id] = {
        nombre: s.nombre,
        caras: ((s.dados_subtabla_caras ?? []) as SubtablaCaraRow[]).map((c) => ({
          numeroCara: c.numero_cara,
          tipo: (c.tipo ?? "nada") as "nada" | "item" | "oro",
          objetoId: c.objeto_id,
          cantidadMin: c.cantidad_min ?? 1,
          cantidadMax: c.cantidad_max ?? 1,
          oroMin: c.oro_min ?? 0,
          oroMax: c.oro_max ?? 0,
        })),
      };
    }
  }

  return {
    id: (r as any).id,
    nombre: (r as any).nombre,
    tipo: (r as any).tipo,
    tipoDado: (r as any).tipo_dado,
    costoOro: (r as any).costo_oro ?? 0,
    objetoId: (r as any).objeto_id ?? null,
    cantidadDados: (r as any).cantidad_dados ?? 1,
    multiplicadorOro: (r as any).multiplicador_oro ?? 1,
    sublista: (((r as any).dados_sublista_items ?? []) as any[]).map((s) => ({
      objetoId: s.objeto_id,
      valorMin: s.valor_min,
      valorMax: s.valor_max,
    })),
    lutCaras: lutRows.map((c) => ({
      numeroCara: c.numero_cara,
      tipo: c.tipo as RewardConfig["lutCaras"][number]["tipo"],
      oroMin: c.oro_min ?? 0,
      oroMax: c.oro_max ?? 0,
      objetoId: c.objeto_id,
      cantidadMin: c.cantidad_min ?? 1,
      cantidadMax: c.cantidad_max ?? 1,
      subtablaId: c.subtabla_id,
    })),
    subtablas,
  };
}

// ── Mapeos snake→camel compartidos por /api/dados/config y /api/dados/admin ──

const embedded = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { id?: number; nombre?: string; icono?: string } | null;

export function mapLutCaraRows(rows: any[]): LutCara[] {
  return rows
    .map((c: any): LutCara => {
      const obj = embedded(c.objeto);
      const sub = embedded(c.subtabla);
      return {
        id: c.id,
        recompensaId: c.recompensa_id,
        numeroCara: c.numero_cara,
        tipo: c.tipo,
        oroMin: c.oro_min ?? 0,
        oroMax: c.oro_max ?? 0,
        objetoId: c.objeto_id ?? null,
        objetoNombre: obj?.nombre ?? null,
        objetoIcono: obj?.icono ?? null,
        cantidadMin: c.cantidad_min ?? 1,
        cantidadMax: c.cantidad_max ?? 1,
        subtablaId: c.subtabla_id ?? null,
        subtablaNombre: sub?.nombre ?? null,
      };
    })
    .sort((a, b) => a.numeroCara - b.numeroCara);
}

export function mapSubtablaCaraRows(rows: any[]): SubtablaCara[] {
  return rows
    .map((c: any): SubtablaCara => {
      const obj = embedded(c.objeto);
      return {
        id: c.id,
        recompensaId: c.recompensa_id,
        numeroCara: c.numero_cara,
        tipo: c.tipo ?? "nada",
        objetoId: c.objeto_id ?? null,
        objetoNombre: obj?.nombre ?? null,
        objetoIcono: obj?.icono ?? null,
        cantidadMin: c.cantidad_min ?? 1,
        cantidadMax: c.cantidad_max ?? 1,
        oroMin: c.oro_min ?? 0,
        oroMax: c.oro_max ?? 0,
      };
    })
    .sort((a, b) => a.numeroCara - b.numeroCara);
}

export function mapSublistaRows(rows: any[]): SublistaItem[] {
  return rows
    .map((si: any): SublistaItem => {
      const obj = embedded(si.objeto);
      return {
        id: si.id,
        objetoId: si.objeto_id,
        objetoNombre: obj?.nombre ?? "",
        objetoIcono: obj?.icono ?? "",
        valorMin: si.valor_min,
        valorMax: si.valor_max,
        orden: si.orden,
      };
    })
    .sort((a, b) => a.orden - b.orden);
}

/** Nombre/icono de los objetos premiados, en una sola query. */
export async function loadObjetos(
  db: SupabaseClient,
  ids: number[],
): Promise<Map<number, ObjetoInfo>> {
  if (ids.length === 0) return new Map();
  const { data } = await db.from("objetos").select("id, nombre, icono").in("id", ids);
  return new Map(
    ((data ?? []) as ObjetoInfo[]).map((o) => [o.id, { id: o.id, nombre: o.nombre, icono: o.icono }]),
  );
}
