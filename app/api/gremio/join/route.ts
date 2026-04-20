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

  const { data, error: rpcError } = await db.rpc("unirse_gremio_con_limite", {
    p_usuario_id: user.id,
    p_gremio_id: gremioId,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "No se pudo unir al gremio";
    if (msg.includes("Ya perteneces")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg.includes("Gremio no encontrado")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes("limite de integrantes")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
