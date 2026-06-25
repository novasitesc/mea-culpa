import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: partidaId } = await params;
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: partida } = await db
    .from("partidas")
    .select("id, estado")
    .eq("id", partidaId)
    .maybeSingle();

  if (!partida || (partida as any).estado !== "en_progreso") {
    return NextResponse.json({ error: "La partida no está en progreso" }, { status: 403 });
  }

  let body: { bolsaId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const bolsaId = Number(body.bolsaId);
  if (!Number.isFinite(bolsaId) || bolsaId <= 0) {
    return NextResponse.json({ error: "bolsaId inválido" }, { status: 400 });
  }

  const { data: participante } = await db
    .from("partida_participantes")
    .select("personaje_id, personaje:personaje_id ( nombre )")
    .eq("partida_id", partidaId)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (!participante) {
    return NextResponse.json({ error: "No eres participante de esta partida" }, { status: 403 });
  }

  const personajeId = (participante as any).personaje_id as number;
  const personajeNombre: string = (participante as any).personaje?.nombre ?? "";

  const { data: bolsaRow } = await db
    .from("bolsa_objetos")
    .select("id, objeto_id, cantidad, objeto:objeto_id ( nombre, icono, tipo_item )")
    .eq("id", bolsaId)
    .eq("personaje_id", personajeId)
    .maybeSingle();

  if (!bolsaRow) {
    return NextResponse.json({ error: "Ítem no encontrado en inventario" }, { status: 404 });
  }

  if ((bolsaRow as any).objeto?.tipo_item !== "consumible") {
    return NextResponse.json({ error: "El ítem no es un consumible" }, { status: 400 });
  }

  const cantidadActual: number = (bolsaRow as any).cantidad ?? 1;
  const cantidadRestante = cantidadActual - 1;

  if (cantidadRestante <= 0) {
    await db.from("bolsa_objetos").delete().eq("id", bolsaId);
  } else {
    await db.from("bolsa_objetos").update({ cantidad: cantidadRestante }).eq("id", bolsaId);
  }

  const objetoId = (bolsaRow as any).objeto_id as number;
  const objeto = {
    id: objetoId,
    nombre: (bolsaRow as any).objeto?.nombre ?? "",
    icono: (bolsaRow as any).objeto?.icono ?? "",
  };

  await db.from("partidas_eventos").insert({
    partida_id: partidaId,
    tipo: "consumible_usado",
    personaje_id: personajeId,
    personaje_nombre: personajeNombre,
    usuario_id: user.id,
    objeto_id: String(objetoId),
    objeto_nombre: objeto.nombre,
    objeto_icono: objeto.icono,
    cantidad: 1,
  });

  // Broadcast server-side so ALL clients (DM + other players) receive the event
  // regardless of client channel state. Service role bypasses any restrictions.
  await db.channel(`partida-sala-${partidaId}`).send({
    type: "broadcast",
    event: "consumible_usado",
    payload: {
      tipo: "consumible_usado",
      personajeId,
      personajeNombre,
      objeto,
    },
  });

  return NextResponse.json({ objeto, cantidadRestante, personajeId, personajeNombre });
}
