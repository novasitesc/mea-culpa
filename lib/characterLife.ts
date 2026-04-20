import type { SupabaseClient } from "@supabase/supabase-js";

export type OwnedAliveResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

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

  if (String((data as any).estado_vida ?? "vivo") === "muerto") {
    return {
      ok: false,
      status: 409,
      error: "Este personaje está muerto y no puede realizar acciones",
    };
  }

  return { ok: true };
}

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
