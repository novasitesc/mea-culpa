import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { asignarItem } from "@/lib/asignarItem";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: partidaId } = await params;

  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;
  const db = session.db;

  const { data: partida } = await db
    .from("partidas")
    .select("id, estado")
    .eq("id", partidaId)
    .maybeSingle();

  if (!partida || (partida as any).estado !== "en_progreso") {
    return NextResponse.json({ error: "Partida no está en progreso" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const personajeId = typeof body?.personaje_id === "number" ? body.personaje_id : null;
  const tipo: "item" | "oro" | null =
    body?.tipo === "item" ? "item" : body?.tipo === "oro" ? "oro" : null;
  const objetoId = typeof body?.objeto_id === "number" ? body.objeto_id : null;
  const cantidad = typeof body?.cantidad === "number" && body.cantidad > 0
    ? Math.floor(body.cantidad)
    : 1;
  const oroDelta = typeof body?.oro_delta === "number" && body.oro_delta > 0
    ? Math.floor(body.oro_delta)
    : null;

  if (!personajeId || !tipo) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const { data: participante } = await db
    .from("partida_participantes")
    .select("id, usuario_id")
    .eq("partida_id", partidaId)
    .eq("personaje_id", personajeId)
    .maybeSingle();

  if (!participante) {
    return NextResponse.json({ error: "Personaje no es participante" }, { status: 400 });
  }

  const targetUserId = (participante as any).usuario_id as string;

  if (tipo === "item") {
    if (!objetoId) {
      return NextResponse.json({ error: "objeto_id requerido" }, { status: 400 });
    }

    const assignResult = await asignarItem({
      db,
      partidaId,
      personajeId,
      usuarioId: targetUserId,
      adminId: session.userId,
      objetoId,
      cantidad,
    });

    if (!assignResult.ok) {
      return NextResponse.json({ error: assignResult.error }, { status: 500 });
    }

    const { data: obj } = await db
      .from("objetos")
      .select("nombre, icono")
      .eq("id", objetoId)
      .maybeSingle();

    return NextResponse.json({
      tipo: "item",
      objeto: obj ? { id: objetoId, nombre: (obj as any).nombre, icono: (obj as any).icono } : null,
      cantidad: assignResult.grantedQty,
    });
  }

  if (tipo === "oro") {
    if (!oroDelta) {
      return NextResponse.json({ error: "oro_delta requerido y debe ser mayor a 0" }, { status: 400 });
    }

    const { error: goldError } = await db.rpc("modificar_oro", {
      p_usuario_id: targetUserId,
      p_delta: oroDelta,
      p_concepto: `partida_sala:${partidaId}`,
      p_referencia: partidaId,
      p_admin_id: session.userId,
    });

    if (goldError) {
      return NextResponse.json({ error: goldError.message }, { status: 500 });
    }

    return NextResponse.json({ tipo: "oro", cantidadOro: oroDelta });
  }

  return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
}
