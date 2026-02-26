import { NextResponse } from "next/server";
import { updateCharacter } from "../route";

export async function POST(request: Request) {
  try {
    const { userId, characterId, bagItems, armor, accessories, weapons } = await request.json();

    if (!userId || !characterId || !bagItems) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Actualizar en memoria (simulando BD)
    const updated = updateCharacter(userId, characterId, {
      bag: { items: bagItems, maxSlots: bagItems.maxSlots || 10 },
      armor,
      accessories,
      weapons,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    // TODO: Aquí irá la lógica para actualizar en la base de datos
    // Ejemplo futuro:
    // await db.update(characters)
    //   .set({ 
    //     bag: JSON.stringify({ items: bagItems, maxSlots: bagItems.maxSlots }),
    //     armor: JSON.stringify(armor),
    //     accessories: JSON.stringify(accessories),
    //     weapons: JSON.stringify(weapons),
    //   })
    //   .where(and(
    //     eq(characters.id, characterId),
    //     eq(characters.userId, userId)
    //   ));

    return NextResponse.json({
      success: true,
      message: "Character updated successfully",
      characterId,
      bagItems,
      armor,
      accessories,
      weapons,
    });
  } catch (error) {
    console.error("Error updating character:", error);
    return NextResponse.json(
      { error: "Failed to update character" },
      { status: 500 }
    );
  }
}
