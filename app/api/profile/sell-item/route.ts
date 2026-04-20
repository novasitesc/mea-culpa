import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { modifyGold } from "@/lib/goldService";

export async function POST(request: Request) {
  try {
    const { userId, characterId, bagIndex } = await request.json();

    if (!userId || !characterId || !Number.isInteger(bagIndex) || bagIndex < 0) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 },
      );
    }

    const db = createServerClient();

    const { data: personaje } = await db
      .from("personajes")
      .select("id")
      .eq("id", characterId)
      .eq("usuario_id", userId)
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

    const { error: deleteError } = await db
      .from("bolsa_objetos")
      .delete()
      .eq("id", row.id)
      .eq("personaje_id", characterId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

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
        return NextResponse.json({ error: orderError.message }, { status: 500 });
      }
    }

    const oro = await modifyGold(userId, saleGold, concepto);

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
