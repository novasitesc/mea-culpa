import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function GET(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await db
    .from("notas_usuario")
    .select("pagina, contenido")
    .eq("usuario_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Error al obtener notas" }, { status: 500 });
  }

  const paginas: Record<number, string> = {};
  for (const row of data ?? []) {
    paginas[row.pagina] = row.contenido;
  }

  return NextResponse.json({ paginas });
}

export async function PATCH(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const pagina = typeof body?.pagina === "number" && body.pagina >= 1 && body.pagina <= 5 ? body.pagina : null;
  const contenido = typeof body?.contenido === "string" ? body.contenido : null;

  if (pagina === null || contenido === null) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const { error } = await db.from("notas_usuario").upsert(
    { usuario_id: user.id, pagina, contenido, actualizado_en: new Date().toISOString() },
    { onConflict: "usuario_id,pagina" }
  );

  if (error) {
    return NextResponse.json({ error: "Error al guardar nota" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
