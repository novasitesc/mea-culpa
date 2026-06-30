import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { normalizeAccountLevel } from "@/lib/accountLevel";
import { getUserFromRequest } from "@/lib/apiAuth";
import { normalizeSpells, type SpellEntry } from "@/lib/spells";

function hasDismemberedLimb(extremities: unknown): boolean {
  if (!extremities || typeof extremities !== "object") {
    return false;
  }

  return Object.values(extremities as Record<string, unknown>).some(
    (value) => value === false,
  );
}

function humanizeLimbKey(key: string): string {
  const normalized = key
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .trim();

  if (!normalized) {
    return key;
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getDismemberedLimbs(extremities: unknown): string[] {
  if (!extremities || typeof extremities !== "object") {
    return [];
  }

  const limbLabels: Record<string, string> = {
    cabeza: "Cabeza",
    head: "Cabeza",
    brazo_izquierdo: "Brazo izquierdo",
    brazo_derecho: "Brazo derecho",
    brazoizquierdo: "Brazo izquierdo",
    brazoderecho: "Brazo derecho",
    left_arm: "Brazo izquierdo",
    right_arm: "Brazo derecho",
    mano_izquierda: "Mano izquierda",
    mano_derecha: "Mano derecha",
    manoizquierda: "Mano izquierda",
    manoderecha: "Mano derecha",
    left_hand: "Mano izquierda",
    right_hand: "Mano derecha",
    pierna_izquierda: "Pierna izquierda",
    pierna_derecha: "Pierna derecha",
    piernaizquierda: "Pierna izquierda",
    piernaderecha: "Pierna derecha",
    left_leg: "Pierna izquierda",
    right_leg: "Pierna derecha",
    pie_izquierdo: "Pie izquierdo",
    pie_derecho: "Pie derecho",
    pieizquierdo: "Pie izquierdo",
    piederecho: "Pie derecho",
    left_foot: "Pie izquierdo",
    right_foot: "Pie derecho",
    torso: "Torso",
    tronco: "Torso",
  };

  return Object.entries(extremities as Record<string, unknown>)
    .filter(([, value]) => value === false)
    .map(([key]) => limbLabels[key.toLowerCase()] ?? humanizeLimbKey(key))
    .filter((label, index, labels) => labels.indexOf(label) === index);
}

function normalizeNivel20Url(rawValue: unknown): {
  value: string | null;
  error: string | null;
} {
  if (rawValue == null) {
    return { value: null, error: null };
  }

  if (typeof rawValue !== "string") {
    return { value: null, error: "nivel20Url debe ser texto o null" };
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { value: null, error: null };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { value: null, error: "Ingresa una URL valida" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      value: null,
      error: "La URL debe iniciar con http:// o https://",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isNivel20Domain =
    hostname === "nivel20.com" || hostname.endsWith(".nivel20.com");

  if (!isNivel20Domain) {
    return {
      value: null,
      error: "Solo se permiten enlaces de nivel20.com",
    };
  }

  return { value: parsed.toString(), error: null };
}

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
    .select("nombre, rol, nivel, hogar, oro, max_personajes")
    .eq("id", userId)
    .single();

  // Obtener personajes con sus clases, stats, equipamiento e inventario
  const { data: personajes } = await db
    .from("personajes")
    .select(
      `
      *,
      clases_personaje ( nombre_clase, nivel, orden ),
      estadisticas_personaje ( fuerza, destreza, constitucion, inteligencia, sabiduria, carisma ),
      equipamiento_personaje (
        cabeza, pecho, guante, botas,
        collar, anillo1, anillo2, anillo3, amuleto, cinturon,
        mano_izquierda, mano_derecha,
        mano_izquierda_socket_1, mano_izquierda_socket_2, mano_izquierda_socket_3,
        mano_derecha_socket_1, mano_derecha_socket_2, mano_derecha_socket_3,
        capa_socket_1, capa_socket_2, capa_socket_3
      ),
      bolsa_objetos (
        id,
        objeto_id,
        cantidad,
        orden,
        fue_comerciado,
        publicado_en_trade,
        objetos:objeto_id ( nombre, tipo_item, precio, icono, descripcion, requiere_dos_manos )
      )
    `,
    )
    .eq("usuario_id", userId)
    .not("estado_vida", "in", '("enterrado","eliminado")')
    .order("numero_slot", { ascending: true });

  // Intentar cargar conjuros conocidos por separado (la columna puede no existir aún)
  let spellsByCharId: Record<string, SpellEntry[]> = {};
  try {
    const { data: spellRows } = await db
      .from("personajes")
      .select("id, conjuros_conocidos")
      .eq("usuario_id", userId);
    if (spellRows) {
      for (const row of spellRows as any[]) {
        spellsByCharId[row.id] = normalizeSpells(row.conjuros_conocidos);
      }
    }
  } catch {
    // Column doesn't exist yet — safe to ignore
  }

  // Resolver IDs de equipamiento a nombres de objetos (la DB guarda BIGINTs)
  const allEquipIds = new Set<number>();
  for (const p of (personajes ?? []) as any[]) {
    const equip = Array.isArray(p.equipamiento_personaje)
      ? p.equipamiento_personaje[0]
      : p.equipamiento_personaje;
    if (!equip) continue;
    for (const val of [
      equip.cabeza,
      equip.pecho,
      equip.guante,
      equip.botas,
      equip.collar,
      equip.anillo1,
      equip.anillo2,
      equip.anillo3,
      equip.amuleto,
      equip.cinturon,
      equip.mano_izquierda,
      equip.mano_derecha,
      equip.mano_izquierda_socket_1,
      equip.mano_izquierda_socket_2,
      equip.mano_izquierda_socket_3,
      equip.mano_derecha_socket_1,
      equip.mano_derecha_socket_2,
      equip.mano_derecha_socket_3,
      equip.capa_socket_1,
      equip.capa_socket_2,
      equip.capa_socket_3,
    ]) {
      if (val != null) allEquipIds.add(val);
    }
  }

  const equipIdToName = new Map<number, string>();
  const equipIdToPrice = new Map<number, number>();
  const equipIdToType = new Map<number, string>();
  const equipIdToTwoHands = new Map<number, boolean>();
  if (allEquipIds.size > 0) {
    const { data: objEquip } = await db
      .from("objetos")
      .select("id, nombre, precio, tipo_item, requiere_dos_manos")
      .in("id", Array.from(allEquipIds));
    for (const o of objEquip ?? []) {
      equipIdToName.set(o.id, o.nombre);
      equipIdToPrice.set(o.id, o.precio ?? 0);
      equipIdToType.set(o.id, o.tipo_item);
      equipIdToTwoHands.set(o.id, Boolean(o.requiere_dos_manos));
    }
  }

  // Transformar a la forma que espera el frontend
  const characters = (personajes ?? []).map((p: any) => {
    const stats = Array.isArray(p.estadisticas_personaje)
      ? p.estadisticas_personaje[0]
      : p.estadisticas_personaje;
    const equip = Array.isArray(p.equipamiento_personaje)
      ? p.equipamiento_personaje[0]
      : p.equipamiento_personaje;
    const clases = (p.clases_personaje ?? []).sort(
      (a: any, b: any) => a.orden - b.orden,
    );
    const extremities = p.Extremidades ?? p.extremidades ?? null;

    const equipmentPriceByName: Record<string, number> = {};
    const equipmentRequiresTwoHandsByName: Record<string, boolean> = {};
    for (const id of [
      equip?.cabeza,
      equip?.pecho,
      equip?.guante,
      equip?.botas,
      equip?.collar,
      equip?.anillo1,
      equip?.anillo2,
      equip?.anillo3,
      equip?.amuleto,
      equip?.cinturon,
      equip?.mano_izquierda,
      equip?.mano_derecha,
      equip?.mano_izquierda_socket_1,
      equip?.mano_izquierda_socket_2,
      equip?.mano_izquierda_socket_3,
      equip?.mano_derecha_socket_1,
      equip?.mano_derecha_socket_2,
      equip?.mano_derecha_socket_3,
      equip?.capa_socket_1,
      equip?.capa_socket_2,
      equip?.capa_socket_3,
    ]) {
      if (id == null) continue;
      const name = equipIdToName.get(id);
      if (!name) continue;
      equipmentPriceByName[name] = equipIdToPrice.get(id) ?? 0;
      equipmentRequiresTwoHandsByName[name] = equipIdToTwoHands.get(id) ?? false;
    }

    const mapEquipItem = (id: number | null | undefined) => {
      if (id == null) return null;
      const name = equipIdToName.get(id);
      if (!name) return null;
      const rawType = equipIdToType.get(id);
      const type = rawType === "pecho" ? "armadura" : rawType;
      return {
        name,
        type: type ?? "misc",
        price: equipIdToPrice.get(id) ?? 0,
        requiresTwoHands: equipIdToTwoHands.get(id) ?? false,
      };
    };

    return {
      id: p.id,
      name: p.nombre,
      nivel20Url: p.nivel20_url ?? null,
      multiclass: clases.map((c: any) => ({
        className: c.nombre_clase,
        level: c.nivel,
      })),
      race: p.raza,
      alignment: p.alineamiento,
      portrait: p.retrato,
      lifeStatus: p.estado_vida ?? "vivo",
      deadAt: p.muerto_en ?? null,
      revivedAt: p.revivido_en ?? null,
      puntoCansancio: Number(p.puntos_cansancio ?? 0),
      knownSpells: spellsByCharId[p.id] ?? [],
      hasDismemberedLimb: hasDismemberedLimb(extremities),
      dismemberedLimbs: getDismemberedLimbs(extremities),
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
        cabeza:
          equip?.cabeza != null ? equipIdToName.get(equip.cabeza) : undefined,
        armadura:
          equip?.pecho != null ? equipIdToName.get(equip.pecho) : undefined,
        pecho:
          equip?.pecho != null ? equipIdToName.get(equip.pecho) : undefined,
        guante:
          equip?.guante != null ? equipIdToName.get(equip.guante) : undefined,
        botas:
          equip?.botas != null ? equipIdToName.get(equip.botas) : undefined,
      },
      accessories: {
        collar:
          equip?.collar != null ? equipIdToName.get(equip.collar) : undefined,
        anillo1:
          equip?.anillo1 != null ? equipIdToName.get(equip.anillo1) : undefined,
        anillo2:
          equip?.anillo2 != null ? equipIdToName.get(equip.anillo2) : undefined,
        anillo3:
          equip?.anillo3 != null ? equipIdToName.get(equip.anillo3) : undefined,
        amuleto:
          equip?.amuleto != null ? equipIdToName.get(equip.amuleto) : undefined,
        cinturon:
          equip?.cinturon != null ? equipIdToName.get(equip.cinturon) : undefined,
      },
      weapons: {
        manoIzquierda:
          equip?.mano_izquierda != null
            ? equipIdToName.get(equip.mano_izquierda)
            : undefined,
        manoDerecha:
          equip?.mano_derecha != null
            ? equipIdToName.get(equip.mano_derecha)
            : undefined,
      },
      weaponSockets: {
        manoizq: [
          mapEquipItem(equip?.mano_izquierda_socket_1),
          mapEquipItem(equip?.mano_izquierda_socket_2),
          mapEquipItem(equip?.mano_izquierda_socket_3),
        ],
        manoderecha: [
          mapEquipItem(equip?.mano_derecha_socket_1),
          mapEquipItem(equip?.mano_derecha_socket_2),
          mapEquipItem(equip?.mano_derecha_socket_3),
        ],
      },
      capeSockets: [
        mapEquipItem(equip?.capa_socket_1),
        mapEquipItem(equip?.capa_socket_2),
        mapEquipItem(equip?.capa_socket_3),
      ],
      equipmentPriceByName,
      equipmentRequiresTwoHandsByName,
      bag: {
        items: (p.bolsa_objetos ?? [])
          .filter((bi: any) => !bi.publicado_en_trade)
          .sort((a: any, b: any) => a.orden - b.orden)
          .map((bi: any) => ({
            bagRowId: bi.id,
            objectId: bi.objeto_id,
            name: bi.objetos?.nombre ?? "Objeto desconocido",
            icono: bi.objetos?.icono ?? "📦",
            description: bi.objetos?.descripcion ?? null,
            type:
              bi.objetos?.tipo_item === "pecho"
                ? "armadura"
                : (bi.objetos?.tipo_item ?? "misc"),
            price: bi.objetos?.precio ?? 0,
            requiresTwoHands: Boolean(bi.objetos?.requiere_dos_manos),
            cantidad: bi.cantidad ?? 1,
            fueComerciado: Boolean(bi.fue_comerciado),
            publicadoEnTrade: Boolean(bi.publicado_en_trade),
          })),
        maxSlots: p.capacidad_bolsa,
      },
    };
  });

  return NextResponse.json({
    player: {
      name: perfil?.nombre ?? "Aventurero",
      role: perfil?.rol ?? "Dungeon Explorer",
      level: normalizeAccountLevel(perfil?.nivel ?? 1),
      home: perfil?.hogar ?? "Sin hogar",
      oro: perfil?.oro ?? 0,
      maxCharacterSlots: perfil?.max_personajes ?? 2,
    },
    characters,
    userId,
  });
}

export async function PATCH(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { nivel20Url?: unknown; characterId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON invalido" }, { status: 400 });
  }

  if (!Object.prototype.hasOwnProperty.call(body, "nivel20Url")) {
    return NextResponse.json(
      { error: "nivel20Url es requerido" },
      { status: 400 },
    );
  }

  const characterId = Number(body.characterId);
  if (!Number.isFinite(characterId) || characterId <= 0) {
    return NextResponse.json(
      { error: "characterId es requerido" },
      { status: 400 },
    );
  }

  const normalized = normalizeNivel20Url(body.nivel20Url);
  if (normalized.error) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  // Verify the character belongs to this user
  const { data: charCheck } = await db
    .from("personajes")
    .select("id")
    .eq("id", characterId)
    .eq("usuario_id", user.id)
    .single();

  if (!charCheck) {
    return NextResponse.json(
      { error: "Personaje no encontrado o no te pertenece" },
      { status: 404 },
    );
  }

  const { data, error } = await db
    .from("personajes")
    .update({ nivel20_url: normalized.value })
    .eq("id", characterId)
    .eq("usuario_id", user.id)
    .select("nivel20_url")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    characterId,
    nivel20Url: data?.nivel20_url ?? normalized.value,
  });
}
