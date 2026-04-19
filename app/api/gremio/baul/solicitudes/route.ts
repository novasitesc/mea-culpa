import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);

  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: {
    baulItemId?: unknown;
    targetCharacterId?: unknown;
    note?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  const baulItemId = Number(body.baulItemId);
  const targetCharacterId = Number(body.targetCharacterId);

  if (!Number.isFinite(baulItemId) || !Number.isFinite(targetCharacterId)) {
    return NextResponse.json(
      { error: "baulItemId y targetCharacterId son requeridos" },
      { status: 400 },
    );
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  const { data: membership, error: membershipError } = await db
    .from("gremio_miembros")
    .select("gremio_id")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "No perteneces a un gremio" }, { status: 409 });
  }

  const { data: baulItem, error: baulError } = await db
    .from("gremio_baul")
    .select("id, gremio_id")
    .eq("id", baulItemId)
    .maybeSingle();

  if (baulError) {
    return NextResponse.json({ error: baulError.message }, { status: 500 });
  }

  if (!baulItem || Number(baulItem.gremio_id) !== Number(membership.gremio_id)) {
    return NextResponse.json({ error: "Objeto de baul no disponible" }, { status: 404 });
  }

  const { data: targetCharacter, error: targetError } = await db
    .from("personajes")
    .select("id")
    .eq("id", targetCharacterId)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }

  if (!targetCharacter) {
    return NextResponse.json({ error: "El personaje destino no es tuyo" }, { status: 403 });
  }

  const { data, error: insertError } = await db
    .from("gremio_solicitudes_baul")
    .insert({
      gremio_id: membership.gremio_id,
      baul_item_id: baulItemId,
      solicitante_usuario_id: user.id,
      personaje_destino_id: targetCharacterId,
      nota: note || null,
      estado: "pendiente",
    })
    .select("id, estado, baul_item_id, personaje_destino_id")
    .single();

  if (insertError) {
    if (String((insertError as any).code) === "23505") {
      return NextResponse.json(
        { error: "Ya existe una solicitud pendiente para este objeto" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
