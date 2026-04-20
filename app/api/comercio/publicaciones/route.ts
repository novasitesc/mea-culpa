import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/apiAuth";
import { ensureOwnedAliveCharacter } from "@/lib/characterLife";

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

  const { searchParams } = new URL(request.url);
  const includeSolicitados = searchParams.get("includeSolicitados") === "1";

  const estados = includeSolicitados
    ? ["publicado", "solicitado"]
    : ["publicado"];

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
    .in("estado", estados)
    .order("creado_en", { ascending: false });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map(mapPublicacion));
}

export async function POST(request: Request) {
  const db = createServerClient();

  const { user, error } = await getUserFromRequest(db, request);
  if (error || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { characterId?: unknown; bagRowId?: unknown; price?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const characterId = Number(body.characterId);
  const bagRowId = Number(body.bagRowId);
  const price = Number(body.price);

  if (
    !Number.isFinite(characterId) ||
    !Number.isFinite(bagRowId) ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return NextResponse.json(
      { error: "characterId, bagRowId y price son requeridos" },
      { status: 400 },
    );
  }

  const lifeCheck = await ensureOwnedAliveCharacter(db, user.id, characterId);
  if (!lifeCheck.ok) {
    return NextResponse.json({ error: lifeCheck.error }, { status: lifeCheck.status });
  }

  const { data: bagRow, error: bagError } = await db
    .from("bolsa_objetos")
    .select("id, personaje_id, fue_comerciado, publicado_en_trade")
    .eq("id", bagRowId)
    .eq("personaje_id", characterId)
    .maybeSingle();

  if (bagError) {
    return NextResponse.json({ error: bagError.message }, { status: 500 });
  }

  if (!bagRow) {
    return NextResponse.json({ error: "Objeto no encontrado en la bolsa" }, { status: 404 });
  }

  if (bagRow.fue_comerciado) {
    return NextResponse.json(
      { error: "Este objeto ya fue comerciado y no puede volver a publicarse" },
      { status: 409 },
    );
  }

  if (bagRow.publicado_en_trade) {
    return NextResponse.json(
      { error: "Este objeto ya tiene una publicación activa" },
      { status: 409 },
    );
  }

  const { data: existingPublication, error: existingError } = await db
    .from("publicaciones_comercio")
    .select("id")
    .eq("item_bolsa_id", bagRowId)
    .in("estado", ["publicado", "solicitado"])
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingPublication) {
    return NextResponse.json(
      { error: "Este objeto ya tiene una publicación activa" },
      { status: 409 },
    );
  }

  const { error: markPublishedError } = await db
    .from("bolsa_objetos")
    .update({ publicado_en_trade: true })
    .eq("id", bagRowId)
    .eq("personaje_id", characterId);

  if (markPublishedError) {
    return NextResponse.json({ error: markPublishedError.message }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await db
    .from("publicaciones_comercio")
    .insert({
      item_bolsa_id: bagRowId,
      vendedor_usuario_id: user.id,
      vendedor_personaje_id: characterId,
      precio: Math.floor(price),
      estado: "publicado",
    })
    .select("id, precio, estado, creado_en")
    .single();

  if (insertError) {
    await db
      .from("bolsa_objetos")
      .update({ publicado_en_trade: false })
      .eq("id", bagRowId)
      .eq("personaje_id", characterId);

    if (String((insertError as any).code) === "23505") {
      return NextResponse.json(
        { error: "Este objeto ya tiene una publicación activa" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
