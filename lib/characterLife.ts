// Estado de vida del personaje: el guardián que usan casi todas las acciones.
//
// Un personaje tiene una columna `estado_vida` con tres valores posibles:
//   · "vivo"      → puede actuar con normalidad
//   · "muerto"    → congelado; solo revive pagando (PayPal) o por un admin
//   · "eliminado" / "enterrado" → borrado definitivo, no vuelve
//
// Muerte y resurrección NO se escriben aquí a mano: se delegan en funciones RPC
// de Postgres (`marcar_personaje_muerto`, `revivir_personaje`) para que el
// cambio de estado y su registro en el historial ocurran en una sola
// transacción y no puedan quedar a medias.
import type { SupabaseClient } from "@supabase/supabase-js";

export type OwnedAliveResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Verifica de una vez las dos preguntas que toda acción necesita responder:
 * ¿este personaje es del usuario que llama? ¿y está vivo?
 *
 * Comprobar la propiedad es lo que impide que alguien mande el `characterId` de
 * otro jugador y actúe en su nombre. El `status` que devuelve es el HTTP que la
 * ruta debe responder (403 no es tuyo, 409 muerto, 410 eliminado).
 */
export async function ensureOwnedAliveCharacter(
  db: SupabaseClient,
  userId: string,
  characterId: number,
): Promise<OwnedAliveResult> {
  const { data, error } = await db
    .from("personajes")
    .select("id, estado_vida")
    .eq("id", characterId)
    .eq("usuario_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  if (!data) {
    return { ok: false, status: 403, error: "Personaje no válido" };
  }

  const estado = String((data as any).estado_vida ?? "vivo");

  if (estado === "muerto") {
    return {
      ok: false,
      status: 409,
      error: "Este personaje está muerto y no puede realizar acciones",
    };
  }

  if (estado === "eliminado" || estado === "enterrado") {
    return {
      ok: false,
      status: 410,
      error: "Este personaje fue eliminado permanentemente",
    };
  }

  return { ok: true };
}

/**
 * ¿Le queda al usuario al menos un personaje vivo?
 *
 * Regla del juego: con todos los personajes muertos la cuenta queda encerrada
 * en el Perfil (sin ruleta, sin partidas). Esto lo comprueban las rutas que no
 * apuntan a un personaje concreto, como la tirada de ruleta.
 */
export async function userHasAnyAliveCharacter(
  db: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; hasAlive: boolean; error?: string }> {
  const { data, error } = await db
    .from("personajes")
    .select("id")
    .eq("usuario_id", userId)
    .eq("estado_vida", "vivo")
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, hasAlive: false, error: error.message };
  }

  return { ok: true, hasAlive: Boolean(data?.id) };
}

/**
 * Mata un personaje. `reason` es la causa ("impuesto_impago", "muerte_en_partida"…)
 * y `metadata` guarda el contexto libre que luego se ve en el historial de muertes.
 *
 * La RPC hace el trabajo real: cambia `estado_vida` e inserta la fila en
 * `personajes_historial_vida` de forma atómica.
 */
export async function markCharacterDead(params: {
  db: SupabaseClient;
  userId: string;
  characterId: number;
  reason: string;
  partidaId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const { db, userId, characterId, reason, partidaId = null, metadata = {} } = params;

  const { error } = await db.rpc("marcar_personaje_muerto", {
    p_personaje_id: characterId,
    p_usuario_id: userId,
    p_motivo: reason,
    p_partida_id: partidaId,
    p_metadata: metadata,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Revive un personaje muerto. Dos caminos llegan aquí: el pago de PayPal
 * (entonces `paymentId` apunta a la fila de `pagos_paypal`) o un admin desde el
 * panel (`paymentId` null).
 */
export async function reviveCharacter(params: {
  db: SupabaseClient;
  userId: string;
  characterId: number;
  reason: string;
  paymentId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const { db, userId, characterId, reason, paymentId = null, metadata = {} } = params;

  const { error } = await db.rpc("revivir_personaje", {
    p_personaje_id: characterId,
    p_usuario_id: userId,
    p_motivo: reason,
    p_pago_id: paymentId,
    p_metadata: metadata,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
