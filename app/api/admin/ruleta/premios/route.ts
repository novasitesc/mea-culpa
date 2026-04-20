import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { categoryToLabel, type RouletteCategory } from "@/lib/roulette";

const VALID_CATEGORIES: RouletteCategory[] = [
  "jackpot",
  "muy_grande",
  "nada",
  "grande",
  "mediano",
  "pequeno",
];

function normalizeCategory(value: unknown): RouletteCategory | null {
  return typeof value === "string" && VALID_CATEGORIES.includes(value as RouletteCategory)
    ? (value as RouletteCategory)
    : null;
}

function normalizeRewardType(value: unknown): "oro" | "objeto" | null {
  return value === "oro" || value === "objeto" ? value : null;
}

export async function GET(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { session } = result;
  const { data, error } = await session.db
    .from("ruleta_premios_pool")
    .select("id, categoria, tipo_recompensa, etiqueta, oro_monto, objeto_id, objeto_cantidad, activo, orden, creado_en, actualizado_en, creado_por, actualizado_por, objetos:objeto_id(nombre, icono, precio)")
    .order("categoria", { ascending: true })
    .order("activo", { ascending: false })
    .order("orden", { ascending: true })
    .order("creado_en", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    categories: VALID_CATEGORIES.map((category) => ({
      value: category,
      label: categoryToLabel(category),
    })),
    pools: (data ?? []).map((row: any) => ({
      id: row.id,
      category: row.categoria,
      categoryLabel: categoryToLabel(row.categoria),
      rewardType: row.tipo_recompensa,
      label: row.etiqueta,
      goldAmount: row.oro_monto,
      objectId: row.objeto_id,
      objectQuantity: row.objeto_cantidad,
      active: row.activo,
      order: row.orden,
      createdAt: row.creado_en,
      updatedAt: row.actualizado_en,
      object: row.objetos
        ? {
            name: row.objetos.nombre,
            icon: row.objetos.icono,
            price: row.objetos.precio,
          }
        : null,
    })),
  });
}

export async function POST(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { session } = result;
  const body = await request.json().catch(() => null);

  const category = normalizeCategory(body?.category);
  const rewardType = normalizeRewardType(body?.rewardType);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const active = typeof body?.active === "boolean" ? body.active : true;
  const order = Number.isFinite(Number(body?.order)) ? Math.floor(Number(body.order)) : 0;

  if (!category) {
    return NextResponse.json({ error: "Categoria invalida" }, { status: 400 });
  }
  if (!rewardType) {
    return NextResponse.json({ error: "Tipo de premio invalido" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    categoria: category,
    tipo_recompensa: rewardType,
    etiqueta: label,
    activo,
    orden,
  };

  if (rewardType === "oro") {
    const goldAmount = Number(body?.goldAmount);
    if (!Number.isFinite(goldAmount) || goldAmount <= 0) {
      return NextResponse.json({ error: "Monto de oro invalido" }, { status: 400 });
    }
    payload.oro_monto = Math.floor(goldAmount);
    payload.objeto_id = null;
    payload.objeto_cantidad = 1;
  } else {
    const objectId = Number(body?.objectId);
    const objectQuantity = Number.isFinite(Number(body?.objectQuantity)) ? Math.floor(Number(body.objectQuantity)) : 1;
    if (!Number.isFinite(objectId) || objectId <= 0) {
      return NextResponse.json({ error: "Objeto invalido" }, { status: 400 });
    }
    if (objectQuantity <= 0) {
      return NextResponse.json({ error: "Cantidad invalida" }, { status: 400 });
    }

    const { data: existingObject, error: objectError } = await session.db
      .from("objetos")
      .select("id")
      .eq("id", Math.floor(objectId))
      .maybeSingle();

    if (objectError) {
      return NextResponse.json({ error: objectError.message }, { status: 500 });
    }
    if (!existingObject) {
      return NextResponse.json({ error: "El objeto no existe" }, { status: 404 });
    }

    payload.oro_monto = null;
    payload.objeto_id = Math.floor(objectId);
    payload.objeto_cantidad = objectQuantity;
  }

  const { data, error } = await session.db
    .from("ruleta_premios_pool")
    .insert(payload)
    .select("id, categoria, tipo_recompensa, etiqueta, oro_monto, objeto_id, objeto_cantidad, activo, orden, creado_en, actualizado_en")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, pool: data }, { status: 201 });
}
