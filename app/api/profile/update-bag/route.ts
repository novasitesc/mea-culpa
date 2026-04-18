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
        armor?.armadura,
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
        const { data: objEquip, error: equipLookupError } = await db
          .from("objetos")
          .select("id, nombre")
          .in("nombre", slotNames);

        if (equipLookupError) {
          return NextResponse.json(
            { error: "Failed to resolve equipment items" },
            { status: 500 },
          );
        }

        for (const o of objEquip ?? []) nameToId.set(o.nombre, o.id);
      }

      const equipUpdate: Record<string, number | null> = {};
      if (armor) {
        equipUpdate.cabeza = armor.cabeza
          ? (nameToId.get(armor.cabeza) ?? null)
          : null;
        const chestName = armor.armadura ?? armor.pecho;
        equipUpdate.pecho = chestName
          ? (nameToId.get(chestName) ?? null)
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

      const { error: equipUpsertError } = await db
        .from("equipamiento_personaje")
        .upsert(
          {
            personaje_id: characterId,
            ...equipUpdate,
          },
          { onConflict: "personaje_id" },
        );

      if (equipUpsertError) {
        return NextResponse.json(
          { error: "Failed to update character equipment" },
          { status: 500 },
        );
      }
    }

    // Actualizar bolsa preservando identidad de filas y flags de comercio
    if (bagItems) {
      const normalizedBagItems = Array.isArray(bagItems) ? bagItems : [];

      const { data: existingRows, error: existingBagError } = await db
        .from("bolsa_objetos")
        .select("id, objeto_id, cantidad, orden, fue_comerciado, publicado_en_trade, objetos:objeto_id(nombre)")
        .eq("personaje_id", characterId)
        .order("orden", { ascending: true });

      if (existingBagError) {
        return NextResponse.json(
          { error: "Failed to load current bag state" },
          { status: 500 },
        );
      }

      const existingById = new Map<number, any>();
      const existingByName = new Map<string, any[]>();

      for (const row of existingRows ?? []) {
        existingById.set(row.id, row);
        const name = (row as any).objetos?.nombre;
        if (!name) continue;
        const queue = existingByName.get(name) ?? [];
        queue.push(row);
        existingByName.set(name, queue);
      }

      const namesToResolve = Array.from(
        new Set(
          normalizedBagItems
            .map((item: any) => String(item?.name ?? "").trim())
            .filter(Boolean),
        ),
      );

      let nameToId = new Map<string, number>();
      if (namesToResolve.length > 0) {
        const { data: objetos, error: bagLookupError } = await db
          .from("objetos")
          .select("id, nombre")
          .in("nombre", namesToResolve);

        if (bagLookupError) {
          return NextResponse.json(
            { error: "Failed to resolve bag item IDs" },
            { status: 500 },
          );
        }

        nameToId = new Map((objetos ?? []).map((o: any) => [o.nombre, o.id]));
      }

      const matchedExistingIds = new Set<number>();

      const rowsToApply = normalizedBagItems.map((item: any, i: number) => {
        const explicitId = Number(item?.bagRowId);
        let existing = Number.isFinite(explicitId)
          ? existingById.get(explicitId)
          : undefined;

        const itemName = String(item?.name ?? "").trim();
        if (!existing && itemName) {
          const queue = existingByName.get(itemName) ?? [];
          while (queue.length > 0) {
            const candidate = queue.shift();
            if (candidate && !matchedExistingIds.has(candidate.id)) {
              existing = candidate;
              break;
            }
          }
          existingByName.set(itemName, queue);
        }

        if (existing) {
          matchedExistingIds.add(existing.id);
        }

        const resolvedObjectId =
          Number(item?.objectId) || existing?.objeto_id || nameToId.get(itemName) || null;

        const resolvedCantidad = Number(item?.cantidad);
        const cantidad = Number.isFinite(resolvedCantidad) && resolvedCantidad > 0
          ? Math.floor(resolvedCantidad)
          : Number(existing?.cantidad ?? 1);

        return {
          id: existing?.id ?? null,
          personaje_id: characterId,
          objeto_id: resolvedObjectId,
          cantidad: cantidad > 0 ? cantidad : 1,
          orden: i + 1,
          fue_comerciado: Boolean(existing?.fue_comerciado ?? false),
          publicado_en_trade: Boolean(existing?.publicado_en_trade ?? false),
        };
      });

      const idsToKeep = new Set(
        rowsToApply
          .map((row) => row.id)
          .filter((id): id is number => Number.isFinite(Number(id))),
      );

      const idsToDelete = (existingRows ?? [])
        .map((row) => row.id)
        .filter((id) => !idsToKeep.has(id));

      if (idsToDelete.length > 0) {
        const { error: deleteBagError } = await db
          .from("bolsa_objetos")
          .delete()
          .eq("personaje_id", characterId)
          .in("id", idsToDelete);

        if (deleteBagError) {
          return NextResponse.json(
            { error: "Failed to remove old bag items" },
            { status: 500 },
          );
        }
      }

      for (const row of rowsToApply) {
        if (row.id) {
          const { error: updateBagError } = await db
            .from("bolsa_objetos")
            .update({
              objeto_id: row.objeto_id,
              cantidad: row.cantidad,
              orden: row.orden,
              fue_comerciado: row.fue_comerciado,
              publicado_en_trade: row.publicado_en_trade,
            })
            .eq("id", row.id)
            .eq("personaje_id", characterId);

          if (updateBagError) {
            return NextResponse.json(
              { error: "Failed to update bag items" },
              { status: 500 },
            );
          }
          continue;
        }

        const { error: insertBagError } = await db
          .from("bolsa_objetos")
          .insert({
            personaje_id: characterId,
            objeto_id: row.objeto_id,
            cantidad: row.cantidad,
            orden: row.orden,
            fue_comerciado: false,
            publicado_en_trade: false,
          });

        if (insertBagError) {
          return NextResponse.json(
            { error: "Failed to insert new bag items" },
            { status: 500 },
          );
        }
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
