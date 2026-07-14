import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function DELETE(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("characterId");
    const transferTargetType = searchParams.get("transferTargetType") || "none";
    const transferTargetId = searchParams.get("transferTargetId");

    if (!characterId) {
      return NextResponse.json({ error: "ID de personaje requerido" }, { status: 400 });
    }

    // 1. Obtener el personaje para verificar su estado actual
    const { data: personaje, error: fetchError } = await db
      .from("personajes")
      .select("id, estado_vida, numero_slot")
      .eq("id", characterId)
      .eq("usuario_id", user.id)
      .single();

    if (fetchError || !personaje) {
      return NextResponse.json({ error: "Personaje no encontrado" }, { status: 404 });
    }

    // No permitir eliminar un personaje ya eliminado/enterrado
    if (personaje.estado_vida === "eliminado" || personaje.estado_vida === "enterrado") {
      return NextResponse.json(
        { error: "Este personaje ya fue eliminado" },
        { status: 409 }
      );
    }

    // 2. Lógica de transferencia de ítems si se solicitó
    if (transferTargetType === "character" && transferTargetId) {
      const targetIdNum = Number(transferTargetId);
      if (targetIdNum !== Number(characterId)) {
        // Consultar cuántos ítems tiene el destino en su bolsa
        const { count: targetCount } = await db
          .from("bolsa_objetos")
          .select("id", { count: "exact", head: true })
          .eq("personaje_id", targetIdNum);

        let currentOrder = targetCount ?? 0;

        // Obtener ítems del personaje a eliminar que no estén en trade
        const { data: sourceItems } = await db
          .from("bolsa_objetos")
          .select("id")
          .eq("personaje_id", characterId)
          .eq("publicado_en_trade", false);

        for (const item of sourceItems ?? []) {
          currentOrder++;
          await db
            .from("bolsa_objetos")
            .update({
              personaje_id: targetIdNum,
              orden: currentOrder,
              fue_comerciado: true,
            })
            .eq("id", item.id);
        }
      }
    } else if (transferTargetType === "guild") {
      const { data: membership } = await db
        .from("gremio_miembros")
        .select("gremio_id")
        .eq("usuario_id", user.id)
        .maybeSingle();

      if (membership) {
        const { data: sourceItems } = await db
          .from("bolsa_objetos")
          .select("id, objeto_id, cantidad")
          .eq("personaje_id", characterId)
          .eq("publicado_en_trade", false);

        for (const item of sourceItems ?? []) {
          if (item.objeto_id) {
            await db.rpc("depositar_gremio_baul_con_limite", {
              p_gremio_id: membership.gremio_id,
              p_objeto_id: item.objeto_id,
              p_cantidad: item.cantidad ?? 1,
              p_depositante_usuario_id: user.id,
            });
            await db.from("bolsa_objetos").delete().eq("id", item.id);
          }
        }
      }
    }

    // Limpiar ítems restantes en bolsa si quedaron
    await db.from("bolsa_objetos").delete().eq("personaje_id", characterId);

    // 3. Eliminar el personaje: marcar como 'eliminado' y liberar el slot
    const { error: updateError } = await db
      .from("personajes")
      .update({
        estado_vida: "eliminado",
        numero_slot: null,
        eliminado_en: new Date().toISOString(),
      })
      .eq("id", characterId)
      .eq("usuario_id", user.id);

    if (updateError) {
      console.error("Error al eliminar personaje:", updateError);
      return NextResponse.json(
        { error: "Error al eliminar el personaje" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action: "deleted",
      freedSlot: personaje.numero_slot,
      message: "Personaje eliminado permanentemente. El slot ha sido liberado.",
    });

  } catch (error) {
    console.error("Error en delete-character:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
