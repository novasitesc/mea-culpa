import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import {
  getCasterType,
  getMaxKnownSpells,
  normalizeSpells,
  validateSpells,
  type SpellEntry,
} from "@/lib/spells";

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

    // Normalizar al nuevo formato SpellEntry[]
    const spellEntries: SpellEntry[] = normalizeSpells(newSpells);

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

    // Normalizar conjuros actuales (backward compat con string[])
    const currentSpells: SpellEntry[] = normalizeSpells(personaje.conjuros_conocidos);

    // Anti-trampa: no se pueden eliminar conjuros previamente registrados
    for (const existing of currentSpells) {
      const key = existing.name.toLowerCase().trim();
      const stillPresent = spellEntries.some(
        s => s.name.toLowerCase().trim() === key,
      );
      if (!stillPresent) {
        return NextResponse.json(
          { error: `Bloqueo anti-trampa: No puedes eliminar el conjuro "${existing.name}".` },
          { status: 403 },
        );
      }
    }

    // Validar conjuros según reglas de cada clase
    const clases = (personaje.clases_personaje || []) as {
      nombre_clase: string;
      nivel: number;
    }[];

    // Acumular errores de validación de todas las clases
    const allErrors: string[] = [];
    let totalMaxKnown = 0;

    for (const c of clases) {
      const type = getCasterType(c.nombre_clase);
      if (type === "known") {
        totalMaxKnown += getMaxKnownSpells(c.nombre_clase, c.nivel);
      }

      // Validar distribución y niveles por clase
      if (type !== "none") {
        const result = validateSpells(c.nombre_clase, c.nivel, spellEntries);
        allErrors.push(...result.errors);
      }
    }

    // Quitar duplicados antes de guardar
    const seenKeys = new Set<string>();
    const uniqueSpells: SpellEntry[] = [];
    for (const s of spellEntries) {
      const key = s.name.toLowerCase().trim();
      if (key.length === 0) continue;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      uniqueSpells.push({ name: s.name.trim(), spellLevel: s.spellLevel });
    }

    // Si hay errores de validación, rechazar
    if (allErrors.length > 0) {
      return NextResponse.json(
        { error: `Bloqueo anti-trampa: ${allErrors[0]}`, errors: allErrors },
        { status: 403 },
      );
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
