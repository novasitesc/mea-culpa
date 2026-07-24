// GET — Listado de partidas disponibles con sus participantes, para la
// pantalla de partidas. Crearlas y cambiarlas de estado es cosa del admin
// (/api/admin/partidas).
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { normalizeAccountLevel } from "@/lib/accountLevel";
import { syncPartidasInProgress } from "@/lib/partidasState";

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

  try {
    await syncPartidasInProgress(db);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo sincronizar estado de partidas",
      },
      { status: 500 },
    );
  }

  const { data: perfil, error: perfilError } = await db
    .from("perfiles")
    .select("nivel, ultima_partida_finalizada_en, es_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError) {
    return NextResponse.json({ error: perfilError.message }, { status: 500 });
  }

  const esAdmin = (perfil as any)?.es_admin === true;
  const accountLevel = normalizeAccountLevel((perfil as any)?.nivel ?? 1);
  const maxVisibleTier = accountLevel >= 2 ? 2 : 1;

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

  const nowMs = Date.now();
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

  const cooldownEndsAtMs =
    lastFinishedAtMs == null ? null : lastFinishedAtMs + 24 * 60 * 60 * 1000;
  const inCooldown = cooldownEndsAtMs != null && nowMs < cooldownEndsAtMs;

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
        creada_por,
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

  // Buscar partidas en progreso donde el usuario es participante
  const { data: activaRows } = await db
    .from("partidas")
    .select(`
      id, titulo, comentario, estado, minimo_jugadores, maximo_jugadores,
      limite_jugadores, piso, inicio_en, tier, creada_en, creada_por,
      creador:creada_por ( nombre ),
      partida_participantes!inner (
        id, personaje_id, usuario_id, personaje:personaje_id ( nombre )
      )
    `)
    .eq("estado", "en_progreso")
    .eq("partida_participantes.usuario_id", user.id);

  // Para admins: también traer partidas en progreso que ellos crearon (aunque no sean participantes)
  const { data: dmActivaRows } = esAdmin
    ? await db
        .from("partidas")
        .select(`
          id, titulo, comentario, estado, minimo_jugadores, maximo_jugadores,
          limite_jugadores, piso, inicio_en, tier, creada_en, creada_por,
          creador:creada_por ( nombre ),
          partida_participantes (
            id, personaje_id, usuario_id, personaje:personaje_id ( nombre )
          )
        `)
        .eq("estado", "en_progreso")
        .eq("creada_por", user.id)
    : { data: [] };

  function buildEntry(p: any, opts: { esDmDe?: boolean } = {}) {
    const participants = p.partida_participantes ?? [];
    const participantCount = participants.length;
    const minPlayers = Math.max(5, Number(p.minimo_jugadores ?? 5));
    const maxPlayers = Math.max(5, Number(p.maximo_jugadores ?? p.limite_jugadores ?? 6));
    const slotsRemaining = Math.max(0, maxPlayers - participantCount);
    const isDm = opts.esDmDe ?? (esAdmin && p.creada_por === user!.id);

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
      inCooldown: isDm ? false : inCooldown,
      cooldownEndsAt: isDm ? null : (inCooldown && cooldownEndsAtMs != null ? new Date(cooldownEndsAtMs).toISOString() : null),
      cooldownSecondsRemaining: isDm ? 0 : (inCooldown && cooldownEndsAtMs != null ? Math.max(0, Math.floor((cooldownEndsAtMs - nowMs) / 1000)) : 0),
      createdAt: p.creada_en,
      createdBy: p.creador?.nombre ?? null,
      esDmDe: isDm,
      joinedCharacterIds: participants
        .filter((pp: any) => pp.usuario_id === user!.id)
        .map((pp: any) => Number(pp.personaje_id)),
      participants: participants.map((pp: any) => ({
        id: pp.id,
        characterId: Number(pp.personaje_id),
        characterName: pp.personaje?.nombre ?? "",
        userId: pp.usuario_id,
      })),
    };
  }

  const payload = (partidas ?? []).map((p: any) => buildEntry(p));

  // Añadir partidas activas (en_progreso) donde el usuario es participante o DM
  const existingIds = new Set(payload.map((p: any) => p.id));

  for (const p of [...(activaRows ?? []), ...(dmActivaRows ?? [])]) {
    if (existingIds.has((p as any).id)) continue;
    existingIds.add((p as any).id);
    payload.push(buildEntry(p as any));
  }

  return NextResponse.json(payload);
}
