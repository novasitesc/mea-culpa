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
