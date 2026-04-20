import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { session } = result;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 25)));
  const offset = (page - 1) * limit;

  const userName = searchParams.get("userName")?.trim();
  const category = searchParams.get("category")?.trim();
  const paymentType = searchParams.get("paymentType")?.trim();
  const rewardType = searchParams.get("rewardType")?.trim();

  let query = session.db
    .from("ruleta_tiradas")
    .select(
      `
      id,
      usuario_id,
      slot,
      categoria,
      premio_label,
      premio_tipo,
      premio_oro_monto,
      premio_objeto_id,
      premio_objeto_cantidad,
      pago_tipo,
      pago_monto,
      costo_tipo,
      costo_monto,
      ciclo_numero,
      cobro_pendiente,
      oro_resultante,
      entregado_a_personaje_id,
      entregado_a_personaje_nombre,
      entregado_en,
      creado_en,
      perfiles:usuario_id(nombre),
      objetos:premio_objeto_id(nombre, icono)
    `,
      { count: "exact" },
    );

  if (userName) {
    query = query.ilike("perfiles.nombre", `%${userName}%`);
  }
  if (category) {
    query = query.eq("categoria", category);
  }
  if (paymentType) {
    query = query.eq("pago_tipo", paymentType);
  }
  if (rewardType) {
    query = query.eq("premio_tipo", rewardType);
  }

  const { data, error, count } = await query
    .order("creado_en", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: (data ?? []).map((row: any) => ({
      id: row.id,
      userId: row.usuario_id,
      userName: row.perfiles?.nombre ?? "Desconocido",
      slot: row.slot,
      category: row.categoria,
      rewardLabel: row.premio_label,
      rewardType: row.premio_tipo,
      rewardGoldAmount: row.premio_oro_monto,
      rewardObjectId: row.premio_objeto_id,
      rewardObjectQuantity: row.premio_objeto_cantidad,
      paymentType: row.pago_tipo ?? row.costo_tipo,
      paymentAmount: row.pago_monto ?? row.costo_monto,
      costType: row.costo_tipo,
      costAmount: row.costo_monto,
      cycle: row.ciclo_numero,
      pendingCharge: row.cobro_pendiente,
      goldAfter: row.oro_resultante,
      deliveredToCharacterId: row.entregado_a_personaje_id,
      deliveredToCharacterName: row.entregado_a_personaje_nombre,
      deliveredAt: row.entregado_en,
      createdAt: row.creado_en,
      object: row.objetos
        ? { name: row.objetos.nombre, icon: row.objetos.icono }
        : null,
    })),
    count: count ?? 0,
    page,
    limit,
    totalPages: count ? Math.ceil(count / limit) : 0,
  });
}
