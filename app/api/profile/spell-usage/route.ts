import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { normalizeSpells, normalizeUsedSpells, spellKey } from "@/lib/spells";

// Marca o devuelve un conjuro gastado. En D&D 5e 2014 los espacios de conjuro
// se recuperan con el descanso largo (PHB p.186); aquí el jugador lleva la
// cuenta de qué conjuros ya lanzó y el descanso largo los devuelve todos.
// Los trucos (nivel 0) no se gastan, así que no son marcables.
export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);
  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { characterId?: unknown; spellName?: unknown; used?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  const characterId = Number(body.characterId);
  const rawName = String(body.spellName ?? "").trim();
  const used = body.used === true;

  if (!Number.isFinite(characterId) || characterId <= 0 || rawName.length === 0) {
    return NextResponse.json({ error: "characterId y spellName son requeridos" }, { status: 400 });
  }

  const { data: personaje, error: fetchError } = await db
    .from("personajes")
    .select("id, conjuros_conocidos, conjuros_usados")
    .eq("id", characterId)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!personaje) {
    return NextResponse.json({ error: "Personaje no encontrado" }, { status: 404 });
  }

  const key = spellKey(rawName);
  const known = normalizeSpells((personaje as any).conjuros_conocidos);
  const entry = known.find((s) => spellKey(s.name) === key);

  if (!entry) {
    return NextResponse.json({ error: "El personaje no conoce ese conjuro" }, { status: 400 });
  }
  if (entry.spellLevel === 0) {
    return NextResponse.json({ error: "Los trucos no consumen espacios de conjuro" }, { status: 400 });
  }

  const current = new Set(normalizeUsedSpells((personaje as any).conjuros_usados));
  if (used) current.add(key);
  else current.delete(key);
  const next = Array.from(current);

  const { error: updateError } = await db
    .from("personajes")
    .update({ conjuros_usados: next })
    .eq("id", characterId)
    .eq("usuario_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ usedSpells: next });
}
