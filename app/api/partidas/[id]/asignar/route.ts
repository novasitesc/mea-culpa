// POST — Solo admin (el DM). Reparte un objeto a un participante durante la
// partida. Delega en asignarItem() (lib/asignarItem.ts), que respeta la
// capacidad de la bolsa y puede entregar menos de lo pedido si no cabe.
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
    .select("id, usuario_id, personaje:personaje_id ( nombre )")
    .eq("partida_id", partidaId)
    .eq("personaje_id", personajeId)
    .maybeSingle();

  if (!participante) {
    return NextResponse.json({ error: "Personaje no es participante" }, { status: 400 });
  }

  const targetUserId = (participante as any).usuario_id as string;
  const personajeNombre: string = (participante as any).personaje?.nombre ?? "";

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

    const objData = obj ? { id: objetoId, nombre: (obj as any).nombre, icono: (obj as any).icono } : null;

    await db.from("partidas_eventos").insert({
      partida_id: partidaId,
      tipo: "asignacion_manual",
      personaje_id: personajeId,
      personaje_nombre: personajeNombre,
      usuario_id: targetUserId,
      tipo_resultado: "item",
      objeto_id: String(objetoId),
      objeto_nombre: objData?.nombre ?? null,
      objeto_icono: objData?.icono ?? null,
      cantidad: assignResult.grantedQty,
    });

    return NextResponse.json({
      tipo: "item",
      objeto: objData,
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

    await db.from("partidas_eventos").insert({
      partida_id: partidaId,
      tipo: "asignacion_manual",
      personaje_id: personajeId,
      personaje_nombre: personajeNombre,
      usuario_id: targetUserId,
      tipo_resultado: "oro",
      cantidad_oro: oroDelta,
    });

    return NextResponse.json({ tipo: "oro", cantidadOro: oroDelta });
  }

  return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
}
