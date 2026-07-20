import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

// POST /api/partidas/leave
// Retira los personajes del usuario autenticado de una partida todavía en
// lobby. Una vez iniciada la expedición ya no se puede abandonar por aquí:
// dentro de la sala el destino lo decide el DM.
export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = createServerClient();

  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { partidaId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const partidaId = String(body.partidaId ?? "").trim();
  if (!partidaId) {
    return NextResponse.json({ error: "partidaId es requerido" }, { status: 400 });
  }

  const { data: partida, error: partidaError } = await db
    .from("partidas")
    .select("id, estado")
    .eq("id", partidaId)
    .maybeSingle();

  if (partidaError) {
    return NextResponse.json({ error: partidaError.message }, { status: 500 });
  }

  if (!partida) {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  if (partida.estado !== "abierta") {
    return NextResponse.json(
      { error: "La partida ya inició; no puedes abandonarla desde aquí" },
      { status: 409 },
    );
  }

  const { data: removed, error: deleteError } = await db
    .from("partida_participantes")
    .delete()
    .eq("partida_id", partidaId)
    .eq("usuario_id", user.id)
    .select("id");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (!removed || removed.length === 0) {
    return NextResponse.json(
      { error: "No estás inscrito en esta partida" },
      { status: 404 },
    );
  }

  return NextResponse.json({ partidaId, removed: removed.length });
}
