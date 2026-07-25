// POST — Vender un objeto de la bolsa por oro.
// Lo quita de la bolsa y abona el oro con modifyGold() (lib/goldService.ts),
// que deja el movimiento registrado.
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { modifyGold } from "@/lib/goldService";

export async function POST(request: Request) {
  try {
    const db = createServerClient();
    const { user, error: authError } = await getUserFromRequest(db, request);
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { characterId, bagIndex } = await request.json();

    if (!characterId || !Number.isInteger(bagIndex) || bagIndex < 0) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 },
      );
    }

    const { data: personaje } = await db
      .from("personajes")
      .select("id")
      .eq("id", characterId)
      .eq("usuario_id", user.id)
      .single();

    if (!personaje) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const { data: bagRows, error: bagError } = await db
      .from("bolsa_objetos")
      .select("id, orden, objeto_id, publicado_en_trade, objetos:objeto_id(nombre, precio)")
      .eq("personaje_id", characterId)
      .order("orden", { ascending: true });

    if (bagError) {
      return NextResponse.json({ error: bagError.message }, { status: 500 });
    }

    const row = (bagRows ?? [])[bagIndex] as
      | {
          id: number;
          orden: number;
          objeto_id: number | null;
          publicado_en_trade?: boolean;
          objetos?: { nombre?: string; precio?: number } | null;
        }
      | undefined;

    if (!row) {
      return NextResponse.json({ error: "Item not found in bag" }, { status: 404 });
    }

    if (row.publicado_en_trade) {
      return NextResponse.json(
        { error: "No puedes vender este objeto mientras esté publicado en comercio" },
        { status: 409 },
      );
    }

    const itemName = row.objetos?.nombre ?? "Objeto desconocido";
    const itemPrice = Number(row.objetos?.precio ?? 0);
    const saleGold = Math.max(0, Math.floor(itemPrice / 2));
    const safeItemName = itemName.replace(/"/g, "'");
    const concepto = `venta_objeto "${safeItemName}"`;

    // Orden importante: primero el borrado, y solo si desaparece de verdad se
    // paga. Antes se borraba, se reordenaba y se pagaba al final: si el reordenado
    // fallaba a mitad, el objeto ya no existía y nadie había cobrado.
    // El borrado condicionado por id evita además pagar dos veces la misma fila
    // si llegan dos peticiones a la vez.
    const { data: deletedRows, error: deleteError } = await db
      .from("bolsa_objetos")
      .delete()
      .eq("id", row.id)
      .eq("personaje_id", characterId)
      .select("id");

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        { error: "Ese objeto ya no está en la bolsa" },
        { status: 409 },
      );
    }

    let oro: number;
    try {
      oro = await modifyGold(user.id, saleGold, concepto);
    } catch (goldError) {
      // Sin oro no hay venta: se devuelve el objeto a la bolsa antes de fallar.
      await db
        .from("bolsa_objetos")
        .insert({
          personaje_id: characterId,
          objeto_id: row.objeto_id,
          cantidad: 1,
          orden: row.orden,
          fue_comerciado: false,
          publicado_en_trade: false,
        })
        .then(() => null, () => null);

      const message =
        goldError instanceof Error ? goldError.message : "No se pudo abonar la venta";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // El reordenado es cosmético: si falla, la venta ya está cerrada y el hueco de
    // `orden` no rompe nada (todo el mundo calcula MAX(orden)+1).
    const remainingRows = (bagRows ?? []).filter((r: any) => r.id !== row.id);

    for (let i = 0; i < remainingRows.length; i += 1) {
      const targetOrder = i + 1;
      const current = remainingRows[i];
      if ((current as any).orden === targetOrder) continue;

      const { error: orderError } = await db
        .from("bolsa_objetos")
        .update({ orden: targetOrder })
        .eq("id", (current as any).id)
        .eq("personaje_id", characterId);

      if (orderError) {
        console.error("[sell-item] reordenado incompleto tras la venta:", orderError);
        break;
      }
    }

    return NextResponse.json({
      success: true,
      oro,
      saleGold,
      concepto,
      itemName,
      bagIndex,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sell item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
