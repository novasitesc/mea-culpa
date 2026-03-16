import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

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
    case "fighter":
      return { ...base, fuerza: 16, constitucion: 14, destreza: 12 };
    case "paladin":
      return { ...base, fuerza: 16, carisma: 14, constitucion: 12 };
    case "ranger":
    case "monk":
      return { ...base, destreza: 16, sabiduria: 14, constitucion: 12 };
    case "rogue":
      return { ...base, destreza: 16, carisma: 14, inteligencia: 12 };
    case "bard":
      return { ...base, carisma: 16, destreza: 14, constitucion: 12 };
    case "cleric":
      return { ...base, sabiduria: 16, constitucion: 14, fuerza: 12 };
    case "druid":
      return { ...base, sabiduria: 16, constitucion: 14, destreza: 12 };
    case "sorcerer":
    case "warlock":
      return { ...base, carisma: 16, constitucion: 14, destreza: 12 };
    case "wizard":
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

    // Verificar límite de personajes
    // Cuentas gratuitas: máximo 2. Con plan premium (a implementar): hasta 5.
    const FREE_LIMIT = 2;
    const { count } = await db
      .from("personajes")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", userId);

    if ((count ?? 0) >= FREE_LIMIT) {
      return NextResponse.json(
        {
          error:
            "Has alcanzado el límite de 2 personajes de la cuenta gratuita. Actualiza tu plan para crear hasta 5.",
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
    while (usedSlots.has(nextSlot) && nextSlot <= 5) nextSlot++;

    // Generar stats basados en la clase primaria
    const primaryClass = multiclass[0].className;
    const stats = generateStatsForClass(primaryClass);

    // Calcular capacidad de bolsa
    const conModifier = Math.floor((stats.constitucion - 10) / 2);
    const capacidadBolsa = Math.max(10 + conModifier, 10);

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
        nivel: c.level || 1,
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
