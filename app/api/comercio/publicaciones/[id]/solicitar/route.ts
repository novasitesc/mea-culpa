import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { modifyGold } from "@/lib/goldService";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const db = createServerClient();

  const { user, error } = await getUserFromRequest(db, request);
  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const publicationId = Number(id);
  if (!Number.isFinite(publicationId)) {
    return NextResponse.json({ error: "ID de publicación inválido" }, { status: 400 });
  }

  let body: { buyerCharacterId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const buyerCharacterId = Number(body.buyerCharacterId);
  if (!Number.isFinite(buyerCharacterId)) {
    return NextResponse.json(
      { error: "buyerCharacterId es requerido" },
      { status: 400 },
    );
  }

  const { data: buyerCharacter, error: buyerCharError } = await db
    .from("personajes")
    .select("id, usuario_id")
    .eq("id", buyerCharacterId)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (buyerCharError) {
    return NextResponse.json({ error: buyerCharError.message }, { status: 500 });
  }

  if (!buyerCharacter) {
    return NextResponse.json({ error: "Personaje comprador no válido" }, { status: 403 });
  }

  const { data: publication, error: publicationError } = await db
    .from("publicaciones_comercio")
    .select("id, vendedor_usuario_id, estado, precio")
    .eq("id", publicationId)
    .maybeSingle();

  if (publicationError) {
    return NextResponse.json({ error: publicationError.message }, { status: 500 });
  }

  if (!publication) {
    return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
  }

  if (publication.vendedor_usuario_id === user.id) {
    return NextResponse.json({ error: "No puedes solicitar tu propia publicación" }, { status: 409 });
  }

  if (publication.estado !== "publicado") {
    return NextResponse.json({ error: "La publicación ya no está disponible" }, { status: 409 });
  }

  if (Number(publication.precio ?? 0) <= 0) {
    return NextResponse.json({ error: "La publicación tiene un precio inválido" }, { status: 409 });
  }

  const { data: updated, error: updateError } = await db
    .from("publicaciones_comercio")
    .update({
      estado: "solicitado",
      comprador_usuario_id: user.id,
      comprador_personaje_id: buyerCharacterId,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", publicationId)
    .eq("estado", "publicado")
    .select("id, estado, comprador_usuario_id, comprador_personaje_id, precio")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Otro jugador tomó esta publicación antes" },
      { status: 409 },
    );
  }

  try {
    const oro = await modifyGold(
      user.id,
      -Math.floor(Number(updated.precio ?? publication.precio ?? 0)),
      "reserva_compra_comercio",
    );

    return NextResponse.json({
      ...updated,
      oro,
    });
  } catch (goldError) {
    await db
      .from("publicaciones_comercio")
      .update({
        estado: "publicado",
        comprador_usuario_id: null,
        comprador_personaje_id: null,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", publicationId)
      .eq("estado", "solicitado")
      .eq("comprador_usuario_id", user.id);

    const message =
      goldError instanceof Error ? goldError.message : "No se pudo reservar el oro";
    if (message.toLowerCase().includes("insuficiente")) {
      return NextResponse.json({ error: "No tienes oro suficiente para solicitar esta compra" }, { status: 422 });
    }
    return NextResponse.json({ error: "No se pudo reservar el oro para la solicitud" }, { status: 500 });
  }
}
