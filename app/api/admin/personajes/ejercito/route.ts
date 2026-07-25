// PATCH — Solo admin. El DM aplica bajas al ejército de un personaje cuando
// las unidades caen en batalla, para que nadie pueda decir "es que me
// sobrevive". Resta `bajas` regimientos de la casilla; si llega a 0 (o si el
// DM aniquila la unidad entera), la casilla se libera.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { EJERCITO_SELECT, aplicarBajas, mapUnidadRow } from "@/lib/ejercito";

export async function PATCH(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  let body: { unidadId?: unknown; bajas?: unknown; aniquilar?: unknown; partidaId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const unidadId = Number(body.unidadId);
  const aniquilar = Boolean(body.aniquilar);
  const bajas = Math.floor(Number(body.bajas ?? 1));
  const partidaId = body.partidaId ? String(body.partidaId) : null;

  if (!Number.isFinite(unidadId) || unidadId <= 0) {
    return NextResponse.json({ error: "unidadId inválido" }, { status: 400 });
  }
  if (!aniquilar && (!Number.isFinite(bajas) || bajas <= 0)) {
    return NextResponse.json({ error: "Indica cuántas unidades caen" }, { status: 400 });
  }

  const { data: unidad, error: fetchError } = await session.db
    .from("ejercito_objetos")
    .select(`${EJERCITO_SELECT}, personaje_id`)
    .eq("id", unidadId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!unidad) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  const actual = mapUnidadRow(unidad);
  const personajeId = Number((unidad as any).personaje_id);
  const { caidas, restante } = aplicarBajas(actual.cantidad, bajas, aniquilar);

  if (restante > 0) {
    const { error } = await session.db
      .from("ejercito_objetos")
      .update({ cantidad: restante })
      .eq("id", unidadId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await session.db.from("ejercito_objetos").delete().eq("id", unidadId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: personaje } = await session.db
    .from("personajes")
    .select("nombre, usuario_id")
    .eq("id", personajeId)
    .maybeSingle();

  if (partidaId) {
    await session.db.from("partidas_eventos").insert({
      partida_id: partidaId,
      tipo: "ejercito_baja",
      personaje_id: personajeId,
      personaje_nombre: (personaje as any)?.nombre ?? null,
      usuario_id: (personaje as any)?.usuario_id ?? null,
      objeto_id: String(actual.objetoId),
      objeto_nombre: actual.nombre,
      objeto_icono: actual.icono,
      cantidad: caidas,
      metadata: { restante, aniquilada: restante === 0, unidadId },
    });
  }

  return NextResponse.json({
    personajeId,
    unidadId,
    unidadNombre: actual.nombre,
    unidadIcono: actual.icono,
    bajas: caidas,
    restante,
    aniquilada: restante === 0,
    personajeNombre: (personaje as any)?.nombre ?? "Personaje",
  });
}
