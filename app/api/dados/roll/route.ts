// POST — Tirada de dados PERSONAL (el probador del panel admin: el usuario paga
// y recibe él mismo). La versión de partida está en partidas/[id]/dados/roll.
//
// La tirada tiene cuatro pasos separados a propósito (lib/dice/):
//   load.ts    → carga la configuración de la recompensa
//   engine.ts  → resuelve el resultado (función pura: config + azar → resultado)
//   apply.ts   → cobra y entrega, en una única transacción de base de datos
//   engine.ts  → traduce el resultado al formato que anima la UI
//
// GET existe para el caso de refrescar la página a media animación: con el
// `rollId` devuelve la tirada YA comprometida en vez de generar otra. Ese id es
// además la clave de idempotencia: reenviar el mismo POST no vuelve a cobrar.
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { resolveRoll, collectObjetoIds, toRollResult, DiceConfigError } from "@/lib/dice/engine";
import { loadRewardConfig, loadObjetos, rollBodySchema } from "@/lib/dice/load";
import { personalAwarder } from "@/lib/dice/apply";

// Tirada personal: solo admins/DMs (probador del panel admin).
export async function POST(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;
  const db = session.db;

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
      .eq("usuario_id", session.userId)
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
    const awarder = personalAwarder(db, { userId: session.userId, personajeId, config, cantidad, resultado });
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
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;
  const db = session.db;

  const rollId = new URL(request.url).searchParams.get("rollId");
  if (!rollId || !z.string().uuid().safeParse(rollId).success) {
    return NextResponse.json({ error: "rollId inválido" }, { status: 400 });
  }

  const { data } = await db
    .from("dados_tiradas")
    .select("roll_id, resultado, entregas")
    .eq("roll_id", rollId)
    .eq("usuario_id", session.userId)
    .eq("contexto", "personal")
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Tirada no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ...(data.resultado as object), rollId, entregas: data.entregas ?? [], replayed: true });
}
