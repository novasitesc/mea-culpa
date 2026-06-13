import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { getCasterType, getMaxKnownSpells } from "@/lib/spells";

export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { characterId, newSpells } = await request.json();

    if (!characterId || !Array.isArray(newSpells)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Obtener personaje y sus clases actuales para validar el límite
    const { data: personaje, error: charError } = await db
      .from("personajes")
      .select(`
        id,
        conjuros_conocidos,
        clases_personaje ( nombre_clase, nivel )
      `)
      .eq("id", characterId)
      .eq("usuario_id", user.id)
      .single();

    if (charError || !personaje) {
      return NextResponse.json({ error: "Personaje no encontrado" }, { status: 404 });
    }

    const currentSpells: string[] = personaje.conjuros_conocidos || [];
    
    // Validar si el usuario está intentando eliminar conjuros
    for (const spell of currentSpells) {
      if (!newSpells.includes(spell)) {
        return NextResponse.json({ error: "Bloqueo anti-trampa: No puedes eliminar conjuros ya conocidos." }, { status: 403 });
      }
    }

    // Calcular tope máximo según nivel de clase
    let maxAllowed = 0;
    for (const c of (personaje.clases_personaje || [])) {
      const type = getCasterType(c.nombre_clase);
      if (type === "known") {
        maxAllowed += getMaxKnownSpells(c.nombre_clase, c.nivel);
      }
    }

    // Quitar duplicados antes de guardar
    const uniqueSpells = Array.from(new Set(newSpells)).filter(s => s.trim().length > 0);

    if (uniqueSpells.length > maxAllowed) {
      return NextResponse.json({ error: `Bloqueo anti-trampa: Excedes el máximo permitido de conjuros conocidos (${maxAllowed}).` }, { status: 403 });
    }

    const { error: updateError } = await db
      .from("personajes")
      .update({ conjuros_conocidos: uniqueSpells })
      .eq("id", characterId)
      .eq("usuario_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "Error guardando los conjuros" }, { status: 500 });
    }

    return NextResponse.json({ success: true, spells: uniqueSpells });
  } catch (error) {
    return NextResponse.json({ error: "Error procesando la solicitud" }, { status: 500 });
  }
}
