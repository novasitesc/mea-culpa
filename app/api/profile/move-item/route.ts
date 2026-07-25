// POST — Reordenar objetos dentro de la bolsa (arrastrar y soltar).
// Solo cambia la columna `orden`; equipar y desequipar es /update-bag.
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { ensureOwnedAliveCharacter } from "@/lib/characterLife";

/** 500 que conserva el código de Postgres, igual que en /update-bag. */
function dbFailure(context: string, error: unknown) {
  const err = error as { message?: string; code?: string } | null;
  console.error(`[move-item] ${context}:`, err);
  return NextResponse.json(
    { error: context, detail: err?.message ?? "Error desconocido", code: err?.code ?? null },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const db = createServerClient();
    const { user, error: authError } = await getUserFromRequest(db, request);
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { fromCharacterId, toCharacterId, bagIndex } = await request.json();

    if (
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

    // Validar personaje de origen
    const fromLifeCheck = await ensureOwnedAliveCharacter(db, String(user.id), Number(fromCharacterId));
    if (!fromLifeCheck.ok) {
      return NextResponse.json({ error: `Origen: ${fromLifeCheck.error}` }, { status: fromLifeCheck.status });
    }

    // Validar personaje de destino
    const toLifeCheck = await ensureOwnedAliveCharacter(db, String(user.id), Number(toCharacterId));
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

    // El destino es MAX(orden)+1, no COUNT+1: la bolsa puede tener huecos (una
    // venta, un depósito en comercio) y entonces COUNT+1 apunta a un `orden` que
    // ya existe → uq_bolsa_orden (23505). Es el mismo cálculo que hacen las RPC.
    const { data: lastRow, error: lastRowError } = await db
      .from("bolsa_objetos")
      .select("orden")
      .eq("personaje_id", toCharacterId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRowError) {
      return NextResponse.json({ error: lastRowError.message }, { status: 500 });
    }

    const nextOrden = Number((lastRow as any)?.orden ?? 0) + 1;

    // Mover el objeto: actualizar personaje_id y orden (al final de la bolsa destino)
    const { data: movedItem, error: updateError } = await db
      .from("bolsa_objetos")
      .update({
        personaje_id: toCharacterId,
        orden: nextOrden,
        fue_comerciado: true,
      })
      .eq("id", itemRow.id)
      .eq("personaje_id", fromCharacterId)
      .eq("fue_comerciado", false)
      .select("id")
      .single();

    if (updateError || !movedItem) {
      // Un choque de `orden` no es "ya fue comerciado": confundirlos hacía que el
      // jugador leyera que su objeto estaba quemado cuando el fallo era nuestro.
      if (String((updateError as any)?.code) === "23505") {
        return dbFailure("No se pudo colocar el objeto en la bolsa destino", updateError);
      }

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
