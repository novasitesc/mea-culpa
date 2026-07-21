// GET — Solo admin. Devuelve la configuración de dados ya montada para la UI
// (caras, sub-tablas y sublistas en formato camelCase).
// Es lectura para pintar el panel; la edición está en /admin.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { mapLutCaraRows, mapSubtablaCaraRows, mapSublistaRows } from "@/lib/dice/load";

// Config del tirador: solo admins/DMs (sala DM y probador del panel admin).
export async function GET(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;
  const db = session.db;

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

  const [{ data: lutCarasData }, { data: subtablaCarasData }, { data: personajesData }] =
    await Promise.all([
      db
        .from("dados_lut_caras")
        .select(`id, recompensa_id, numero_cara, tipo, oro_min, oro_max, objeto_id, cantidad_min, cantidad_max, subtabla_id, objeto:objeto_id(id, nombre, icono), subtabla:subtabla_id(id, nombre)`),
      db
        .from("dados_subtabla_caras")
        .select(`id, recompensa_id, numero_cara, tipo, oro_min, oro_max, objeto_id, cantidad_min, cantidad_max, objeto:objeto_id(id, nombre, icono)`),
      // Personajes vivos del usuario: destino de los ítems en la tirada personal.
      db.from("personajes").select("id, nombre, muerto").eq("usuario_id", session.userId).order("id"),
    ]);

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
        sublistaItems: mapSublistaRows(r.dados_sublista_items ?? []),
        lutCaras: mapLutCaraRows(lutMap.get(r.id) ?? []),
        subtablaCaras: mapSubtablaCaraRows(subtablaMap.get(r.id) ?? []),
      };
    });

  const personajes = ((personajesData ?? []) as Array<{ id: number; nombre: string; muerto: boolean }>)
    .filter((p) => !p.muerto)
    .map((p) => ({ id: p.id, nombre: p.nombre }));

  return NextResponse.json({ recompensas: mapped, personajes });
}
