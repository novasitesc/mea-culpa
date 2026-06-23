import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import {
  getCasterType,
  getMaxKnownSpells,
  getMaxSpellLevel,
  getEffectiveMaxSpellLevel,
  getMaxRegistrableSpells,
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

    // ──────────────────────────────────────────────────────────
    // VALIDACIÓN CONTRA EL CATÁLOGO DE SUPABASE
    // ──────────────────────────────────────────────────────────

    // Obtener las clases del personaje
    const clases = (personaje.clases_personaje || []) as {
      nombre_clase: string;
      nivel: number;
    }[];

    const classNames = clases.map(c => c.nombre_clase);

    // Obtener todos los nombres de conjuros que el jugador quiere guardar
    const spellNames = spellEntries.map(s => s.name.trim());

    if (spellNames.length > 0) {
      // 1. Verificar que TODOS los conjuros existen en el catálogo
      const { data: catalogSpells, error: catalogError } = await db
        .from("conjuros")
        .select("nombre, nivel")
        .in("nombre", spellNames);

      if (catalogError) {
        return NextResponse.json(
          { error: "Error verificando el catálogo de conjuros" },
          { status: 500 },
        );
      }

      const catalogMap = new Map<string, number>();
      for (const cs of catalogSpells ?? []) {
        catalogMap.set(cs.nombre.toLowerCase().trim(), cs.nivel);
      }

      // Verificar existencia y corregir nivel desde el catálogo
      for (const s of spellEntries) {
        const key = s.name.toLowerCase().trim();
        const realLevel = catalogMap.get(key);
        if (realLevel === undefined) {
          return NextResponse.json(
            { error: `Bloqueo anti-trampa: El conjuro "${s.name}" no existe en el catálogo oficial.` },
            { status: 403 },
          );
        }
        // Forzar el nivel real del catálogo (impide manipulación de nivel)
        s.spellLevel = realLevel;
      }

      // 2. Verificar que las clases del personaje tienen acceso a esos conjuros y nivel
      const { data: allowedMappings, error: mappingError } = await db
        .from("conjuro_clases")
        .select("conjuro_nombre, nombre_clase")
        .in("conjuro_nombre", spellNames)
        .in("nombre_clase", classNames);

      if (mappingError) {
        return NextResponse.json(
          { error: "Error verificando acceso a conjuros por clase" },
          { status: 500 },
        );
      }

      // Precalcular el nivel máximo de conjuro por cada clase del personaje
      // Bug #1 fix: también considerar el nivel máximo efectivo de multiclase
      const classMaxSpellLevel = new Map<string, number>();
      for (const c of clases) {
        classMaxSpellLevel.set(c.nombre_clase, getMaxSpellLevel(c.nombre_clase, c.nivel));
      }
      // Nivel máximo efectivo considerando multiclase (PHB p.165)
      const effectiveMaxLv = getEffectiveMaxSpellLevel(
        clases.map(c => ({ className: c.nombre_clase, level: c.nivel })),
      );

      for (const s of spellEntries) {
        const key = s.name.toLowerCase().trim();
        const validClassesForSpell = (allowedMappings ?? [])
          .filter(m => m.conjuro_nombre.toLowerCase().trim() === key)
          .map(m => m.nombre_clase);

        if (validClassesForSpell.length === 0) {
          return NextResponse.json(
            {
              error: `Bloqueo anti-trampa: "${s.name}" no está disponible para las clases de este personaje (${classNames.join(", ")}).`,
            },
            { status: 403 },
          );
        }

        // Verificar si ALGUNA de las clases válidas para este conjuro tiene el nivel suficiente
        // Bug #1 fix: También aceptar si el nivel efectivo de multiclase lo permite
        const canCast = validClassesForSpell.some(cName => {
          const maxLv = classMaxSpellLevel.get(cName) || 0;
          return maxLv >= s.spellLevel;
        }) || s.spellLevel <= effectiveMaxLv;

        if (!canCast) {
          return NextResponse.json(
            {
              error: `Bloqueo anti-trampa: Tu nivel en las clases que acceden a "${s.name}" es demasiado bajo para aprender conjuros de nivel ${s.spellLevel}.`,
            },
            { status: 403 },
          );
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // VALIDACIÓN DE LÍMITE TOTAL DE CONJUROS REGISTRABLES
    // ──────────────────────────────────────────────────────────
    // Bug #2 fix: incluir TODOS los tipos de caster, no solo "known"

    let totalMaxRegistrable = 0;
    let isUnlimited = false;
    for (const c of clases) {
      const max = getMaxRegistrableSpells(c.nombre_clase, c.nivel);
      if (max === -1) {
        isUnlimited = true; // Clérigo/Druida/Paladín: sin límite de registro
      } else {
        totalMaxRegistrable += max;
      }
    }

    // Si tiene un límite y lo excede
    if (!isUnlimited && totalMaxRegistrable > 0 && spellEntries.length > totalMaxRegistrable) {
      return NextResponse.json(
        { error: `Excede el máximo de conjuros registrables: ${spellEntries.length}/${totalMaxRegistrable}.` },
        { status: 403 },
      );
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
