import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

// GET /api/tiendas              → lista todas las tiendas (sin items)
// GET /api/tiendas?id=herrero   → detalle de una tienda con sus items
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const db = createServerClient();

  if (id) {
    // Detalle de una tienda con items
    const { data: tienda, error } = await db
      .from("tiendas")
      .select(
        `
        id, nombre, descripcion, icono, tendero, ubicacion, nivel_minimo,
        articulos_tienda (
          id, inventario,
          objetos:objeto_id (
            id, nombre, descripcion, rareza, tipo_item, icono, precio
          )
        )
      `,
      )
      .eq("id", id)
      .single();

    if (error || !tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }

    const items = (tienda.articulos_tienda ?? []).map((a: any) => ({
      id: a.objetos?.id,
      articuloTiendaId: a.id,
      name: a.objetos?.nombre,
      description: a.objetos?.descripcion,
      price: a.objetos?.precio ?? 0,
      rarity: a.objetos?.rareza,
      category: a.objetos?.tipo_item,
      stock: a.inventario,
      icon: a.objetos?.icono ?? "📦",
    }));

    return NextResponse.json({
      id: tienda.id,
      name: tienda.nombre,
      description: tienda.descripcion,
      icon: tienda.icono,
      keeper: tienda.tendero,
      location: tienda.ubicacion,
      minLevel: tienda.nivel_minimo ?? undefined,
      items,
    });
  }

  // Lista de tiendas (sin items)
  const { data: tiendas } = await db
    .from("tiendas")
    .select("id, nombre, descripcion, icono, tendero, ubicacion, nivel_minimo");

  const { data: counts } = await db
    .from("articulos_tienda")
    .select("tienda_id");

  // Contar items por tienda
  const countMap = new Map<number, number>();
  for (const row of counts ?? []) {
    countMap.set(row.tienda_id, (countMap.get(row.tienda_id) ?? 0) + 1);
  }

  const list = (tiendas ?? []).map((t: any) => ({
    id: t.id,
    name: t.nombre,
    description: t.descripcion,
    icon: t.icono,
    keeper: t.tendero,
    location: t.ubicacion,
    minLevel: t.nivel_minimo ?? undefined,
    itemCount: countMap.get(t.id) ?? 0,
  }));

  return NextResponse.json(list);
}
