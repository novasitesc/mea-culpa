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
    .select(
      "id, estado, precio, item_bolsa_id, vendedor_usuario_id, comprador_usuario_id",
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
    return NextResponse.json(
      { error: "Solo el vendedor puede cancelar esta publicación" },
      { status: 403 },
    );
  }

  if (publication.estado !== "publicado" && publication.estado !== "solicitado") {
    return NextResponse.json(
      { error: "Solo puedes cancelar publicaciones activas" },
      { status: 409 },
    );
  }

  const refundAmount = Math.floor(Number(publication.precio ?? 0));
  const shouldRefundBuyer = publication.estado === "solicitado" && Boolean(publication.comprador_usuario_id);

  let refundedGold: number | null = null;
  if (shouldRefundBuyer) {
    try {
      refundedGold = await modifyGold(
        String(publication.comprador_usuario_id),
        refundAmount,
        "reembolso_cancelacion_vendedor_comercio",
      );
    } catch (refundError) {
      return NextResponse.json(
        {
          error:
            refundError instanceof Error
              ? refundError.message
              : "No se pudo reembolsar el oro del comprador",
        },
        { status: 500 },
      );
    }
  }

  const { data: updated, error: updateError } = await db
    .from("publicaciones_comercio")
    .update({
      estado: "cancelado",
      comprador_usuario_id: null,
      comprador_personaje_id: null,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", publicationId)
    .eq("vendedor_usuario_id", user.id)
    .in("estado", ["publicado", "solicitado"])
    .select("id, estado")
    .maybeSingle();

  if (updateError) {
    if (shouldRefundBuyer && publication.comprador_usuario_id) {
      await modifyGold(
        String(publication.comprador_usuario_id),
        -refundAmount,
        "reversion_reembolso_cancelacion_vendedor_comercio",
      ).catch(() => null);
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated) {
    if (shouldRefundBuyer && publication.comprador_usuario_id) {
      await modifyGold(
        String(publication.comprador_usuario_id),
        -refundAmount,
        "reversion_reembolso_cancelacion_vendedor_comercio",
      ).catch(() => null);
    }

    return NextResponse.json(
      { error: "La publicación ya cambió de estado" },
      { status: 409 },
    );
  }

  const { error: releaseError } = await db
    .from("bolsa_objetos")
    .update({ publicado_en_trade: false })
    .eq("id", publication.item_bolsa_id);

  if (releaseError) {
    return NextResponse.json({
      ...updated,
      refundedGold,
      warning: "Se canceló la publicación pero no se pudo liberar la bandera de bolsa",
    });
  }

  return NextResponse.json({ ...updated, refundedGold });
}
