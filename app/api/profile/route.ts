import { NextResponse } from "next/server";
import { DEMO_USERS } from "@/lib/demoUsers";

// Datos de personajes por usuario (simulando BD)
// En producción, esto vendrá de la base de datos
const charactersByUser: Record<string, any[]> = {
  "1": [
    {
      id: 1,
      userId: "1",
      name: "Liora",
      multiclass: [{ className: "Sorcerer", level: 5 }],
      race: "Human",
      alignment: "Lawful Good",
      portrait: "/characters/renekton.png",
      stats: {
        str: 15,
        dex: 10,
        con: 10,
        int: 12,
        wis: 10,
        chr: 15,
      },
      armor: {
        cabeza: "Arcane helmet",
        pecho: "Arcane Robes",
        guante: undefined,
        botas: "Boots",
      },
      accessories: {
        collar: undefined,
        anillo1: "Traveler's Ring",
        anillo2: undefined,
        amuleto: "Arcane Focus",
      },
      weapons: {
        manoIzquierda: "Iron Staff",
        manoDerecha: undefined,
      },
      bag: {
        items: [
          { name: "Iron Helmet", type: "cabeza" },
          { name: "Leather Helmet", type: "cabeza" },
          { name: "Leather Gloves", type: "guante" },
        ],
        maxSlots: 10 + Math.floor(15 / 2),
      },
    },
    {
      id: 2,
      userId: "1",
      name: "Brom",
      multiclass: [{ className: "Fighter", level: 6 }],
      race: "Dwarf",
      alignment: "Neutral Good",
      portrait: "/characters/braum.png",
      stats: {
        str: 18,
        dex: 12,
        con: 16,
        int: 9,
        wis: 11,
        chr: 8,
      },
      armor: {
        cabeza: undefined,
        pecho: "Plate Armor",
        guante: undefined,
        botas: "Boots",
      },
      accessories: {
        collar: undefined,
        anillo1: undefined,
        anillo2: undefined,
        amuleto: "Battle Trophy",
      },
      weapons: {
        manoIzquierda: "Shield",
        manoDerecha: "Greatsword",
      },
      bag: {
        items: [
          { name: "Iron Helmet", type: "cabeza" },
          { name: "Silver Ring", type: "anillo" },
          { name: "Battle Axe", type: "arma" },
          { name: "Gold Necklace", type: "collar" },
        ],
        maxSlots: 10 + Math.floor(18 / 2),
      },
    },
  ],
  "2": [], // Usuario admin sin personajes por defecto
};

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const foundUser =
    DEMO_USERS.find((user) => user.id === userId) ?? DEMO_USERS[0];

  // Obtener personajes del usuario específico
  // En producción: await db.select().from(characters).where(eq(characters.userId, userId))
  const userCharacters = charactersByUser[userId] || [];

  return NextResponse.json({
    player: {
      name: foundUser.name,
      role: foundUser.role,
      level: foundUser.level,
      home: foundUser.home,
    },
    characters: userCharacters,
    userId,
  });
}

// Función auxiliar para agregar un personaje (usado por create-character)
export function addCharacter(userId: string, character: any) {
  if (!charactersByUser[userId]) {
    charactersByUser[userId] = [];
  }
  charactersByUser[userId].push(character);
}

// Función auxiliar para obtener personajes de un usuario
export function getUserCharacters(userId: string) {
  return charactersByUser[userId] || [];
}

// Función auxiliar para actualizar un personaje
export function updateCharacter(
  userId: string,
  characterId: number,
  updates: any,
) {
  if (!charactersByUser[userId]) return false;

  const charIndex = charactersByUser[userId].findIndex(
    (c) => c.id === characterId,
  );
  if (charIndex === -1) return false;

  charactersByUser[userId][charIndex] = {
    ...charactersByUser[userId][charIndex],
    ...updates,
  };

  return true;
}
