import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { SALAS_POR_DESCANSO, salasDesdeUltimoDescanso } from "@/lib/descanso";

// El DM avanza al grupo a la siguiente sala de la expedición. El conteo vive
// en el log de eventos (no hay contador persistido): cualquier descanso lo
// pone a cero. Al llegar a SALAS_POR_DESCANSO se avisa de descanso obligatorio.
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

  const { data: eventos, error: eventosError } = await session.db
    .from("partidas_eventos")
    .select("tipo")
    .eq("partida_id", partidaId)
    .in("tipo", ["sala_avanzada", "descanso_corto", "descanso_largo"])
    .order("creado_en", { ascending: true });

  if (eventosError) {
    return NextResponse.json({ error: eventosError.message }, { status: 500 });
  }

  const sala = salasDesdeUltimoDescanso((eventos ?? []) as Array<{ tipo: string }>) + 1;
  const requiereDescanso = sala >= SALAS_POR_DESCANSO;

  const { error: insertError } = await session.db.from("partidas_eventos").insert({
    partida_id: partidaId,
    tipo: "sala_avanzada",
    cantidad: sala,
    metadata: { requiereDescanso },
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ sala, requiereDescanso });
}
