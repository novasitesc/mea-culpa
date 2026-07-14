import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { asignarItem } from "@/lib/asignarItem";
import { rollDie } from "@/lib/types/dados";
import type { DiceType, LutCaraResult } from "@/lib/types/dados";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: partidaId } = await params;

  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;
  const db = session.db;

  const { data: partida } = await db
    .from("partidas")
    .select("id, estado")
    .eq("id", partidaId)
    .maybeSingle();

  if (!partida || (partida as any).estado !== "en_progreso") {
    return NextResponse.json({ error: "Partida no está en progreso" }, { status: 403 });
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

  const { data: participante } = await db
    .from("partida_participantes")
    .select("id, usuario_id, personaje:personaje_id ( nombre )")
    .eq("partida_id", partidaId)
    .eq("personaje_id", personajeId)
    .maybeSingle();

  if (!participante) {
    return NextResponse.json({ error: "Personaje no es participante de esta partida" }, { status: 400 });
  }

  const targetUserId = (participante as any).usuario_id as string;
  const personajeNombre: string = (participante as any).personaje?.nombre ?? "";

  const { data: recompensa, error: recompensaError } = await db
    .from("dados_recompensas")
    .select(`
      id, nombre, tipo, tipo_dado, activo, objeto_id, cantidad_dados, multiplicador_oro,
      dados_sublista_items(id, objeto_id, valor_min, valor_max)
    `)
    .eq("id", recompensaId)
    .eq("activo", true)
    .maybeSingle();

  if (recompensaError || !recompensa) {
    return NextResponse.json({ error: "Recompensa no encontrada" }, { status: 404 });
  }

  const { data: lutCarasRaw } = await db
    .from("dados_lut_caras")
    .select("id, numero_cara, tipo, cantidad_dados, tipo_dado_oro, multiplicador_oro, objeto_id, subtabla_id")
    .eq("recompensa_id", recompensaId);

  async function awardGold(amount: number) {
    if (amount <= 0 || !targetUserId) return;
    await db.rpc("modificar_oro", {
      p_usuario_id: targetUserId,
      p_delta: amount,
      p_concepto: `partida_sala:${partidaId}`,
      p_referencia: partidaId,
      p_admin_id: session.userId,
    });
  }

  async function awardItem(objetoId: number): Promise<{ nombre: string; icono: string } | null> {
    await asignarItem({
      db,
      partidaId,
      personajeId: personajeId!,
      usuarioId: targetUserId,
      adminId: session.userId,
      objetoId,
      cantidad: 1,
    });
    const { data: obj } = await db.from("objetos").select("nombre, icono").eq("id", objetoId).maybeSingle();
    return obj ? { nombre: (obj as any).nombre, icono: (obj as any).icono } : null;
  }

  // --- LUT ---
  if ((recompensa as any).tipo === "lut") {
    const lutCaras = (lutCarasRaw ?? []) as Array<{
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
        continue;
      }

      if (caraConfig.tipo === "item" && caraConfig.objeto_id) {
        const obj = await awardItem(caraConfig.objeto_id);
        lutResultados.push({
          cara: primaryCara,
          tipo: "item",
          objeto: obj ? { id: caraConfig.objeto_id, nombre: obj.nombre, icono: obj.icono } : undefined,
        });
        continue;
      }

      if (caraConfig.tipo === "oro") {
        const oroMin = caraConfig.cantidad_dados ?? 0;
        const oroMax = caraConfig.multiplicador_oro ?? 0;
        const range = Math.max(0, oroMax - oroMin);
        const cantidadOro = oroMin + Math.floor(Math.random() * (range + 1));
        await awardGold(cantidadOro);
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
        continue;
      }

      if (caraConfig.tipo === "subtabla" && caraConfig.subtabla_id) {
        const { data: subtabla } = await db
          .from("dados_recompensas")
          .select("id, nombre, dados_subtabla_caras(numero_cara, tipo, objeto_id, oro_min, oro_max)")
          .eq("id", caraConfig.subtabla_id)
          .maybeSingle();

        const subCara = rollDie("d20");
        const subtablaCaras = ((subtabla as any)?.dados_subtabla_caras ?? []) as Array<{
          numero_cara: number;
          tipo: string;
          objeto_id: number | null;
          oro_min: number;
          oro_max: number;
        }>;
        const subCaraConfig = subtablaCaras.find((c) => c.numero_cara === subCara);
        const subTipo = subCaraConfig?.tipo ?? "nada";

        let subObjeto: { id: number; nombre: string; icono: string } | null = null;
        let subCantidadOro: number | undefined;

        if (subTipo === "item" && subCaraConfig?.objeto_id) {
          const obj = await awardItem(subCaraConfig.objeto_id);
          if (obj) subObjeto = { id: subCaraConfig.objeto_id, nombre: obj.nombre, icono: obj.icono };
        } else if (subTipo === "oro") {
          const oroMin = subCaraConfig?.oro_min ?? 0;
          const oroMax = subCaraConfig?.oro_max ?? 0;
          const range = Math.max(0, oroMax - oroMin);
          subCantidadOro = oroMin + Math.floor(Math.random() * (range + 1));
          await awardGold(subCantidadOro);
        }

        lutResultados.push({
          cara: primaryCara,
          tipo: "subtabla",
          subRoll: {
            subtablaNombre: (subtabla as any)?.nombre ?? "Sub-tabla",
            subtablaId: caraConfig.subtabla_id,
            cara: subCara,
            objeto: subObjeto,
            cantidadOro: subCantidadOro,
          },
        });
        continue;
      }

      lutResultados.push({ cara: primaryCara, tipo: "nada" });
    }

    // Persistir cada tirada como evento individual
    for (const r of lutResultados) {
      const subObj = r.tipo === "item" ? r.objeto : r.tipo === "subtabla" ? r.subRoll?.objeto : undefined;
      const subOro = r.tipo === "oro" ? (r.oroDetalle?.cantidadOro ?? undefined) : r.tipo === "subtabla" ? r.subRoll?.cantidadOro : undefined;
      await db.from("partidas_eventos").insert({
        partida_id: partidaId,
        tipo: "dado_tirado",
        personaje_id: personajeId,
        personaje_nombre: personajeNombre,
        usuario_id: targetUserId,
        tipo_dado: "d20",
        recompensa_nombre: (recompensa as any).nombre,
        tipo_resultado: r.tipo,
        objeto_id: subObj ? String(subObj.id) : null,
        objeto_nombre: subObj?.nombre ?? null,
        objeto_icono: subObj?.icono ?? null,
        cantidad_oro: subOro ?? null,
        metadata: r,
      });
    }

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
  const tipoDado = (recompensa as any).tipo_dado as DiceType;
  const cantidadDados = (recompensa as any).tipo === "oro_dados" ? ((recompensa as any).cantidad_dados ?? 1) : 1;
  const resultados: number[] = Array.from({ length: cantidadDados }, () => rollDie(tipoDado));

  let tipoResultado: "item" | "oro" = "item";
  let objetoId: number | null = null;
  let cantidadOro: number | null = null;

  if ((recompensa as any).tipo === "item_fijo") {
    objetoId = (recompensa as any).objeto_id ?? null;
    if (!objetoId) return NextResponse.json({ error: "Item no configurado" }, { status: 500 });
    tipoResultado = "item";
  } else if ((recompensa as any).tipo === "sublista") {
    const resultado = resultados[0];
    const items = ((recompensa as any).dados_sublista_items ?? []) as Array<{
      id: number;
      objeto_id: number;
      valor_min: number;
      valor_max: number;
    }>;
    const match = items.find((si) => resultado >= si.valor_min && resultado <= si.valor_max);
    if (!match) return NextResponse.json({ error: "Sin item para ese resultado" }, { status: 500 });
    objetoId = match.objeto_id;
    tipoResultado = "item";
  } else if ((recompensa as any).tipo === "oro_dados") {
    const suma = resultados.reduce((acc, v) => acc + v, 0);
    cantidadOro = suma * ((recompensa as any).multiplicador_oro ?? 1);
    tipoResultado = "oro";
  }

  let objetoData: { id: number; nombre: string; icono: string } | undefined;
  if (tipoResultado === "item" && objetoId) {
    const obj = await awardItem(objetoId);
    if (obj) objetoData = { id: objetoId, nombre: obj.nombre, icono: obj.icono };
  } else if (tipoResultado === "oro" && cantidadOro && cantidadOro > 0) {
    await awardGold(cantidadOro);
  }

  await db.from("partidas_eventos").insert({
    partida_id: partidaId,
    tipo: "dado_tirado",
    personaje_id: personajeId,
    personaje_nombre: personajeNombre,
    usuario_id: targetUserId,
    tipo_dado: tipoDado,
    recompensa_nombre: (recompensa as any).nombre,
    tipo_resultado: tipoResultado,
    objeto_id: objetoData ? String(objetoData.id) : null,
    objeto_nombre: objetoData?.nombre ?? null,
    objeto_icono: objetoData?.icono ?? null,
    cantidad_oro: tipoResultado === "oro" ? cantidadOro : null,
    metadata: { resultados },
  });

  return NextResponse.json({
    resultados,
    tipoResultado,
    objeto: objetoData,
    cantidadOro: tipoResultado === "oro" ? cantidadOro : undefined,
  });
}
