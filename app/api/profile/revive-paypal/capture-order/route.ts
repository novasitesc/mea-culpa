import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { capturePayPalOrder, getCaptureIdFromCaptureResponse } from "@/lib/paypal";
import { reviveCharacter } from "@/lib/characterLife";

function extractCharacterId(metadata: unknown): number | null {
  const raw = (metadata as { characterId?: unknown } | null)?.characterId;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

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
      .select("id, estado, effect_applied, metadata")
      .eq("usuario_id", user.id)
      .eq("concepto", "character_revive")
      .eq("paypal_order_id", orderId)
      .maybeSingle();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    if (!payment) {
      return NextResponse.json({ error: "Pago PayPal no encontrado" }, { status: 404 });
    }

    const characterId = extractCharacterId((payment as any).metadata);
    if (!characterId) {
      return NextResponse.json({ error: "Pago sin characterId válido" }, { status: 500 });
    }

    if ((payment as any).estado !== "completed") {
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
            .eq("id", (payment as any).id);

          return NextResponse.json(
            {
              error:
                "La orden PayPal ya no existe o expiró. Vuelve a intentar el pago para generar una orden nueva.",
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
            ...((payment as any).metadata ?? {}),
            capture,
          },
        })
        .eq("id", (payment as any).id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      if (mappedStatus !== "completed") {
        return NextResponse.json({ success: false, status: mappedStatus });
      }
    }

    if (!(payment as any).effect_applied) {
      const reviveResult = await reviveCharacter({
        db,
        userId: user.id,
        characterId,
        reason: "paypal_revive",
        paymentId: (payment as any).id,
        metadata: { source: "capture-order" },
      });

      if (!reviveResult.ok) {
        return NextResponse.json({ error: reviveResult.error ?? "No se pudo revivir" }, { status: 500 });
      }

      const { error: applyError } = await db
        .from("pagos_paypal")
        .update({
          effect_applied: true,
          completado_en: new Date().toISOString(),
        })
        .eq("id", (payment as any).id)
        .eq("effect_applied", false);

      if (applyError) {
        return NextResponse.json({ error: applyError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      status: "completed",
      characterId,
      revived: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
