import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

// GET /api/profile/oro-historial
// Devuelve las últimas 50 transacciones de oro del usuario autenticado.
// Requiere: Authorization: Bearer <access_token>
export async function GET(request: Request) {
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

  const { data, error } = await db
    .from("transacciones_oro")
    .select("id, delta, balance_after, concepto, referencia_id, creado_en")
    .eq("usuario_id", user.id)
    .order("creado_en", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transacciones: data });
}
