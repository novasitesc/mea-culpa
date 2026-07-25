// POST — Solo admin. Mata un personaje desde el panel.
// Delega en markCharacterDead() (lib/characterLife.ts), que cambia el estado y
// deja el registro en el historial de muertes en una sola transacción.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { markCharacterDead } from "@/lib/characterLife";

// POST /api/admin/characters/kill
// Pone a un personaje en estado "muerto" desde el panel de administración.
// El personaje QUEDA VISIBLE en la interfaz (puede ser revivido).
// Diferente de DELETE que marca como "eliminado" y lo oculta.
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const body = await request.json();
  const { characterId, reason } = body as {
    characterId: number;
    reason?: string;
  };

  if (!characterId) {
    return NextResponse.json(
      { error: "characterId es requerido" },
      { status: 400 },
    );
  }

  // Verificar que el personaje existe y está vivo
  const { data: personaje, error: fetchError } = await session.db
    .from("personajes")
    .select("id, nombre, estado_vida, usuario_id")
    .eq("id", characterId)
    .single();

  if (fetchError || !personaje) {
    return NextResponse.json(
      { error: "Personaje no encontrado" },
      { status: 404 },
    );
  }

  if (personaje.estado_vida !== "vivo") {
    return NextResponse.json(
      {
        error: `El personaje no está vivo (estado actual: ${personaje.estado_vida})`,
      },
      { status: 409 },
    );
  }

  const killResult = await markCharacterDead({
    db: session.db,
    userId: personaje.usuario_id,
    characterId,
    reason: reason ?? "Muerte decretada por administrador",
    partidaId: null,
    metadata: { source: "admin_panel" },
  });

  if (!killResult.ok) {
    return NextResponse.json(
      { error: killResult.error ?? "Error al matar personaje" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
