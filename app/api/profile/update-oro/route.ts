import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

// POST /api/profile/update-oro
// Body: { userId: string, delta: number }
// delta positivo = ganar oro, negativo = gastar oro.
// El oro nunca puede quedar negativo (la función RPC lo verifica).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, delta } = body;

    if (!userId || typeof delta !== "number" || !Number.isInteger(delta)) {
      return NextResponse.json(
        { error: "userId y delta (entero) son requeridos" },
        { status: 400 },
      );
    }

    const db = createServerClient();

    const { data, error } = await db.rpc("modificar_oro", {
      p_usuario_id: userId,
      p_delta: delta,
    });

    if (error) {
      // La función RPC lanza excepción si el oro quedaría negativo
      const insuficiente = error.message?.includes("Oro insuficiente");
      return NextResponse.json(
        { error: insuficiente ? "Oro insuficiente" : error.message },
        { status: insuficiente ? 422 : 500 },
      );
    }

    return NextResponse.json({ oro: data });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
