import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { createPayPalOrder } from "@/lib/paypal";
import { getNextSpinCost } from "@/lib/roulette";

export async function POST(request: Request) {
  try {
    const db = createServerClient();
    const { user, error: authError } = await getUserFromRequest(db, request);

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { count, error: countError } = await db
      .from("ruleta_tiradas")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", user.id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const nextCost = getNextSpinCost(count ?? 0);

    if (nextCost.type !== "usd") {
      return NextResponse.json(
        { error: "La proxima tirada no requiere cobro en USD" },
        { status: 409 },
      );
    }

    const { data: paidCredit, error: paidCreditError } = await db
      .from("pagos_paypal")
      .select("id")
      .eq("usuario_id", user.id)
      .eq("concepto", "ruleta_usd_spin")
      .eq("estado", "completed")
      .eq("effect_applied", false)
      .is("referencia_id", null)
      .order("creado_en", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (paidCreditError) {
      return NextResponse.json({ error: paidCreditError.message }, { status: 500 });
    }

    if (paidCredit) {
      return NextResponse.json(
        { alreadyPaid: true },
        { status: 200 },
      );
    }

    const { data: existing } = await db
      .from("pagos_paypal")
      .select("id, estado")
      .eq("usuario_id", user.id)
      .eq("concepto", "ruleta_usd_spin")
      .in("estado", ["created", "approved", "captured"])
      .is("referencia_id", null)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await db
        .from("pagos_paypal")
        .update({
          estado: "failed",
          metadata: {
            invalidatedBy: "new_order_requested",
            previousStatus: existing.estado,
          },
        })
        .eq("id", existing.id);
    }

    const amountUsd = Number(nextCost.amount ?? 0);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json(
        { error: "Monto USD invalido para la proxima tirada" },
        { status: 422 },
      );
    }

    const order = await createPayPalOrder({
      amountUsd,
      description: `Ruleta prepay paso ${nextCost.step}`,
      customId: `ruleta-prepay:${user.id}:${nextCost.step}`,
    });

    const { error: insertError } = await db.from("pagos_paypal").insert({
      usuario_id: user.id,
      concepto: "ruleta_usd_spin",
      referencia_id: null,
      monto_usd: amountUsd,
      paypal_order_id: order.id,
      estado: "created",
      metadata: {
        step: nextCost.step,
        expectedAmountUsd: amountUsd,
        orderStatus: order.status,
      },
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
