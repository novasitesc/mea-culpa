import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import type { SalaEvento } from "@/lib/types/sala";

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
    case "consumible_usado": return {
      tipo: "consumible_usado",
      personajeId:     row.personaje_id,
      personajeNombre: row.personaje_nombre ?? "",
      objeto: {
        id:     Number(row.objeto_id),
        nombre: row.objeto_nombre ?? "",
        icono:  row.objeto_icono  ?? "",
      },
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
    .select("id, titulo, estado, piso, tier, inicio_en")
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

  const { data: participantes } = await db
    .from("partida_participantes")
    .select("id, personaje_id, usuario_id, muerto, personaje:personaje_id(nombre, extremidades)")
    .eq("partida_id", partidaId);

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
    },
    esAdmin,
    participantes: (participantes ?? []).map((p: any) => ({
      id: p.id,
      personajeId: p.personaje_id,
      usuarioId: p.usuario_id,
      muerto: p.muerto ?? false,
      nombre: p.personaje?.nombre ?? "Personaje",
      extremidades: (p.personaje as any)?.extremidades ?? null,
    })),
    eventos,
  });
}
