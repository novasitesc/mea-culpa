import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { ensureOwnedAliveCharacter } from "@/lib/characterLife";
import { normalizeAccountLevel } from "@/lib/accountLevel";

// POST /api/tiendas/comprar
// Authorization: Bearer <access_token>
// Body: {
//   personajeId: number,
//   items: Array<{ articuloTiendaId: number, qty: number }>
// }
//
// La lógica de negocio vive completamente en la función RPC `comprar_en_tienda`:
//   · Verifica que el personaje pertenece al usuario autenticado.
//   · Valida stock de cada artículo.
//   · Verifica que el usuario tiene oro suficiente.
//   · Reduce stock, añade objetos a la bolsa y descuenta el oro.
//   · Todo ocurre en una sola transacción atómica.
//
// Devuelve: { oro: number }  ← nuevo saldo del usuario
export async function POST(request: Request) {
  // 1. Verificar sesión activa
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = createServerClient();

  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2. Validar cuerpo de la petición
  let body: { personajeId?: unknown; items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido" },
      { status: 400 },
    );
  }

  const { personajeId, items } = body;

  if (
    typeof personajeId !== "number" ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return NextResponse.json(
      { error: "personajeId (number) y items (array no vacío) son requeridos" },
      { status: 400 },
    );
  }

  // Los enteros de Postgres son de 32 bits: sin este techo, un qty de 3.000.000.000
  // llegaba a la RPC y volvía como 500 con el mensaje crudo de la base.
  const INT_MAX = 2147483647;

  for (const item of items) {
    const articuloTiendaId = (item as any).articuloTiendaId;
    const qty = (item as any).qty;

    if (
      typeof articuloTiendaId !== "number" ||
      !Number.isInteger(articuloTiendaId) ||
      articuloTiendaId < 1 ||
      articuloTiendaId > INT_MAX ||
      typeof qty !== "number" ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      qty > 10000
    ) {
      return NextResponse.json(
        { error: "Cada item requiere articuloTiendaId (entero) y qty entero entre 1 y 10000" },
        { status: 400 },
      );
    }
  }

  const lifeCheck = await ensureOwnedAliveCharacter(db, user.id, personajeId);
  if (!lifeCheck.ok) {
    return NextResponse.json({ error: lifeCheck.error }, { status: lifeCheck.status });
  }

  // Nivel mínimo de la tienda: hasta ahora era un filtro de la interfaz, así que
  // una cuenta de nivel 1 compraba en las tiendas de nivel 4 llamando a la API.
  const articuloIds = (items as Array<{ articuloTiendaId: number }>).map(
    (i) => i.articuloTiendaId,
  );

  const [{ data: perfilNivel }, { data: articulosTienda, error: articulosError }] =
    await Promise.all([
      db.from("perfiles").select("nivel").eq("id", user.id).maybeSingle(),
      db
        .from("articulos_tienda")
        .select("id, tienda:tienda_id (id, nombre, nivel_minimo)")
        .in("id", articuloIds),
    ]);

  if (articulosError) {
    return NextResponse.json({ error: articulosError.message }, { status: 500 });
  }

  const nivelCuenta = normalizeAccountLevel((perfilNivel as any)?.nivel ?? 1);

  for (const articulo of articulosTienda ?? []) {
    const tienda = (articulo as any).tienda;
    const nivelMinimo = Number(tienda?.nivel_minimo ?? 1);
    if (Number.isFinite(nivelMinimo) && nivelCuenta < nivelMinimo) {
      return NextResponse.json(
        {
          error: `Necesitas nivel de cuenta ${nivelMinimo} para comprar en ${tienda?.nombre ?? "esta tienda"}`,
        },
        { status: 403 },
      );
    }
  }

  // 3. Llamar a la función RPC atómica
  const rpcItems = (
    items as Array<{ articuloTiendaId: number; qty: number }>
  ).map((i) => ({ articulo_tienda_id: i.articuloTiendaId, qty: i.qty }));

  const { data, error } = await db.rpc("comprar_en_tienda", {
    p_usuario_id: user.id,
    p_personaje_id: personajeId,
    p_items: rpcItems,
  });

  if (error) {
    const msg = error.message ?? "";
    // La 022 decía "partida abierta"; la 054/056 lo cambiaron a "expedicion en
    // curso" y este mapeo se quedó atrás, así que un bloqueo previsto salía como
    // 500. Se aceptan los dos textos.
    if (
      msg.includes("esta en una partida abierta") ||
      msg.includes("esta en una expedicion en curso")
    ) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg.includes("Oro insuficiente")) {
      return NextResponse.json({ error: "Oro insuficiente" }, { status: 422 });
    }
    if (msg.includes("Stock insuficiente")) {
      return NextResponse.json(
        { error: "Stock insuficiente" },
        { status: 422 },
      );
    }
    if (msg.includes("Bolsa llena")) {
      return NextResponse.json({ error: msg }, { status: 422 });
    }
    if (msg.includes("no pertenece al usuario")) {
      return NextResponse.json(
        { error: "Personaje no válido" },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(data); // { oro: nuevoBalance }
}
