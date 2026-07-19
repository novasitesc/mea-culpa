import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { resolveRoll, collectObjetoIds, toRollResult, DiceConfigError } from "@/lib/dice/engine";
import { loadRewardConfig, loadObjetos, rollBodySchema } from "@/lib/dice/load";
import { applyOutcomes, partidaAwarder } from "@/lib/dice/apply";

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
  const { recompensa_id, cantidad, personaje_id } = parsed.data;

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

    await applyOutcomes(
      outcomes,
      partidaAwarder({
        db,
        config,
        objetos,
        partidaId,
        personajeId: personaje_id,
        personajeNombre: (participante as any).personaje?.nombre ?? "",
        targetUserId: (participante as any).usuario_id as string,
        adminId: session.userId,
      }),
    );

    return NextResponse.json(toRollResult(config, outcomes, objetos, cantidad));
  } catch (err) {
    if (err instanceof DiceConfigError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[partidas/dados/roll]", err);
    return NextResponse.json({ error: "Error al procesar la tirada" }, { status: 500 });
  }
}
