import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { createPayPalOrder } from "@/lib/paypal";

const SLOT_UNLOCK_PRICE_USD = 4.99;

export async function POST(request: Request) {
  try {
    const db = createServerClient();
    const { user, error: authError } = await getUserFromRequest(db, request);

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await db
      .from("perfiles")
      .select("max_personajes")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if ((profile?.max_personajes ?? 2) >= 5) {
      return NextResponse.json(
        { error: "Tu cuenta ya tiene slots premium desbloqueados" },
        { status: 409 },
      );
    }

    const { data: existing } = await db
      .from("pagos_paypal")
      .select("paypal_order_id, estado")
      .eq("usuario_id", user.id)
      .eq("concepto", "character_slot_unlock")
      .in("estado", ["created", "approved", "captured", "completed"])
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.estado === "completed") {
      return NextResponse.json({
        orderId: existing.paypal_order_id,
        alreadyUnlocked: true,
      });
    }

    if (existing?.paypal_order_id) {
      return NextResponse.json({
        orderId: existing.paypal_order_id,
        reused: true,
      });
    }

    const order = await createPayPalOrder({
      amountUsd: SLOT_UNLOCK_PRICE_USD,
      description: "Desbloqueo premium de slots de personaje (2 a 5)",
      customId: `slot_unlock:${user.id}`,
    });

    const { error: insertError } = await db.from("pagos_paypal").insert({
      usuario_id: user.id,
      concepto: "character_slot_unlock",
      referencia_id: null,
      monto_usd: SLOT_UNLOCK_PRICE_USD,
      paypal_order_id: order.id,
      estado: "created",
      metadata: {
        orderStatus: order.status,
      },
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ orderId: order.id, status: order.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
