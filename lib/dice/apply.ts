// Aplicadores de efectos: la diferencia entre tirada personal y de partida no es
// la resolución (engine.ts), es quién paga, cómo se entrega y dónde se registra.
// Ambos delegan en la RPC dados_ejecutar_tirada: cobro + premios + registro en
// UNA transacción, idempotente por roll_id (reenviar devuelve lo ya persistido).
import type { SupabaseClient } from "@supabase/supabase-js";
import { outcomeToLutResult } from "./engine";
import type { DiceOutcome, ObjetoInfo, RewardConfig } from "./engine";
import type { RollResult } from "../types/dados";

export type Entrega = { objetoId: number; solicitada: number; entregada: number };

export type TiradaEjecutada = {
  replayed: boolean;
  resultado: RollResult;
  entregas: Entrega[];
};

export type DiceAwarder = {
  /** Aplica la tirada completa de forma atómica; con roll_id repetido no re-cobra ni re-premia. */
  execute(rollId: string, outcomes: DiceOutcome[]): Promise<TiradaEjecutada>;
};

type Efecto =
  | { tipo: "oro"; cantidad: number }
  | { tipo: "item"; objetoId: number; cantidad: number };

/** Premios efectivos a aplicar (el premio anidado de subtabla es el que cuenta). */
function flattenEfectos(outcomes: DiceOutcome[]): Efecto[] {
  const efectos: Efecto[] = [];
  for (const o of outcomes) {
    const e = o.kind === "subtabla" ? o.premio : o;
    if (e.kind === "oro" && e.cantidad > 0) efectos.push({ tipo: "oro", cantidad: e.cantidad });
    else if (e.kind === "item") efectos.push({ tipo: "item", objetoId: e.objetoId, cantidad: e.cantidad });
  }
  return efectos;
}

async function ejecutarRPC(db: SupabaseClient, params: Record<string, unknown>): Promise<TiradaEjecutada> {
  const { data, error } = await db.rpc("dados_ejecutar_tirada", params);
  if (error) throw new Error(error.message);
  const r = data as { replayed: boolean; resultado: RollResult; entregas: Entrega[] | null };
  return { replayed: !!r.replayed, resultado: r.resultado, entregas: r.entregas ?? [] };
}

/** Tirada personal: el usuario paga y recibe; log en dados_historial. */
export function personalAwarder(
  db: SupabaseClient,
  opts: {
    userId: string;
    personajeId: number | null; // null → los ítems no se entregan (la UI lo señala)
    config: RewardConfig;
    cantidad: number;
    resultado: RollResult;
  },
): DiceAwarder {
  const { userId, personajeId, config, cantidad, resultado } = opts;
  return {
    execute: (rollId, outcomes) =>
      ejecutarRPC(db, {
        p_roll_id: rollId,
        p_contexto: "personal",
        p_usuario_id: userId,
        p_personaje_id: personajeId,
        p_recompensa_id: config.id,
        p_cantidad: cantidad,
        p_costo_total: config.costoOro * (config.tipo === "lut" ? cantidad : 1),
        p_efectos: flattenEfectos(outcomes),
        p_resultado: resultado,
        p_logs: outcomes.map((o) => historialRow(config, o)),
      }),
  };
}

/** Tirada en partida: el DM no paga; oro y bolsa del personaje participante,
 *  log en partidas_eventos (una fila por tirada, como el feed espera). */
export function partidaAwarder(
  db: SupabaseClient,
  opts: {
    config: RewardConfig;
    objetos: Map<number, ObjetoInfo>;
    partidaId: string;
    personajeId: number;
    personajeNombre: string;
    targetUserId: string;
    adminId: string;
    cantidad: number;
    resultado: RollResult;
  },
): DiceAwarder {
  const { config, objetos, partidaId, personajeId, personajeNombre, targetUserId, adminId, cantidad, resultado } = opts;
  return {
    execute: (rollId, outcomes) =>
      ejecutarRPC(db, {
        p_roll_id: rollId,
        p_contexto: "partida",
        p_usuario_id: targetUserId,
        p_personaje_id: personajeId,
        p_recompensa_id: config.id,
        p_cantidad: cantidad,
        p_costo_total: 0,
        p_efectos: flattenEfectos(outcomes),
        p_resultado: resultado,
        p_logs: outcomes.map((o) => eventoRow(config, o, objetos, personajeNombre)),
        p_partida_id: partidaId,
        p_admin_id: adminId,
      }),
  };
}

function historialRow(config: RewardConfig, o: DiceOutcome) {
  const base = {
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

function eventoRow(
  config: RewardConfig,
  o: DiceOutcome,
  objetos: Map<number, ObjetoInfo>,
  personajeNombre: string,
) {
  const efectivo = o.kind === "subtabla" ? o.premio : o;
  const objeto = efectivo.kind === "item" ? objetos.get(efectivo.objetoId) : undefined;
  return {
    personaje_nombre: personajeNombre,
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
}
