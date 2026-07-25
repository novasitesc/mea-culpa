// GET — La foto completa de la sala de juego: partida, participantes con sus
// personajes y el feed de eventos.
// La usan tanto la vista del jugador (sala-player.tsx) como la del DM
// (sala-dm.tsx), consultándola cada pocos segundos para mantenerla al día.
// Es la mejor ruta por la que empezar a entender el sistema de partidas.
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import type { SalaEvento } from "@/lib/types/sala";
import { EJERCITO_SELECT, mapUnidadRow } from "@/lib/ejercito";

function mapEventoRow(row: any): SalaEvento | null {
  switch (row.tipo) {
    case "partida_iniciada": return { tipo: "partida_iniciada" };
    case "partida_cerrada":  return { tipo: "partida_cerrada" };
    case "desmembramiento":  return {
      tipo: "desmembramiento",
      personajeId:     row.personaje_id,
      personajeNombre: row.personaje_nombre ?? "",
      miembro:         row.miembro,
      miembroLabel:    row.miembro_label ?? row.miembro,
      desmembrado:     row.desmembrado,
    };
    case "caida": return {
      tipo: "caida",
      personajeId:     row.personaje_id,
      personajeNombre: row.personaje_nombre ?? "",
      caidas:          Number(row.cantidad ?? 0),
      delta:           Number((row.metadata as any)?.delta ?? 1),
      derrotado:       Boolean((row.metadata as any)?.derrotado ?? false),
      ...((row.metadata as any)?.cansancio !== undefined
        ? { cansancio: Number((row.metadata as any).cansancio) }
        : {}),
    };
    case "cansancio": return {
      tipo: "cansancio",
      personajeId:     row.personaje_id,
      personajeNombre: row.personaje_nombre ?? "",
      cansancio:       Number(row.cantidad ?? 0),
      delta:           Number((row.metadata as any)?.delta ?? 1),
    };
    case "conjuro_lanzado": return {
      tipo: "conjuro_lanzado",
      personajeId:     row.personaje_id,
      personajeNombre: row.personaje_nombre ?? "",
      conjuro:         row.objeto_nombre ?? "",
      spellLevel:      Number(row.cantidad ?? 0),
      escuela:         ((row.metadata as any)?.escuela ?? null) as string | null,
      descripcion:     ((row.metadata as any)?.descripcion ?? null) as string | null,
    };
    case "sala_avanzada": return {
      tipo: "sala_avanzada",
      sala:             Number(row.cantidad ?? 0),
      requiereDescanso: Boolean((row.metadata as any)?.requiereDescanso ?? false),
    };
    case "ejercito_baja": return {
      tipo: "ejercito_baja",
      personajeId:     row.personaje_id,
      personajeNombre: row.personaje_nombre ?? "",
      unidadId:        Number((row.metadata as any)?.unidadId ?? 0),
      unidadNombre:    row.objeto_nombre ?? "",
      unidadIcono:     row.objeto_icono ?? "⚔️",
      bajas:           Number(row.cantidad ?? 0),
      restante:        Number((row.metadata as any)?.restante ?? 0),
      aniquilada:      Boolean((row.metadata as any)?.aniquilada ?? false),
    };
    case "descanso_largo":
    case "descanso_corto": return {
      tipo: row.tipo,
      personajes: ((row.metadata as any)?.personajes ?? []).map((p: any) => ({
        personajeId:    Number(p.personajeId),
        nombre:         p.nombre ?? "Personaje",
        caidasPrevias:  Number(p.caidasPrevias ?? 0),
        cansancioPrevio: Number(p.cansancioPrevio ?? 0),
        ...(p.caidas !== undefined ? { caidas: Number(p.caidas) } : {}),
        ...(p.cansancio !== undefined ? { cansancio: Number(p.cansancio) } : {}),
        ...(p.sinRacion !== undefined ? { sinRacion: Boolean(p.sinRacion) } : {}),
        ...(p.conjurosRecuperados !== undefined
          ? { conjurosRecuperados: Boolean(p.conjurosRecuperados) }
          : {}),
      })),
    };
    case "consumible_usado": return {
      tipo: "consumible_usado",
      personajeId:     row.personaje_id,
      personajeNombre: row.personaje_nombre ?? "",
      objeto: {
        id:     Number(row.objeto_id),
        nombre: row.objeto_nombre ?? "",
        icono:  row.objeto_icono  ?? "",
      },
      restante:        Number(row.cantidad ?? 0),
    };
    case "asignacion_manual": return {
      tipo: "asignacion_manual",
      personajeId:     row.personaje_id,
      personajeNombre: row.personaje_nombre ?? "",
      ...(row.tipo_resultado === "item" && row.objeto_nombre ? {
        objeto:   { id: Number(row.objeto_id), nombre: row.objeto_nombre, icono: row.objeto_icono ?? "" },
        cantidad: row.cantidad ?? 1,
      } : {}),
      ...(row.tipo_resultado === "oro" ? { cantidadOro: row.cantidad_oro } : {}),
    };
    case "dado_tirado": {
      const meta = row.metadata as any;
      if (meta?.tipo && ["item", "oro", "nada", "subtabla"].includes(meta.tipo)) {
        return {
          tipo: "dado_tirado",
          tipoDado:         row.tipo_dado ?? "d20",
          recompensaNombre: row.recompensa_nombre ?? "",
          resultados:       [],
          tipoResultado:    row.tipo_resultado ?? "",
          personajeNombre:  row.personaje_nombre ?? "",
          personajeId:      row.personaje_id ?? 0,
          lutResultados:    [meta],
        };
      }
      return {
        tipo: "dado_tirado",
        tipoDado:         row.tipo_dado ?? "",
        recompensaNombre: row.recompensa_nombre ?? "",
        resultados:       meta?.resultados ?? [],
        tipoResultado:    row.tipo_resultado ?? "",
        personajeNombre:  row.personaje_nombre ?? "",
        personajeId:      row.personaje_id ?? 0,
        ...(row.tipo_resultado === "item" && row.objeto_nombre ? {
          objeto: { id: Number(row.objeto_id), nombre: row.objeto_nombre, icono: row.objeto_icono ?? "" },
        } : {}),
        ...(row.tipo_resultado === "oro" ? { cantidadOro: row.cantidad_oro } : {}),
      };
    }
    default: return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: partidaId } = await params;
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: partida, error: partidaError } = await db
    .from("partidas")
    .select("id, titulo, estado, piso, tier, inicio_en, creada_por")
    .eq("id", partidaId)
    .maybeSingle();

  if (partidaError || !partida) {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  const estadoValido = ["abierta", "en_progreso"].includes((partida as any).estado);
  if (!estadoValido) {
    return NextResponse.json({ error: "La partida no está disponible" }, { status: 403 });
  }

  const { data: perfil } = await db
    .from("perfiles")
    .select("es_admin")
    .eq("id", user.id)
    .single();

  const esAdmin = (perfil as any)?.es_admin === true;

  if (!esAdmin) {
    const { data: participante } = await db
      .from("partida_participantes")
      .select("id")
      .eq("partida_id", partidaId)
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (!participante) {
      return NextResponse.json({ error: "No eres participante de esta partida" }, { status: 403 });
    }
  }

  const { data: participantes, error: participantesError } = await db
    .from("partida_participantes")
    .select(
      `id, personaje_id, usuario_id, muerto, derrotado,
       personaje:personaje_id(
         nombre, extremidades, caidas, puntos_cansancio,
         ejercito_objetos ( ${EJERCITO_SELECT} )
       )`,
    )
    .eq("partida_id", partidaId);

  // Igual que en /api/profile: si esto falla, la sala no está vacía, está rota.
  // Sin este control el DM veía una mesa sin jugadores y no sabía por qué.
  if (participantesError) {
    console.error("[sala] no se pudieron cargar los participantes:", participantesError);
    return NextResponse.json(
      {
        error:
          participantesError.code === "42703"
            ? "La base de datos está desactualizada: falta aplicar una migración de supabase/migrations"
            : "No se pudieron cargar los participantes",
        detail: participantesError.message,
        code: participantesError.code ?? null,
      },
      { status: 500 },
    );
  }

  const { data: eventosRows } = await db
    .from("partidas_eventos")
    .select("*")
    .eq("partida_id", partidaId)
    .order("creado_en", { ascending: true });

  const eventos = (eventosRows ?? []).map(mapEventoRow).filter((e): e is SalaEvento => e !== null);

  return NextResponse.json({
    partida: {
      id: (partida as any).id,
      titulo: (partida as any).titulo,
      estado: (partida as any).estado,
      piso: (partida as any).piso,
      tier: (partida as any).tier,
      inicioEn: (partida as any).inicio_en,
      // Quien la creó es su DM: solo él (o el super admin) puede iniciarla.
      esMiPartida: (partida as any).creada_por === user.id,
    },
    esAdmin,
    participantes: (participantes ?? []).map((p: any) => ({
      id: p.id,
      personajeId: p.personaje_id,
      usuarioId: p.usuario_id,
      muerto: p.muerto ?? false,
      derrotado: p.derrotado ?? false,
      nombre: p.personaje?.nombre ?? "Personaje",
      extremidades: (p.personaje as any)?.extremidades ?? null,
      caidas: Number((p.personaje as any)?.caidas ?? 0),
      cansancio: Number((p.personaje as any)?.puntos_cansancio ?? 0),
      ejercito: ((p.personaje as any)?.ejercito_objetos ?? [])
        .sort((a: any, b: any) => a.orden - b.orden)
        .map(mapUnidadRow),
    })),
    eventos,
  });
}
