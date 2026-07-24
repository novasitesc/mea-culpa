import type { SupabaseClient } from "@supabase/supabase-js";

// Partidas now start manually via DM action — no auto-transition
export async function syncPartidasInProgress(_db: any): Promise<void> {}

// Un personaje en expedición en curso no puede recibir objetos desde fuera de
// la sala (tienda, comercio P2P, bóveda del gremio); las recompensas del DM
// dentro de la sala no pasan por aquí.
export async function personajeEnExpedicion(
  db: SupabaseClient,
  personajeId: number,
): Promise<boolean> {
  const { data } = await db
    .from("partida_participantes")
    .select("partida:partida_id(estado)")
    .eq("personaje_id", personajeId);

  return (data ?? []).some((r: any) => r.partida?.estado === "en_progreso");
}
