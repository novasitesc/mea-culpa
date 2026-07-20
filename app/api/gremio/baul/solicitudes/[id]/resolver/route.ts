import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { personajeEnExpedicion } from "@/lib/partidasState";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);

  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await db
    .from("gremio_miembros")
    .select("rol")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  if (!membership || membership.rol !== "lider") {
    return NextResponse.json(
      { error: "Solo el lider del gremio puede resolver solicitudes" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const solicitudId = Number(id);
  if (!Number.isFinite(solicitudId)) {
    return NextResponse.json({ error: "ID de solicitud invalido" }, { status: 400 });
  }

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  const action = String(body.action ?? "").toLowerCase();
  if (action !== "aprobar" && action !== "rechazar") {
    return NextResponse.json(
      { error: "action debe ser aprobar o rechazar" },
      { status: 400 },
    );
  }

  // La partida del destinatario pudo iniciar entre la solicitud y la entrega
  if (action === "aprobar") {
    const { data: solicitud } = await db
      .from("gremio_solicitudes_baul")
      .select("personaje_destino_id")
      .eq("id", solicitudId)
      .maybeSingle();

    const destinoId = Number((solicitud as any)?.personaje_destino_id ?? 0);
    if (destinoId > 0 && (await personajeEnExpedicion(db, destinoId))) {
      return NextResponse.json(
        { error: "El personaje destino está en una expedición en curso; aprueba cuando salga" },
        { status: 409 },
      );
    }
  }

  const { data, error: rpcError } = await db.rpc("resolver_solicitud_gremio_baul", {
    p_solicitud_id: solicitudId,
    p_lider_usuario_id: user.id,
    p_accion: action,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "No se pudo resolver la solicitud";

    if (msg.includes("No autorizado")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    if (
      msg.includes("ya fue resuelta") ||
      msg.includes("ya no esta en el baul") ||
      msg.includes("no encontrada")
    ) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    if (msg.includes("Bolsa llena")) {
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(data);
}
