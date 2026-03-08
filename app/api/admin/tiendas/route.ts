import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// GET /api/admin/tiendas[?id=slug]
// Sin ?id -> lista todas las tiendas con conteo de items.
// Con ?id -> detalle de una tienda.
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const { data: tienda, error } = await db
      .from("tiendas")
      .select(
        "id, nombre, descripcion, icono, tendero, ubicacion, nivel_minimo, creado_en, articulos_tienda(id)",
      )
      .eq("id", id)
      .single();

    if (error || !tienda) {
      return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      id: (tienda as any).id,
      name: (tienda as any).nombre,
      description: (tienda as any).descripcion,
      icon: (tienda as any).icono,
      keeper: (tienda as any).tendero,
      location: (tienda as any).ubicacion,
      minLevel: (tienda as any).nivel_minimo ?? undefined,
      itemCount: ((tienda as any).articulos_tienda ?? []).length,
      createdAt: (tienda as any).creado_en,
    });
  }

  const { data: tiendas, error } = await db
    .from("tiendas")
    .select(
      "id, nombre, descripcion, icono, tendero, ubicacion, nivel_minimo, creado_en, articulos_tienda(id)",
    )
    .order("orden", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    (tiendas ?? []).map((t: any) => ({
      id: t.id,
      name: t.nombre,
      description: t.descripcion,
      icon: t.icono,
      keeper: t.tendero,
      location: t.ubicacion,
      minLevel: t.nivel_minimo ?? undefined,
      itemCount: (t.articulos_tienda ?? []).length,
      createdAt: t.creado_en,
    })),
  );
}

// POST /api/admin/tiendas  Crea una nueva tienda.
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const body = await request.json();
  const { name, description, icon, keeper, location, minLevel } = body;

  if (!name?.trim() || !description?.trim() || !keeper?.trim() || !location?.trim()) {
    return NextResponse.json(
      { error: "Nombre, descripcion, tendero y ubicacion son obligatorios" },
      { status: 400 },
    );
  }

  const id = slugify(name);

  const { data: existing } = await db
    .from("tiendas")
    .select("id")
    .eq("id", id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Ya existe una tienda con ese nombre (slug duplicado)" },
      { status: 409 },
    );
  }

  const { data: tienda, error } = await db
    .from("tiendas")
    .insert({
      id,
      nombre: name,
      descripcion: description,
      icono: icon ?? "",
      tendero: keeper,
      ubicacion: location,
      nivel_minimo: minLevel ? Number(minLevel) : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      id: (tienda as any).id,
      name: (tienda as any).nombre,
      description: (tienda as any).descripcion,
      icon: (tienda as any).icono,
      keeper: (tienda as any).tendero,
      location: (tienda as any).ubicacion,
      minLevel: (tienda as any).nivel_minimo ?? undefined,
      itemCount: 0,
      createdAt: (tienda as any).creado_en,
    },
    { status: 201 },
  );
}

// PATCH /api/admin/tiendas?id=:slug  Actualiza los datos de una tienda.
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
  const { name, description, icon, keeper, location, minLevel } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.nombre = name;
  if (description !== undefined) updates.descripcion = description;
  if (icon !== undefined) updates.icono = icon;
  if (keeper !== undefined) updates.tendero = keeper;
  if (location !== undefined) updates.ubicacion = location;
  updates.nivel_minimo = minLevel ? Number(minLevel) : null;

  const { error } = await db.from("tiendas").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: tienda } = await db
    .from("tiendas")
    .select(
      "id, nombre, descripcion, icono, tendero, ubicacion, nivel_minimo, creado_en, articulos_tienda(id)",
    )
    .eq("id", id)
    .single();

  return NextResponse.json({
    id: (tienda as any).id,
    name: (tienda as any).nombre,
    description: (tienda as any).descripcion,
    icon: (tienda as any).icono,
    keeper: (tienda as any).tendero,
    location: (tienda as any).ubicacion,
    minLevel: (tienda as any).nivel_minimo ?? undefined,
    itemCount: ((tienda as any).articulos_tienda ?? []).length,
    createdAt: (tienda as any).creado_en,
  });
}

// DELETE /api/admin/tiendas?id=:slug  Elimina una tienda y sus items en cascada.
export async function DELETE(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el parametro id" }, { status: 400 });
  }

  const { error } = await db.from("tiendas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
