import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { resolveRoll, collectObjetoIds, toRollResult, DiceConfigError } from "@/lib/dice/engine";
import { loadRewardConfig, loadObjetos, rollBodySchema } from "@/lib/dice/load";
import { personalAwarder } from "@/lib/dice/apply";

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
  const { recompensa_id, cantidad, personaje_id, roll_id } = parsed.data;

  // Personaje destino de ítems: opcional, pero si viene debe ser tuyo y estar vivo.
  let personajeId: number | null = null;
  if (personaje_id) {
    const { data: pj } = await db
      .from("personajes")
      .select("id, muerto")
      .eq("id", personaje_id)
      .eq("usuario_id", user.id)
      .maybeSingle();
    if (!pj || (pj as { muerto: boolean }).muerto) {
      return NextResponse.json({ error: "Personaje no válido" }, { status: 400 });
    }
    personajeId = personaje_id;
  }

  const config = await loadRewardConfig(db, recompensa_id);
  if (!config) {
    return NextResponse.json({ error: "Recompensa no encontrada" }, { status: 404 });
  }

  try {
    const tiradas = config.tipo === "lut" ? cantidad : 1;
    const outcomes = resolveRoll(config, tiradas);
    const objetos = await loadObjetos(db, collectObjetoIds(outcomes));
    const resultado = toRollResult(config, outcomes, objetos, cantidad);

    const rollId = roll_id ?? randomUUID();
    const awarder = personalAwarder(db, { userId: user.id, personajeId, config, cantidad, resultado });
    const ejec = await awarder.execute(rollId, outcomes);

    return NextResponse.json({ ...ejec.resultado, rollId, entregas: ejec.entregas, replayed: ejec.replayed });
  } catch (err) {
    if (err instanceof DiceConfigError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Oro insuficiente")) {
      return NextResponse.json({ error: "Oro insuficiente" }, { status: 400 });
    }
    console.error("[dados/roll]", err);
    return NextResponse.json({ error: "Error al procesar la tirada" }, { status: 500 });
  }
}

// Recuperación tras refresh: devuelve la tirada ya comprometida para reproducirla.
export async function GET(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rollId = new URL(request.url).searchParams.get("rollId");
  if (!rollId || !z.string().uuid().safeParse(rollId).success) {
    return NextResponse.json({ error: "rollId inválido" }, { status: 400 });
  }

  const { data } = await db
    .from("dados_tiradas")
    .select("roll_id, resultado, entregas")
    .eq("roll_id", rollId)
    .eq("usuario_id", user.id)
    .eq("contexto", "personal")
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Tirada no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ...(data.resultado as object), rollId, entregas: data.entregas ?? [], replayed: true });
}
