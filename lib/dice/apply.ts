// Aplicadores de efectos: la diferencia entre tirada personal y de partida no es
// la resolución (engine.ts), es quién paga y cómo se entrega/registra.
import type { SupabaseClient } from "@supabase/supabase-js";
import { modifyGold } from "../goldService";
import type { DiceOutcome, RewardConfig } from "./engine";

export type DiceAwarder = {
  /** Cobra el costo total por adelantado; lanza "Oro insuficiente" si no alcanza. */
  chargeGold(total: number): Promise<void>;
  awardGold(cantidad: number): Promise<void>;
  awardItem(objetoId: number, cantidad: number): Promise<void>;
  /** Registro en batch: dados_historial o partidas_eventos según contexto. */
  logAll(outcomes: DiceOutcome[]): Promise<void>;
};

/** Recorre los outcomes (incluidos premios anidados de subtabla) aplicando efectos y log. */
export async function applyOutcomes(outcomes: DiceOutcome[], awarder: DiceAwarder): Promise<void> {
  for (const o of outcomes) {
    const efectivo = o.kind === "subtabla" ? o.premio : o;
    if (efectivo.kind === "oro" && efectivo.cantidad > 0) {
      await awarder.awardGold(efectivo.cantidad);
    } else if (efectivo.kind === "item") {
      await awarder.awardItem(efectivo.objetoId, efectivo.cantidad);
    }
  }
  await awarder.logAll(outcomes);
}

/** Tirada personal: oro real del usuario, log en dados_historial (batch). */
export function personalAwarder(
  db: SupabaseClient,
  userId: string,
  config: RewardConfig,
): DiceAwarder {
  return {
    async chargeGold(total) {
      if (total > 0) await modifyGold(userId, -total, "dado_costo");
    },
    async awardGold(cantidad) {
      await modifyGold(userId, cantidad, "dado_recompensa_oro");
    },
    async awardItem() {
      // La entrega real a la bolsa llega con la RPC transaccional (dados_ejecutar_tirada).
    },
    async logAll(outcomes) {
      const rows = outcomes.map((o) => historialRow(userId, config, o));
      if (rows.length > 0) {
        const { error } = await db.from("dados_historial").insert(rows);
        if (error) console.error("[dados/apply] historial insert error:", error);
      }
    },
  };
}

function historialRow(userId: string, config: RewardConfig, o: DiceOutcome) {
  const base = {
    usuario_id: userId,
    recompensa_id: config.id,
    costo_pagado: config.costoOro,
    objeto_id: null as number | null,
    cantidad_objeto: null as number | null,
    cantidad_oro: null as number | null,
  };
  switch (o.kind) {
    case "nada":
      return { ...base, resultados_dados: [o.cara], tipo_resultado: "nada" };
    case "item":
      return {
        ...base,
        resultados_dados: [o.cara],
        tipo_resultado: "item",
        objeto_id: o.objetoId,
        cantidad_objeto: o.cantidad,
      };
    case "oro":
      return {
        ...base,
        resultados_dados: o.caras ?? [o.cara],
        tipo_resultado: "oro",
        cantidad_oro: o.cantidad,
      };
    case "subtabla": {
      const p = o.premio;
      return {
        ...base,
        resultados_dados: [o.cara, o.subCara],
        tipo_resultado: p.kind === "oro" ? "oro" : "subtabla",
        objeto_id: p.kind === "item" ? p.objetoId : null,
        cantidad_objeto: p.kind === "item" ? p.cantidad : null,
        cantidad_oro: p.kind === "oro" ? p.cantidad : null,
      };
    }
  }
}
