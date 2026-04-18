import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getNextSpinCost, rollRoulette } from "@/lib/roulette";

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

    const { data: pendingSpin, error: pendingSpinError } = await db
      .from("ruleta_tiradas")
      .select("id")
      .eq("usuario_id", user.id)
      .eq("cobro_pendiente", true)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingSpinError) {
      return NextResponse.json({ error: pendingSpinError.message }, { status: 500 });
    }

    if (pendingSpin) {
      return NextResponse.json(
        {
          error: "Tienes una tirada USD pendiente de pago",
          pendingSpinId: pendingSpin.id,
        },
        { status: 409 },
      );
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
      cobroPendiente: Boolean(row?.cobro_pendiente),
      oro: row?.oro_resultante ?? null,
      nextCost: getNextSpinCost(totalSpins + 1),
      spinCount: totalSpins + 1,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
