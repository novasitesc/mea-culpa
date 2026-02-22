import { NextResponse } from "next/server";
import { DEMO_USERS } from "@/lib/demoUsers";

const data = {
  characters: [
    {
      id: 1,
      name: "Liora",
      className: "Sorcerer",
      race: "Human",
      alignment: "Lawful Good",
      background: "Hermit",
      portrait: "/characters/renekton.png",
      stats: {
        str: 15,
        dex: 10,
        con: 10,
        int: 12,
        wis: 10,
        chr: 15,
      },
      gear: [
        "Arcane Focus",
        "Traveler's Ring",
        "Spellbook",
        "Iron Staff",
        "Arcane Robes",
        "Boots",
      ],
    },
    {
      id: 2,
      name: "Brom",
      className: "Fighter",
      race: "Dwarf",
      alignment: "Neutral Good",
      background: "Soldier",
      portrait: "/characters/braum.png",
      stats: {
        str: 18,
        dex: 12,
        con: 16,
        int: 9,
        wis: 11,
        chr: 8,
      },
      gear: [
        "Greatsword",
        "Shield",
        "Plate Armor",
        "Traveler's Cloak",
        "Boots",
        "Battle Trophy",
      ],
    },
  ],
};

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const foundUser =
    DEMO_USERS.find((user) => user.id === userId) ?? DEMO_USERS[0];

  return NextResponse.json({
    player: {
      name: foundUser.name,
      role: foundUser.role,
      level: foundUser.level,
      home: foundUser.home,
    },
    characters: data.characters,
    userId,
  });
}
