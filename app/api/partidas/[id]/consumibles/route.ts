import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function GET(
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

  if (!partida) {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  if (!["abierta", "en_progreso"].includes((partida as any).estado)) {
    return NextResponse.json({ error: "Partida no disponible" }, { status: 403 });
  }

  const { data: participante } = await db
    .from("partida_participantes")
    .select("personaje_id, personaje:personaje_id ( nombre )")
    .eq("partida_id", partidaId)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (!participante) {
    return NextResponse.json({ consumibles: [], personajeId: null, personajeNombre: null });
  }

  const personajeId = (participante as any).personaje_id as number;
  const personajeNombre: string = (participante as any).personaje?.nombre ?? "";

  const { data: bolsa } = await db
    .from("bolsa_objetos")
    .select("id, objeto_id, cantidad, objeto:objeto_id ( nombre, icono, rareza, tipo_item )")
    .eq("personaje_id", personajeId)
    .order("orden", { ascending: true });

  const consumibles = (bolsa ?? [])
    .filter((row: any) => row.objeto?.tipo_item === "consumible")
    .map((row: any) => ({
      bolsaId: row.id,
      objetoId: row.objeto_id,
      nombre: row.objeto?.nombre ?? "",
      icono: row.objeto?.icono ?? "",
      rareza: row.objeto?.rareza ?? "común",
      cantidad: row.cantidad ?? 1,
    }));

  return NextResponse.json({ consumibles, personajeId, personajeNombre });
}
