import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { normalizeAccountLevel } from "@/lib/accountLevel";

// POST /api/partidas/join
// Inscribe un personaje del usuario autenticado a una partida abierta con cupo.
export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

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

  const { data: perfil, error: perfilError } = await db
    .from("perfiles")
    .select("nivel, ultima_partida_finalizada_en")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError) {
    return NextResponse.json({ error: perfilError.message }, { status: 500 });
  }

  const accountLevel = normalizeAccountLevel((perfil as any)?.nivel ?? 1);

  const { data: recentParticipations, error: recentParticipationsError } = await db
    .from("partida_participantes")
    .select(
      `
        partida:partida_id (
          id,
          estado,
          finalizada_en
        )
      `,
    )
    .eq("usuario_id", user.id);

  if (recentParticipationsError) {
    return NextResponse.json({ error: recentParticipationsError.message }, { status: 500 });
  }

  let lastFinishedAtMs: number | null = null;
  const profileLastFinishedRaw = (perfil as any)?.ultima_partida_finalizada_en;
  if (profileLastFinishedRaw) {
    const profileLastFinishedMs = new Date(String(profileLastFinishedRaw)).getTime();
    if (Number.isFinite(profileLastFinishedMs)) {
      lastFinishedAtMs = profileLastFinishedMs;
    }
  }
  for (const row of recentParticipations ?? []) {
    const partida = (row as any).partida;
    const estado = String(partida?.estado ?? "");
    const finalizadaEnRaw = partida?.finalizada_en;
    if (estado !== "finalizada" || !finalizadaEnRaw) continue;

    const finalizadaMs = new Date(String(finalizadaEnRaw)).getTime();
    if (!Number.isFinite(finalizadaMs)) continue;
    if (lastFinishedAtMs == null || finalizadaMs > lastFinishedAtMs) {
      lastFinishedAtMs = finalizadaMs;
    }
  }

  if (lastFinishedAtMs != null) {
    const cooldownEndsAtMs = lastFinishedAtMs + 24 * 60 * 60 * 1000;
    if (Date.now() < cooldownEndsAtMs) {
      return NextResponse.json(
        {
          error: "Debes esperar 24 horas después de tu última partida finalizada",
          cooldownEndsAt: new Date(cooldownEndsAtMs).toISOString(),
        },
        { status: 409 },
      );
    }
  }

  let body: { partidaId?: unknown; characterId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const partidaId = String(body.partidaId ?? "").trim();
  const characterId = Number(body.characterId);

  if (!partidaId || !Number.isFinite(characterId)) {
    return NextResponse.json(
      { error: "partidaId y characterId son requeridos" },
      { status: 400 },
    );
  }

  const { data: personaje, error: personajeError } = await db
    .from("personajes")
    .select("id")
    .eq("id", characterId)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (personajeError) {
    return NextResponse.json({ error: personajeError.message }, { status: 500 });
  }

  if (!personaje) {
    return NextResponse.json({ error: "Personaje no válido" }, { status: 403 });
  }

  const { data: pendingSleep, error: pendingSleepError } = await db
    .from("descansos_pendientes")
    .select("id")
    .eq("personaje_id", characterId)
    .maybeSingle();

  if (pendingSleepError) {
    return NextResponse.json({ error: pendingSleepError.message }, { status: 500 });
  }

  if (pendingSleep) {
    return NextResponse.json(
      { error: "Debes elegir donde dormir antes de volver a jugar" },
      { status: 409 },
    );
  }

  const { data: partida, error: partidaError } = await db
    .from("partidas")
    .select("id, titulo, estado, tier, maximo_jugadores, limite_jugadores")
    .eq("id", partidaId)
    .maybeSingle();

  if (partidaError) {
    return NextResponse.json({ error: partidaError.message }, { status: 500 });
  }

  if (!partida) {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  if (partida.estado !== "abierta") {
    return NextResponse.json(
      { error: "La partida ya no está disponible" },
      { status: 409 },
    );
  }

  if (Number((partida as any).tier ?? 1) > (accountLevel >= 2 ? 2 : 1)) {
    return NextResponse.json(
      { error: "No tienes nivel suficiente para esta partida" },
      { status: 403 },
    );
  }

  const { data: alreadyJoined, error: joinedError } = await db
    .from("partida_participantes")
    .select("id")
    .eq("partida_id", partidaId)
    .eq("personaje_id", characterId)
    .maybeSingle();

  if (joinedError) {
    return NextResponse.json({ error: joinedError.message }, { status: 500 });
  }

  if (alreadyJoined) {
    return NextResponse.json(
      { error: "Ese personaje ya está inscrito en esta partida" },
      { status: 409 },
    );
  }

  const { count: participantCount, error: countError } = await db
    .from("partida_participantes")
    .select("id", { count: "exact", head: true })
    .eq("partida_id", partidaId);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const playerLimit = Math.max(
    5,
    Number((partida as any).maximo_jugadores ?? (partida as any).limite_jugadores ?? 6),
  );
  if ((participantCount ?? 0) >= playerLimit) {
    return NextResponse.json(
      { error: "La partida alcanzó el límite de jugadores" },
      { status: 409 },
    );
  }

  const { data: memberships, error: membershipsError } = await db
    .from("partida_participantes")
    .select("partida_id")
    .or(`usuario_id.eq.${user.id},personaje_id.eq.${characterId}`)
    .neq("partida_id", partidaId);

  if (membershipsError) {
    return NextResponse.json({ error: membershipsError.message }, { status: 500 });
  }

  const candidatePartidaIds = Array.from(
    new Set((memberships ?? []).map((m: any) => String(m.partida_id)).filter(Boolean)),
  );

  if (candidatePartidaIds.length > 0) {
    const { data: activeMembership, error: activeMembershipError } = await db
      .from("partidas")
      .select("id, titulo")
      .in("id", candidatePartidaIds)
      .eq("estado", "abierta")
      .limit(1)
      .maybeSingle();

    if (activeMembershipError) {
      return NextResponse.json({ error: activeMembershipError.message }, { status: 500 });
    }

    if (activeMembership) {
      return NextResponse.json(
        {
          error: `Ya estás inscrito en otra partida abierta: ${
            (activeMembership as any).titulo ?? "sin título"
          }`,
        },
        { status: 409 },
      );
    }
  }

  const { error: insertError } = await db.from("partida_participantes").insert({
    partida_id: partidaId,
    personaje_id: characterId,
    usuario_id: user.id,
    oro_delta: 0,
    comentario: "",
    muerto: false,
  });

  if (insertError) {
    if (String((insertError as any).code) === "23505") {
      return NextResponse.json(
        { error: "Ese personaje ya está inscrito en esta partida" },
        { status: 409 },
      );
    }
    if (
      String((insertError as any).code) === "23514" ||
      insertError.message.toLowerCase().includes("otra partida abierta")
    ) {
      return NextResponse.json(
        { error: "No puedes estar en dos partidas abiertas al mismo tiempo" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const nextParticipantCount = (participantCount ?? 0) + 1;

  return NextResponse.json({
    partidaId,
    title: (partida as any).titulo,
    participantCount: nextParticipantCount,
    playerLimit,
    slotsRemaining: Math.max(0, playerLimit - nextParticipantCount),
  });
}
