import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function GET(request: Request) {
  try {
    const db = createServerClient();
    const { user, error: authError } = await getUserFromRequest(db, request);

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId")?.trim();

    let query = db
      .from("pagos_paypal")
      .select("id, estado, paypal_order_id, paypal_capture_id, effect_applied, actualizado_en")
      .eq("usuario_id", user.id)
      .eq("concepto", "ruleta_usd_spin");

    if (orderId) {
      query = query.eq("paypal_order_id", orderId);
    } else {
      query = query
        .eq("estado", "completed")
        .eq("effect_applied", false)
        .is("referencia_id", null)
        .order("creado_en", { ascending: false });
    }

    const { data: payment, error: paymentError } = await query.limit(1).maybeSingle();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    return NextResponse.json({
      payment: payment ?? null,
      hasUsdSpinPayment: Boolean(
        payment && payment.estado === "completed" && !payment.effect_applied,
      ),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
