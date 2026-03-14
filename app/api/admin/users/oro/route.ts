import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  try {
    const body = await request.json();
    const { userId, amount, reason, action } = body;

    if (!userId || !amount || amount <= 0 || !["add", "remove"].includes(action)) {
      return NextResponse.json(
        { error: "Datos inválidos (userId, amount > 0, action 'add' o 'remove' requeridos)" },
        { status: 400 }
      );
    }

    // Obtener oro actual
    const { data: userProfile, error: profileError } = await session.db
      .from("perfiles")
      .select("oro")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const currentGold = userProfile.oro || 0;
    const montoCambio = action === "add" ? amount : -amount;
    const newGold = currentGold + montoCambio;

    if (newGold < 0) {
      return NextResponse.json(
        { error: "El usuario no tiene suficiente oro para quitar esa cantidad." },
        { status: 400 }
      );
    }

    // Usar la función RPC para añadir la transacción
    const delta = action === "add" ? amount : -amount;
    const desc = reason || `Administrador (${action === "add" ? "añadió" : "quitó"})`;

    const { data: updatedGold, error: rpcError } = await session.db.rpc("modificar_oro", {
      p_usuario_id: userId,
      p_delta: delta,
      p_concepto: desc,
      p_referencia: null,
      p_admin_id: session.userId,
    });

    if (rpcError) {
      console.error("Error al modificar oro vía RPC:", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, newGold: updatedGold });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
