import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

type ParticipantInput = {
  characterId: number;
  gold?: number;
  comment?: string;
  dead?: boolean;
  items?: { objectId: number; qty?: number }[];
};

// GET /api/admin/partidas
// Lista partidas con participantes y objetos entregados.
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const { data: partidas, error: partidasError } = await session.db
    .from("partidas")
    .select(
      `
      id,
      titulo,
      comentario,
      estado,
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

  const payload = (partidas ?? []).map((p: any) => ({
    id: p.id,
    title: p.titulo,
    comment: p.comentario,
    status: p.estado,
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
  }));

  return NextResponse.json(payload);
}

// POST /api/admin/partidas
// Crea una partida con participantes y recompensas registradas.
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const body = await request.json();
  const title = String(body?.title ?? "").trim();
  const comment = String(body?.comment ?? "").trim();
  const participants = Array.isArray(body?.participants)
    ? (body.participants as ParticipantInput[])
    : [];

  if (!title) {
    return NextResponse.json({ error: "El nombre de la partida es obligatorio" }, { status: 400 });
  }

  if (participants.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un participante" }, { status: 400 });
  }

  const characterIds = participants
    .map((p) => Number(p.characterId))
    .filter((id) => Number.isFinite(id));

  if (characterIds.length !== participants.length) {
    return NextResponse.json({ error: "Participantes inválidos" }, { status: 400 });
  }

  const { data: personajes, error: personajesError } = await session.db
    .from("personajes")
    .select("id, usuario_id")
    .in("id", characterIds);

  if (personajesError) {
    return NextResponse.json({ error: personajesError.message }, { status: 500 });
  }

  const userMap = new Map<number, string>();
  for (const p of personajes ?? []) {
    userMap.set((p as any).id, (p as any).usuario_id);
  }

  const missing = characterIds.filter((id) => !userMap.has(id));
  if (missing.length > 0) {
    return NextResponse.json({ error: "Personajes no encontrados" }, { status: 400 });
  }

  const { data: partida, error: partidaError } = await session.db
    .from("partidas")
    .insert({
      titulo: title,
      comentario: comment,
      creada_por: session.userId,
    })
    .select("id, creada_en, estado")
    .single();

  if (partidaError || !partida) {
    return NextResponse.json(
      { error: partidaError?.message ?? "Error al crear partida" },
      { status: 500 },
    );
  }

  const participantesPayload = participants.map((p) => ({
    partida_id: (partida as any).id,
    personaje_id: Number(p.characterId),
    usuario_id: userMap.get(Number(p.characterId)),
    oro_delta: Math.max(0, Number(p.gold ?? 0) || 0),
    comentario: String(p.comment ?? "").trim(),
    muerto: Boolean(p.dead),
  }));

  const { data: participantes, error: participantesError } = await session.db
    .from("partida_participantes")
    .insert(participantesPayload)
    .select("id, personaje_id");

  if (participantesError) {
    return NextResponse.json({ error: participantesError.message }, { status: 500 });
  }

  const itemsPayload: {
    partida_id: string;
    personaje_id: number;
    objeto_id: number;
    origen: string;
    cantidad: number;
  }[] = [];

  for (const p of participants) {
    const personajeId = Number(p.characterId);
    const usuarioId = userMap.get(personajeId);
    if (!Number.isFinite(personajeId) || !usuarioId) continue;

    const itemMap = new Map<number, number>();
    for (const item of p.items ?? []) {
      const objectId = Number(item.objectId);
      if (!Number.isFinite(objectId)) continue;
      const qty = Math.max(1, Number(item.qty ?? 1) || 1);
      itemMap.set(objectId, (itemMap.get(objectId) ?? 0) + qty);
    }

    const uniqueObjectIds = Array.from(itemMap.keys());

    if (uniqueObjectIds.length > 0) {
      const { data: personaje, error: personajeError } = await session.db
        .from("personajes")
        .select("capacidad_bolsa")
        .eq("id", personajeId)
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
        .eq("personaje_id", personajeId)
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
        .eq("personaje_id", personajeId);

      if (bagCountError) {
        return NextResponse.json({ error: bagCountError.message }, { status: 500 });
      }

      const newSlotsNeeded = uniqueObjectIds.filter(
        (id) => !existingMap.has(id),
      ).length;

      if ((bagCount ?? 0) + newSlotsNeeded > (personaje as any).capacidad_bolsa) {
        return NextResponse.json(
          { error: "Bolsa llena para uno de los personajes" },
          { status: 400 },
        );
      }

      const { data: maxOrdenRow, error: maxOrdenError } = await session.db
        .from("bolsa_objetos")
        .select("orden")
        .eq("personaje_id", personajeId)
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
          nextOrden += 1;
          const { error: insertError } = await session.db
            .from("bolsa_objetos")
            .insert({
              personaje_id: personajeId,
              objeto_id: objectId,
              cantidad: qty,
              orden: nextOrden,
            });

          if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
          }
        }

        itemsPayload.push({
          partida_id: (partida as any).id,
          personaje_id: personajeId,
          objeto_id: objectId,
          origen: "admin",
          cantidad: qty,
        });
      }
    }

    const goldDelta = Math.max(0, Number(p.gold ?? 0) || 0);
    if (goldDelta > 0) {
      const { error: goldError } = await session.db.rpc("modificar_oro", {
        p_usuario_id: usuarioId,
        p_delta: goldDelta,
        p_concepto: `partida:${title}`,
        p_referencia: (partida as any).id,
        p_admin_id: session.userId,
      });

      if (goldError) {
        return NextResponse.json({ error: goldError.message }, { status: 500 });
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

  return NextResponse.json(
    {
      id: (partida as any).id,
      createdAt: (partida as any).creada_en,
      status: (partida as any).estado,
      participants: participantes?.length ?? 0,
    },
    { status: 201 },
  );
}
