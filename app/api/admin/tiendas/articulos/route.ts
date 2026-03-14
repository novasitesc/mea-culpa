import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

// GET /api/admin/tiendas/articulos?tiendaId=:id
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { searchParams } = new URL(request.url);
  const tiendaId = searchParams.get("tiendaId");
  if (!tiendaId) {
    return NextResponse.json({ error: "Falta el parametro tiendaId" }, { status: 400 });
  }

  const { data, error } = await db
    .from("articulos_tienda")
    .select(
      "id, tienda_id, objeto_id, precio, inventario, orden, creado_en, objetos(id, nombre, icono, tipo_item, rareza)",
    )
    .eq("tienda_id", tiendaId)
    .order("orden", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    (data ?? []).map((a: any) => ({
      id: a.id,
      tiendaId: a.tienda_id,
      objetoId: a.objeto_id,
      precio: a.precio,
      inventario: a.inventario,
      orden: a.orden,
      createdAt: a.creado_en,
      object: {
        id: a.objetos?.id,
        name: a.objetos?.nombre,
        icon: a.objetos?.icono,
        itemType: a.objetos?.tipo_item,
        rarity: a.objetos?.rareza,
      },
    })),
  );
}

// POST /api/admin/tiendas/articulos
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const body = await request.json();
  const { tiendaId, objetoId, precio, inventario, orden } = body;

  if (!tiendaId || !objetoId || precio === undefined || precio === null) {
    return NextResponse.json(
      { error: "tiendaId, objetoId y precio son obligatorios" },
      { status: 400 },
    );
  }

  const payload = {
    tienda_id: tiendaId,
    objeto_id: Number(objetoId),
    precio: Number(precio),
    inventario: inventario === null || inventario === "" ? null : Number(inventario),
    orden: orden === null || orden === "" ? 0 : Number(orden),
  };

  if (Number.isNaN(payload.objeto_id) || Number.isNaN(payload.precio)) {
    return NextResponse.json({ error: "objetoId y precio deben ser numericos" }, { status: 400 });
  }

  const { data, error } = await db
    .from("articulos_tienda")
    .insert(payload)
    .select(
      "id, tienda_id, objeto_id, precio, inventario, orden, creado_en, objetos(id, nombre, icono, tipo_item, rareza)",
    )
    .single();

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json(
        { error: "Ese objeto ya existe en la tienda" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: (data as any).id,
      tiendaId: (data as any).tienda_id,
      objetoId: (data as any).objeto_id,
      precio: (data as any).precio,
      inventario: (data as any).inventario,
      orden: (data as any).orden,
      createdAt: (data as any).creado_en,
      object: {
        id: (data as any).objetos?.id,
        name: (data as any).objetos?.nombre,
        icon: (data as any).objetos?.icono,
        itemType: (data as any).objetos?.tipo_item,
        rarity: (data as any).objetos?.rareza,
      },
    },
    { status: 201 },
  );
}

// PATCH /api/admin/tiendas/articulos?id=:id
export async function PATCH(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el parametro id" }, { status: 400 });
  }

  const body = await request.json();
  const { precio, inventario, orden } = body;

  const updates: Record<string, unknown> = {};
  if (precio !== undefined) updates.precio = Number(precio);
  if (inventario !== undefined) {
    updates.inventario = inventario === null || inventario === "" ? null : Number(inventario);
  }
  if (orden !== undefined) updates.orden = orden === null || orden === "" ? 0 : Number(orden);

  const { error } = await db.from("articulos_tienda").update(updates).eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = await db
    .from("articulos_tienda")
    .select(
      "id, tienda_id, objeto_id, precio, inventario, orden, creado_en, objetos(id, nombre, icono, tipo_item, rareza)",
    )
    .eq("id", Number(id))
    .single();

  return NextResponse.json({
    id: (data as any).id,
    tiendaId: (data as any).tienda_id,
    objetoId: (data as any).objeto_id,
    precio: (data as any).precio,
    inventario: (data as any).inventario,
    orden: (data as any).orden,
    createdAt: (data as any).creado_en,
    object: {
      id: (data as any).objetos?.id,
      name: (data as any).objetos?.nombre,
      icon: (data as any).objetos?.icono,
      itemType: (data as any).objetos?.tipo_item,
      rarity: (data as any).objetos?.rareza,
    },
  });
}

// DELETE /api/admin/tiendas/articulos?id=:id
export async function DELETE(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el parametro id" }, { status: 400 });
  }

  const { error } = await db.from("articulos_tienda").delete().eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
