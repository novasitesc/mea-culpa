import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { modifyGold } from "@/lib/goldService";
import { rollDie } from "@/lib/types/dados";
import type { DiceType, LutCaraResult } from "@/lib/types/dados";

async function addItemToCharacter(
  db: ReturnType<typeof createServerClient>,
  personajeId: number,
  objetoId: number
) {
  const { data: existing } = await db
    .from("bolsa_objetos")
    .select("id, cantidad")
    .eq("personaje_id", personajeId)
    .eq("objeto_id", objetoId)
    .maybeSingle();

  if (existing) {
    await db
      .from("bolsa_objetos")
      .update({ cantidad: existing.cantidad + 1 })
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
      cantidad: 1,
      orden: ((maxOrden as any)?.orden ?? 0) + 1,
    });
  }
}

export async function POST(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const recompensaId = typeof body?.recompensa_id === "number" ? body.recompensa_id : null;
  const personajeId = typeof body?.personaje_id === "number" ? body.personaje_id : null;
  const cantidad =
    typeof body?.cantidad === "number" &&
    Number.isInteger(body.cantidad) &&
    body.cantidad >= 1 &&
    body.cantidad <= 10
      ? body.cantidad
      : 1;

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

  // Obtener la recompensa activa con todas sus caras
  const { data: recompensa, error: recompensaError } = await db
    .from("dados_recompensas")
    .select(`
      id, nombre, tipo, tipo_dado, costo_oro, activo, objeto_id, cantidad_dados, multiplicador_oro,
      dados_sublista_items(id, objeto_id, valor_min, valor_max),
      dados_lut_caras(id, numero_cara, tipo, cantidad_dados, tipo_dado_oro, multiplicador_oro, objeto_id, subtabla_id)
    `)
    .eq("id", recompensaId)
    .eq("activo", true)
    .maybeSingle();

  if (recompensaError || !recompensa) {
    return NextResponse.json({ error: "Recompensa no encontrada" }, { status: 404 });
  }

  // Verificar oro suficiente para todas las tiradas
  const costoTotal = recompensa.costo_oro * cantidad;
  const { data: perfil, error: perfilError } = await db
    .from("perfiles")
    .select("oro")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  }

  if ((perfil.oro ?? 0) < costoTotal) {
    return NextResponse.json({ error: "Oro insuficiente" }, { status: 400 });
  }

  // --- Tipo LUT ---
  if (recompensa.tipo === "lut") {
    // Deducir costo total de una sola vez
    if (costoTotal > 0) {
      await modifyGold(user.id, -costoTotal, "dado_costo", String(recompensaId));
    }

    const lutCaras = (recompensa.dados_lut_caras ?? []) as Array<{
      id: number;
      numero_cara: number;
      tipo: string;
      cantidad_dados: number | null;
      tipo_dado_oro: string | null;
      multiplicador_oro: number;
      objeto_id: number | null;
      subtabla_id: number | null;
    }>;

    const lutResultados: LutCaraResult[] = [];

    for (let t = 0; t < cantidad; t++) {
      const primaryCara = rollDie("d20");
      const caraConfig = lutCaras.find((c) => c.numero_cara === primaryCara);

      if (!caraConfig || caraConfig.tipo === "nada") {
        lutResultados.push({ cara: primaryCara, tipo: "nada" });
        await db.from("dados_historial").insert({
          usuario_id: user.id,
          recompensa_id: recompensaId,
          resultados_dados: [primaryCara],
          tipo_resultado: "nada",
          objeto_id: null,
          cantidad_objeto: null,
          cantidad_oro: null,
          costo_pagado: recompensa.costo_oro,
        });
        continue;
      }

      if (caraConfig.tipo === "item" && caraConfig.objeto_id) {
        await addItemToCharacter(db, personajeId, caraConfig.objeto_id);

        const { data: obj } = await db
          .from("objetos")
          .select("id, nombre, icono")
          .eq("id", caraConfig.objeto_id)
          .maybeSingle();

        lutResultados.push({
          cara: primaryCara,
          tipo: "item",
          objeto: obj ? { id: obj.id, nombre: obj.nombre, icono: obj.icono } : undefined,
        });

        await db.from("dados_historial").insert({
          usuario_id: user.id,
          recompensa_id: recompensaId,
          resultados_dados: [primaryCara],
          tipo_resultado: "item",
          objeto_id: caraConfig.objeto_id,
          cantidad_objeto: 1,
          cantidad_oro: null,
          costo_pagado: recompensa.costo_oro,
        });
        continue;
      }

      if (caraConfig.tipo === "oro") {
        const oroMin = caraConfig.cantidad_dados ?? 0;
        const oroMax = caraConfig.multiplicador_oro ?? 0;
        const range = Math.max(0, oroMax - oroMin);
        const cantidadOro = oroMin + Math.floor(Math.random() * (range + 1));

        if (cantidadOro > 0) {
          await modifyGold(user.id, cantidadOro, "dado_recompensa_oro", String(recompensaId));
        }

        lutResultados.push({
          cara: primaryCara,
          tipo: "oro",
          oroDetalle: {
            formula: `${oroMin}–${oroMax}`,
            dados: [cantidadOro],
            total: cantidadOro,
            multiplicador: 1,
            cantidadOro,
          },
        });

        await db.from("dados_historial").insert({
          usuario_id: user.id,
          recompensa_id: recompensaId,
          resultados_dados: [primaryCara],
          tipo_resultado: "oro",
          objeto_id: null,
          cantidad_objeto: null,
          cantidad_oro: cantidadOro,
          costo_pagado: recompensa.costo_oro,
        });
        continue;
      }

      if (caraConfig.tipo === "subtabla" && caraConfig.subtabla_id) {
        // Obtener sub-tabla
        const { data: subtabla } = await db
          .from("dados_recompensas")
          .select("id, nombre, dados_subtabla_caras(numero_cara, objeto_id)")
          .eq("id", caraConfig.subtabla_id)
          .maybeSingle();

        const subCara = rollDie("d20");
        const subtablaCaras = (subtabla?.dados_subtabla_caras ?? []) as Array<{
          numero_cara: number;
          objeto_id: number | null;
        }>;
        const subCaraConfig = subtablaCaras.find((c) => c.numero_cara === subCara);
        const subObjetoId = subCaraConfig?.objeto_id ?? null;

        let subObjeto: { id: number; nombre: string; icono: string } | null = null;
        if (subObjetoId) {
          await addItemToCharacter(db, personajeId, subObjetoId);
          const { data: obj } = await db
            .from("objetos")
            .select("id, nombre, icono")
            .eq("id", subObjetoId)
            .maybeSingle();
          if (obj) subObjeto = { id: obj.id, nombre: obj.nombre, icono: obj.icono };
        }

        lutResultados.push({
          cara: primaryCara,
          tipo: "subtabla",
          subRoll: {
            subtablaNombre: subtabla?.nombre ?? "Sub-tabla",
            subtablaId: caraConfig.subtabla_id,
            cara: subCara,
            objeto: subObjeto,
          },
        });

        await db.from("dados_historial").insert({
          usuario_id: user.id,
          recompensa_id: recompensaId,
          resultados_dados: [primaryCara, subCara],
          tipo_resultado: "subtabla",
          objeto_id: subObjetoId,
          cantidad_objeto: subObjetoId ? 1 : null,
          cantidad_oro: null,
          costo_pagado: recompensa.costo_oro,
        });
        continue;
      }

      // Cara sin configuración válida
      lutResultados.push({ cara: primaryCara, tipo: "nada" });
      await db.from("dados_historial").insert({
        usuario_id: user.id,
        recompensa_id: recompensaId,
        resultados_dados: [primaryCara],
        tipo_resultado: "nada",
        objeto_id: null,
        cantidad_objeto: null,
        cantidad_oro: null,
        costo_pagado: recompensa.costo_oro,
      });
    }

    // Legacy fields del primer resultado para compatibilidad
    const first = lutResultados[0];
    return NextResponse.json({
      resultados: [first?.cara ?? 0],
      tipoResultado: first?.tipo ?? "nada",
      objeto: first?.objeto,
      cantidadOro: first?.oroDetalle?.cantidadOro,
      lutResultados,
      cantidad,
    });
  }

  // --- Tipos legacy (item_fijo, sublista, oro_dados) ---
  const tipoDado = recompensa.tipo_dado as DiceType;
  const cantidadDados = recompensa.tipo === "oro_dados" ? (recompensa.cantidad_dados ?? 1) : 1;
  const resultados: number[] = Array.from({ length: cantidadDados }, () => rollDie(tipoDado));

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
    await addItemToCharacter(db, personajeId, objetoId);
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
