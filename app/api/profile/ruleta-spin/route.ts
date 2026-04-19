import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getNextSpinCost, rollRoulette } from "@/lib/roulette";

async function getCurrentGold(userId: string): Promise<number | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("perfiles")
    .select("oro")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.oro === "number" ? data.oro : null;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const db = createServerClient();

    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { count, error: countError } = await db
      .from("ruleta_tiradas")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", user.id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const totalSpins = count ?? 0;
    const nextCost = getNextSpinCost(totalSpins);
    const spin = rollRoulette();

    let prepaidPayment:
      | {
          id: string;
          metadata: Record<string, unknown> | null;
        }
      | null = null;

    if (nextCost.type === "usd") {
      const { data: paid, error: paidError } = await db
        .from("pagos_paypal")
        .select("id, metadata")
        .eq("usuario_id", user.id)
        .eq("concepto", "ruleta_usd_spin")
        .eq("estado", "completed")
        .eq("effect_applied", false)
        .is("referencia_id", null)
        .order("creado_en", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (paidError) {
        return NextResponse.json({ error: paidError.message }, { status: 500 });
      }

      if (!paid) {
        return NextResponse.json(
          { error: "Debes pagar la tirada USD antes de usar la ruleta" },
          { status: 402 },
        );
      }

      prepaidPayment = paid as { id: string; metadata: Record<string, unknown> | null };
    }

    const { data, error } = await db.rpc("ruleta_registrar_tirada", {
      p_usuario_id: user.id,
      p_slot: spin.slot,
      p_categoria: spin.category,
      p_premio_label: spin.rewardLabel,
      p_costo_tipo: nextCost.type,
      p_costo_monto: nextCost.amount,
      p_ciclo_numero: nextCost.step,
    });

    if (error) {
      if (error.message?.includes("Oro insuficiente")) {
        return NextResponse.json({ error: "Oro insuficiente" }, { status: 422 });
      }
      if (error.message?.toLowerCase().includes("deshabilitada")) {
        return NextResponse.json(
          { error: "Ruleta deshabilitada" },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    let resolvedGold =
      typeof row?.oro_resultante === "number" ? row.oro_resultante : null;

    if (nextCost.type === "oro" && resolvedGold === null) {
      resolvedGold = await getCurrentGold(user.id);
      if (resolvedGold === null) {
        return NextResponse.json(
          { error: "No se pudo resolver el saldo tras la tirada" },
          { status: 500 },
        );
      }
    }

    if (nextCost.type === "usd" && row?.tirada_id && prepaidPayment) {
      const { error: spinUpdateError } = await db
        .from("ruleta_tiradas")
        .update({ cobro_pendiente: false })
        .eq("id", row.tirada_id)
        .eq("usuario_id", user.id);

      if (spinUpdateError) {
        return NextResponse.json({ error: spinUpdateError.message }, { status: 500 });
      }

      const { error: consumeError } = await db
        .from("pagos_paypal")
        .update({
          effect_applied: true,
          referencia_id: row.tirada_id,
          metadata: {
            ...(prepaidPayment.metadata ?? {}),
            consumedBy: "ruleta_spin",
            consumedSpinId: row.tirada_id,
            consumedAt: new Date().toISOString(),
          },
        })
        .eq("id", prepaidPayment.id)
        .eq("effect_applied", false);

      if (consumeError) {
        return NextResponse.json({ error: consumeError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      tiradaId: row?.tirada_id,
      slot: spin.slot,
      category: spin.category,
      rewardLabel: spin.rewardLabel,
      cost: {
        step: nextCost.step,
        type: nextCost.type,
        amount: nextCost.amount,
      },
      cobroPendiente: false,
      oro: resolvedGold,
      nextCost: getNextSpinCost(totalSpins + 1),
      spinCount: totalSpins + 1,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
