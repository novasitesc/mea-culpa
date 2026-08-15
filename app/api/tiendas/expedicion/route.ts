import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

/**
 * GET /api/tiendas/expedicion
 *
 * Returns whether the authenticated user is currently in an active game,
 * and which shops are open for them. Uses service role to bypass RLS on
 * partida_participantes and partidas_tiendas_abiertas.
 */
export async function GET(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);
  if (error || !user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  // Find active game participation
  const { data: participacion } = await db
    .from("partida_participantes")
    .select("partida_id, personaje_id, partidas!inner(estado)")
    .eq("usuario_id", user.id)
    .eq("partidas.estado", "en_progreso")
    .limit(1);

  if (!participacion || participacion.length === 0) {
    return NextResponse.json({
      enExpedicion: false,
      partidaId: null,
      personajeId: null,
      tiendasAbiertas: [],
    });
  }

  const { partida_id: partidaId, personaje_id: personajeId } = participacion[0];

  // Fetch open shops with tienda name/icon
  const { data: abiertas } = await db
    .from("partidas_tiendas_abiertas")
    .select("tienda_id, expira_en, jugadores_permitidos, tiendas!inner(nombre, icono)")
    .eq("partida_id", partidaId);

  // Filter expired shops server-side
  const now = Date.now();
  const tiendasAbiertas = (abiertas ?? []).filter(
    (r: any) => !r.expira_en || new Date(r.expira_en).getTime() > now,
  );

  return NextResponse.json({
    enExpedicion: true,
    partidaId,
    personajeId,
    tiendasAbiertas,
  });
}
