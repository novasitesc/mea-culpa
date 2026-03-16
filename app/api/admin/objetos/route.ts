import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

const VALID_TYPES = [
  "cabeza",
  "pecho",
  "guante",
  "botas",
  "collar",
  "anillo",
  "amuleto",
  "arma",
  "consumible",
  "ingrediente",
  "misc",
] as const;

const VALID_RARITIES_DB = ["común", "poco común", "raro", "épico", "legendario"] as const;

function normalizeRarity(raw: string): string {
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (
    !["comun", "poco comun", "raro", "epico", "legendario"].includes(
      normalized,
    )
  ) {
    return "común";
  }

  switch (normalized) {
    case "comun":
      return "común";
    case "poco comun":
      return "poco común";
    case "raro":
      return "raro";
    case "epico":
      return "épico";
    case "legendario":
      return "legendario";
    default:
      return "común";
  }
}

function mapRarityFromDb(rarity: string): string {
  return rarity
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// GET /api/admin/objetos
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { data, error } = await db
    .from("objetos")
    .select("id, nombre, descripcion, icono, tipo_item, rareza, precio, bono_estadisticas, creado_en")
    .order("creado_en", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    (data ?? []).map((o: any) => ({
      id: o.id,
      name: o.nombre,
      description: o.descripcion,
      icon: o.icono,
      itemType: o.tipo_item,
      rarity: mapRarityFromDb(o.rareza),
      price: o.precio,
      bonusStats: o.bono_estadisticas,
      createdAt: o.creado_en,
    })),
  );
}

// POST /api/admin/objetos
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const body = await request.json();
  const { name, description, icon, itemType, rarity, price, bonusStats } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nombre obligatorio" }, { status: 400 });
  }
  if (!itemType || !VALID_TYPES.includes(itemType)) {
    return NextResponse.json({ error: "Tipo de objeto invalido" }, { status: 400 });
  }
  if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
    return NextResponse.json({ error: "Precio invalido" }, { status: 400 });
  }

  const rarityNormalized = normalizeRarity(rarity ?? "común");

  const { data, error } = await db
    .from("objetos")
    .insert({
      nombre: name,
      descripcion: description ?? "",
      icono: icon?.trim() || "📦",
      tipo_item: itemType,
      rareza: rarityNormalized,
      precio: Number(price),
      bono_estadisticas: bonusStats ?? null,
    })
    .select("id, nombre, descripcion, icono, tipo_item, rareza, precio, bono_estadisticas, creado_en")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      id: (data as any).id,
      name: (data as any).nombre,
      description: (data as any).descripcion,
      icon: (data as any).icono,
      itemType: (data as any).tipo_item,
      rarity: mapRarityFromDb((data as any).rareza),
      price: (data as any).precio,
      bonusStats: (data as any).bono_estadisticas,
      createdAt: (data as any).creado_en,
    },
    { status: 201 },
  );
}

// PATCH /api/admin/objetos?id=:id
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
  const { name, description, icon, itemType, rarity, price, bonusStats } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.nombre = name;
  if (description !== undefined) updates.descripcion = description;
  if (icon !== undefined) updates.icono = icon;
  if (itemType !== undefined) {
    if (!VALID_TYPES.includes(itemType)) {
      return NextResponse.json({ error: "Tipo de objeto invalido" }, { status: 400 });
    }
    updates.tipo_item = itemType;
  }
  if (rarity !== undefined) {
    const normalized = normalizeRarity(rarity);
    if (!VALID_RARITIES_DB.includes(normalized as (typeof VALID_RARITIES_DB)[number])) {
      return NextResponse.json({ error: "Rareza invalida" }, { status: 400 });
    }
    updates.rareza = normalized;
  }
  if (price !== undefined) {
    if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "Precio invalido" }, { status: 400 });
    }
    updates.precio = Number(price);
  }
  if (bonusStats !== undefined) updates.bono_estadisticas = bonusStats;

  const { error } = await db.from("objetos").update(updates).eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = await db
    .from("objetos")
    .select("id, nombre, descripcion, icono, tipo_item, rareza, precio, bono_estadisticas, creado_en")
    .eq("id", Number(id))
    .single();

  return NextResponse.json({
    id: (data as any).id,
    name: (data as any).nombre,
    description: (data as any).descripcion,
    icon: (data as any).icono,
    itemType: (data as any).tipo_item,
    rarity: mapRarityFromDb((data as any).rareza),
    price: (data as any).precio,
    bonusStats: (data as any).bono_estadisticas,
    createdAt: (data as any).creado_en,
  });
}

// DELETE /api/admin/objetos?id=:id
export async function DELETE(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el parametro id" }, { status: 400 });
  }

  const { error } = await db.from("objetos").delete().eq("id", Number(id));
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("foreign key") || msg.includes("violates")) {
      return NextResponse.json(
        { error: "No se puede eliminar el objeto porque esta en uso" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
