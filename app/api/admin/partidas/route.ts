import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

type ParticipantInput = {
  characterId: number;
  gold?: number;
  comment?: string;
  dead?: boolean;
  items?: { objectId: number; qty?: number }[];
};

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
    .select("id, creado_en, estado")
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
    personaje_id: number;
    objeto_id: number;
    origen: string;
    cantidad: number;
  }[] = [];

  (participants ?? []).forEach((p) => {
    const personajeId = Number(p.characterId);
    if (!Number.isFinite(personajeId)) return;
    for (const item of p.items ?? []) {
      const objectId = Number(item.objectId);
      if (!Number.isFinite(objectId)) continue;
      const qty = Math.max(1, Number(item.qty ?? 1) || 1);
      itemsPayload.push({
        personaje_id: personajeId,
        objeto_id: objectId,
        origen: "admin",
        cantidad: qty,
      });
    }
  });

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
      createdAt: (partida as any).creado_en,
      status: (partida as any).estado,
      participants: participantes?.length ?? 0,
    },
    { status: 201 },
  );
}
