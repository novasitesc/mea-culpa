import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { resolveRoll, collectObjetoIds, toRollResult, DiceConfigError } from "@/lib/dice/engine";
import { loadRewardConfig, loadObjetos, rollBodySchema } from "@/lib/dice/load";
import { applyOutcomes, personalAwarder } from "@/lib/dice/apply";

export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = rollBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }
  const { recompensa_id, cantidad } = parsed.data;

  const config = await loadRewardConfig(db, recompensa_id);
  if (!config) {
    return NextResponse.json({ error: "Recompensa no encontrada" }, { status: 404 });
  }

  try {
    const tiradas = config.tipo === "lut" ? cantidad : 1;
    const outcomes = resolveRoll(config, tiradas);
    const awarder = personalAwarder(db, user.id, config);

    try {
      await awarder.chargeGold(config.costoOro * tiradas);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      return NextResponse.json(
        { error: msg.includes("Oro insuficiente") ? "Oro insuficiente" : "Error al procesar el pago" },
        { status: 400 },
      );
    }

    await applyOutcomes(outcomes, awarder);
    const objetos = await loadObjetos(db, collectObjetoIds(outcomes));
    return NextResponse.json(toRollResult(config, outcomes, objetos, cantidad));
  } catch (err) {
    if (err instanceof DiceConfigError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[dados/roll]", err);
    return NextResponse.json({ error: "Error al procesar la tirada" }, { status: 500 });
  }
}
