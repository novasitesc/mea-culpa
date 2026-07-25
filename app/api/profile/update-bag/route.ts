// POST — Equipar, desequipar y mover objetos entre bolsa y equipo.
// Aquí viven las reglas de equipamiento: qué tipo de objeto entra en qué ranura,
// las armas a dos manos que ocupan las dos, las gemas engarzadas y la capacidad
// máxima de la bolsa (derivada de la Fuerza).
// Es la ruta con más reglas de inventario del proyecto.
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { ensureOwnedAliveCharacter } from "@/lib/characterLife";
import { filasQueSeMueven, ordenAparcado } from "@/lib/bagOrder";

/**
 * 500 que no se traga el error de Postgres.
 *
 * Antes cada rama devolvía una cadena fija y descartaba el objeto de error, así
 * que un fallo aquí llegaba al navegador como "Failed to update bag" y al log
 * del servidor como nada. El código de Postgres (23505, 23502, …) es justo lo
 * que hace falta para saber qué se rompió.
 */
function dbFailure(context: string, error: unknown) {
  const err = error as { message?: string; code?: string; details?: string } | null;
  console.error(`[update-bag] ${context}:`, err);
  return NextResponse.json(
    {
      error: context,
      detail: err?.message ?? "Error desconocido",
      code: err?.code ?? null,
    },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const db = createServerClient();
    const { user, error: authError } = await getUserFromRequest(db, request);
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const {
      characterId,
      bagItems,
      armor,
      accessories,
      weapons,
      weaponSockets,
      capeSockets,
    } =
      await request.json();

    if (!characterId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const lifeCheck = await ensureOwnedAliveCharacter(db, String(user.id), Number(characterId));
    if (!lifeCheck.ok) {
      return NextResponse.json({ error: lifeCheck.error }, { status: lifeCheck.status });
    }

    // Actualizar equipamiento
    // La DB almacena IDs (BIGINT); el frontend envía nombres de objetos.
    // Resolver nombres → IDs antes de escribir.
    if (armor || accessories || weapons || weaponSockets || capeSockets) {
      const weaponSocketNames = [
        weaponSockets?.manoizq?.[0]?.name,
        weaponSockets?.manoizq?.[1]?.name,
        weaponSockets?.manoizq?.[2]?.name,
        weaponSockets?.manoderecha?.[0]?.name,
        weaponSockets?.manoderecha?.[1]?.name,
        weaponSockets?.manoderecha?.[2]?.name,
      ];
      const capeSocketNames = [
        capeSockets?.[0]?.name,
        capeSockets?.[1]?.name,
        capeSockets?.[2]?.name,
      ];

      const slotNames = [
        armor?.cabeza,
        armor?.armadura,
        armor?.pecho,
        armor?.guante,
        armor?.botas,
        accessories?.collar,
        accessories?.anillo1,
        accessories?.anillo2,
        accessories?.anillo3,
        accessories?.amuleto,
        accessories?.cinturon,
        weapons?.manoIzquierda,
        weapons?.manoDerecha,
        ...weaponSocketNames,
        ...capeSocketNames,
      ].filter((v): v is string => typeof v === "string" && v.trim() !== "");

      const nameToId = new Map<string, number>();
      if (slotNames.length > 0) {
        const { data: objEquip, error: equipLookupError } = await db
          .from("objetos")
          .select("id, nombre")
          .in("nombre", slotNames);

        if (equipLookupError) {
          return dbFailure("Failed to resolve equipment items", equipLookupError);
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
        equipUpdate.anillo3 = accessories.anillo3
          ? (nameToId.get(accessories.anillo3) ?? null)
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
      if (weaponSockets) {
        equipUpdate.mano_izquierda_socket_1 = weaponSockets.manoizq?.[0]?.name
          ? (nameToId.get(weaponSockets.manoizq[0].name) ?? null)
          : null;
        equipUpdate.mano_izquierda_socket_2 = weaponSockets.manoizq?.[1]?.name
          ? (nameToId.get(weaponSockets.manoizq[1].name) ?? null)
          : null;
        equipUpdate.mano_izquierda_socket_3 = weaponSockets.manoizq?.[2]?.name
          ? (nameToId.get(weaponSockets.manoizq[2].name) ?? null)
          : null;
        equipUpdate.mano_derecha_socket_1 = weaponSockets.manoderecha?.[0]?.name
          ? (nameToId.get(weaponSockets.manoderecha[0].name) ?? null)
          : null;
        equipUpdate.mano_derecha_socket_2 = weaponSockets.manoderecha?.[1]?.name
          ? (nameToId.get(weaponSockets.manoderecha[1].name) ?? null)
          : null;
        equipUpdate.mano_derecha_socket_3 = weaponSockets.manoderecha?.[2]?.name
          ? (nameToId.get(weaponSockets.manoderecha[2].name) ?? null)
          : null;
      }
      if (capeSockets) {
        equipUpdate.capa_socket_1 = capeSockets?.[0]?.name
          ? (nameToId.get(capeSockets[0].name) ?? null)
          : null;
        equipUpdate.capa_socket_2 = capeSockets?.[1]?.name
          ? (nameToId.get(capeSockets[1].name) ?? null)
          : null;
        equipUpdate.capa_socket_3 = capeSockets?.[2]?.name
          ? (nameToId.get(capeSockets[2].name) ?? null)
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
        return dbFailure("Failed to update character equipment", equipUpsertError);
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
        return dbFailure("Failed to load current bag state", existingBagError);
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
          return dbFailure("Failed to resolve bag item IDs", bagLookupError);
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
          return dbFailure("Failed to remove old bag items", deleteBagError);
        }
      }

      // Pasada 1: aparcar en negativo las filas que cambian de posición, para
      // que la pasada 2 escriba el orden definitivo sin chocar con el que otra
      // fila todavía ocupa. El porqué, en lib/bagOrder.ts.
      const ordenActual = new Map(
        (existingRows ?? []).map((row) => [Number(row.id), Number(row.orden)]),
      );

      for (const row of filasQueSeMueven(rowsToApply, ordenActual)) {
        const { error: parkError } = await db
          .from("bolsa_objetos")
          .update({ orden: ordenAparcado(Number(row.id)) })
          .eq("id", row.id)
          .eq("personaje_id", characterId);

        if (parkError) {
          return dbFailure("Failed to reorder bag items", parkError);
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
            return dbFailure("Failed to update bag items", updateBagError);
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
          return dbFailure("Failed to insert new bag items", insertBagError);
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
