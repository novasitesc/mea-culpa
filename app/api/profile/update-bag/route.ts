import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  try {
    const { userId, characterId, bagItems, armor, accessories, weapons } =
      await request.json();

    if (!userId || !characterId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const db = createServerClient();

    // Verificar que el personaje pertenece al usuario
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

    // Actualizar equipamiento
    if (armor || accessories || weapons) {
      const equipUpdate: Record<string, any> = {};
      if (armor) {
        equipUpdate.cabeza = armor.cabeza ?? null;
        equipUpdate.pecho = armor.pecho ?? null;
        equipUpdate.guante = armor.guante ?? null;
        equipUpdate.botas = armor.botas ?? null;
      }
      if (accessories) {
        equipUpdate.collar = accessories.collar ?? null;
        equipUpdate.anillo1 = accessories.anillo1 ?? null;
        equipUpdate.anillo2 = accessories.anillo2 ?? null;
        equipUpdate.amuleto = accessories.amuleto ?? null;
      }
      if (weapons) {
        equipUpdate.mano_izquierda = weapons.manoIzquierda ?? null;
        equipUpdate.mano_derecha = weapons.manoDerecha ?? null;
      }

      await db
        .from("equipamiento_personaje")
        .update(equipUpdate)
        .eq("personaje_id", characterId);
    }

    // Actualizar bolsa: borrar todo y re-insertar
    if (bagItems) {
      await db.from("bolsa_objetos").delete().eq("personaje_id", characterId);

      if (Array.isArray(bagItems) && bagItems.length > 0) {
        // Buscar IDs de objetos por nombre
        const nombres = bagItems.map((item: any) => item.name);
        const { data: objetos } = await db
          .from("objetos")
          .select("id, nombre")
          .in("nombre", nombres);

        const nombreToId = new Map(
          (objetos ?? []).map((o: any) => [o.nombre, o.id]),
        );

        const rows = bagItems.map((item: any, i: number) => ({
          personaje_id: characterId,
          objeto_id: nombreToId.get(item.name) ?? null,
          cantidad: 1,
          orden: i + 1,
        }));

        await db.from("bolsa_objetos").insert(rows);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Character updated successfully",
      characterId,
    });
  } catch (error) {
    console.error("Error updating character:", error);
    return NextResponse.json(
      { error: "Failed to update character" },
      { status: 500 },
    );
  }
}
