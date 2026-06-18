import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { VALID_LIMB_KEYS, applyLimbUpdate } from "@/lib/limbs";

export async function PATCH(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  let body: { personajeId?: unknown; miembro?: unknown; desmembrado?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const personajeId = Number(body.personajeId);
  const miembro = String(body.miembro ?? "").trim();
  const desmembrado = Boolean(body.desmembrado);

  if (!Number.isFinite(personajeId) || personajeId <= 0) {
    return NextResponse.json({ error: "personajeId inválido" }, { status: 400 });
  }
  if (!VALID_LIMB_KEYS.has(miembro as any)) {
    return NextResponse.json({ error: "miembro inválido" }, { status: 400 });
  }

  const { data: personaje, error: fetchError } = await session.db
    .from("personajes")
    .select("id, extremidades")
    .eq("id", personajeId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!personaje) {
    return NextResponse.json({ error: "Personaje no encontrado" }, { status: 404 });
  }

  const updated = applyLimbUpdate((personaje as any).extremidades, miembro, desmembrado);
  const value = Object.keys(updated).length > 0 ? updated : null;

  const { error: updateError } = await session.db
    .from("personajes")
    .update({ extremidades: value })
    .eq("id", personajeId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ extremidades: value });
}
