import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error } = await getUserFromRequest(db, request);

  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error: rpcError } = await db.rpc("salir_gremio", {
    p_usuario_id: user.id,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "No se pudo salir del gremio";
    if (msg.includes("No perteneces")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(data);
}
