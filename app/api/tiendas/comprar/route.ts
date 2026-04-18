import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

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

  for (const item of items) {
    if (
      typeof (item as any).articuloTiendaId !== "number" ||
      typeof (item as any).qty !== "number" ||
      (item as any).qty < 1
    ) {
      return NextResponse.json(
        { error: "Cada item requiere articuloTiendaId (number) y qty >= 1" },
        { status: 400 },
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
    if (msg.includes("esta en una partida abierta")) {
      return NextResponse.json(
        { error: "No puedes comprar en tienda mientras tu personaje esta en una partida abierta" },
        { status: 409 },
      );
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
