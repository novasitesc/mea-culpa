// Aplicadores de efectos: la diferencia entre tirada personal y de partida no es
// la resolución (engine.ts), es quién paga y cómo se entrega/registra.
import type { SupabaseClient } from "@supabase/supabase-js";
import { modifyGold } from "../goldService";
import { asignarItem } from "../asignarItem";
import { outcomeToLutResult } from "./engine";
import type { DiceOutcome, ObjetoInfo, RewardConfig } from "./engine";

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

export type PartidaAwarderOpts = {
  db: SupabaseClient;
  config: RewardConfig;
  objetos: Map<number, ObjetoInfo>;
  partidaId: string;
  personajeId: number;
  personajeNombre: string;
  targetUserId: string;
  adminId: string;
};

/** Tirada en partida: el DM no paga; oro vía RPC con admin, ítems a la bolsa
 *  real del personaje (respetando cantidad), log en partidas_eventos. */
export function partidaAwarder(opts: PartidaAwarderOpts): DiceAwarder {
  const { db, config, objetos, partidaId, personajeId, personajeNombre, targetUserId, adminId } = opts;
  return {
    async chargeGold() {
      // Nadie paga en la sala (hideCost).
    },
    async awardGold(cantidad) {
      await db.rpc("modificar_oro", {
        p_usuario_id: targetUserId,
        p_delta: cantidad,
        p_concepto: `partida_sala:${partidaId}`,
        p_referencia: partidaId,
        p_admin_id: adminId,
      });
    },
    async awardItem(objetoId, cantidad) {
      await asignarItem({ db, partidaId, personajeId, usuarioId: targetUserId, adminId, objetoId, cantidad });
    },
    async logAll(outcomes) {
      const rows = outcomes.map((o) => {
        const efectivo = o.kind === "subtabla" ? o.premio : o;
        const objeto = efectivo.kind === "item" ? objetos.get(efectivo.objetoId) : undefined;
        return {
          partida_id: partidaId,
          tipo: "dado_tirado",
          personaje_id: personajeId,
          personaje_nombre: personajeNombre,
          usuario_id: targetUserId,
          tipo_dado: config.tipo === "lut" ? "d20" : config.tipoDado,
          recompensa_nombre: config.nombre,
          tipo_resultado: o.kind,
          objeto_id: objeto ? String(objeto.id) : null,
          objeto_nombre: objeto?.nombre ?? null,
          objeto_icono: objeto?.icono ?? null,
          cantidad: efectivo.kind === "item" ? efectivo.cantidad : null,
          cantidad_oro: efectivo.kind === "oro" ? efectivo.cantidad : null,
          metadata:
            config.tipo === "lut"
              ? outcomeToLutResult(config, o, objetos)
              : { resultados: o.kind === "oro" ? (o.caras ?? [o.cara]) : [o.cara] },
        };
      });
      if (rows.length > 0) {
        const { error } = await db.from("partidas_eventos").insert(rows);
        if (error) console.error("[dados/apply] partidas_eventos insert error:", error);
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
