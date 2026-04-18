import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { verifyPayPalWebhookSignature } from "@/lib/paypal";

type WebhookEvent = {
  event_type?: string;
  resource?: {
    id?: string;
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
      };
    };
  };
};

function getHeader(headers: Headers, key: string): string {
  return headers.get(key) ?? "";
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const transmissionId = getHeader(request.headers, "paypal-transmission-id");
    const transmissionTime = getHeader(request.headers, "paypal-transmission-time");
    const certUrl = getHeader(request.headers, "paypal-cert-url");
    const authAlgo = getHeader(request.headers, "paypal-auth-algo");
    const transmissionSig = getHeader(request.headers, "paypal-transmission-sig");

    if (
      !transmissionId ||
      !transmissionTime ||
      !certUrl ||
      !authAlgo ||
      !transmissionSig
    ) {
      return NextResponse.json({ error: "Headers de webhook incompletos" }, { status: 400 });
    }

    const isValid = await verifyPayPalWebhookSignature({
      body: rawBody,
      transmissionId,
      transmissionTime,
      certUrl,
      authAlgo,
      transmissionSig,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Firma de webhook invalida" }, { status: 401 });
    }

    const event = JSON.parse(rawBody) as WebhookEvent;
    const eventType = event.event_type ?? "";
    const captureId = event.resource?.id ?? null;
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id ?? null;

    if (!orderId && !captureId) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const db = createServerClient();

    const { data: payment, error: paymentError } = await db
      .from("pagos_paypal")
      .select("id, estado, concepto")
      .or(
        [
          orderId ? `paypal_order_id.eq.${orderId}` : "",
          captureId ? `paypal_capture_id.eq.${captureId}` : "",
        ]
          .filter(Boolean)
          .join(","),
      )
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    if (!payment) {
      return NextResponse.json({ received: true, ignored: true });
    }

    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      if (payment.estado !== "completed") {
        const { error: updateError } = await db
          .from("pagos_paypal")
          .update({
            estado: "completed",
            paypal_capture_id: captureId,
            metadata: {
              webhookEventType: eventType,
              webhookResource: event.resource,
            },
            completado_en: new Date().toISOString(),
          })
          .eq("id", payment.id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
      }

      if (payment.concepto === "character_slot_unlock") {
        const { error: applyError } = await db.rpc("paypal_aplicar_efecto", {
          p_pago_id: payment.id,
        });

        if (applyError) {
          return NextResponse.json({ error: applyError.message }, { status: 500 });
        }
      }
    }

    if (
      eventType === "PAYMENT.CAPTURE.DENIED" ||
      eventType === "PAYMENT.CAPTURE.REFUNDED" ||
      eventType === "PAYMENT.CAPTURE.REVERSED"
    ) {
      const failedState = eventType === "PAYMENT.CAPTURE.REFUNDED" ? "refunded" : "failed";
      await db
        .from("pagos_paypal")
        .update({
          estado: failedState,
          paypal_capture_id: captureId,
          metadata: {
            webhookEventType: eventType,
            webhookResource: event.resource,
          },
        })
        .eq("id", payment.id);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
