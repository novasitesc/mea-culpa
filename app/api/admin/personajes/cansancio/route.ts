// PATCH — Solo admin. Ajusta el nivel de agotamiento (0-6) de un personaje.
// A nivel 6 el personaje muere; los efectos de cada nivel están en
// EFECTOS_CANSANCIO (lib/caidas.ts).
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { MAX_CANSANCIO } from "@/lib/caidas";

// Ajuste manual de agotamiento por el DM durante la expedición (efectos de
// mazmorra, acciones extenuantes). Satura en MAX_CANSANCIO sin matar: dentro
// de la partida no se muere; la muerte por agotamiento solo ocurre al rehusar
// el descanso obligatorio (sleep-options).
export async function PATCH(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  let body: { personajeId?: unknown; delta?: unknown; partidaId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const personajeId = Number(body.personajeId);
  const delta = Number(body.delta);
  const partidaId = body.partidaId ? String(body.partidaId) : null;

  if (!Number.isFinite(personajeId) || personajeId <= 0) {
    return NextResponse.json({ error: "personajeId inválido" }, { status: 400 });
  }
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: "delta debe ser 1 o -1" }, { status: 400 });
  }

  const { data: personaje, error: fetchError } = await session.db
    .from("personajes")
    .select("id, nombre, usuario_id, puntos_cansancio")
    .eq("id", personajeId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!personaje) {
    return NextResponse.json({ error: "Personaje no encontrado" }, { status: 404 });
  }

  const current = Math.max(0, Math.min(MAX_CANSANCIO, Number((personaje as any).puntos_cansancio ?? 0)));
  const nuevo = Math.max(0, Math.min(MAX_CANSANCIO, current + delta));

  if (nuevo === current) {
    return NextResponse.json({ cansancio: current });
  }

  const { error: updateError } = await session.db
    .from("personajes")
    .update({ puntos_cansancio: nuevo })
    .eq("id", personajeId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (partidaId) {
    await session.db.from("partidas_eventos").insert({
      partida_id: partidaId,
      tipo: "cansancio",
      personaje_id: personajeId,
      personaje_nombre: (personaje as any).nombre ?? null,
      usuario_id: (personaje as any).usuario_id ?? null,
      cantidad: nuevo,
      metadata: { delta },
    });
  }

  return NextResponse.json({ cansancio: nuevo });
}
