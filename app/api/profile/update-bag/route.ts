import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { userId, characterId, bagItems } = await request.json();

    if (!userId || !characterId || !bagItems) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // TODO: Aquí irá la lógica para actualizar en la base de datos
    // Por ahora solo simula una respuesta exitosa
    // Ejemplo futuro:
    // await db.update(characters)
    //   .set({ bag: { items: bagItems } })
    //   .where(eq(characters.id, characterId))

    return NextResponse.json({
      success: true,
      message: "Bag updated successfully",
      characterId,
      bagItems,
    });
  } catch (error) {
    console.error("Error updating bag:", error);
    return NextResponse.json(
      { error: "Failed to update bag" },
      { status: 500 }
    );
  }
}
