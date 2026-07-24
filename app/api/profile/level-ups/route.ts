// GET / POST — Subidas de nivel del personaje.
// GET  cuántas subidas tiene pendientes de aplicar.
// POST sube un nivel en una de sus clases (tope 20 entre todas).
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

// Ascensos que el jugador todavia no ha visto celebrados: el DM sube el nivel
// (cierre de partida o panel de personajes) y aqui se compara el nivel total
// con `nivel_visto`. GET los lista, POST marca uno como visto.

type PendingLevelUp = {
  characterId: number;
  characterName: string;
  portrait: string | null;
  from: number;
  to: number;
  classes: Array<{ className: string; level: number }>;
};

export async function GET(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);
  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: rows, error: fetchError } = await db
    .from("personajes")
    .select("id, nombre, retrato, nivel_visto, clases_personaje ( nombre_clase, nivel, orden )")
    .eq("usuario_id", user.id)
    .not("estado_vida", "in", '("enterrado","eliminado")');

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const pending: PendingLevelUp[] = [];
  for (const row of (rows ?? []) as any[]) {
    const clases = (row.clases_personaje ?? []).slice().sort(
      (a: any, b: any) => Number(a.orden ?? 0) - Number(b.orden ?? 0),
    );
    const total = clases.reduce((sum: number, c: any) => sum + Number(c.nivel ?? 0), 0);
    const seen = Number(row.nivel_visto ?? 0);
    if (total <= seen || total <= 0) continue;

    pending.push({
      characterId: Number(row.id),
      characterName: row.nombre ?? "Personaje",
      portrait: row.retrato ?? null,
      from: seen,
      to: total,
      classes: clases.map((c: any) => ({
        className: String(c.nombre_clase ?? ""),
        level: Number(c.nivel ?? 1),
      })),
    });
  }

  return NextResponse.json({ pending });
}

export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);
  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { characterId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  const characterId = Number(body.characterId);
  if (!Number.isFinite(characterId) || characterId <= 0) {
    return NextResponse.json({ error: "characterId invalido" }, { status: 400 });
  }

  // Releer el nivel en el servidor: el cliente nunca decide hasta donde marcar.
  const { data: clases, error: clasesError } = await db
    .from("clases_personaje")
    .select("nivel, personajes!inner(usuario_id)")
    .eq("personaje_id", characterId)
    .eq("personajes.usuario_id", user.id);

  if (clasesError) {
    return NextResponse.json({ error: clasesError.message }, { status: 500 });
  }
  if (!clases || clases.length === 0) {
    return NextResponse.json({ error: "Personaje no encontrado" }, { status: 404 });
  }

  const total = (clases as any[]).reduce((sum, c) => sum + Number(c.nivel ?? 0), 0);

  const { error: updateError } = await db
    .from("personajes")
    .update({ nivel_visto: total })
    .eq("id", characterId)
    .eq("usuario_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ nivelVisto: total });
}
