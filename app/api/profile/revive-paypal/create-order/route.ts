import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { createPayPalOrder } from "@/lib/paypal";

const REVIVE_PRICE_USD = 10.0;

export async function POST(request: Request) {
  try {
    const db = createServerClient();
    const { user, error: authError } = await getUserFromRequest(db, request);

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { characterId?: unknown } | null;
    const characterId = Number(body?.characterId);

    if (!Number.isFinite(characterId) || characterId <= 0) {
      return NextResponse.json({ error: "characterId es requerido" }, { status: 400 });
    }

    const { data: character, error: characterError } = await db
      .from("personajes")
      .select("id, nombre, estado_vida")
      .eq("id", characterId)
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (characterError) {
      return NextResponse.json({ error: characterError.message }, { status: 500 });
    }

    if (!character) {
      return NextResponse.json({ error: "Personaje no válido" }, { status: 403 });
    }

    if (String((character as any).estado_vida ?? "vivo") !== "muerto") {
      return NextResponse.json({ error: "El personaje no está muerto" }, { status: 409 });
    }

    const { data: existing } = await db
      .from("pagos_paypal")
      .select("id, estado")
      .eq("usuario_id", user.id)
      .eq("concepto", "character_revive")
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
            invalidatedBy: "new_revive_order_requested",
            previousStatus: existing.estado,
          },
        })
        .eq("id", existing.id);
    }

    const order = await createPayPalOrder({
      amountUsd: REVIVE_PRICE_USD,
      description: `Revivir personaje: ${(character as any).nombre ?? `#${characterId}`}`,
      customId: `character_revive:${user.id}:${characterId}`,
    });

    const { error: insertError } = await db.from("pagos_paypal").insert({
      usuario_id: user.id,
      concepto: "character_revive",
      referencia_id: null,
      monto_usd: REVIVE_PRICE_USD,
      paypal_order_id: order.id,
      estado: "created",
      metadata: {
        characterId,
        orderStatus: order.status,
      },
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      characterId,
      priceUsd: REVIVE_PRICE_USD,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
