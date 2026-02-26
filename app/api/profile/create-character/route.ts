import { NextResponse } from "next/server";

// Función auxiliar para generar stats basados en la clase
function generateStatsForClass(className: string): Record<string, number> {
  const baseStats = {
    str: 10, dex: 10, con: 10, int: 10, wis: 10, chr: 10
  };

  // Ajustar stats según la clase
  switch (className.toLowerCase()) {
    case 'barbarian':
      return { ...baseStats, str: 16, con: 14, dex: 12 };
    case 'fighter':
      return { ...baseStats, str: 16, con: 14, dex: 12 };
    case 'paladin':
      return { ...baseStats, str: 16, chr: 14, con: 12 };
    case 'ranger':
      return { ...baseStats, dex: 16, wis: 14, con: 12 };
    case 'rogue':
      return { ...baseStats, dex: 16, chr: 14, int: 12 };
    case 'monk':
      return { ...baseStats, dex: 16, wis: 14, con: 12 };
    case 'bard':
      return { ...baseStats, chr: 16, dex: 14, con: 12 };
    case 'cleric':
      return { ...baseStats, wis: 16, con: 14, str: 12 };
    case 'druid':
      return { ...baseStats, wis: 16, con: 14, dex: 12 };
    case 'sorcerer':
      return { ...baseStats, chr: 16, con: 14, dex: 12 };
    case 'warlock':
      return { ...baseStats, chr: 16, con: 14, dex: 12 };
    case 'wizard':
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
  if (['fighter', 'barbarian', 'paladin'].includes(classLower)) {
    armor.pecho = "Leather Armor";
    weapons.manoDerecha = "Simple Sword";
  } else if (['rogue', 'ranger', 'monk'].includes(classLower)) {
    armor.pecho = "Light Armor";
    weapons.manoDerecha = "Dagger";
  } else if (['wizard', 'sorcerer', 'warlock'].includes(classLower)) {
    armor.pecho = "Simple Robes";
    weapons.manoDerecha = "Wooden Staff";
  } else if (['cleric', 'druid'].includes(classLower)) {
    armor.pecho = "Simple Robes";
    weapons.manoDerecha = "Simple Mace";
  } else if (classLower === 'bard') {
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
        { status: 400 }
      );
    }

    const { name, race, className, background, alignment } = characterData;

    if (!name || !race || !className || !background || !alignment) {
      return NextResponse.json(
        { error: "All character fields are required" },
        { status: 400 }
      );
    }

    // Validar límite de personajes (máximo 5)
    const existingCharacters = getUserCharacters(userId);
    if (existingCharacters.length >= 5) {
      return NextResponse.json(
        { error: "Character limit reached. Maximum 5 characters per user." },
        { status: 400 }
      );
    }

    // Generar stats basados en la clase
    const stats = generateStatsForClass(className);
    
    // Generar equipo inicial
    const { armor, weapons, accessories } = generateInitialEquipment(className);

    // Calcular espacios de bolsa (10 base + modificador de constitución)
    const conModifier = Math.floor((stats.con - 10) / 2);
    const maxSlots = 10 + conModifier;

    // Crear el nuevo personaje
    const newCharacter = {
      id: Date.now(), // En producción, esto será generado por la BD
      userId,
      name,
      className,
      race,
      alignment,
      background,
      portrait: "/characters/default-portrait.png", // Placeholder, se puede personalizar después
      stats,
      armor,
      accessories,
      weapons,
      bag: {
        items: [],
        maxSlots: maxSlots > 0 ? maxSlots : 10,
      },
    };

    // Agregar a la simulación de BD
    addCharacter(userId, newCharacter);

    // TODO: Aquí irá la lógica para guardar en la base de datos
    // Ejemplo futuro:
    // const result = await db.insert(characters).values({
    //   userId: userId,
    //   name: newCharacter.name,
    //   class: newCharacter.className,
    //   race: newCharacter.race,
    //   alignment: newCharacter.alignment,
    //   background: newCharacter.background,
    //   portrait: newCharacter.portrait,
    //   stats: JSON.stringify(newCharacter.stats),
    //   armor: JSON.stringify(newCharacter.armor),
    //   accessories: JSON.stringify(newCharacter.accessories),
    //   weapons: JSON.stringify(newCharacter.weapons),
    //   bag: JSON.stringify(newCharacter.bag),
    //   createdAt: new Date(),
    // }).returning();

    return NextResponse.json({
      success: true,
      message: "Character created successfully",
      character: newCharacter,
    });
  } catch (error) {
    console.error("Error creating character:", error);
    return NextResponse.json(
      { error: "Failed to create character" },
      { status: 500 }
    );
  }
}
