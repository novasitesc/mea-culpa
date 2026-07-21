import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { normalizeSpells, normalizeUsedSpells, spellKey } from "@/lib/spells";

// Conjuros del personaje que el jugador tiene en la expedición.
// GET lista lo que puede lanzar; POST lanza uno: gasta el espacio (D&D 5e
// 2014 — sólo un descanso largo lo devuelve), registra el evento y lo
// retransmite para que todos vean la animación en la sala.

type Participacion = {
  personajeId: number;
  personajeNombre: string;
  known: ReturnType<typeof normalizeSpells>;
  used: string[];
};

async function cargarParticipacion(
  db: ReturnType<typeof createServerClient>,
  partidaId: string,
  userId: string,
): Promise<{ ok: true; data: Participacion } | { ok: false; error: string; status: number }> {
  const { data: partida } = await db
    .from("partidas")
    .select("id, estado")
    .eq("id", partidaId)
    .maybeSingle();

  if (!partida || (partida as any).estado !== "en_progreso") {
    return { ok: false, error: "La partida no está en progreso", status: 403 };
  }

  const { data: participante } = await db
    .from("partida_participantes")
    .select(
      "personaje_id, muerto, derrotado, personaje:personaje_id ( nombre, conjuros_conocidos, conjuros_usados )",
    )
    .eq("partida_id", partidaId)
    .eq("usuario_id", userId)
    .maybeSingle();

  if (!participante) {
    return { ok: false, error: "No eres participante de esta partida", status: 403 };
  }
  if ((participante as any).muerto || (participante as any).derrotado) {
    return { ok: false, error: "Tu personaje ya abandonó la expedición", status: 403 };
  }

  const personaje = (participante as any).personaje;
  return {
    ok: true,
    data: {
      personajeId: Number((participante as any).personaje_id),
      personajeNombre: personaje?.nombre ?? "Personaje",
      known: normalizeSpells(personaje?.conjuros_conocidos),
      used: normalizeUsedSpells(personaje?.conjuros_usados),
    },
  };
}

/** Añade la escuela del catálogo a cada conjuro conocido. */
async function conEscuela(
  db: ReturnType<typeof createServerClient>,
  known: ReturnType<typeof normalizeSpells>,
): Promise<Map<string, string | null>> {
  const nombres = known.map((s) => s.name);
  if (nombres.length === 0) return new Map();

  const { data: catalogo } = await db
    .from("conjuros")
    .select("nombre, escuela")
    .in("nombre", nombres);

  const porNombre = new Map<string, string | null>();
  for (const row of (catalogo ?? []) as any[]) {
    porNombre.set(spellKey(row.nombre), row.escuela ?? null);
  }
  return porNombre;
}

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

  const result = await cargarParticipacion(db, partidaId, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { known, used, personajeId, personajeNombre } = result.data;
  const escuelas = await conEscuela(db, known);
  const usedSet = new Set(used);

  return NextResponse.json({
    personajeId,
    personajeNombre,
    conjuros: known
      .map((s) => ({
        name: s.name,
        spellLevel: s.spellLevel,
        escuela: escuelas.get(spellKey(s.name)) ?? null,
        // Los trucos no gastan espacio: siempre disponibles (PHB p.201).
        used: s.spellLevel > 0 && usedSet.has(spellKey(s.name)),
      }))
      .sort((a, b) => a.spellLevel - b.spellLevel || a.name.localeCompare(b.name)),
  });
}

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

  let body: { spellName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const rawName = String(body.spellName ?? "").trim();
  if (rawName.length === 0) {
    return NextResponse.json({ error: "spellName es requerido" }, { status: 400 });
  }

  const result = await cargarParticipacion(db, partidaId, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { known, used, personajeId, personajeNombre } = result.data;
  const key = spellKey(rawName);
  const entry = known.find((s) => spellKey(s.name) === key);

  if (!entry) {
    return NextResponse.json({ error: "No conoces ese conjuro" }, { status: 400 });
  }

  const usedSet = new Set(used);
  if (entry.spellLevel > 0 && usedSet.has(key)) {
    return NextResponse.json(
      { error: "Ya gastaste ese conjuro; necesitas un descanso largo" },
      { status: 409 },
    );
  }

  // Los trucos no consumen espacio, así que no tocan conjuros_usados.
  let nuevosUsados = used;
  if (entry.spellLevel > 0) {
    usedSet.add(key);
    nuevosUsados = Array.from(usedSet);
    const { error: updateError } = await db
      .from("personajes")
      .update({ conjuros_usados: nuevosUsados })
      .eq("id", personajeId)
      .eq("usuario_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const { data: catalogo } = await db
    .from("conjuros")
    .select("escuela")
    .eq("nombre", entry.name)
    .maybeSingle();

  const escuela = ((catalogo as any)?.escuela ?? null) as string | null;

  const payload = {
    tipo: "conjuro_lanzado" as const,
    personajeId,
    personajeNombre,
    conjuro: entry.name,
    spellLevel: entry.spellLevel,
    escuela,
  };

  await db.from("partidas_eventos").insert({
    partida_id: partidaId,
    tipo: "conjuro_lanzado",
    personaje_id: personajeId,
    personaje_nombre: personajeNombre,
    usuario_id: user.id,
    objeto_nombre: entry.name,
    cantidad: entry.spellLevel,
    metadata: { escuela },
  });

  // El broadcast lo hace el cliente al recibir esta respuesta (mismo camino que
  // los consumibles). Emitirlo también aquí duplicaría evento y animación.
  return NextResponse.json({ ...payload, usedSpells: nuevosUsados });
}
