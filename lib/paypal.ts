// Cliente HTTP de PayPal. Solo habla con PayPal: no toca la base de datos ni
// concede nada. Quien decide qué se entrega tras el pago son las rutas
// /api/profile/*-paypal/* y /api/paypal/webhook.
//
// El flujo de un pago tiene tres momentos:
//   1. createPayPalOrder  → se crea la orden y el navegador abre el checkout.
//   2. capturePayPalOrder → el usuario ya aprobó; aquí se cobra de verdad.
//   3. webhook            → PayPal avisa por su cuenta del resultado, por si el
//      usuario cerró la pestaña antes del paso 2. De ahí que el efecto se
//      registre con `effect_applied` en `pagos_paypal`: los pasos 2 y 3 pueden
//      llegar los dos, y el premio debe entregarse UNA sola vez.
type PayPalEnv = "sandbox" | "live";

type PayPalOrderResponse = {
  id: string;
  status: string;
};

type PayPalCaptureResponse = {
  id: string;
  status: string;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
      }>;
    };
  }>;
};

function getPayPalEnv(): PayPalEnv {
  return process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
}

function getPayPalApiBaseUrl(): string {
  return getPayPalEnv() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET no configurados");
  }

  return { clientId, clientSecret };
}

/** Token de acceso de PayPal (caduca; se pide uno nuevo en cada operación). */
export async function getPayPalAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getClientCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${getPayPalApiBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`No se pudo obtener access token de PayPal: ${details}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Respuesta de PayPal sin access_token");
  }

  return data.access_token;
}

/**
 * Crea la orden de pago. `customId` viaja hasta el webhook, así que es donde se
 * mete la referencia interna (qué usuario y qué concepto) para reconocer el
 * pago cuando PayPal nos avise.
 */
export async function createPayPalOrder(params: {
  amountUsd: number;
  description: string;
  customId: string;
}): Promise<PayPalOrderResponse> {
  const token = await getPayPalAccessToken();

  const response = await fetch(`${getPayPalApiBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: params.customId,
          description: params.description,
          amount: {
            currency_code: "USD",
            value: params.amountUsd.toFixed(2),
          },
        },
      ],
      application_context: {
        user_action: "PAY_NOW",
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`No se pudo crear orden PayPal: ${details}`);
  }

  const data = (await response.json()) as PayPalOrderResponse;

  if (!data.id) {
    throw new Error("PayPal no devolvio un id de orden");
  }

  return data;
}

/** Cobra una orden ya aprobada por el usuario. Este es el punto donde el dinero se mueve. */
export async function capturePayPalOrder(orderId: string): Promise<PayPalCaptureResponse> {
  const token = await getPayPalAccessToken();

  const response = await fetch(
    `${getPayPalApiBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`No se pudo capturar orden PayPal: ${details}`);
  }

  return (await response.json()) as PayPalCaptureResponse;
}

export function getCaptureIdFromCaptureResponse(capture: PayPalCaptureResponse): string | null {
  return capture.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
}

/**
 * Comprueba con PayPal que un webhook entrante es auténtico.
 *
 * OBLIGATORIO: la URL del webhook es pública, cualquiera puede mandarle un JSON
 * diciendo "pago completado". Sin esta verificación se regalarían resurrecciones
 * y tiradas. Devuelve false ante cualquier duda (incluido webhook_id sin
 * configurar): fallar cerrado, nunca abierto.
 */
export async function verifyPayPalWebhookSignature(params: {
  body: string;
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    return false;
  }

  const token = await getPayPalAccessToken();

  const parsedBody = JSON.parse(params.body);
  const response = await fetch(
    `${getPayPalApiBaseUrl()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: params.authAlgo,
        cert_url: params.certUrl,
        transmission_id: params.transmissionId,
        transmission_sig: params.transmissionSig,
        transmission_time: params.transmissionTime,
        webhook_id: webhookId,
        webhook_event: parsedBody,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return false;
  }

  const verification = (await response.json()) as { verification_status?: string };
  return verification.verification_status === "SUCCESS";
}
