import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { capturePayPalOrder, getCaptureIdFromCaptureResponse } from "@/lib/paypal";

export async function POST(request: Request) {
  try {
    const db = createServerClient();
    const { user, error: authError } = await getUserFromRequest(db, request);

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { orderId?: string } | null;
    const orderId = body?.orderId?.trim();

    if (!orderId) {
      return NextResponse.json({ error: "orderId es requerido" }, { status: 400 });
    }

    const { data: payment, error: paymentError } = await db
      .from("pagos_paypal")
      .select("id, estado")
      .eq("usuario_id", user.id)
      .eq("concepto", "character_slot_unlock")
      .eq("paypal_order_id", orderId)
      .maybeSingle();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    if (!payment) {
      return NextResponse.json({ error: "Pago PayPal no encontrado" }, { status: 404 });
    }

    const { data: profile, error: profileError } = await db
      .from("perfiles")
      .select("max_personajes")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const currentSlots = profile?.max_personajes ?? 2;

    if (currentSlots >= 5 && payment.estado !== "completed") {
      return NextResponse.json(
        { error: "Ya alcanzaste el maximo de slots (5/5)" },
        { status: 409 },
      );
    }

    if (payment.estado === "completed") {
      return NextResponse.json({
        success: true,
        status: "completed",
        awaitingWebhook: false,
        alreadyCaptured: true,
        newMaxCharacterSlots: currentSlots,
      });
    }

    let capture;
    try {
      capture = await capturePayPalOrder(orderId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error al capturar orden";
      if (message.includes("RESOURCE_NOT_FOUND") || message.includes("INVALID_RESOURCE_ID")) {
        await db
          .from("pagos_paypal")
          .update({
            estado: "failed",
            metadata: {
              captureError: message,
              reason: "resource_not_found_or_expired",
            },
          })
          .eq("id", payment.id);

        return NextResponse.json(
          {
            error:
              "La orden PayPal ya no existe o expiro. Vuelve a intentar el pago para generar una orden nueva.",
          },
          { status: 409 },
        );
      }
      throw error;
    }
    const captureId = getCaptureIdFromCaptureResponse(capture);

    const mappedStatus = capture.status === "COMPLETED" ? "completed" : "failed";

    const { error: updateError } = await db
      .from("pagos_paypal")
      .update({
        estado: mappedStatus,
        paypal_capture_id: captureId,
        metadata: {
          capture,
        },
      })
      .eq("id", payment.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (mappedStatus === "completed") {
      const { error: applyError } = await db.rpc("paypal_aplicar_efecto", {
        p_pago_id: payment.id,
      });

      if (applyError) {
        return NextResponse.json({ error: applyError.message }, { status: 500 });
      }
    }

    const { data: updatedProfile, error: updatedProfileError } = await db
      .from("perfiles")
      .select("max_personajes")
      .eq("id", user.id)
      .single();

    if (updatedProfileError) {
      return NextResponse.json({ error: updatedProfileError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: mappedStatus === "completed",
      status: mappedStatus,
      awaitingWebhook: false,
      captureId,
      newMaxCharacterSlots: updatedProfile?.max_personajes ?? currentSlots,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
