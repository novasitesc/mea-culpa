import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { modifyGold } from "@/lib/goldService";

// POST /api/profile/update-oro
// Requiere sesión activa con rol = 'admin'.
// Body: { userId: string, delta: number, concepto?: string, referenciaId?: string }
//
// Para modificar oro desde otras rutas del servidor (tiendas, misiones…)
// importar y llamar directamente a `modifyGold` de lib/goldService.ts
// en lugar de hacer una petición HTTP a este endpoint.
export async function POST(request: Request) {
  try {
    // 1. Verificar que la petición incluye un token de sesión válido
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

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

    // 2. Verificar que el usuario tiene rol de administrador
    const { data: perfil } = await db
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (perfil?.rol !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // 3. Validar y procesar el cuerpo de la solicitud
    const body = await request.json();
    const { userId, delta, concepto = "admin", referenciaId } = body;

    if (!userId || typeof delta !== "number" || !Number.isInteger(delta)) {
      return NextResponse.json(
        { error: "userId y delta (entero) son requeridos" },
        { status: 400 },
      );
    }

    const nuevoOro = await modifyGold(userId, delta, concepto, referenciaId);
    return NextResponse.json({ oro: nuevoOro });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    const isInsuficiente = message === "Oro insuficiente";
    return NextResponse.json(
      { error: message },
      { status: isInsuficiente ? 422 : 500 },
    );
  }
}
