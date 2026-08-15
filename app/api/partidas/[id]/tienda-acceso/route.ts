import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: partidaId } = await params;

  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const { data: partida } = await session.db
    .from("partidas")
    .select("id, estado")
    .eq("id", partidaId)
    .maybeSingle();

  if (!partida || (partida as any).estado !== "en_progreso") {
    return NextResponse.json({ error: "Partida no está en progreso" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const tiendaId = typeof body?.tiendaId === "string" ? body.tiendaId : null;

  // Close the store
  if (body?.cerrar === true) {
    if (tiendaId) {
      await session.db
        .from("partidas_tiendas_abiertas")
        .delete()
        .eq("partida_id", partidaId)
        .eq("tienda_id", tiendaId);
    }

    const channel = session.db.channel(`partida-sala-${partidaId}`);
    await channel.send({
      type: "broadcast",
      event: "tienda_cerrada",
      payload: { tipo: "tienda_cerrada", tiendaId },
    });
    session.db.removeChannel(channel);
    return NextResponse.json({ success: true });
  }

  // Open the store
  const duracion = typeof body?.duracion === "number" && body.duracion > 0 ? body.duracion : null;

  if (!tiendaId) {
    return NextResponse.json({ error: "tiendaId es requerido" }, { status: 400 });
  }

  const { data: tienda } = await session.db
    .from("tiendas")
    .select("nombre, icono")
    .eq("id", tiendaId)
    .maybeSingle();

  if (!tienda) {
    return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
  }

  let expiraEn: string | null = null;
  if (duracion) {
    const expiresDate = new Date();
    expiresDate.setMinutes(expiresDate.getMinutes() + duracion);
    expiraEn = expiresDate.toISOString();
  }

  const jugadoresPermitidos = Array.isArray(body?.jugadoresPermitidos)
    ? body.jugadoresPermitidos.filter((id: any) => typeof id === "number")
    : [];

  await session.db.from("partidas_tiendas_abiertas").upsert(
    {
      partida_id: partidaId,
      tienda_id: tiendaId,
      jugadores_permitidos: jugadoresPermitidos.length > 0 ? jugadoresPermitidos : null,
      expira_en: expiraEn,
    },
    { onConflict: "partida_id, tienda_id" }
  );

  const channel = session.db.channel(`partida-sala-${partidaId}`);
  await channel.send({
    type: "broadcast",
    event: "tienda_abierta",
    payload: {
      tipo: "tienda_abierta",
      tiendaId,
      tiendaNombre: tienda.nombre,
      tiendaIcono: tienda.icono,
      expiraEn,
      jugadoresPermitidos,
    },
  });
  session.db.removeChannel(channel);

  return NextResponse.json({ success: true });
}
