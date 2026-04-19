import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);

  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { characterId?: unknown; bagRowId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  const characterId = Number(body.characterId);
  const bagRowId = Number(body.bagRowId);
  if (!Number.isFinite(characterId) || !Number.isFinite(bagRowId)) {
    return NextResponse.json(
      { error: "characterId y bagRowId son requeridos" },
      { status: 400 },
    );
  }

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

  const { data: character, error: characterError } = await db
    .from("personajes")
    .select("id")
    .eq("id", characterId)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (characterError) {
    return NextResponse.json({ error: characterError.message }, { status: 500 });
  }

  if (!character) {
    return NextResponse.json({ error: "Personaje no valido" }, { status: 403 });
  }

  const { data: bagItem, error: bagError } = await db
    .from("bolsa_objetos")
    .select("id, objeto_id, cantidad, personaje_id, publicado_en_trade")
    .eq("id", bagRowId)
    .eq("personaje_id", characterId)
    .maybeSingle();

  if (bagError) {
    return NextResponse.json({ error: bagError.message }, { status: 500 });
  }

  if (!bagItem) {
    return NextResponse.json({ error: "Objeto no encontrado en tu bolsa" }, { status: 404 });
  }

  if (bagItem.publicado_en_trade) {
    return NextResponse.json(
      { error: "No puedes depositar un objeto que esta en comercio" },
      { status: 409 },
    );
  }

  if (!bagItem.objeto_id) {
    return NextResponse.json({ error: "Objeto invalido para deposito" }, { status: 409 });
  }

  const { data: inserted, error: insertError } = await db
    .from("gremio_baul")
    .insert({
      gremio_id: membership.gremio_id,
      objeto_id: bagItem.objeto_id,
      cantidad: bagItem.cantidad,
      depositante_usuario_id: user.id,
    })
    .select("id, gremio_id, objeto_id, cantidad")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: deleteError } = await db
    .from("bolsa_objetos")
    .delete()
    .eq("id", bagRowId)
    .eq("personaje_id", characterId);

  if (deleteError) {
    await db.from("gremio_baul").delete().eq("id", inserted.id);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
