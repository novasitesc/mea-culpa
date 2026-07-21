import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { MAX_CAIDAS, MAX_CANSANCIO, CANSANCIO_POR_DERROTA } from "@/lib/caidas";
import { aplicarDescanso, esRacion, esTiendaAcampar, type TipoDescanso } from "@/lib/descanso";

export async function PATCH(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  let body: { personajeId?: unknown; delta?: unknown; partidaId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const personajeId = Number(body.personajeId);
  const delta = Number(body.delta);
  const partidaId = body.partidaId ? String(body.partidaId) : null;

  if (!Number.isFinite(personajeId) || personajeId <= 0) {
    return NextResponse.json({ error: "personajeId inválido" }, { status: 400 });
  }
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: "delta debe ser 1 o -1" }, { status: 400 });
  }

  const { data: personaje, error: fetchError } = await session.db
    .from("personajes")
    .select("id, nombre, usuario_id, caidas, puntos_cansancio")
    .eq("id", personajeId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!personaje) {
    return NextResponse.json({ error: "Personaje no encontrado" }, { status: 404 });
  }

  const currentCaidas = Math.max(0, Math.min(MAX_CAIDAS, Number((personaje as any).caidas ?? 0)));
  const newCaidas = Math.max(0, Math.min(MAX_CAIDAS, currentCaidas + delta));

  if (newCaidas === currentCaidas) {
    return NextResponse.json({
      caidas: currentCaidas,
      derrotado: currentCaidas >= MAX_CAIDAS,
      puntosCansancio: Number((personaje as any).puntos_cansancio ?? 0),
    });
  }

  const currentCansancio = Number((personaje as any).puntos_cansancio ?? 0);
  const reachesDefeat = newCaidas >= MAX_CAIDAS;
  const revertsDefeat = currentCaidas >= MAX_CAIDAS && newCaidas < MAX_CAIDAS;

  // ponytail: la derrota satura en MAX_CANSANCIO sin matar; la muerte por
  // agotamiento solo ocurre al rehusar el descanso obligatorio (sleep-options).
  let newCansancio = currentCansancio;
  if (reachesDefeat) newCansancio = Math.min(MAX_CANSANCIO, currentCansancio + CANSANCIO_POR_DERROTA);
  if (revertsDefeat) newCansancio = Math.max(0, currentCansancio - CANSANCIO_POR_DERROTA);

  const { error: updateError } = await session.db
    .from("personajes")
    .update({ caidas: newCaidas, puntos_cansancio: newCansancio })
    .eq("id", personajeId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (partidaId && (reachesDefeat || revertsDefeat)) {
    const { error: participantError } = await session.db
      .from("partida_participantes")
      .update({ derrotado: reachesDefeat })
      .eq("partida_id", partidaId)
      .eq("personaje_id", personajeId);

    if (participantError) {
      return NextResponse.json({ error: participantError.message }, { status: 500 });
    }
  }

  if (partidaId) {
    await session.db.from("partidas_eventos").insert({
      partida_id: partidaId,
      tipo: "caida",
      personaje_id: personajeId,
      personaje_nombre: (personaje as any).nombre ?? null,
      usuario_id: (personaje as any).usuario_id ?? null,
      cantidad: newCaidas,
      metadata: { delta, derrotado: reachesDefeat, cansancio: newCansancio },
    });
  }

  return NextResponse.json({
    caidas: newCaidas,
    derrotado: reachesDefeat,
    puntosCansancio: newCansancio,
  });
}

// Consume 1 unidad de una fila de bolsa. El filtro por cantidad actual hace
// la operación atómica: si otra petición ya la gastó, no afecta filas.
async function consumirUno(
  db: any,
  row: { id: number; cantidad: number },
): Promise<boolean> {
  const cantidad = Number(row.cantidad ?? 1);
  if (cantidad <= 1) {
    const { data } = await db
      .from("bolsa_objetos")
      .delete()
      .eq("id", row.id)
      .eq("cantidad", cantidad)
      .select("id");
    return (data ?? []).length > 0;
  }
  const { data } = await db
    .from("bolsa_objetos")
    .update({ cantidad: cantidad - 1 })
    .eq("id", row.id)
    .eq("cantidad", cantidad)
    .select("id");
  return (data ?? []).length > 0;
}

// Descanso en expedición (grupal, lo gestiona el DM). Ambos tipos consumen
// 1 ración por personaje activo; sin ración no hay beneficio y se gana 1
// punto de cansancio. El corto cura CAIDAS_CURADAS_DESCANSO_CORTO caídas.
// El largo además requiere una tienda de acampar del grupo, restaura caídas
// a 0 y reduce 1 nivel de agotamiento (D&D 5e 2014); como solo cabe un
// descanso largo por día de aventura, se permite uno por expedición.
export async function POST(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  let body: { partidaId?: unknown; tipo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const partidaId = String(body.partidaId ?? "").trim();
  if (!partidaId) {
    return NextResponse.json({ error: "partidaId es requerido" }, { status: 400 });
  }
  const tipo: TipoDescanso = body.tipo === "corto" ? "corto" : "largo";

  if (tipo === "largo") {
    const { count: descansosPrevios } = await session.db
      .from("partidas_eventos")
      .select("id", { count: "exact", head: true })
      .eq("partida_id", partidaId)
      .eq("tipo", "descanso_largo");

    if ((descansosPrevios ?? 0) > 0) {
      return NextResponse.json(
        { error: "Ya se realizó un descanso largo en esta expedición" },
        { status: 409 },
      );
    }
  }

  const { data: participantes, error: fetchError } = await session.db
    .from("partida_participantes")
    .select("personaje_id, muerto, derrotado, personaje:personaje_id(nombre, caidas, puntos_cansancio)")
    .eq("partida_id", partidaId);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const activos = (participantes ?? [])
    .filter((p: any) => !p.muerto && !p.derrotado)
    .map((p: any) => ({
      personajeId: Number(p.personaje_id),
      nombre: (p.personaje?.nombre ?? "Personaje") as string,
      caidasPrevias: Number(p.personaje?.caidas ?? 0),
      cansancioPrevio: Number(p.personaje?.puntos_cansancio ?? 0),
    }));

  if (activos.length === 0) {
    return NextResponse.json(
      { error: "No hay personajes activos para descansar" },
      { status: 409 },
    );
  }

  const { data: bagRows, error: bagError } = await session.db
    .from("bolsa_objetos")
    .select("id, personaje_id, cantidad, publicado_en_trade, objetos:objeto_id(nombre)")
    .in("personaje_id", activos.map((p) => p.personajeId));

  if (bagError) {
    return NextResponse.json({ error: bagError.message }, { status: 500 });
  }

  const disponibles = (bagRows ?? []).filter(
    (r: any) => !r.publicado_en_trade && Number(r.cantidad ?? 0) > 0,
  );

  const racionPorPersonaje = new Map<number, any>();
  for (const r of disponibles) {
    const pid = Number((r as any).personaje_id);
    if (!racionPorPersonaje.has(pid) && esRacion((r as any).objetos?.nombre ?? "")) {
      racionPorPersonaje.set(pid, r);
    }
  }

  if (tipo === "largo") {
    const tienda = disponibles.find((r: any) => esTiendaAcampar(r.objetos?.nombre ?? ""));
    if (!tienda) {
      return NextResponse.json(
        { error: "El grupo necesita una tienda de acampar en alguna bolsa para el descanso largo" },
        { status: 409 },
      );
    }
    const consumida = await consumirUno(session.db, tienda as any);
    if (!consumida) {
      return NextResponse.json(
        { error: "La tienda de acampar ya no está disponible" },
        { status: 409 },
      );
    }
  }

  const personajes = [];
  for (const p of activos) {
    const racion = racionPorPersonaje.get(p.personajeId);
    const tieneRacion = racion ? await consumirUno(session.db, racion) : false;
    const nuevo = aplicarDescanso(
      tipo,
      { caidas: p.caidasPrevias, cansancio: p.cansancioPrevio },
      tieneRacion,
    );

    // D&D 5e 2014 (PHB p.186): el descanso largo devuelve los espacios de
    // conjuro. Sin ración no hay descanso efectivo, así que tampoco se recuperan.
    const recuperaConjuros = tipo === "largo" && tieneRacion;

    const { error: updateError } = await session.db
      .from("personajes")
      .update({
        caidas: nuevo.caidas,
        puntos_cansancio: nuevo.cansancio,
        ...(recuperaConjuros ? { conjuros_usados: [] } : {}),
      })
      .eq("id", p.personajeId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    personajes.push({
      ...p,
      caidas: nuevo.caidas,
      cansancio: nuevo.cansancio,
      sinRacion: !tieneRacion,
      ...(recuperaConjuros ? { conjurosRecuperados: true } : {}),
    });
  }

  await session.db.from("partidas_eventos").insert({
    partida_id: partidaId,
    tipo: tipo === "corto" ? "descanso_corto" : "descanso_largo",
    metadata: { personajes },
  });

  return NextResponse.json({ tipo, personajes });
}
