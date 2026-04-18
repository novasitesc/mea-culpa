import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";

function mapPublicacion(row: any) {
  return {
    id: row.id,
    precio: row.precio,
    estado: row.estado,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
    vendedorUsuarioId: row.vendedor_usuario_id,
    vendedorPersonajeId: row.vendedor_personaje_id,
    compradorUsuarioId: row.comprador_usuario_id,
    compradorPersonajeId: row.comprador_personaje_id,
    item: {
      bagRowId: row.item?.id ?? null,
      cantidad: row.item?.cantidad ?? 1,
      fueComerciado: Boolean(row.item?.fue_comerciado),
      publicadoEnTrade: Boolean(row.item?.publicado_en_trade),
      objetoId: row.item?.objeto_id ?? null,
      nombre: row.item?.objetos?.nombre ?? "Objeto desconocido",
      icono: row.item?.objetos?.icono ?? "📦",
      rareza: row.item?.objetos?.rareza ?? "común",
      tipo: row.item?.objetos?.tipo_item ?? "misc",
      precioBase: row.item?.objetos?.precio ?? 0,
    },
    vendedor: {
      nombre: row.vendedor_personaje?.nombre ?? "Vendedor",
      retrato:
        row.vendedor_personaje?.retrato ?? "/characters/profileplaceholder.webp",
    },
    comprador: row.comprador_personaje
      ? {
          nombre: row.comprador_personaje.nombre ?? "Comprador",
          retrato:
            row.comprador_personaje.retrato ??
            "/characters/profileplaceholder.webp",
        }
      : null,
  };
}

export async function GET(request: Request) {
  const db = createServerClient();

  const { user, error } = await getUserFromRequest(db, request);
  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error: listError } = await db
    .from("publicaciones_comercio")
    .select(
      `
      id,
      precio,
      estado,
      creado_en,
      actualizado_en,
      vendedor_usuario_id,
      vendedor_personaje_id,
      comprador_usuario_id,
      comprador_personaje_id,
      item:item_bolsa_id (
        id,
        objeto_id,
        cantidad,
        fue_comerciado,
        publicado_en_trade,
        objetos:objeto_id (id, nombre, icono, rareza, tipo_item, precio)
      ),
      vendedor_personaje:vendedor_personaje_id (id, nombre, retrato),
      comprador_personaje:comprador_personaje_id (id, nombre, retrato)
    `,
    )
    .or(`vendedor_usuario_id.eq.${user.id},comprador_usuario_id.eq.${user.id}`)
    .order("actualizado_en", { ascending: false });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map(mapPublicacion));
}
