import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { MAX_CAIDAS, MAX_CANSANCIO, CANSANCIO_POR_DERROTA } from "@/lib/caidas";

export async function PATCH(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  let body: { personajeId?: unknown; delta?: unknown; partidaId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const personajeId = Number(body.personajeId);
  const delta = Number(body.delta);
  const partidaId = body.partidaId ? String(body.partidaId) : null;

  if (!Number.isFinite(personajeId) || personajeId <= 0) {
    return NextResponse.json({ error: "personajeId inválido" }, { status: 400 });
  }
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: "delta debe ser 1 o -1" }, { status: 400 });
  }

  const { data: personaje, error: fetchError } = await session.db
    .from("personajes")
    .select("id, nombre, usuario_id, caidas, puntos_cansancio")
    .eq("id", personajeId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!personaje) {
    return NextResponse.json({ error: "Personaje no encontrado" }, { status: 404 });
  }

  const currentCaidas = Math.max(0, Math.min(MAX_CAIDAS, Number((personaje as any).caidas ?? 0)));
  const newCaidas = Math.max(0, Math.min(MAX_CAIDAS, currentCaidas + delta));

  if (newCaidas === currentCaidas) {
    return NextResponse.json({
      caidas: currentCaidas,
      derrotado: currentCaidas >= MAX_CAIDAS,
      puntosCansancio: Number((personaje as any).puntos_cansancio ?? 0),
    });
  }

  const currentCansancio = Number((personaje as any).puntos_cansancio ?? 0);
  const reachesDefeat = newCaidas >= MAX_CAIDAS;
  const revertsDefeat = currentCaidas >= MAX_CAIDAS && newCaidas < MAX_CAIDAS;

  // ponytail: la derrota satura en MAX_CANSANCIO sin matar; la muerte por
  // agotamiento solo ocurre al rehusar el descanso obligatorio (sleep-options).
  let newCansancio = currentCansancio;
  if (reachesDefeat) newCansancio = Math.min(MAX_CANSANCIO, currentCansancio + CANSANCIO_POR_DERROTA);
  if (revertsDefeat) newCansancio = Math.max(0, currentCansancio - CANSANCIO_POR_DERROTA);

  const { error: updateError } = await session.db
    .from("personajes")
    .update({ caidas: newCaidas, puntos_cansancio: newCansancio })
    .eq("id", personajeId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (partidaId && (reachesDefeat || revertsDefeat)) {
    const { error: participantError } = await session.db
      .from("partida_participantes")
      .update({ derrotado: reachesDefeat })
      .eq("partida_id", partidaId)
      .eq("personaje_id", personajeId);

    if (participantError) {
      return NextResponse.json({ error: participantError.message }, { status: 500 });
    }
  }

  if (partidaId) {
    await session.db.from("partidas_eventos").insert({
      partida_id: partidaId,
      tipo: "caida",
      personaje_id: personajeId,
      personaje_nombre: (personaje as any).nombre ?? null,
      usuario_id: (personaje as any).usuario_id ?? null,
      cantidad: newCaidas,
      metadata: { delta, derrotado: reachesDefeat, cansancio: newCansancio },
    });
  }

  return NextResponse.json({
    caidas: newCaidas,
    derrotado: reachesDefeat,
    puntosCansancio: newCansancio,
  });
}

// Descanso largo en expedición: restaura a 0 las caídas y reduce 1 nivel de
// agotamiento a los participantes activos (los muertos y derrotados ya
// abandonaron la partida). Como en D&D 5e 2014 solo cabe un descanso largo
// por día de aventura, se permite uno por expedición.
export async function POST(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  let body: { partidaId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const partidaId = String(body.partidaId ?? "").trim();
  if (!partidaId) {
    return NextResponse.json({ error: "partidaId es requerido" }, { status: 400 });
  }

  const { count: descansosPrevios } = await session.db
    .from("partidas_eventos")
    .select("id", { count: "exact", head: true })
    .eq("partida_id", partidaId)
    .eq("tipo", "descanso_largo");

  if ((descansosPrevios ?? 0) > 0) {
    return NextResponse.json(
      { error: "Ya se realizó un descanso largo en esta expedición" },
      { status: 409 },
    );
  }

  const { data: participantes, error: fetchError } = await session.db
    .from("partida_participantes")
    .select("personaje_id, muerto, derrotado, personaje:personaje_id(nombre, caidas, puntos_cansancio)")
    .eq("partida_id", partidaId);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const personajes = (participantes ?? [])
    .filter((p: any) => {
      if (p.muerto || p.derrotado) return false;
      return Number(p.personaje?.caidas ?? 0) > 0 || Number(p.personaje?.puntos_cansancio ?? 0) > 0;
    })
    .map((p: any) => ({
      personajeId: Number(p.personaje_id),
      nombre: p.personaje?.nombre ?? "Personaje",
      caidasPrevias: Number(p.personaje?.caidas ?? 0),
      cansancioPrevio: Number(p.personaje?.puntos_cansancio ?? 0),
    }));

  for (const p of personajes) {
    const { error: updateError } = await session.db
      .from("personajes")
      .update({ caidas: 0, puntos_cansancio: Math.max(0, p.cansancioPrevio - 1) })
      .eq("id", p.personajeId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  await session.db.from("partidas_eventos").insert({
    partida_id: partidaId,
    tipo: "descanso_largo",
    metadata: { personajes },
  });

  return NextResponse.json({ personajes });
}
