// POST / GET — Solo admin (el DM). Tirada de dados DENTRO de una partida.
// Misma resolución que /api/dados/roll pero con otro aplicador (partidaAwarder,
// lib/dice/apply.ts): aquí el DM no paga, el premio va al personaje del jugador
// y queda registrado en el feed de la sala en vez de en el historial personal.
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { resolveRoll, collectObjetoIds, toRollResult, DiceConfigError } from "@/lib/dice/engine";
import { loadRewardConfig, loadObjetos, rollBodySchema } from "@/lib/dice/load";
import { partidaAwarder } from "@/lib/dice/apply";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: partidaId } = await params;

  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;
  const db = session.db;

  const { data: partida } = await db
    .from("partidas")
    .select("id, estado")
    .eq("id", partidaId)
    .maybeSingle();

  if (!partida || (partida as any).estado !== "en_progreso") {
    return NextResponse.json({ error: "Partida no está en progreso" }, { status: 403 });
  }

  const parsed = rollBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.personaje_id) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }
  const { recompensa_id, cantidad, personaje_id, roll_id } = parsed.data;

  const { data: participante } = await db
    .from("partida_participantes")
    .select("id, usuario_id, personaje:personaje_id ( nombre )")
    .eq("partida_id", partidaId)
    .eq("personaje_id", personaje_id)
    .maybeSingle();

  if (!participante) {
    return NextResponse.json({ error: "Personaje no es participante de esta partida" }, { status: 400 });
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
    const awarder = partidaAwarder(db, {
      config,
      objetos,
      partidaId,
      personajeId: personaje_id,
      personajeNombre: (participante as any).personaje?.nombre ?? "",
      targetUserId: (participante as any).usuario_id as string,
      adminId: session.userId,
      cantidad,
      resultado,
    });
    const ejec = await awarder.execute(rollId, outcomes);

    return NextResponse.json({ ...ejec.resultado, rollId, entregas: ejec.entregas, replayed: ejec.replayed });
  } catch (err) {
    if (err instanceof DiceConfigError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[partidas/dados/roll]", err);
    return NextResponse.json({ error: "Error al procesar la tirada" }, { status: 500 });
  }
}

// Recuperación tras refresh en la sala DM.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: partidaId } = await params;

  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const db = result.session.db;

  const rollId = new URL(request.url).searchParams.get("rollId");
  if (!rollId || !z.string().uuid().safeParse(rollId).success) {
    return NextResponse.json({ error: "rollId inválido" }, { status: 400 });
  }

  const { data } = await db
    .from("dados_tiradas")
    .select("roll_id, resultado, entregas")
    .eq("roll_id", rollId)
    .eq("partida_id", partidaId)
    .eq("contexto", "partida")
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Tirada no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ...(data.resultado as object), rollId, entregas: data.entregas ?? [], replayed: true });
}
