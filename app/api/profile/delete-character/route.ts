import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function DELETE(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("characterId");

    if (!characterId) {
      return NextResponse.json({ error: "ID de personaje requerido" }, { status: 400 });
    }

    // 1. Obtener el personaje para verificar su estado actual
    const { data: personaje, error: fetchError } = await db
      .from("personajes")
      .select("id, estado_vida")
      .eq("id", characterId)
      .eq("usuario_id", user.id)
      .single();

    if (fetchError || !personaje) {
      return NextResponse.json({ error: "Personaje no encontrado" }, { status: 404 });
    }

    // 2. Si el personaje está vivo, lo matamos
    if (personaje.estado_vida !== "muerto") {
      const { error: updateError } = await db
        .from("personajes")
        .update({ 
          estado_vida: "muerto",
          muerto_en: new Date().toISOString()
        })
        .eq("id", characterId)
        .eq("usuario_id", user.id);

      if (updateError) {
        return NextResponse.json({ error: "Error al matar al personaje" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "killed" });
    } 
    
    // 3. Si el personaje ya está muerto, lo ocultamos del perfil (enterrado)
    const { error: deleteError } = await db
      .from("personajes")
      .update({ estado_vida: "enterrado", numero_slot: null })
      .eq("id", characterId)
      .eq("usuario_id", user.id);

    if (deleteError) {
      return NextResponse.json({ error: "Error al enterrar el personaje" }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: "deleted" });

  } catch (error) {
    console.error("Error en delete-character:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
