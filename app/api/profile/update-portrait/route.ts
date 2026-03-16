import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

const ALLOWED_PORTRAITS = new Set([
  "/characters/barbaro.webp",
  "/characters/bardo.webp",
  "/characters/brujo.webp",
  "/characters/clerigo.webp",
  "/characters/druida.webp",
  "/characters/explorador.webp",
  "/characters/guerrero.webp",
  "/characters/hechicero.webp",
  "/characters/mago.webp",
  "/characters/monje.webp",
  "/characters/paladin.webp",
  "/characters/picaro.webp",
  "/characters/profileplaceholder.webp",
]);

export async function POST(request: Request) {
  try {
    const { userId, characterId, portrait } = await request.json();

    if (!userId || !characterId || !portrait) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!ALLOWED_PORTRAITS.has(portrait)) {
      return NextResponse.json(
        { error: "Portrait not allowed" },
        { status: 400 },
      );
    }

    const db = createServerClient();

    const { data: personaje } = await db
      .from("personajes")
      .select("id")
      .eq("id", characterId)
      .eq("usuario_id", userId)
      .single();

    if (!personaje) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 },
      );
    }

    const { error: updateError } = await db
      .from("personajes")
      .update({ retrato: portrait })
      .eq("id", characterId)
      .eq("usuario_id", userId);

    if (updateError) {
      console.error("Error updating portrait:", updateError);
      return NextResponse.json(
        { error: "Failed to update portrait" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      characterId,
      portrait,
    });
  } catch (error) {
    console.error("Error updating portrait:", error);
    return NextResponse.json(
      { error: "Failed to update portrait" },
      { status: 500 },
    );
  }
}
