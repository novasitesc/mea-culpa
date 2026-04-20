import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function GET(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const { data, error } = await db
    .from("ruleta_tiradas")
    .select(
      `
      id,
      slot,
      categoria,
      premio_label,
      premio_tipo,
      premio_oro_monto,
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
      objetos:premio_objeto_id(nombre, icono)
    `,
    )
    .eq("usuario_id", user.id)
    .order("creado_en", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    tiradas: (data ?? []).map((row: any) => ({
      id: row.id,
      slot: row.slot,
      category: row.categoria,
      rewardLabel: row.premio_label,
      rewardType: row.premio_tipo,
      rewardGoldAmount: row.premio_oro_monto,
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
  });
}
