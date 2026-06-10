import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

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

  const mapped = (recompensas ?? []).map((r: any) => {
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
    };
  });

  return NextResponse.json({ recompensas: mapped });
}
