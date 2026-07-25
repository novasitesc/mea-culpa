// GET / POST / PATCH / DELETE — Solo admin. CRUD del catálogo de objetos
// (tabla `objetos`): nombre, icono, tipo, rareza, precio.
// Es el catálogo maestro del que tiran tiendas, ruleta, dados y bolsas.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

const VALID_TYPES = [
  "cabeza",
  "armadura",
  "pecho",
  "guante",
  "botas",
  "collar",
  "anillo",
  "amuleto",
  "cinturón",
  "arma",
  "gema-arma",
  "gema-capa",
  "consumible",
  "ingrediente",
  "misc",
  "capa",
  "ejército",
] as const;

// Ficha de la unidad: sólo la rellenan los objetos de tipo ejército. `dano` es
// texto libre para que el DM escriba "1d6" o "2d6+1" sin encorsetarlo.
function normalizeUnitStat(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function mapItemTypeToDb(itemType: string): string {
  return itemType === "armadura" ? "pecho" : itemType;
}

function mapItemTypeFromDb(itemType: string): string {
  return itemType === "pecho" ? "armadura" : itemType;
}

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

// La base ya guarda la forma can\u00f3nica ("com\u00fan", "poco com\u00fan", "\u00e9pico"), que es la
// misma de ITEM_RARITY_OPTIONS. Quitarle los acentos aqu\u00ed dejaba al panel con
// valores que no existen en ITEM_RARITY_HEX, as\u00ed que la rareza se pintaba con el
// color por defecto y no coincid\u00eda con lo que devuelve /api/admin/tiendas/articulos.
function mapRarityFromDb(rarity: string): string {
  return normalizeRarity(rarity ?? "com\u00fan");
}

const OBJECT_COLUMNS =
  "id, nombre, descripcion, icono, tipo_item, requiere_dos_manos, rareza, precio, bono_estadisticas, soldados, clase_armadura, dano, creado_en";

function mapObjectRow(o: any) {
  return {
    id: o.id,
    name: o.nombre,
    description: o.descripcion,
    icon: o.icono,
    itemType: mapItemTypeFromDb(o.tipo_item),
    requiresTwoHands: Boolean(o.requiere_dos_manos),
    rarity: mapRarityFromDb(o.rareza),
    price: o.precio,
    bonusStats: o.bono_estadisticas,
    soldiers: o.soldados ?? null,
    armorClass: o.clase_armadura ?? null,
    damage: o.dano ?? null,
    createdAt: o.creado_en,
  };
}

// GET /api/admin/objetos
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { data, error } = await db
    .from("objetos")
    .select(OBJECT_COLUMNS)
    .order("creado_en", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json((data ?? []).map(mapObjectRow));
}

// POST /api/admin/objetos
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const body = await request.json();
  const { name, description, icon, itemType, rarity, price, bonusStats, requiresTwoHands, soldiers, armorClass, damage } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nombre obligatorio" }, { status: 400 });
  }
  if (!itemType || !VALID_TYPES.includes(itemType)) {
    return NextResponse.json({ error: "Tipo de objeto invalido" }, { status: 400 });
  }
  if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
    return NextResponse.json({ error: "Precio invalido" }, { status: 400 });
  }
  if (requiresTwoHands !== undefined && typeof requiresTwoHands !== "boolean") {
    return NextResponse.json({ error: "Flag de dos manos invalido" }, { status: 400 });
  }

  const weaponRequiresTwoHands = itemType === "arma" ? Boolean(requiresTwoHands) : false;

  const rarityNormalized = normalizeRarity(rarity ?? "común");
  const esEjercito = itemType === "ejército";

  const { data, error } = await db
    .from("objetos")
    .insert({
      nombre: name,
      descripcion: description ?? "",
      icono: icon?.trim() || "📦",
      tipo_item: mapItemTypeToDb(itemType),
      requiere_dos_manos: weaponRequiresTwoHands,
      rareza: rarityNormalized,
      precio: Number(price),
      bono_estadisticas: bonusStats ?? null,
      // La ficha de unidad sólo tiene sentido en objetos de tipo ejército.
      soldados: esEjercito ? normalizeUnitStat(soldiers) : null,
      clase_armadura: esEjercito ? normalizeUnitStat(armorClass) : null,
      dano: esEjercito && typeof damage === "string" && damage.trim() ? damage.trim() : null,
    })
    .select(OBJECT_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(mapObjectRow(data), { status: 201 });
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
  const { name, description, icon, itemType, rarity, price, bonusStats, requiresTwoHands, soldiers, armorClass, damage } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.nombre = name;
  if (description !== undefined) updates.descripcion = description;
  if (icon !== undefined) updates.icono = icon;
  if (itemType !== undefined) {
    if (!VALID_TYPES.includes(itemType)) {
      return NextResponse.json({ error: "Tipo de objeto invalido" }, { status: 400 });
    }
    updates.tipo_item = mapItemTypeToDb(itemType);
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
  if (requiresTwoHands !== undefined) {
    if (typeof requiresTwoHands !== "boolean") {
      return NextResponse.json({ error: "Flag de dos manos invalido" }, { status: 400 });
    }
    updates.requiere_dos_manos = itemType === "arma" ? requiresTwoHands : false;
  }
  if (bonusStats !== undefined) updates.bono_estadisticas = bonusStats;

  // Al dejar de ser ejército la ficha de unidad se limpia; al serlo, se guarda.
  if (itemType !== undefined && itemType !== "ejército") {
    updates.soldados = null;
    updates.clase_armadura = null;
    updates.dano = null;
  } else {
    if (soldiers !== undefined) updates.soldados = normalizeUnitStat(soldiers);
    if (armorClass !== undefined) updates.clase_armadura = normalizeUnitStat(armorClass);
    if (damage !== undefined) {
      updates.dano = typeof damage === "string" && damage.trim() ? damage.trim() : null;
    }
  }

  const { error } = await db.from("objetos").update(updates).eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = await db
    .from("objetos")
    .select(OBJECT_COLUMNS)
    .eq("id", Number(id))
    .single();

  return NextResponse.json(mapObjectRow(data));
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
