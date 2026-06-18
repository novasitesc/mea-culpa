import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { ensureOwnedAliveCharacter } from "@/lib/characterLife";

export async function POST(request: Request) {
  try {
    const { userId, fromCharacterId, toCharacterId, bagIndex } = await request.json();

    if (
      !userId ||
      !fromCharacterId ||
      !toCharacterId ||
      typeof bagIndex !== "number" ||
      bagIndex < 0
    ) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios o son inválidos" },
        { status: 400 },
      );
    }

    if (Number(fromCharacterId) === Number(toCharacterId)) {
      return NextResponse.json(
        { error: "No se puede mover un objeto al mismo personaje" },
        { status: 400 },
      );
    }

    const db = createServerClient();

    // Validar personaje de origen
    const fromLifeCheck = await ensureOwnedAliveCharacter(db, String(userId), Number(fromCharacterId));
    if (!fromLifeCheck.ok) {
      return NextResponse.json({ error: `Origen: ${fromLifeCheck.error}` }, { status: fromLifeCheck.status });
    }

    // Validar personaje de destino
    const toLifeCheck = await ensureOwnedAliveCharacter(db, String(userId), Number(toCharacterId));
    if (!toLifeCheck.ok) {
      return NextResponse.json({ error: `Destino: ${toLifeCheck.error}` }, { status: toLifeCheck.status });
    }

    // Obtener los personajes para consultar la capacidad del destino
    const { data: toCharData, error: toCharError } = await db
      .from("personajes")
      .select("nombre, capacidad_bolsa")
      .eq("id", toCharacterId)
      .single();

    if (toCharError || !toCharData) {
      return NextResponse.json(
        { error: "No se pudo obtener la información del personaje destino" },
        { status: 404 },
      );
    }

    // Consultar bolsa del personaje origen
    const { data: sourceBagRows, error: sourceBagError } = await db
      .from("bolsa_objetos")
      .select("id, orden, objeto_id, publicado_en_trade, fue_comerciado, objetos:objeto_id(nombre)")
      .eq("personaje_id", fromCharacterId)
      .order("orden", { ascending: true });

    if (sourceBagError) {
      return NextResponse.json({ error: sourceBagError.message }, { status: 500 });
    }

    const itemRow = (sourceBagRows ?? [])[bagIndex] as
      | {
        id: number;
        orden: number;
        objeto_id: number | null;
        publicado_en_trade?: boolean;
        fue_comerciado?: boolean;
        objetos?: { nombre?: string } | null;
      }
      | undefined;

    if (!itemRow) {
      return NextResponse.json({ error: "Objeto no encontrado en la bolsa de origen" }, { status: 404 });
    }

    if (itemRow.fue_comerciado) {
      return NextResponse.json(
        {
          error:
            "No puedes mover este objeto. Ya fue transferido anteriormente y cada objeto solo puede comerciarse una vez.",
        },
        { status: 409 },
      );
    }

    // Consultar la cantidad actual de objetos en la bolsa del destino
    const { count: targetBagCount, error: targetBagError } = await db
      .from("bolsa_objetos")
      .select("id", { count: "exact", head: true })
      .eq("personaje_id", toCharacterId);

    if (targetBagError) {
      return NextResponse.json({ error: targetBagError.message }, { status: 500 });
    }

    const targetMaxSlots = Number(toCharData.capacidad_bolsa ?? 10);
    const currentTargetCount = targetBagCount ?? 0;

    if (currentTargetCount >= targetMaxSlots) {
      return NextResponse.json(
        { error: `La bolsa de ${toCharData.nombre} está llena (${currentTargetCount}/${targetMaxSlots} espacios)` },
        { status: 400 },
      );
    }

    // Mover el objeto: actualizar personaje_id y orden (al final de la bolsa destino)
    const { data: movedItem, error: updateError } = await db
      .from("bolsa_objetos")
      .update({
        personaje_id: toCharacterId,
        orden: currentTargetCount + 1,
        fue_comerciado: true,
      })
      .eq("id", itemRow.id)
      .eq("personaje_id", fromCharacterId)
      .eq("fue_comerciado", false)
      .select("id")
      .single();

    if (updateError || !movedItem) {
      return NextResponse.json(
        {
          error:
            "No puedes mover este objeto. Ya fue transferido anteriormente y cada objeto solo puede comerciarse una vez.",
        },
        { status: 409 },
      );
    }

    // Reordenar bolsa origen restante
    const remainingRows = (sourceBagRows ?? []).filter((r) => r.id !== itemRow.id);
    for (let i = 0; i < remainingRows.length; i += 1) {
      const targetOrder = i + 1;
      const current = remainingRows[i];
      if (current.orden === targetOrder) continue;

      const { error: orderError } = await db
        .from("bolsa_objetos")
        .update({ orden: targetOrder })
        .eq("id", current.id)
        .eq("personaje_id", fromCharacterId);

      if (orderError) {
        return NextResponse.json({ error: orderError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      itemName: itemRow.objetos?.nombre ?? "Objeto",
      targetCharacterName: toCharData.nombre,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al mover el objeto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
