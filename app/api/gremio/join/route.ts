import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);

  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { gremioId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  const gremioId = Number(body.gremioId);
  if (!Number.isFinite(gremioId)) {
    return NextResponse.json({ error: "gremioId es requerido" }, { status: 400 });
  }

  const { data: existingMembership, error: existingError } = await db
    .from("gremio_miembros")
    .select("id")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingMembership) {
    return NextResponse.json({ error: "Ya perteneces a un gremio" }, { status: 409 });
  }

  const { data: guild, error: guildError } = await db
    .from("gremios")
    .select("id")
    .eq("id", gremioId)
    .maybeSingle();

  if (guildError) {
    return NextResponse.json({ error: guildError.message }, { status: 500 });
  }

  if (!guild) {
    return NextResponse.json({ error: "Gremio no encontrado" }, { status: 404 });
  }

  const { data, error: insertError } = await db
    .from("gremio_miembros")
    .insert({
      gremio_id: gremioId,
      usuario_id: user.id,
      rol: "integrante",
    })
    .select("id, gremio_id, rol")
    .single();

  if (insertError) {
    if (String((insertError as any).code) === "23505") {
      return NextResponse.json({ error: "Ya perteneces a un gremio" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
