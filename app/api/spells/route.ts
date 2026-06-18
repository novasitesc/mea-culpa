import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

/**
 * GET /api/spells?clases=Mago,Bardo&maxLevel=5
 *
 * Devuelve conjuros del catálogo filtrados por clase(s) y nivel máximo.
 * Si no se pasa `clases`, devuelve TODOS los conjuros (para preparadores
 * que conocen su lista completa: Clérigo, Druida, Paladín, Mago).
 * Si no se pasa `maxLevel`, no se filtra por nivel.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clasesParam = searchParams.get("clases"); // "Mago,Bardo"
  const maxLevelParam = searchParams.get("maxLevel"); // "5"

  const db = createServerClient();

  try {
    // Si se especifican clases, buscar conjuros que pertenezcan a esas clases
    if (clasesParam) {
      const clasesList = clasesParam
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      if (clasesList.length === 0) {
        return NextResponse.json({ error: "Clases vacías" }, { status: 400 });
      }

      // Obtener nombres de conjuros que pertenecen a las clases indicadas
      const { data: conjuroClases, error: ccError } = await db
        .from("conjuro_clases")
        .select("conjuro_nombre")
        .in("nombre_clase", clasesList);

      if (ccError) {
        return NextResponse.json(
          { error: "Error consultando clases de conjuros" },
          { status: 500 },
        );
      }

      // Nombres únicos de conjuros accesibles
      const nombresUnicos = [
        ...new Set((conjuroClases ?? []).map((r) => r.conjuro_nombre)),
      ];

      if (nombresUnicos.length === 0) {
        return NextResponse.json({ spells: [] });
      }

      // Consultar datos completos de esos conjuros
      let query = db
        .from("conjuros")
        .select("nombre, nivel, escuela, categoria, alcance, duracion")
        .in("nombre", nombresUnicos)
        .order("nivel", { ascending: true })
        .order("nombre", { ascending: true });

      if (maxLevelParam) {
        const maxLevel = parseInt(maxLevelParam, 10);
        if (!isNaN(maxLevel) && maxLevel >= 0 && maxLevel <= 9) {
          query = query.lte("nivel", maxLevel);
        }
      }

      const { data: conjuros, error: conjError } = await query;

      if (conjError) {
        return NextResponse.json(
          { error: "Error consultando conjuros" },
          { status: 500 },
        );
      }

      return NextResponse.json({ spells: conjuros ?? [] });
    }

    // Sin filtro de clases: devolver todos los conjuros (con filtro de nivel opcional)
    let query = db
      .from("conjuros")
      .select("nombre, nivel, escuela, categoria, alcance, duracion")
      .order("nivel", { ascending: true })
      .order("nombre", { ascending: true });

    if (maxLevelParam) {
      const maxLevel = parseInt(maxLevelParam, 10);
      if (!isNaN(maxLevel) && maxLevel >= 0 && maxLevel <= 9) {
        query = query.lte("nivel", maxLevel);
      }
    }

    const { data: conjuros, error: conjError } = await query;

    if (conjError) {
      return NextResponse.json(
        { error: "Error consultando conjuros" },
        { status: 500 },
      );
    }

    return NextResponse.json({ spells: conjuros ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Error procesando la solicitud" },
      { status: 500 },
    );
  }
}
