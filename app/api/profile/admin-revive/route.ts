// POST — Solo admin. Revive un personaje sin pago, desde el panel.
// La versión de pago es /api/profile/revive-paypal/*.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  try {
    const { characterId } = await request.json();

    if (!characterId) {
      return NextResponse.json({ error: "ID de personaje requerido" }, { status: 400 });
    }

    // Actualizar estado de vida a vivo
    const { error: updateError } = await session.db
      .from("personajes")
      .update({ 
        estado_vida: "vivo",
        muerto_en: null
      })
      .eq("id", characterId);

    if (updateError) {
      return NextResponse.json({ error: "Error al revivir al personaje" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Personaje revivido por admin" });

  } catch (error) {
    console.error("Error en admin-revive:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
