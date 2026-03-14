import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  try {
    const body = await request.json();
    const { userId, delta, concepto } = body;

    if (!userId || typeof delta !== "number") {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos: userId y delta" },
        { status: 400 },
      );
    }

    if (delta === 0) {
      return NextResponse.json(
        { error: "El delta no puede ser 0" },
        { status: 400 },
      );
    }

    // Call the RPC function `modificar_oro`
    const { data: newBalance, error } = await session.db.rpc("modificar_oro", {
      p_usuario_id: userId,
      p_delta: delta,
      p_concepto: concepto || "admin",
      p_referencia: null,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Error al modificar el oro" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      newBalance,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 },
    );
  }
}
