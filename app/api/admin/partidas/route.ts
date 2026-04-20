import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { markCharacterDead } from "@/lib/characterLife";
import { syncPartidasInProgress } from "@/lib/partidasState";

// GET /api/admin/partidas
// Lista partidas con participantes, cupo y metadata de disponibilidad.
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  try {
    await syncPartidasInProgress(session.db);
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

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  let partidasQuery = session.db
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
        finalizada_en,
        creada_por,
        creador:creada_por ( nombre ),
        partida_participantes (
          id,
          personaje_id,
          usuario_id,
          oro_delta,
          comentario,
          muerto,
          personaje:personaje_id ( nombre ),
          usuario:usuario_id ( nombre )
        )
      `,
    )
    .order("creada_en", { ascending: false })
    .limit(limit);

  if (statusFilter === "abierta" || statusFilter === "finalizada" || statusFilter === "en_progreso") {
    partidasQuery = partidasQuery.eq("estado", statusFilter);
  } else if (statusFilter === "activa") {
    partidasQuery = partidasQuery.in("estado", ["abierta", "en_progreso"]);
  }

  const { data: partidas, error: partidasError } = await partidasQuery;

  if (partidasError) {
    return NextResponse.json({ error: partidasError.message }, { status: 500 });
  }

  const partidaIds = (partidas ?? []).map((p: any) => p.id);
  const itemsByPartida = new Map<string, any[]>();

  if (partidaIds.length > 0) {
    const { data: items, error: itemsError } = await session.db
      .from("transacciones_objetos")
      .select(
        `
        partida_id,
        personaje_id,
        objeto_id,
        cantidad,
        creado_en,
        objeto:objeto_id ( nombre, icono )
      `,
      )
      .in("partida_id", partidaIds)
      .eq("origen", "admin");

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    for (const item of items ?? []) {
      const partidaId = (item as any).partida_id;
      if (!partidaId) continue;
      const list = itemsByPartida.get(partidaId) ?? [];
      list.push(item);
      itemsByPartida.set(partidaId, list);
    }
  }

  const payload = (partidas ?? []).map((p: any) => {
    const participantCount = (p.partida_participantes ?? []).length;
    const minPlayers = Math.max(5, Number(p.minimo_jugadores ?? 5));
    const maxPlayers = Math.max(5, Number(p.maximo_jugadores ?? p.limite_jugadores ?? 6));

    return {
      id: p.id,
      title: p.titulo,
      comment: p.comentario,
      status: p.estado,
      minPlayers,
      maxPlayers,
      playerLimit: maxPlayers,
      participantCount,
      floor: Number(p.piso ?? 1),
      startTime: p.inicio_en,
      tier: Number(p.tier ?? 1),
      isFull: participantCount >= maxPlayers,
      isJoinable: p.estado === "abierta" && participantCount < maxPlayers,
      createdAt: p.creada_en,
      finalizedAt: p.finalizada_en,
      createdBy: p.creador?.nombre ?? null,
      participants: (p.partida_participantes ?? []).map((pp: any) => ({
        id: pp.id,
        characterId: pp.personaje_id,
        characterName: pp.personaje?.nombre ?? "",
        userId: pp.usuario_id,
        userName: pp.usuario?.nombre ?? "",
        gold: pp.oro_delta ?? 0,
        comment: pp.comentario ?? "",
        dead: pp.muerto ?? false,
      })),
      items: (itemsByPartida.get(p.id) ?? []).map((it: any) => ({
        characterId: it.personaje_id,
        objectId: it.objeto_id,
        objectName: it.objeto?.nombre ?? "",
        objectIcon: it.objeto?.icono ?? "📦",
        qty: it.cantidad ?? 1,
      })),
    };
  });

  return NextResponse.json(payload);
}

// POST /api/admin/partidas
// Publica una partida abierta con cupo máximo.
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const body = await request.json();
  const title = String(body?.title ?? "").trim();
  const comment = String(body?.comment ?? "").trim();
  const minPlayers = 5;
  const maxPlayers = Math.floor(Number(body?.playerLimit ?? body?.maxPlayers ?? 6));
  const floor = Math.floor(Number(body?.floor ?? 1));
  const tier = Math.floor(Number(body?.tier ?? 1));
  const startTimeRaw = body?.startTime;
  const hasStartTime = typeof startTimeRaw === "string" && startTimeRaw.trim().length > 0;
  const startTime =
    hasStartTime
      ? new Date(startTimeRaw)
      : null;

  if (!title) {
    return NextResponse.json({ error: "El nombre de la partida es obligatorio" }, { status: 400 });
  }

  if (!Number.isFinite(maxPlayers) || maxPlayers < 5 || maxPlayers > 6) {
    return NextResponse.json(
      { error: "La cantidad de jugadores debe estar entre 5 y 6" },
      { status: 400 },
    );
  }

  if (!Number.isFinite(floor) || floor < 1 || floor > 20) {
    return NextResponse.json(
      { error: "El piso debe estar entre 1 y 20" },
      { status: 400 },
    );
  }

  if (tier !== 1 && tier !== 2) {
    return NextResponse.json(
      { error: "El tier debe ser 1 o 2" },
      { status: 400 },
    );
  }

  if (!hasStartTime) {
    return NextResponse.json(
      { error: "La fecha y hora de inicio son obligatorias" },
      { status: 400 },
    );
  }

  if (!startTime || Number.isNaN(startTime.getTime())) {
    return NextResponse.json(
      { error: "La hora de inicio es inválida" },
      { status: 400 },
    );
  }

  const { data: partida, error: partidaError } = await session.db
    .from("partidas")
    .insert({
      titulo: title,
      comentario: comment,
      minimo_jugadores: minPlayers,
      maximo_jugadores: maxPlayers,
      limite_jugadores: maxPlayers,
      piso: floor,
      inicio_en: startTime.toISOString(),
      tier,
      creada_por: session.userId,
    })
    .select("id, creada_en, estado, minimo_jugadores, maximo_jugadores, limite_jugadores, piso, inicio_en, tier")
    .single();

  if (partidaError || !partida) {
    return NextResponse.json(
      { error: partidaError?.message ?? "Error al crear partida" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      id: (partida as any).id,
      createdAt: (partida as any).creada_en,
      status: (partida as any).estado,
      minPlayers: (partida as any).minimo_jugadores,
      maxPlayers: (partida as any).maximo_jugadores ?? (partida as any).limite_jugadores,
      playerLimit: (partida as any).maximo_jugadores ?? (partida as any).limite_jugadores,
      floor: (partida as any).piso,
      startTime: (partida as any).inicio_en,
      tier: (partida as any).tier,
      participants: 0,
    },
    { status: 201 },
  );
}

// PATCH /api/admin/partidas
// Cierra una partida activa y permite asignar recompensas finales.
export async function PATCH(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const body = await request.json();
  const partidaId = String(body?.partidaId ?? "").trim();
  const action = String(body?.action ?? "").trim();
  const participantRewards = Array.isArray(body?.participantRewards)
    ? body.participantRewards
    : [];

  if (!partidaId) {
    return NextResponse.json({ error: "Falta partidaId" }, { status: 400 });
  }

  if (action !== "close") {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const { data: partida, error: partidaError } = await session.db
    .from("partidas")
    .select("id, estado, finalizada_en")
    .eq("id", partidaId)
    .maybeSingle();

  if (partidaError) {
    return NextResponse.json({ error: partidaError.message }, { status: 500 });
  }

  if (!partida) {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  if (partida.estado === "finalizada") {
    return NextResponse.json({
      id: partida.id,
      status: partida.estado,
      finalizedAt: partida.finalizada_en,
    });
  }

  const { data: participantesPartida, error: participantesPartidaError } = await session.db
    .from("partida_participantes")
    .select("id, personaje_id, usuario_id, muerto")
    .eq("partida_id", partidaId);

  if (participantesPartidaError) {
    return NextResponse.json({ error: participantesPartidaError.message }, { status: 500 });
  }

  const participantsByCharacter = new Map<number, { id: string; usuario_id: string | null }>();
  for (const row of participantesPartida ?? []) {
    participantsByCharacter.set(Number((row as any).personaje_id), {
      id: String((row as any).id),
      usuario_id: ((row as any).usuario_id as string | null) ?? null,
    });
  }

  const itemsPayload: {
    partida_id: string;
    personaje_id: number;
    objeto_id: number;
    origen: string;
    cantidad: number;
  }[] = [];

  for (const rewardRaw of participantRewards) {
    const characterId = Number((rewardRaw as any)?.characterId);
    if (!Number.isFinite(characterId)) {
      return NextResponse.json({ error: "characterId inválido en recompensas" }, { status: 400 });
    }

    const participantRow = participantsByCharacter.get(characterId);
    if (!participantRow) {
      return NextResponse.json(
        { error: "Uno de los personajes no pertenece a esta partida" },
        { status: 400 },
      );
    }

    const gold = Math.max(0, Number((rewardRaw as any)?.gold ?? 0) || 0);
    const levelUps = Math.max(0, Math.floor(Number((rewardRaw as any)?.levelUps ?? 0) || 0));
    const rewardItems = Array.isArray((rewardRaw as any)?.items)
      ? (rewardRaw as any).items
      : [];

    if (gold > 0) {
      const { error: updateParticipantGoldError } = await session.db
        .from("partida_participantes")
        .update({ oro_delta: gold })
        .eq("id", participantRow.id);

      if (updateParticipantGoldError) {
        return NextResponse.json(
          { error: updateParticipantGoldError.message },
          { status: 500 },
        );
      }

      if (participantRow.usuario_id) {
        const { error: goldError } = await session.db.rpc("modificar_oro", {
          p_usuario_id: participantRow.usuario_id,
          p_delta: gold,
          p_concepto: `partida_cierre:${partidaId}`,
          p_referencia: partidaId,
          p_admin_id: session.userId,
        });

        if (goldError) {
          return NextResponse.json({ error: goldError.message }, { status: 500 });
        }
      }
    }

    if (levelUps > 0) {
      const { data: classRows, error: classRowsError } = await session.db
        .from("clases_personaje")
        .select("id, orden")
        .eq("personaje_id", characterId)
        .order("orden", { ascending: true })
        .limit(1);

      if (classRowsError) {
        return NextResponse.json({ error: classRowsError.message }, { status: 500 });
      }

      const classRow = classRows?.[0] as any;
      if (classRow?.id) {
        const { data: classLevelData, error: classLevelError } = await session.db
          .from("clases_personaje")
          .select("nivel")
          .eq("id", classRow.id)
          .single();

        if (classLevelError) {
          return NextResponse.json({ error: classLevelError.message }, { status: 500 });
        }

        const currentLevel = Number((classLevelData as any).nivel ?? 1);
        const nextLevel = Math.min(20, Math.max(1, currentLevel + levelUps));
        const { error: updateLevelError } = await session.db
          .from("clases_personaje")
          .update({ nivel: nextLevel })
          .eq("id", classRow.id);

        if (updateLevelError) {
          return NextResponse.json({ error: updateLevelError.message }, { status: 500 });
        }
      }
    }

    const itemMap = new Map<number, number>();
    for (const rawItem of rewardItems) {
      const objectId = Number((rawItem as any)?.objectId);
      if (!Number.isFinite(objectId)) continue;
      const qty = Math.max(1, Number((rawItem as any)?.qty ?? 1) || 1);
      itemMap.set(objectId, (itemMap.get(objectId) ?? 0) + qty);
    }

    const uniqueObjectIds = Array.from(itemMap.keys());

    if (uniqueObjectIds.length > 0) {
      const { data: personaje, error: personajeError } = await session.db
        .from("personajes")
        .select("capacidad_bolsa")
        .eq("id", characterId)
        .single();

      if (personajeError || !personaje) {
        return NextResponse.json(
          { error: "No se pudo cargar la capacidad de bolsa" },
          { status: 500 },
        );
      }

      const { data: existingItems, error: existingError } = await session.db
        .from("bolsa_objetos")
        .select("id, objeto_id, cantidad")
        .eq("personaje_id", characterId)
        .in("objeto_id", uniqueObjectIds);

      if (existingError) {
        return NextResponse.json({ error: existingError.message }, { status: 500 });
      }

      const existingMap = new Map<number, { id: number; cantidad: number }>();
      for (const row of existingItems ?? []) {
        existingMap.set((row as any).objeto_id, {
          id: (row as any).id,
          cantidad: (row as any).cantidad,
        });
      }

      const { count: bagCount, error: bagCountError } = await session.db
        .from("bolsa_objetos")
        .select("id", { count: "exact", head: true })
        .eq("personaje_id", characterId);

      if (bagCountError) {
        return NextResponse.json({ error: bagCountError.message }, { status: 500 });
      }

      const bagCapacity = Number((personaje as any).capacidad_bolsa ?? 0);
      let freeSlots = Math.max(0, bagCapacity - Number(bagCount ?? 0));

      const { data: maxOrdenRow, error: maxOrdenError } = await session.db
        .from("bolsa_objetos")
        .select("orden")
        .eq("personaje_id", characterId)
        .order("orden", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxOrdenError) {
        return NextResponse.json({ error: maxOrdenError.message }, { status: 500 });
      }

      let nextOrden = maxOrdenRow?.orden ?? -1;

      for (const [objectId, qty] of itemMap.entries()) {
        const existing = existingMap.get(objectId);
        if (existing) {
          const { error: updateError } = await session.db
            .from("bolsa_objetos")
            .update({ cantidad: existing.cantidad + qty })
            .eq("id", existing.id);

          if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
          }
        } else {
          if (freeSlots <= 0) {
            // Si no hay espacio en bolsa, el objeto se descarta sin bloquear el cierre.
            continue;
          }

          nextOrden += 1;
          const { error: insertError } = await session.db
            .from("bolsa_objetos")
            .insert({
              personaje_id: characterId,
              objeto_id: objectId,
              cantidad: qty,
              orden: nextOrden,
            });

          if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
          }

          freeSlots -= 1;
        }

        itemsPayload.push({
          partida_id: partidaId,
          personaje_id: characterId,
          objeto_id: objectId,
          origen: "admin",
          cantidad: qty,
        });
      }
    }
  }

  if (itemsPayload.length > 0) {
    const { error: itemsError } = await session.db
      .from("transacciones_objetos")
      .insert(itemsPayload);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  const finalizedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await session.db
    .from("partidas")
    .update({ estado: "finalizada", finalizada_en: finalizedAt })
    .eq("id", partidaId)
    .select("id, estado, finalizada_en")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "No se pudo cerrar la partida" },
      { status: 500 },
    );
  }

  const deadParticipants = (participantesPartida ?? [])
    .filter((row: any) => Boolean(row.muerto))
    .map((row: any) => ({
      characterId: Number(row.personaje_id),
      userId: String(row.usuario_id ?? ""),
    }))
    .filter((row) => Number.isFinite(row.characterId) && row.characterId > 0 && row.userId.length > 0);

  for (const row of deadParticipants) {
    const deadResult = await markCharacterDead({
      db: session.db,
      userId: row.userId,
      characterId: row.characterId,
      reason: "muerte_partida",
      partidaId,
      metadata: { source: "admin-close-match", closedBy: session.userId },
    });

    if (!deadResult.ok) {
      return NextResponse.json({ error: deadResult.error ?? "No se pudo marcar muerto" }, { status: 500 });
    }
  }

  const participantUserIds = Array.from(
    new Set(
      (participantesPartida ?? [])
        .map((row: any) => String(row.usuario_id ?? ""))
        .filter((id) => id.length > 0),
    ),
  );

  if (participantUserIds.length > 0) {
    const { data: perfilesActuales, error: perfilesActualesError } = await session.db
      .from("perfiles")
      .select("id, ultima_partida_finalizada_en")
      .in("id", participantUserIds);

    if (perfilesActualesError) {
      return NextResponse.json({ error: perfilesActualesError.message }, { status: 500 });
    }

    const profileIdsToUpdate = (perfilesActuales ?? [])
      .filter((perfil: any) => {
        const previous = perfil.ultima_partida_finalizada_en
          ? new Date(String(perfil.ultima_partida_finalizada_en)).getTime()
          : null;
        return previous == null || previous < new Date(finalizedAt).getTime();
      })
      .map((perfil: any) => String(perfil.id));

    if (profileIdsToUpdate.length > 0) {
      const { error: profileCooldownError } = await session.db
        .from("perfiles")
        .update({ ultima_partida_finalizada_en: finalizedAt })
        .in("id", profileIdsToUpdate);

      if (profileCooldownError) {
        return NextResponse.json({ error: profileCooldownError.message }, { status: 500 });
      }
    }
  }

  const pendingSleepPayload = (participantesPartida ?? [])
    .filter((row: any) => !row.muerto)
    .map((row: any) => ({
      usuario_id: row.usuario_id,
      personaje_id: Number(row.personaje_id),
      partida_id: partidaId,
      creado_en: finalizedAt,
    }))
    .filter(
      (row) =>
        typeof row.usuario_id === "string" &&
        row.usuario_id.length > 0 &&
        Number.isFinite(row.personaje_id) &&
        row.personaje_id > 0,
    );

  if (pendingSleepPayload.length > 0) {
    const { error: pendingSleepError } = await session.db
      .from("descansos_pendientes")
      .upsert(pendingSleepPayload, { onConflict: "personaje_id" });

    if (pendingSleepError) {
      return NextResponse.json({ error: pendingSleepError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    id: (updated as any).id,
    status: (updated as any).estado,
    finalizedAt: (updated as any).finalizada_en,
  });
}
