import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { normalizeAccountLevel } from "@/lib/accountLevel";

// GET /api/partidas
// Lista partidas abiertas para que el usuario autenticado pueda inscribirse.
export async function GET(request: Request) {
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
    .select("nivel")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError) {
    return NextResponse.json({ error: perfilError.message }, { status: 500 });
  }

  const accountLevel = normalizeAccountLevel((perfil as any)?.nivel ?? 1);
  const maxVisibleTier = accountLevel >= 2 ? 2 : 1;

  const { data: partidas, error } = await db
    .from("partidas")
    .select(
      `
        id,
        titulo,
        comentario,
        estado,
        minimo_jugadores,
        maximo_jugadores,
        limite_jugadores,
        piso,
        inicio_en,
        tier,
        creada_en,
        creador:creada_por ( nombre ),
        partida_participantes (
          id,
          personaje_id,
          usuario_id,
          personaje:personaje_id ( nombre )
        )
      `,
    )
    .eq("estado", "abierta")
    .lte("tier", maxVisibleTier)
    .order("creada_en", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = (partidas ?? []).map((p: any) => {
    const participants = p.partida_participantes ?? [];
    const participantCount = participants.length;
    const minPlayers = Math.max(5, Number(p.minimo_jugadores ?? 5));
    const maxPlayers = Math.max(5, Number(p.maximo_jugadores ?? p.limite_jugadores ?? 6));
    const slotsRemaining = Math.max(0, maxPlayers - participantCount);

    return {
      id: p.id,
      title: p.titulo,
      comment: p.comentario,
      status: p.estado,
      minPlayers,
      maxPlayers,
      playerLimit: maxPlayers,
      participantCount,
      slotsRemaining,
      floor: Number(p.piso ?? 1),
      startTime: p.inicio_en,
      tier: Number(p.tier ?? 1),
      isFull: participantCount >= maxPlayers,
      createdAt: p.creada_en,
      createdBy: p.creador?.nombre ?? null,
      joinedCharacterIds: participants
        .filter((pp: any) => pp.usuario_id === user.id)
        .map((pp: any) => Number(pp.personaje_id)),
      participants: participants.map((pp: any) => ({
        id: pp.id,
        characterId: Number(pp.personaje_id),
        characterName: pp.personaje?.nombre ?? "",
        userId: pp.usuario_id,
      })),
    };
  });

  return NextResponse.json(payload);
}
