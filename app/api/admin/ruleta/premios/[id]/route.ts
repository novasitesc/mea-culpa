import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

function normalizeRewardType(value: unknown): "oro" | "objeto" | null {
  return value === "oro" || value === "objeto" ? value : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { session } = result;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  const updates: Record<string, unknown> = {};

  if (body?.category !== undefined) {
    const category = String(body.category);
    if (![
      "jackpot",
      "muy_grande",
      "nada",
      "grande",
      "mediano",
      "pequeno",
    ].includes(category)) {
      return NextResponse.json({ error: "Categoria invalida" }, { status: 400 });
    }
    updates.categoria = category;
  }

  if (body?.rewardType !== undefined) {
    const rewardType = normalizeRewardType(body.rewardType);
    if (!rewardType) {
      return NextResponse.json({ error: "Tipo de premio invalido" }, { status: 400 });
    }
    updates.tipo_recompensa = rewardType;
  }

  if (body?.label !== undefined) updates.etiqueta = String(body.label).trim();
  if (body?.active !== undefined) updates.activo = Boolean(body.active);
  if (body?.order !== undefined) {
    const order = Number(body.order);
    if (!Number.isFinite(order)) {
      return NextResponse.json({ error: "Orden invalido" }, { status: 400 });
    }
    updates.orden = Math.floor(order);
  }

  if (body?.rewardType === "oro" || updates.tipo_recompensa === "oro") {
    const goldAmount = body?.goldAmount !== undefined ? Number(body.goldAmount) : undefined;
    if (goldAmount !== undefined) {
      if (!Number.isFinite(goldAmount) || goldAmount <= 0) {
        return NextResponse.json({ error: "Monto de oro invalido" }, { status: 400 });
      }
      updates.oro_monto = Math.floor(goldAmount);
      updates.objeto_id = null;
      updates.objeto_cantidad = 1;
    }
  }

  if (body?.rewardType === "objeto" || updates.tipo_recompensa === "objeto") {
    if (body?.objectId !== undefined) {
      const objectId = Number(body.objectId);
      if (!Number.isFinite(objectId) || objectId <= 0) {
        return NextResponse.json({ error: "Objeto invalido" }, { status: 400 });
      }
      updates.objeto_id = Math.floor(objectId);
      updates.oro_monto = null;
    }
    if (body?.objectQuantity !== undefined) {
      const objectQuantity = Number(body.objectQuantity);
      if (!Number.isFinite(objectQuantity) || objectQuantity <= 0) {
        return NextResponse.json({ error: "Cantidad invalida" }, { status: 400 });
      }
      updates.objeto_cantidad = Math.floor(objectQuantity);
    }
  }

  const { error } = await session.db
    .from("ruleta_premios_pool")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { session } = result;
  const { id } = await context.params;

  const { error } = await session.db
    .from("ruleta_premios_pool")
    .update({ activo: false })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
