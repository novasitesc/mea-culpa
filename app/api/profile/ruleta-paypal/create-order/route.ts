import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { createPayPalOrder } from "@/lib/paypal";

export async function POST(request: Request) {
  try {
    const db = createServerClient();
    const { user, error: authError } = await getUserFromRequest(db, request);

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { tiradaId?: string } | null;
    const tiradaId = body?.tiradaId?.trim();

    if (!tiradaId) {
      return NextResponse.json({ error: "tiradaId es requerido" }, { status: 400 });
    }

    const { data: spin, error: spinError } = await db
      .from("ruleta_tiradas")
      .select("id, usuario_id, costo_tipo, costo_monto, cobro_pendiente")
      .eq("id", tiradaId)
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (spinError) {
      return NextResponse.json({ error: spinError.message }, { status: 500 });
    }

    if (!spin) {
      return NextResponse.json({ error: "Tirada no encontrada" }, { status: 404 });
    }

    if (spin.costo_tipo !== "usd") {
      return NextResponse.json(
        { error: "La tirada no requiere cobro en USD" },
        { status: 409 },
      );
    }

    if (!spin.cobro_pendiente) {
      return NextResponse.json(
        { error: "La tirada ya fue cobrada", alreadyPaid: true },
        { status: 409 },
      );
    }

    const { data: existing } = await db
      .from("pagos_paypal")
      .select("id, paypal_order_id, estado")
      .eq("usuario_id", user.id)
      .eq("concepto", "ruleta_usd_spin")
      .eq("referencia_id", spin.id)
      .in("estado", ["created", "approved", "captured", "completed"])
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.estado === "completed") {
      return NextResponse.json({
        orderId: existing.paypal_order_id,
        alreadyPaid: true,
      });
    }

    if (existing && existing.estado !== "completed") {
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

    const amountUsd = Number(spin.costo_monto ?? 0);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json(
        { error: "Monto USD invalido en la tirada" },
        { status: 422 },
      );
    }

    const order = await createPayPalOrder({
      amountUsd,
      description: `Ruleta paso USD - tirada ${spin.id}`,
      customId: `ruleta:${spin.id}`,
    });

    const { error: insertError } = await db.from("pagos_paypal").insert({
      usuario_id: user.id,
      concepto: "ruleta_usd_spin",
      referencia_id: spin.id,
      monto_usd: amountUsd,
      paypal_order_id: order.id,
      estado: "created",
      metadata: {
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
