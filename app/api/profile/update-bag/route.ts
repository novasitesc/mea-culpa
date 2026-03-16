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
    // La DB almacena IDs (BIGINT); el frontend envía nombres de objetos.
    // Resolver nombres → IDs antes de escribir.
    if (armor || accessories || weapons) {
      const slotNames = [
        armor?.cabeza,
        armor?.pecho,
        armor?.guante,
        armor?.botas,
        accessories?.collar,
        accessories?.anillo1,
        accessories?.anillo2,
        accessories?.amuleto,
        accessories?.cinturon,
        weapons?.manoIzquierda,
        weapons?.manoDerecha,
      ].filter((v): v is string => typeof v === "string" && v.trim() !== "");

      const nameToId = new Map<string, number>();
      if (slotNames.length > 0) {
        const { data: objEquip } = await db
          .from("objetos")
          .select("id, nombre")
          .in("nombre", slotNames);
        for (const o of objEquip ?? []) nameToId.set(o.nombre, o.id);
      }

      const equipUpdate: Record<string, number | null> = {};
      if (armor) {
        equipUpdate.cabeza = armor.cabeza
          ? (nameToId.get(armor.cabeza) ?? null)
          : null;
        equipUpdate.pecho = armor.pecho
          ? (nameToId.get(armor.pecho) ?? null)
          : null;
        equipUpdate.guante = armor.guante
          ? (nameToId.get(armor.guante) ?? null)
          : null;
        equipUpdate.botas = armor.botas
          ? (nameToId.get(armor.botas) ?? null)
          : null;
      }
      if (accessories) {
        equipUpdate.collar = accessories.collar
          ? (nameToId.get(accessories.collar) ?? null)
          : null;
        equipUpdate.anillo1 = accessories.anillo1
          ? (nameToId.get(accessories.anillo1) ?? null)
          : null;
        equipUpdate.anillo2 = accessories.anillo2
          ? (nameToId.get(accessories.anillo2) ?? null)
          : null;
        equipUpdate.amuleto = accessories.amuleto
          ? (nameToId.get(accessories.amuleto) ?? null)
          : null;
        equipUpdate.cinturon = accessories.cinturon
          ? (nameToId.get(accessories.cinturon) ?? null)
          : null;
      }
      if (weapons) {
        equipUpdate.mano_izquierda = weapons.manoIzquierda
          ? (nameToId.get(weapons.manoIzquierda) ?? null)
          : null;
        equipUpdate.mano_derecha = weapons.manoDerecha
          ? (nameToId.get(weapons.manoDerecha) ?? null)
          : null;
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
