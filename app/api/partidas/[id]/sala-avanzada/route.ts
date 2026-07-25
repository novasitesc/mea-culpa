// POST — Solo admin (el DM). Avanza el grupo a la siguiente sala de la mazmorra.
// A las SALAS_POR_DESCANSO salas (lib/descanso.ts) el descanso es obligatorio y
// este endpoint deja de avanzar hasta que el grupo descanse.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { debeDescansar, salasDesdeUltimoDescanso } from "@/lib/descanso";

// El DM avanza al grupo a la siguiente sala de la expedición. El conteo vive
// en el log de eventos (no hay contador persistido): cualquier descanso lo
// pone a cero. El bloqueo se valida aquí y no solo en el botón: el cliente es
// del DM y un fetch a mano no puede saltarse la regla de la mesa.
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

  const salasRecorridas = salasDesdeUltimoDescanso((eventos ?? []) as Array<{ tipo: string }>);

  if (debeDescansar(salasRecorridas)) {
    return NextResponse.json(
      {
        error: `El grupo lleva ${salasRecorridas} salas sin descansar. El descanso es obligatorio antes de avanzar.`,
        requiereDescanso: true,
        salasRecorridas,
      },
      { status: 409 },
    );
  }

  const sala = salasRecorridas + 1;
  const requiereDescanso = debeDescansar(sala);

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
