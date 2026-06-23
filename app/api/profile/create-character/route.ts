import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { calculateBagSlots } from "@/lib/types/character";
import {
  getCasterType,
  getMaxKnownSpells,
  normalizeSpells,
  validateSpells,
  type SpellEntry,
} from "@/lib/spells";

// Generar stats basados en la clase primaria
function generateStatsForClass(className: string) {
  const base = {
    fuerza: 10,
    destreza: 10,
    constitucion: 10,
    inteligencia: 10,
    sabiduria: 10,
    carisma: 10,
  };
  switch (className.toLowerCase()) {
    case "barbarian":
    case "bárbaro":
    case "fighter":
    case "guerrero":
      return { ...base, fuerza: 16, constitucion: 14, destreza: 12 };
    case "paladin":
    case "paladín":
      return { ...base, fuerza: 16, carisma: 14, constitucion: 12 };
    case "ranger":
    case "explorador":
    case "monk":
    case "monje":
      return { ...base, destreza: 16, sabiduria: 14, constitucion: 12 };
    case "rogue":
    case "pícaro":
      return { ...base, destreza: 16, carisma: 14, inteligencia: 12 };
    case "bard":
    case "bardo":
      return { ...base, carisma: 16, destreza: 14, constitucion: 12 };
    case "cleric":
    case "clérigo":
      return { ...base, sabiduria: 16, constitucion: 14, fuerza: 12 };
    case "druid":
    case "druida":
      return { ...base, sabiduria: 16, constitucion: 14, destreza: 12 };
    case "sorcerer":
    case "hechicero":
    case "warlock":
    case "brujo":
      return { ...base, carisma: 16, constitucion: 14, destreza: 12 };
    case "wizard":
    case "mago":
      return { ...base, inteligencia: 16, constitucion: 14, destreza: 12 };
    default:
      return base;
  }
}

export async function POST(request: Request) {
  try {
    const { userId, characterData } = await request.json();

    if (!userId || !characterData) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const { name, race, multiclass, alignment } = characterData;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "El nombre del personaje es obligatorio" },
        { status: 400 },
      );
    }
    if (!race?.trim()) {
      return NextResponse.json(
        { error: "La raza es obligatoria" },
        { status: 400 },
      );
    }
    if (!alignment) {
      return NextResponse.json(
        { error: "El alineamiento es obligatorio" },
        { status: 400 },
      );
    }
    if (!multiclass || multiclass.length === 0) {
      return NextResponse.json(
        { error: "Debes seleccionar al menos una clase" },
        { status: 400 },
      );
    }
    if (multiclass.length > 3) {
      return NextResponse.json(
        { error: "Máximo 3 clases por personaje" },
        { status: 400 },
      );
    }
    if (multiclass.some((c: { className: string }) => !c.className)) {
      return NextResponse.json(
        { error: "Todas las clases deben estar seleccionadas" },
        { status: 400 },
      );
    }
    const classNames = multiclass.map(
      (c: { className: string }) => c.className,
    );
    if (classNames.length !== new Set(classNames).size) {
      return NextResponse.json(
        { error: "No puede haber clases duplicadas" },
        { status: 400 },
      );
    }

    const db = createServerClient();

    const { data: perfil, error: perfilError } = await db
      .from("perfiles")
      .select("max_personajes")
      .eq("id", userId)
      .single();

    if (perfilError) {
      return NextResponse.json(
        { error: "No se pudo validar el perfil del usuario" },
        { status: 500 },
      );
    }

    const maxCharacterSlots = Math.max(2, Math.min(5, perfil?.max_personajes ?? 2));

    // Verificar limite de personajes configurado para la cuenta.
    const { count } = await db
      .from("personajes")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", userId)
      .neq("estado_vida", "enterrado");

    if ((count ?? 0) >= maxCharacterSlots) {
      return NextResponse.json(
        {
          error: `Has alcanzado el limite de ${maxCharacterSlots} personajes para tu cuenta.`,
          code: "CHARACTER_LIMIT_REACHED",
        },
        { status: 403 },
      );
    }

    // Siguiente slot disponible
    const { data: existingSlots } = await db
      .from("personajes")
      .select("numero_slot")
      .eq("usuario_id", userId);

    const usedSlots = new Set(
      (existingSlots ?? []).map((s: any) => s.numero_slot),
    );
    let nextSlot = 1;
    while (usedSlots.has(nextSlot) && nextSlot <= maxCharacterSlots) nextSlot++;

    // Generar stats basados en la clase primaria
    const primaryClass = multiclass[0].className;
    const stats = generateStatsForClass(primaryClass);

    // Calcular capacidad de bolsa en base a fuerza
    const capacidadBolsa = calculateBagSlots(stats.fuerza);

    // Validar y normalizar conjuros conocidos
    const rawSpells: SpellEntry[] = normalizeSpells(characterData.knownSpells || []);

    // Deduplicar
    const seenKeys = new Set<string>();
    const validatedSpells: SpellEntry[] = [];
    for (const s of rawSpells) {
      const key = s.name.toLowerCase().trim();
      if (key.length === 0 || seenKeys.has(key)) continue;
      seenKeys.add(key);
      validatedSpells.push({ name: s.name.trim(), spellLevel: s.spellLevel });
    }

    // --- VALIDACIÓN CONTRA EL CATÁLOGO DE SUPABASE ---
    if (validatedSpells.length > 0) {
      const spellNames = validatedSpells.map(s => s.name);
      const classNames = multiclass.map((c: { className: string }) => c.className);

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

      for (const s of validatedSpells) {
        const key = s.name.toLowerCase().trim();
        const realLevel = catalogMap.get(key);
        if (realLevel === undefined) {
          return NextResponse.json(
            { error: `El conjuro "${s.name}" no existe en el catálogo oficial.` },
            { status: 400 },
          );
        }
        s.spellLevel = realLevel;
      }

      // 2. Verificar que las clases del personaje tienen acceso a esos conjuros
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

      const allowedSet = new Set<string>();
      for (const m of allowedMappings ?? []) {
        allowedSet.add(m.conjuro_nombre.toLowerCase().trim());
      }

      for (const s of validatedSpells) {
        const key = s.name.toLowerCase().trim();
        if (!allowedSet.has(key)) {
          return NextResponse.json(
            { error: `"${s.name}" no está disponible para las clases seleccionadas (${classNames.join(", ")}).` },
            { status: 400 },
          );
        }
      }
    }

    // Validar suma global de topes (para evitar error en multiclase)
    let totalMaxKnown = 0;
    for (const c of multiclass as { className: string; level: number }[]) {
      const type = getCasterType(c.className);
      if (type === "known") {
        totalMaxKnown += getMaxKnownSpells(c.className, c.level);
      }
    }

    if (totalMaxKnown > 0 && validatedSpells.length > totalMaxKnown) {
       return NextResponse.json(
         { error: `Excede el máximo de conjuros conocidos: ${validatedSpells.length}/${totalMaxKnown}.` },
         { status: 400 },
       );
    }

    // 1. Insertar personaje
    const { data: personaje, error: charErr } = await db
      .from("personajes")
      .insert({
        usuario_id: userId,
        numero_slot: nextSlot,
        nombre: name.trim(),
        raza: race.trim(),
        alineamiento: alignment,
        retrato: "/characters/profileplaceholder.webp",
        capacidad_bolsa: capacidadBolsa,
        conjuros_conocidos: validatedSpells,
      })
      .select("id")
      .single();

    if (charErr || !personaje) {
      console.error("Error inserting character:", charErr);
      return NextResponse.json(
        { error: "Error al crear el personaje" },
        { status: 500 },
      );
    }

    const charId = personaje.id;

    // 2. Insertar clases
    const clasesInsert = multiclass.map(
      (c: { className: string; level: number }, i: number) => ({
        personaje_id: charId,
        nombre_clase: c.className,
        nivel: Math.min(20, Math.max(1, Math.floor(Number(c.level) || 1))),
        orden: i + 1,
      }),
    );

    // 3. Insertar stats
    const statsInsert = { personaje_id: charId, ...stats };

    // 4. Insertar equipamiento vacío
    const equipInsert = { personaje_id: charId };

    // Ejecutar en paralelo
    const [clasesRes, statsRes, equipRes] = await Promise.all([
      db.from("clases_personaje").insert(clasesInsert),
      db.from("estadisticas_personaje").insert(statsInsert),
      db.from("equipamiento_personaje").insert(equipInsert),
    ]);

    if (clasesRes.error)
      console.error("Error inserting classes:", clasesRes.error);
    if (statsRes.error) console.error("Error inserting stats:", statsRes.error);
    if (equipRes.error)
      console.error("Error inserting equipment:", equipRes.error);

    // Devolver el personaje en el formato que espera el frontend
    return NextResponse.json({
      success: true,
      message: "Character created successfully",
      character: {
        id: charId,
        name: name.trim(),
        multiclass,
        race: race.trim(),
        alignment,
        portrait: "/characters/profileplaceholder.webp",
        knownSpells: validatedSpells,
        stats: {
          str: stats.fuerza,
          dex: stats.destreza,
          con: stats.constitucion,
          int: stats.inteligencia,
          wis: stats.sabiduria,
          chr: stats.carisma,
        },
        armor: {},
        accessories: {},
        weapons: {},
        bag: { items: [], maxSlots: capacidadBolsa },
        hasDismemberedLimb: false,
        dismemberedLimbs: [],
      },
    });
  } catch (error) {
    console.error("Error creating character:", error);
    return NextResponse.json(
      { error: "Failed to create character" },
      { status: 500 },
    );
  }
}
