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

  const { data: partida, error: partidaError } = await db
    .from("partidas")
    .select("id, titulo, estado, piso, tier, inicio_en")
    .eq("id", partidaId)
    .maybeSingle();

  if (partidaError || !partida) {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  const estadoValido = ["abierta", "en_progreso"].includes((partida as any).estado);
  if (!estadoValido) {
    return NextResponse.json({ error: "La partida no está disponible" }, { status: 403 });
  }

  const { data: perfil } = await db
    .from("perfiles")
    .select("es_admin")
    .eq("id", user.id)
    .single();

  const esAdmin = (perfil as any)?.es_admin === true;

  if (!esAdmin) {
    const { data: participante } = await db
      .from("partida_participantes")
      .select("id")
      .eq("partida_id", partidaId)
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (!participante) {
      return NextResponse.json({ error: "No eres participante de esta partida" }, { status: 403 });
    }
  }

  const { data: participantes } = await db
    .from("partida_participantes")
    .select("id, personaje_id, usuario_id, muerto, personaje:personaje_id(nombre, extremidades)")
    .eq("partida_id", partidaId);

  return NextResponse.json({
    partida: {
      id: (partida as any).id,
      titulo: (partida as any).titulo,
      estado: (partida as any).estado,
      piso: (partida as any).piso,
      tier: (partida as any).tier,
      inicioEn: (partida as any).inicio_en,
    },
    esAdmin,
    participantes: (participantes ?? []).map((p: any) => ({
      id: p.id,
      personajeId: p.personaje_id,
      usuarioId: p.usuario_id,
      muerto: p.muerto ?? false,
      nombre: p.personaje?.nombre ?? "Personaje",
      extremidades: (p.personaje as any)?.extremidades ?? null,
    })),
  });
}
