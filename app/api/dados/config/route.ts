import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

function mapLutCaras(rows: any[]) {
  return rows
    .map((c: any) => {
      const obj = Array.isArray(c.objeto) ? c.objeto[0] : c.objeto;
      const sub = Array.isArray(c.subtabla) ? c.subtabla[0] : c.subtabla;
      return {
        id: c.id,
        recompensaId: c.recompensa_id,
        numeroCara: c.numero_cara,
        tipo: c.tipo,
        cantidadDados: c.cantidad_dados ?? null,
        tipoDadoOro: c.tipo_dado_oro ?? null,
        multiplicadorOro: c.multiplicador_oro ?? 1,
        objetoId: c.objeto_id ?? null,
        objetoNombre: obj?.nombre ?? null,
        objetoIcono: obj?.icono ?? null,
        subtablaId: c.subtabla_id ?? null,
        subtablaNombre: sub?.nombre ?? null,
      };
    })
    .sort((a: any, b: any) => a.numeroCara - b.numeroCara);
}

function mapSubtablaCaras(rows: any[]) {
  return rows
    .map((c: any) => {
      const obj = Array.isArray(c.objeto) ? c.objeto[0] : c.objeto;
      return {
        id: c.id,
        recompensaId: c.recompensa_id,
        numeroCara: c.numero_cara,
        objetoId: c.objeto_id ?? null,
        objetoNombre: obj?.nombre ?? null,
        objetoIcono: obj?.icono ?? null,
      };
    })
    .sort((a: any, b: any) => a.numeroCara - b.numeroCara);
}

export async function GET(request: Request) {
  const db = createServerClient();
  const { user, error: authError } = await getUserFromRequest(db, request);
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: recompensas, error } = await db
    .from("dados_recompensas")
    .select(`
      id, nombre, descripcion, tipo, tipo_dado, costo_oro, activo, orden,
      objeto_id, cantidad_dados, multiplicador_oro,
      objeto:objeto_id(id, nombre, icono),
      dados_sublista_items(id, objeto_id, valor_min, valor_max, orden, objeto:objeto_id(id, nombre, icono))
    `)
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Queries separadas para LUT/subtabla — fallan silenciosamente si las tablas no existen aún
  const { data: lutCarasData } = await db
    .from("dados_lut_caras")
    .select(`id, recompensa_id, numero_cara, tipo, cantidad_dados, tipo_dado_oro, multiplicador_oro, objeto_id, subtabla_id, objeto:objeto_id(id, nombre, icono), subtabla:subtabla_id(id, nombre)`);

  const { data: subtablaCarasData } = await db
    .from("dados_subtabla_caras")
    .select(`id, recompensa_id, numero_cara, objeto_id, objeto:objeto_id(id, nombre, icono)`);

  const lutMap = new Map<number, any[]>();
  for (const row of lutCarasData ?? []) {
    const list = lutMap.get(row.recompensa_id) ?? [];
    list.push(row);
    lutMap.set(row.recompensa_id, list);
  }

  const subtablaMap = new Map<number, any[]>();
  for (const row of subtablaCarasData ?? []) {
    const list = subtablaMap.get(row.recompensa_id) ?? [];
    list.push(row);
    subtablaMap.set(row.recompensa_id, list);
  }

  const mapped = (recompensas ?? [])
    .filter((r: any) => r.tipo !== "subtabla")
    .map((r: any) => {
      const objetoRow = Array.isArray(r.objeto) ? r.objeto[0] : r.objeto;
      const sublistaItems = (r.dados_sublista_items ?? [])
        .map((si: any) => {
          const siObj = Array.isArray(si.objeto) ? si.objeto[0] : si.objeto;
          return {
            id: si.id,
            objetoId: si.objeto_id,
            objetoNombre: siObj?.nombre ?? "",
            objetoIcono: siObj?.icono ?? "",
            valorMin: si.valor_min,
            valorMax: si.valor_max,
            orden: si.orden,
          };
        })
        .sort((a: any, b: any) => a.orden - b.orden);

      const lutCaras = mapLutCaras(lutMap.get(r.id) ?? []);
      const subtablaCaras = mapSubtablaCaras(subtablaMap.get(r.id) ?? []);

      return {
        id: r.id,
        nombre: r.nombre,
        descripcion: r.descripcion ?? null,
        tipo: r.tipo,
        tipoDado: r.tipo_dado,
        costoOro: r.costo_oro,
        objetoId: r.objeto_id ?? null,
        objetoNombre: objetoRow?.nombre ?? null,
        objetoIcono: objetoRow?.icono ?? null,
        cantidadDados: r.cantidad_dados ?? 1,
        multiplicadorOro: r.multiplicador_oro ?? 1,
        sublistaItems,
        lutCaras,
        subtablaCaras,
      };
    });

  return NextResponse.json({ recompensas: mapped });
}
