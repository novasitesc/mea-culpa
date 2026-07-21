import type { SupabaseClient } from "@supabase/supabase-js";

type AsignarItemParams = {
  db: SupabaseClient;
  partidaId: string;
  personajeId: number;
  usuarioId: string | null;
  adminId: string;
  objetoId: number;
  cantidad: number;
};

type AsignarItemResult = {
  ok: boolean;
  grantedQty: number;
  error?: string;
};

/**
 * Mete objetos en la bolsa de un personaje cuando el DM los reparte en partida.
 *
 * La bolsa tiene un número fijo de huecos (`capacidad_bolsa`, derivado de la
 * Fuerza), y de ahí salen las dos reglas de reparto:
 *   · Consumible → apila: si ya hay una fila de ese objeto, solo sube `cantidad`
 *     y no gasta hueco nuevo.
 *   · No consumible → una fila (un hueco) por unidad, con su `orden` propio.
 *
 * Si no cabe todo, entrega lo que quepa: por eso devuelve `grantedQty`, que
 * puede ser menor que `cantidad`. La ruta que llama avisa al DM de la merma.
 */
export async function asignarItem({
  db,
  partidaId,
  personajeId,
  objetoId,
  cantidad,
}: AsignarItemParams): Promise<AsignarItemResult> {
  const { data: objectRow, error: objectError } = await db
    .from("objetos")
    .select("id, tipo_item")
    .eq("id", objetoId)
    .maybeSingle();

  if (objectError || !objectRow) {
    return { ok: false, grantedQty: 0, error: "Objeto no encontrado" };
  }

  const isConsumable = (objectRow as any).tipo_item === "consumible";

  const { data: personaje, error: personajeError } = await db
    .from("personajes")
    .select("capacidad_bolsa")
    .eq("id", personajeId)
    .single();

  if (personajeError || !personaje) {
    return { ok: false, grantedQty: 0, error: "No se pudo cargar la capacidad de bolsa" };
  }

  const { count: bagCount, error: bagCountError } = await db
    .from("bolsa_objetos")
    .select("id", { count: "exact", head: true })
    .eq("personaje_id", personajeId);

  if (bagCountError) {
    return { ok: false, grantedQty: 0, error: bagCountError.message };
  }

  // Huecos libres = capacidad total − filas que ya hay en la bolsa.
  const bagCapacity = Number((personaje as any).capacidad_bolsa ?? 0);
  let freeSlots = Math.max(0, bagCapacity - Number(bagCount ?? 0));

  // `orden` es la posición visual en la bolsa; se continúa desde la última.
  const { data: maxOrdenRow } = await db
    .from("bolsa_objetos")
    .select("orden")
    .eq("personaje_id", personajeId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextOrden = (maxOrdenRow as any)?.orden ?? -1;
  let grantedQty = 0;

  if (isConsumable) {
    const { data: existing } = await db
      .from("bolsa_objetos")
      .select("id, cantidad")
      .eq("personaje_id", personajeId)
      .eq("objeto_id", objetoId)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await db
        .from("bolsa_objetos")
        .update({ cantidad: (existing as any).cantidad + cantidad })
        .eq("id", (existing as any).id);

      if (updateError) return { ok: false, grantedQty: 0, error: updateError.message };
      grantedQty = cantidad;
    } else if (freeSlots > 0) {
      nextOrden += 1;
      const { error: insertError } = await db
        .from("bolsa_objetos")
        .insert({ personaje_id: personajeId, objeto_id: objetoId, cantidad, orden: nextOrden });

      if (insertError) return { ok: false, grantedQty: 0, error: insertError.message };
      grantedQty = cantidad;
    }
  } else {
    for (let i = 0; i < cantidad; i++) {
      if (freeSlots <= 0) break;
      nextOrden += 1;
      const { error: insertError } = await db
        .from("bolsa_objetos")
        .insert({ personaje_id: personajeId, objeto_id: objetoId, cantidad: 1, orden: nextOrden });

      if (insertError) return { ok: false, grantedQty: 0, error: insertError.message };
      freeSlots -= 1;
      grantedQty += 1;
    }
  }

  // Rastro de auditoría: qué se entregó, a quién y en qué partida.
  if (grantedQty > 0) {
    await db.from("transacciones_objetos").insert({
      partida_id: partidaId,
      personaje_id: personajeId,
      objeto_id: objetoId,
      origen: "partida_sala",
      cantidad: grantedQty,
    });
  }

  return { ok: true, grantedQty };
}
