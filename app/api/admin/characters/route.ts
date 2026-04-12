import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { calculateBagSlots } from "@/lib/types/character";

type Character = {
  id: number;
  nombre: string;
  raza: string;
  clases: Array<{
    nombre_clase: string;
    nivel: number;
  }>;
  estadisticas: {
    fuerza: number;
    destreza: number;
    constitucion: number;
    inteligencia: number;
    sabiduria: number;
    carisma: number;
  };
};

// GET /api/admin/characters?userId={id}
// Obtiene todos los personajes de un usuario
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
  }

  const { data: personajes, error: personajesError } = await session.db
    .from("personajes")
    .select(
      `
      id,
      nombre,
      raza,
      clases_personaje (
        nombre_clase,
        nivel
      ),
      estadisticas_personaje (
        fuerza,
        destreza,
        constitucion,
        inteligencia,
        sabiduria,
        carisma
      )
    `
    )
    .eq("usuario_id", userId);

  if (personajesError) {
    return NextResponse.json({ error: personajesError.message }, { status: 500 });
  }

  const characters = (personajes ?? []).map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    raza: p.raza,
    clases: p.clases_personaje ?? [],
    estadisticas: p.estadisticas_personaje ? p.estadisticas_personaje[0] : null,
  }));

  return NextResponse.json(characters);
}

// PATCH /api/admin/characters
// Actualiza los datos de un personaje (nombre, raza, nivel de clase, estadísticas)
export async function PATCH(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const body = await request.json();
  const { characterId, raza, clases, estadisticas } = body;

  if (!characterId) {
    return NextResponse.json({ error: "characterId es requerido" }, { status: 400 });
  }

  try {
    // Actualizar raza
    if (raza !== undefined) {
      const { error: raceError } = await session.db
        .from("personajes")
        .update({ raza })
        .eq("id", characterId);

      if (raceError) {
        return NextResponse.json({ error: raceError.message }, { status: 500 });
      }
    }

    // Actualizar nivel de clases
    if (clases && Array.isArray(clases)) {
      for (const clase of clases) {
        const boundedLevel = Math.min(
          20,
          Math.max(1, Math.floor(Number(clase.nivel) || 1)),
        );
        const { error: clasError } = await session.db
          .from("clases_personaje")
          .update({ nivel: boundedLevel })
          .eq("personaje_id", characterId)
          .eq("nombre_clase", clase.nombre_clase);

        if (clasError) {
          return NextResponse.json({ error: clasError.message }, { status: 500 });
        }
      }
    }

    // Actualizar estadísticas
    if (estadisticas !== undefined) {
      const { error: statsError } = await session.db
        .from("estadisticas_personaje")
        .update(estadisticas)
        .eq("personaje_id", characterId);

      if (statsError) {
        return NextResponse.json({ error: statsError.message }, { status: 500 });
      }

      // Recalcular capacidad de bolsa según la fuerza efectiva.
      // Si no viene fuerza en el payload, leer el valor actual desde DB.
      let effectiveStrength: number | null =
        typeof estadisticas?.fuerza === "number" ? estadisticas.fuerza : null;

      if (effectiveStrength === null) {
        const { data: currentStats, error: currentStatsError } = await session.db
          .from("estadisticas_personaje")
          .select("fuerza")
          .eq("personaje_id", characterId)
          .single();

        if (currentStatsError) {
          return NextResponse.json({ error: currentStatsError.message }, { status: 500 });
        }

        effectiveStrength = currentStats?.fuerza ?? 10;
      }

      const strengthForBag = effectiveStrength ?? 10;

      const { error: bagError } = await session.db
        .from("personajes")
        .update({ capacidad_bolsa: calculateBagSlots(strengthForBag) })
        .eq("id", characterId);

      if (bagError) {
        return NextResponse.json({ error: bagError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
