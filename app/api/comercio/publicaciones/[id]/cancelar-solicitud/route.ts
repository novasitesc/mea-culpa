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

  const { data: publication, error: publicationError } = await db
    .from("publicaciones_comercio")
    .select("id, estado, comprador_usuario_id, precio")
    .eq("id", publicationId)
    .maybeSingle();

  if (publicationError) {
    return NextResponse.json({ error: publicationError.message }, { status: 500 });
  }

  if (!publication) {
    return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
  }

  if (publication.estado !== "solicitado") {
    return NextResponse.json(
      { error: "Solo puedes cancelar solicitudes pendientes" },
      { status: 409 },
    );
  }

  if (publication.comprador_usuario_id !== user.id) {
    return NextResponse.json(
      { error: "Solo el comprador puede cancelar su solicitud" },
      { status: 403 },
    );
  }

  let refundedGold: number;
  const refundAmount = Math.floor(Number(publication.precio ?? 0));

  if (refundAmount <= 0) {
    return NextResponse.json(
      { error: "La publicación tiene un precio inválido" },
      { status: 409 },
    );
  }

  try {
    refundedGold = await modifyGold(
      user.id,
      refundAmount,
      "cancelacion_solicitud_comercio",
    );
  } catch (refundError) {
    return NextResponse.json(
      {
        error:
          refundError instanceof Error
            ? refundError.message
            : "No se pudo reembolsar el oro",
      },
      { status: 500 },
    );
  }

  const { data: updated, error: updateError } = await db
    .from("publicaciones_comercio")
    .update({
      estado: "publicado",
      comprador_usuario_id: null,
      comprador_personaje_id: null,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", publicationId)
    .eq("estado", "solicitado")
    .eq("comprador_usuario_id", user.id)
    .select("id, estado")
    .maybeSingle();

  if (updateError) {
    await modifyGold(user.id, -refundAmount, "reversion_reembolso_cancelacion_comercio").catch(() => null);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated) {
    await modifyGold(user.id, -refundAmount, "reversion_reembolso_cancelacion_comercio").catch(() => null);
    return NextResponse.json(
      { error: "La solicitud ya cambió de estado" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ...updated, refundedGold });
}
