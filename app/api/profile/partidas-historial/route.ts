// GET — Partidas jugadas por el usuario y qué pasó en cada una.
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

export async function GET(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 1. Participaciones del usuario en partidas finalizadas
  const { data: participaciones, error: partError } = await db
    .from("partida_participantes")
    .select(`
      personaje_id,
      oro_delta,
      muerto,
      partida:partida_id (
        id,
        titulo,
        piso,
        tier,
        finalizada_en
      ),
      personaje:personaje_id ( nombre )
    `)
    .eq("usuario_id", user.id)
    .not("partida_id", "is", null);

  if (partError) {
    return NextResponse.json({ error: partError.message }, { status: 500 });
  }

  const finalizadas = (participaciones ?? []).filter(
    (row: any) => row.partida?.finalizada_en != null,
  );

  if (finalizadas.length === 0) {
    return NextResponse.json({ partidas: [] });
  }

  const partidaIds = finalizadas.map((row: any) => String(row.partida.id));
  const personajeIds = finalizadas.map((row: any) => Number(row.personaje_id));

  // 2. Eventos de sala para esos personajes en esas partidas
  const { data: eventosRaw, error: eventosError } = await db
    .from("partidas_eventos")
    .select(
      "partida_id, tipo, personaje_id, tipo_dado, recompensa_nombre, tipo_resultado, objeto_id, objeto_nombre, objeto_icono, cantidad, cantidad_oro, miembro, miembro_label, desmembrado, metadata, creado_en",
    )
    .in("partida_id", partidaIds)
    .in("personaje_id", personajeIds)
    .in("tipo", ["dado_tirado", "asignacion_manual", "consumible_usado", "desmembramiento"])
    .order("creado_en", { ascending: true });

  if (eventosError) {
    return NextResponse.json({ error: eventosError.message }, { status: 500 });
  }

  // Agrupar eventos por (partida_id, personaje_id)
  const eventosByKey = new Map<string, any[]>();
  for (const ev of eventosRaw ?? []) {
    const key = `${ev.partida_id}__${ev.personaje_id}`;
    const list = eventosByKey.get(key) ?? [];
    list.push(ev);
    eventosByKey.set(key, list);
  }

  const partidas = finalizadas
    .sort((a: any, b: any) => {
      const aDate = new Date(a.partida.finalizada_en).getTime();
      const bDate = new Date(b.partida.finalizada_en).getTime();
      return bDate - aDate;
    })
    .map((row: any) => {
      const personajeId = Number(row.personaje_id);
      const partidaId = String(row.partida.id);
      const key = `${partidaId}__${personajeId}`;
      const eventos = (eventosByKey.get(key) ?? []).map((ev: any) => {
        const meta = ev.metadata as any;
        if (ev.tipo === "dado_tirado" && meta?.tipo) {
          return {
            tipo: "dado_tirado",
            tipoDado: ev.tipo_dado ?? "",
            recompensaNombre: ev.recompensa_nombre ?? "",
            tipoResultado: ev.tipo_resultado ?? "",
            objetoNombre: ev.objeto_nombre ?? null,
            objetoIcono: ev.objeto_icono ?? null,
            cantidadOro: ev.cantidad_oro ?? null,
            lutResultados: [meta],
            creadoEn: ev.creado_en,
          };
        }
        if (ev.tipo === "dado_tirado") {
          return {
            tipo: "dado_tirado",
            tipoDado: ev.tipo_dado ?? "",
            recompensaNombre: ev.recompensa_nombre ?? "",
            tipoResultado: ev.tipo_resultado ?? "",
            objetoNombre: ev.objeto_nombre ?? null,
            objetoIcono: ev.objeto_icono ?? null,
            cantidadOro: ev.cantidad_oro ?? null,
            lutResultados: meta?.resultados ? [meta] : null,
            creadoEn: ev.creado_en,
          };
        }
        if (ev.tipo === "asignacion_manual") {
          return {
            tipo: "asignacion_manual",
            objetoNombre: ev.objeto_nombre ?? null,
            objetoIcono: ev.objeto_icono ?? null,
            cantidad: ev.cantidad ?? 1,
            cantidadOro: ev.cantidad_oro ?? null,
            creadoEn: ev.creado_en,
          };
        }
        if (ev.tipo === "consumible_usado") {
          return {
            tipo: "consumible_usado",
            objetoNombre: ev.objeto_nombre ?? "",
            objetoIcono: ev.objeto_icono ?? "",
            creadoEn: ev.creado_en,
          };
        }
        if (ev.tipo === "desmembramiento") {
          return {
            tipo: "desmembramiento",
            miembro: ev.miembro ?? "",
            miembroLabel: ev.miembro_label ?? ev.miembro ?? "",
            desmembrado: Boolean(ev.desmembrado),
            creadoEn: ev.creado_en,
          };
        }
        return null;
      }).filter(Boolean);

      return {
        partidaId,
        titulo: row.partida.titulo ?? "Sin título",
        piso: Number(row.partida.piso ?? 1),
        tier: Number(row.partida.tier ?? 1),
        finalizadaEn: row.partida.finalizada_en,
        personajeId,
        personajeNombre: row.personaje?.nombre ?? "Personaje",
        muerto: Boolean(row.muerto),
        oroDelta: Number(row.oro_delta ?? 0),
        eventos,
      };
    });

  return NextResponse.json({ partidas });
}
