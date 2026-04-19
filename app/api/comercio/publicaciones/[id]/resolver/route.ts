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

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const action = String(body.action ?? "").toLowerCase();
  if (action !== "aceptar" && action !== "rechazar") {
    return NextResponse.json(
      { error: "action debe ser aceptar o rechazar" },
      { status: 400 },
    );
  }

  const { data: publication, error: publicationError } = await db
    .from("publicaciones_comercio")
    .select(
      "id, vendedor_usuario_id, estado, item_bolsa_id, comprador_usuario_id, comprador_personaje_id, precio",
    )
    .eq("id", publicationId)
    .maybeSingle();

  if (publicationError) {
    return NextResponse.json({ error: publicationError.message }, { status: 500 });
  }

  if (!publication) {
    return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
  }

  if (publication.vendedor_usuario_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (action === "rechazar") {
    if (publication.estado !== "solicitado") {
      return NextResponse.json(
        { error: "Solo puedes rechazar solicitudes pendientes" },
        { status: 409 },
      );
    }

    if (!publication.comprador_usuario_id) {
      return NextResponse.json(
        { error: "La publicación no tiene comprador para reembolsar" },
        { status: 409 },
      );
    }

    let refundedGold: number;
    try {
      refundedGold = await modifyGold(
        publication.comprador_usuario_id,
        Math.floor(Number(publication.precio ?? 0)),
        "reembolso_compra_comercio",
      );
    } catch (refundError) {
      return NextResponse.json(
        {
          error:
            refundError instanceof Error
              ? refundError.message
              : "No se pudo reembolsar el oro al comprador",
        },
        { status: 500 },
      );
    }

    const { data: updated, error: rejectError } = await db
      .from("publicaciones_comercio")
      .update({
        estado: "publicado",
        comprador_usuario_id: null,
        comprador_personaje_id: null,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", publicationId)
      .eq("estado", "solicitado")
      .eq("comprador_usuario_id", publication.comprador_usuario_id)
      .select("id, estado")
      .maybeSingle();

    if (rejectError) {
      return NextResponse.json({ error: rejectError.message }, { status: 500 });
    }

    if (!updated) {
      await modifyGold(
        publication.comprador_usuario_id,
        -Math.floor(Number(publication.precio ?? 0)),
        "reversion_reembolso_comercio",
      ).catch(() => null);

      return NextResponse.json(
        { error: "La publicación cambió de estado" },
        { status: 409 },
      );
    }

    return NextResponse.json({ ...updated, refundedGold });
  }

  const { data, error: acceptError } = await db.rpc(
    "aceptar_publicacion_comercio",
    {
      p_publicacion_id: publicationId,
      p_vendedor_id: user.id,
    },
  );

  if (acceptError) {
    const msg = acceptError.message ?? "No se pudo aceptar la solicitud";
    if (msg.includes("No autorizado")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (
      msg.includes("no está en estado solicitado") ||
      msg.includes("no está disponible") ||
      msg.includes("autocompra")
    ) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg.includes("Bolsa llena") || msg.includes("Oro insuficiente")) {
      return NextResponse.json({ error: msg }, { status: 422 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(data);
}
