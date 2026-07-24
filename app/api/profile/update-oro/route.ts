// POST — Solo admin. Ajuste manual de oro; envoltorio fino sobre
// modifyGold() (lib/goldService.ts).
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
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
    // 1. Verificar token válido + es_admin (fuente única de verdad para permisos)
    const adminResult = await requireAdmin(request);
    if ("error" in adminResult) return adminResult.error;

    // 2. Validar y procesar el cuerpo de la solicitud
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
