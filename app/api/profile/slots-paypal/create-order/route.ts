import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { createPayPalOrder } from "@/lib/paypal";

const SLOT_UNLOCK_PRICE_USD = 10.0;
const SLOT_MIN = 2;
const SLOT_MAX = 5;

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

    const currentSlots = Math.max(
      SLOT_MIN,
      Math.min(SLOT_MAX, profile?.max_personajes ?? SLOT_MIN),
    );

    if (currentSlots >= SLOT_MAX) {
      return NextResponse.json(
        { error: "Ya alcanzaste el maximo de slots (5/5)" },
        { status: 409 },
      );
    }

    const targetSlots = Math.min(SLOT_MAX, currentSlots + 1);

    const { data: existing } = await db
      .from("pagos_paypal")
      .select("id, estado")
      .eq("usuario_id", user.id)
      .eq("concepto", "character_slot_unlock")
      .in("estado", ["created", "approved", "captured"])
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

    const order = await createPayPalOrder({
      amountUsd: SLOT_UNLOCK_PRICE_USD,
      description: `Desbloqueo de slot de personaje (${currentSlots} a ${targetSlots})`,
      customId: `slot_unlock_inc:${user.id}:${currentSlots}:${targetSlots}`,
    });

    const { error: insertError } = await db.from("pagos_paypal").insert({
      usuario_id: user.id,
      concepto: "character_slot_unlock",
      referencia_id: null,
      monto_usd: SLOT_UNLOCK_PRICE_USD,
      paypal_order_id: order.id,
      estado: "created",
      metadata: {
        fromSlots: currentSlots,
        toSlots: targetSlots,
        pricingVersion: "v2-fixed-10_00",
        orderStatus: order.status,
      },
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      fromSlots: currentSlots,
      toSlots: targetSlots,
      priceUsd: SLOT_UNLOCK_PRICE_USD,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
