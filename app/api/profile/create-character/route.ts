import { NextResponse } from "next/server";

// Función auxiliar para generar stats basados en la clase
function generateStatsForClass(className: string): Record<string, number> {
  const baseStats = {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    chr: 10,
  };

  // Ajustar stats según la clase
  switch (className.toLowerCase()) {
    case "barbarian":
      return { ...baseStats, str: 16, con: 14, dex: 12 };
    case "fighter":
      return { ...baseStats, str: 16, con: 14, dex: 12 };
    case "paladin":
      return { ...baseStats, str: 16, chr: 14, con: 12 };
    case "ranger":
      return { ...baseStats, dex: 16, wis: 14, con: 12 };
    case "rogue":
      return { ...baseStats, dex: 16, chr: 14, int: 12 };
    case "monk":
      return { ...baseStats, dex: 16, wis: 14, con: 12 };
    case "bard":
      return { ...baseStats, chr: 16, dex: 14, con: 12 };
    case "cleric":
      return { ...baseStats, wis: 16, con: 14, str: 12 };
    case "druid":
      return { ...baseStats, wis: 16, con: 14, dex: 12 };
    case "sorcerer":
      return { ...baseStats, chr: 16, con: 14, dex: 12 };
    case "warlock":
      return { ...baseStats, chr: 16, con: 14, dex: 12 };
    case "wizard":
      return { ...baseStats, int: 16, con: 14, dex: 12 };
    default:
      return baseStats;
  }
}

// Función para generar equipo inicial según la clase
function generateInitialEquipment(className: string) {
  const classLower = className.toLowerCase();

  // Armadura inicial
  const armor: {
    cabeza: string | undefined;
    pecho: string | undefined;
    guante: string | undefined;
    botas: string | undefined;
  } = {
    cabeza: undefined,
    pecho: undefined,
    guante: undefined,
    botas: "Simple Boots",
  };

  // Armas iniciales
  const weapons: {
    manoIzquierda: string | undefined;
    manoDerecha: string | undefined;
  } = {
    manoIzquierda: undefined,
    manoDerecha: undefined,
  };

  // Accesorios iniciales
  const accessories = {
    collar: undefined,
    anillo1: undefined,
    anillo2: undefined,
    amuleto: undefined,
  };

  // Configurar según clase
  if (["fighter", "barbarian", "paladin"].includes(classLower)) {
    armor.pecho = "Leather Armor";
    weapons.manoDerecha = "Simple Sword";
  } else if (["rogue", "ranger", "monk"].includes(classLower)) {
    armor.pecho = "Light Armor";
    weapons.manoDerecha = "Dagger";
  } else if (["wizard", "sorcerer", "warlock"].includes(classLower)) {
    armor.pecho = "Simple Robes";
    weapons.manoDerecha = "Wooden Staff";
  } else if (["cleric", "druid"].includes(classLower)) {
    armor.pecho = "Simple Robes";
    weapons.manoDerecha = "Simple Mace";
  } else if (classLower === "bard") {
    armor.pecho = "Light Armor";
    weapons.manoDerecha = "Simple Rapier";
  }

  return { armor, weapons, accessories };
}

import { getUserCharacters, addCharacter } from "../route";

export async function POST(request: Request) {
  try {
    const { userId, characterData } = await request.json();

    // Validación de datos requeridos
    if (!userId || !characterData) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const { name, race, multiclass, alignment } = characterData;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "El nombre del personaje es obligatorio" },
        { status: 400 },
      );
    }

    if (!race || !race.trim()) {
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
    const hasDuplicates = classNames.length !== new Set(classNames).size;
    if (hasDuplicates) {
      return NextResponse.json(
        { error: "No puede haber clases duplicadas" },
        { status: 400 },
      );
    }

    // Validar límite de personajes (máximo 5)
    const existingCharacters = getUserCharacters(userId);
    if (existingCharacters.length >= 5) {
      return NextResponse.json(
        { error: "Has alcanzado el límite máximo de 5 personajes por cuenta" },
        { status: 400 },
      );
    }

    // Generar stats basados en la clase primaria
    const primaryClass = multiclass[0].className;
    const stats = generateStatsForClass(primaryClass);

    // Generar equipo inicial basado en la clase primaria
    const { armor, weapons, accessories } =
      generateInitialEquipment(primaryClass);

    // Calcular espacios de bolsa (10 base + modificador de constitución)
    const conModifier = Math.floor((stats.con - 10) / 2);
    const maxSlots = 10 + conModifier;

    // Crear el nuevo personaje
    const newCharacter = {
      id: Date.now(),
      userId,
      name,
      multiclass,
      race,
      alignment,
      portrait: "/characters/default-portrait.png",
      stats,
      armor,
      accessories,
      weapons,
      bag: {
        items: [],
        maxSlots: maxSlots > 0 ? maxSlots : 10,
      },
    };

    // Agregar a la simulación de BD (reemplazar por INSERT de DB cuando migres)
    // TODO: await db.insert(characters).values({
    //   userId:     newCharacter.userId,
    //   name:       newCharacter.name,
    //   multiclass: JSON.stringify(newCharacter.multiclass),
    //   race:       newCharacter.race,
    //   alignment:  newCharacter.alignment,
    //   portrait:   newCharacter.portrait,
    //   stats:      JSON.stringify(newCharacter.stats),
    //   armor:      JSON.stringify(newCharacter.armor),
    //   accessories:JSON.stringify(newCharacter.accessories),
    //   weapons:    JSON.stringify(newCharacter.weapons),
    //   bag:        JSON.stringify(newCharacter.bag),
    // });
    addCharacter(userId, newCharacter);
    return NextResponse.json({
      success: true,
      message: "Character created successfully",
      character: newCharacter,
    });
  } catch (error) {
    console.error("Error creating character:", error);
    return NextResponse.json(
      { error: "Failed to create character" },
      { status: 500 },
    );
  }
}
