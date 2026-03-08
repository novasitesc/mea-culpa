import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const db = createServerClient();

  // Obtener perfil del jugador
  const { data: perfil } = await db
    .from("perfiles")
    .select("nombre, rol, nivel, hogar, oro")
    .eq("id", userId)
    .single();

  // Obtener personajes con sus clases, stats, equipamiento e inventario
  const { data: personajes } = await db
    .from("personajes")
    .select(
      `
      id,
      numero_slot,
      nombre,
      raza,
      alineamiento,
      retrato,
      capacidad_bolsa,
      clases_personaje ( nombre_clase, nivel, orden ),
      estadisticas_personaje ( fuerza, destreza, constitucion, inteligencia, sabiduria, carisma ),
      equipamiento_personaje (
        cabeza, pecho, guante, botas,
        collar, anillo1, anillo2, amuleto,
        mano_izquierda, mano_derecha
      ),
      bolsa_objetos ( id, objeto_id, cantidad, orden, objetos:objeto_id ( nombre, tipo_item ) )
    `,
    )
    .eq("usuario_id", userId)
    .order("numero_slot", { ascending: true });

  // Transformar a la forma que espera el frontend
  const characters = (personajes ?? []).map((p: any) => {
    const stats = p.estadisticas_personaje;
    const equip = p.equipamiento_personaje;
    const clases = (p.clases_personaje ?? []).sort(
      (a: any, b: any) => a.orden - b.orden,
    );

    return {
      id: p.id,
      name: p.nombre,
      multiclass: clases.map((c: any) => ({
        className: c.nombre_clase,
        level: c.nivel,
      })),
      race: p.raza,
      alignment: p.alineamiento,
      portrait: p.retrato,
      stats: stats
        ? {
            str: stats.fuerza,
            dex: stats.destreza,
            con: stats.constitucion,
            int: stats.inteligencia,
            wis: stats.sabiduria,
            chr: stats.carisma,
          }
        : { str: 10, dex: 10, con: 10, int: 10, wis: 10, chr: 10 },
      armor: {
        cabeza: equip?.cabeza ?? undefined,
        pecho: equip?.pecho ?? undefined,
        guante: equip?.guante ?? undefined,
        botas: equip?.botas ?? undefined,
      },
      accessories: {
        collar: equip?.collar ?? undefined,
        anillo1: equip?.anillo1 ?? undefined,
        anillo2: equip?.anillo2 ?? undefined,
        amuleto: equip?.amuleto ?? undefined,
      },
      weapons: {
        manoIzquierda: equip?.mano_izquierda ?? undefined,
        manoDerecha: equip?.mano_derecha ?? undefined,
      },
      bag: {
        items: (p.bolsa_objetos ?? [])
          .sort((a: any, b: any) => a.orden - b.orden)
          .map((bi: any) => ({
            name: bi.objetos?.nombre ?? "Objeto desconocido",
            type: bi.objetos?.tipo_item ?? "misc",
          })),
        maxSlots: p.capacidad_bolsa,
      },
    };
  });

  return NextResponse.json({
    player: {
      name: perfil?.nombre ?? "Aventurero",
      role: perfil?.rol ?? "Dungeon Explorer",
      level: perfil?.nivel ?? 1,
      home: perfil?.hogar ?? "Sin hogar",
      oro: perfil?.oro ?? 0,
    },
    characters,
    userId,
  });
}
