import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { modifyGold } from "@/lib/goldService";
import { rollDie } from "@/lib/types/dados";
import type { DiceType } from "@/lib/types/dados";

export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const recompensaId = typeof body?.recompensa_id === "number" ? body.recompensa_id : null;
  const personajeId = typeof body?.personaje_id === "number" ? body.personaje_id : null;

  if (!recompensaId || !personajeId) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  // Verificar que el personaje pertenece al usuario
  const { data: personaje, error: personajeError } = await db
    .from("personajes")
    .select("id")
    .eq("id", personajeId)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (personajeError || !personaje) {
    return NextResponse.json({ error: "Personaje no válido" }, { status: 403 });
  }

  // Obtener la recompensa activa
  const { data: recompensa, error: recompensaError } = await db
    .from("dados_recompensas")
    .select(`
      id, nombre, tipo, tipo_dado, costo_oro, activo, objeto_id, cantidad_dados, multiplicador_oro,
      dados_sublista_items(id, objeto_id, valor_min, valor_max)
    `)
    .eq("id", recompensaId)
    .eq("activo", true)
    .maybeSingle();

  if (recompensaError || !recompensa) {
    return NextResponse.json({ error: "Recompensa no encontrada" }, { status: 404 });
  }

  // Verificar oro suficiente
  const { data: perfil, error: perfilError } = await db
    .from("perfiles")
    .select("oro")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  }

  if ((perfil.oro ?? 0) < recompensa.costo_oro) {
    return NextResponse.json({ error: "Oro insuficiente" }, { status: 400 });
  }

  // Tirar los dados
  const tipoDado = recompensa.tipo_dado as DiceType;
  const cantidadDados = recompensa.tipo === "oro_dados" ? (recompensa.cantidad_dados ?? 1) : 1;
  const resultados: number[] = Array.from({ length: cantidadDados }, () => rollDie(tipoDado));

  // Calcular resultado según tipo
  let tipoResultado: "item" | "oro" = "item";
  let objetoId: number | null = null;
  let cantidadObjeto = 1;
  let cantidadOro: number | null = null;

  if (recompensa.tipo === "item_fijo") {
    objetoId = recompensa.objeto_id ?? null;
    if (!objetoId) {
      return NextResponse.json({ error: "Item no configurado" }, { status: 500 });
    }
    tipoResultado = "item";
  } else if (recompensa.tipo === "sublista") {
    const resultado = resultados[0];
    const items = (recompensa.dados_sublista_items ?? []) as Array<{
      id: number;
      objeto_id: number;
      valor_min: number;
      valor_max: number;
    }>;
    const match = items.find((si) => resultado >= si.valor_min && resultado <= si.valor_max);
    if (!match) {
      return NextResponse.json({ error: "Sin item para ese resultado" }, { status: 500 });
    }
    objetoId = match.objeto_id;
    tipoResultado = "item";
  } else if (recompensa.tipo === "oro_dados") {
    const suma = resultados.reduce((acc, v) => acc + v, 0);
    cantidadOro = suma * (recompensa.multiplicador_oro ?? 1);
    tipoResultado = "oro";
  }

  // Descontar costo
  if (recompensa.costo_oro > 0) {
    await modifyGold(user.id, -recompensa.costo_oro, "dado_costo", String(recompensaId));
  }

  // Acreditar premio
  if (tipoResultado === "item" && objetoId) {
    // Agregar a bolsa del personaje
    const { data: existing } = await db
      .from("bolsa_objetos")
      .select("id, cantidad")
      .eq("personaje_id", personajeId)
      .eq("objeto_id", objetoId)
      .maybeSingle();

    if (existing) {
      await db
        .from("bolsa_objetos")
        .update({ cantidad: existing.cantidad + cantidadObjeto })
        .eq("id", existing.id);
    } else {
      const { data: maxOrden } = await db
        .from("bolsa_objetos")
        .select("orden")
        .eq("personaje_id", personajeId)
        .order("orden", { ascending: false })
        .limit(1)
        .maybeSingle();

      await db.from("bolsa_objetos").insert({
        personaje_id: personajeId,
        objeto_id: objetoId,
        cantidad: cantidadObjeto,
        orden: ((maxOrden as any)?.orden ?? 0) + 1,
      });
    }
  } else if (tipoResultado === "oro" && cantidadOro && cantidadOro > 0) {
    await modifyGold(user.id, cantidadOro, "dado_recompensa_oro", String(recompensaId));
  }

  // Guardar historial
  await db.from("dados_historial").insert({
    usuario_id: user.id,
    recompensa_id: recompensaId,
    resultados_dados: resultados,
    tipo_resultado: tipoResultado,
    objeto_id: objetoId,
    cantidad_objeto: tipoResultado === "item" ? cantidadObjeto : null,
    cantidad_oro: tipoResultado === "oro" ? cantidadOro : null,
    costo_pagado: recompensa.costo_oro,
  });

  // Obtener nombre del objeto si aplica
  let objetoData: { id: number; nombre: string; icono: string } | undefined;
  if (objetoId) {
    const { data: obj } = await db
      .from("objetos")
      .select("id, nombre, icono")
      .eq("id", objetoId)
      .maybeSingle();
    if (obj) {
      objetoData = { id: obj.id, nombre: obj.nombre, icono: obj.icono };
    }
  }

  return NextResponse.json({
    resultados,
    tipoResultado,
    objeto: objetoData,
    cantidadOro: tipoResultado === "oro" ? cantidadOro : undefined,
  });
}
