// POST — Crea un personaje. La ruta más densa del proyecto, porque valida el
// personaje entero de una vez:
//   · que al usuario le queden huecos de personaje (compra de slots)
//   · las clases elegidas (hasta 3) y sus niveles
//   · las estadísticas, según el método usado (lib/statAllocation.ts) y, si se
//     tiraron dados, verificando el token HMAC (lib/statRollToken.ts)
//   · los conjuros iniciales que correspondan a la clase
// Luego inserta en varias tablas: personajes, clases_personaje,
// estadisticas_personaje y equipamiento_personaje.
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { calculateBagSlots } from "@/lib/types/character";
import {
  getCasterType,
  getMaxKnownSpells,
  normalizeSpells,
  type SpellEntry,
} from "@/lib/spells";
import {
  ABILITY_KEYS,
  recommendedStatsForClass,
  validatePointBuy,
  validateRolledStats,
  validateStandardArray,
  toDbStats,
  type StatMethod,
  type StatsBlock,
} from "@/lib/statAllocation";
import { verifyRollToken } from "@/lib/statRollToken";

// Resuelve las stats base según el método elegido (D&D 5e 2014).
// Devuelve las stats en formato de columnas de BD, o un error 400.
function resolveBaseStats(
  userId: string,
  primaryClass: string,
  characterData: {
    statMethod?: StatMethod;
    stats?: unknown;
    rollToken?: unknown;
  },
): { stats: ReturnType<typeof toDbStats> } | { error: string } {
  const method = characterData.statMethod ?? "recommended";

  switch (method) {
    case "recommended":
      return { stats: toDbStats(recommendedStatsForClass(primaryClass)) };

    case "pointbuy": {
      const result = validatePointBuy(characterData.stats);
      if (!result.ok) return { error: result.error };
      return { stats: toDbStats(result.stats) };
    }

    case "standard": {
      const result = validateStandardArray(characterData.stats);
      if (!result.ok) return { error: result.error };
      return { stats: toDbStats(result.stats) };
    }

    case "roll": {
      const result = validateRolledStats(characterData.stats);
      if (!result.ok) return { error: result.error };
      const totals = ABILITY_KEYS.map((key) => (result.stats as StatsBlock)[key]);
      const tokenCheck = verifyRollToken(userId, totals, characterData.rollToken);
      if (!tokenCheck.ok) return { error: tokenCheck.error };
      return { stats: toDbStats(result.stats) };
    }

    default:
      return { error: "Método de asignación de estadísticas inválido." };
  }
}

export async function POST(request: Request) {
  try {
    const db = createServerClient();
    const { user, error: authError } = await getUserFromRequest(db, request);
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const userId = user.id;

    const { characterData } = await request.json();

    if (!characterData) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const { name, race, multiclass, alignment } = characterData;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "El nombre del personaje es obligatorio" },
        { status: 400 },
      );
    }
    if (!race?.trim()) {
      return NextResponse.json(
        { error: "La raza es obligatoria" },
        { status: 400 },
      );
    }
    if (!alignment) {
      return NextResponse.json(
        { error: "El alineamiento es obligatorio" },
        { status: 400 },
      );
    }
    if (!multiclass || multiclass.length === 0) {
      return NextResponse.json(
        { error: "Debes seleccionar al menos una clase" },
        { status: 400 },
      );
    }
    if (multiclass.length > 3) {
      return NextResponse.json(
        { error: "Máximo 3 clases por personaje" },
        { status: 400 },
      );
    }
    if (multiclass.some((c: { className: string }) => !c.className)) {
      return NextResponse.json(
        { error: "Todas las clases deben estar seleccionadas" },
        { status: 400 },
      );
    }
    const classNames = multiclass.map(
      (c: { className: string }) => c.className,
    );
    if (classNames.length !== new Set(classNames).size) {
      return NextResponse.json(
        { error: "No puede haber clases duplicadas" },
        { status: 400 },
      );
    }

    const { data: perfil, error: perfilError } = await db
      .from("perfiles")
      .select("max_personajes")
      .eq("id", userId)
      .single();

    if (perfilError) {
      return NextResponse.json(
        { error: "No se pudo validar el perfil del usuario" },
        { status: 500 },
      );
    }

    const maxCharacterSlots = Math.max(2, Math.min(5, perfil?.max_personajes ?? 2));

    // Verificar limite de personajes configurado para la cuenta.
    const { count } = await db
      .from("personajes")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", userId)
      .not("estado_vida", "in", '("enterrado","eliminado")');

    if ((count ?? 0) >= maxCharacterSlots) {
      return NextResponse.json(
        {
          error: `Has alcanzado el limite de ${maxCharacterSlots} personajes para tu cuenta.`,
          code: "CHARACTER_LIMIT_REACHED",
        },
        { status: 403 },
      );
    }

    // Siguiente slot disponible
    const { data: existingSlots } = await db
      .from("personajes")
      .select("numero_slot")
      .eq("usuario_id", userId)
      .not("estado_vida", "in", '("enterrado","eliminado")');

    const usedSlots = new Set(
      (existingSlots ?? []).map((s: any) => s.numero_slot),
    );
    let nextSlot = 1;
    while (usedSlots.has(nextSlot) && nextSlot <= maxCharacterSlots) nextSlot++;

    // Resolver stats base según el método elegido (validación server-side)
    const primaryClass = multiclass[0].className;
    const statsResult = resolveBaseStats(userId, primaryClass, characterData);
    if ("error" in statsResult) {
      return NextResponse.json({ error: statsResult.error }, { status: 400 });
    }
    const stats = statsResult.stats;

    // Calcular capacidad de bolsa en base a fuerza
    const capacidadBolsa = calculateBagSlots(stats.fuerza);

    // Validar y normalizar conjuros conocidos
    const rawSpells: SpellEntry[] = normalizeSpells(characterData.knownSpells || []);

    // Deduplicar
    const seenKeys = new Set<string>();
    const validatedSpells: SpellEntry[] = [];
    for (const s of rawSpells) {
      const key = s.name.toLowerCase().trim();
      if (key.length === 0 || seenKeys.has(key)) continue;
      seenKeys.add(key);
      validatedSpells.push({ name: s.name.trim(), spellLevel: s.spellLevel });
    }

    // --- VALIDACIÓN CONTRA EL CATÁLOGO DE SUPABASE ---
    if (validatedSpells.length > 0) {
      const spellNames = validatedSpells.map(s => s.name);
      const classNames = multiclass.map((c: { className: string }) => c.className);

      // 1. Verificar que TODOS los conjuros existen en el catálogo
      const { data: catalogSpells, error: catalogError } = await db
        .from("conjuros")
        .select("nombre, nivel")
        .in("nombre", spellNames);

      if (catalogError) {
        return NextResponse.json(
          { error: "Error verificando el catálogo de conjuros" },
          { status: 500 },
        );
      }

      const catalogMap = new Map<string, number>();
      for (const cs of catalogSpells ?? []) {
        catalogMap.set(cs.nombre.toLowerCase().trim(), cs.nivel);
      }

      for (const s of validatedSpells) {
        const key = s.name.toLowerCase().trim();
        const realLevel = catalogMap.get(key);
        if (realLevel === undefined) {
          return NextResponse.json(
            { error: `El conjuro "${s.name}" no existe en el catálogo oficial.` },
            { status: 400 },
          );
        }
        s.spellLevel = realLevel;
      }

      // 2. Verificar que las clases del personaje tienen acceso a esos conjuros
      const { data: allowedMappings, error: mappingError } = await db
        .from("conjuro_clases")
        .select("conjuro_nombre, nombre_clase")
        .in("conjuro_nombre", spellNames)
        .in("nombre_clase", classNames);

      if (mappingError) {
        return NextResponse.json(
          { error: "Error verificando acceso a conjuros por clase" },
          { status: 500 },
        );
      }

      const allowedSet = new Set<string>();
      for (const m of allowedMappings ?? []) {
        allowedSet.add(m.conjuro_nombre.toLowerCase().trim());
      }

      for (const s of validatedSpells) {
        const key = s.name.toLowerCase().trim();
        if (!allowedSet.has(key)) {
          return NextResponse.json(
            { error: `"${s.name}" no está disponible para las clases seleccionadas (${classNames.join(", ")}).` },
            { status: 400 },
          );
        }
      }
    }

    // Validar suma global de topes (para evitar error en multiclase)
    let totalMaxKnown = 0;
    for (const c of multiclass as { className: string; level: number }[]) {
      const type = getCasterType(c.className);
      if (type === "known") {
        totalMaxKnown += getMaxKnownSpells(c.className, c.level);
      }
    }

    if (totalMaxKnown > 0 && validatedSpells.length > totalMaxKnown) {
       return NextResponse.json(
         { error: `Excede el máximo de conjuros conocidos: ${validatedSpells.length}/${totalMaxKnown}.` },
         { status: 400 },
       );
    }

    // 1. Insertar personaje
    const { data: personaje, error: charErr } = await db
      .from("personajes")
      .insert({
        usuario_id: userId,
        numero_slot: nextSlot,
        nombre: name.trim(),
        raza: race.trim(),
        alineamiento: alignment,
        retrato: "/characters/profileplaceholder.webp",
        capacidad_bolsa: capacidadBolsa,
        conjuros_conocidos: validatedSpells,
      })
      .select("id")
      .single();

    if (charErr || !personaje) {
      console.error("Error inserting character:", charErr);
      return NextResponse.json(
        { error: "Error al crear el personaje" },
        { status: 500 },
      );
    }

    const charId = personaje.id;

    // 2. Insertar clases
    // Todo personaje nace a nivel 1: subir de nivel es cosa del DM al cerrar la
    // partida o del panel de personajes. Antes se aceptaba el `level` del cuerpo,
    // así que se podía nacer a nivel 20 (y con ello colar tier 2 y las tiendas
    // altas) con una sola petición.
    const clasesInsert = multiclass.map(
      (c: { className: string }, i: number) => ({
        personaje_id: charId,
        nombre_clase: c.className,
        nivel: 1,
        orden: i + 1,
      }),
    );

    // 3. Insertar stats
    const statsInsert = { personaje_id: charId, ...stats };

    // 4. Insertar equipamiento vacío
    const equipInsert = { personaje_id: charId };

    // Ejecutar en paralelo
    const [clasesRes, statsRes, equipRes] = await Promise.all([
      db.from("clases_personaje").insert(clasesInsert),
      db.from("estadisticas_personaje").insert(statsInsert),
      db.from("equipamiento_personaje").insert(equipInsert),
    ]);

    if (clasesRes.error)
      console.error("Error inserting classes:", clasesRes.error);
    if (statsRes.error) console.error("Error inserting stats:", statsRes.error);
    if (equipRes.error)
      console.error("Error inserting equipment:", equipRes.error);

    // Devolver el personaje en el formato que espera el frontend
    return NextResponse.json({
      success: true,
      message: "Character created successfully",
      character: {
        id: charId,
        name: name.trim(),
        nivel20Url: null,
        multiclass,
        race: race.trim(),
        alignment,
        portrait: "/characters/profileplaceholder.webp",
        lifeStatus: "vivo",
        deadAt: null,
        revivedAt: null,
        puntoCansancio: 0,
        caidas: 0,
        knownSpells: validatedSpells,
        stats: {
          str: stats.fuerza,
          dex: stats.destreza,
          con: stats.constitucion,
          int: stats.inteligencia,
          wis: stats.sabiduria,
          chr: stats.carisma,
        },
        armor: {},
        accessories: {},
        weapons: {},
        bag: { items: [], maxSlots: capacidadBolsa },
        hasDismemberedLimb: false,
        dismemberedLimbs: [],
      },
    });
  } catch (error) {
    console.error("Error creating character:", error);
    return NextResponse.json(
      { error: "Failed to create character" },
      { status: 500 },
    );
  }
}
