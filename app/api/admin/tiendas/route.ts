import { NextRequest, NextResponse } from "next/server";
import {
  db_getShops,
  db_getShopById,
  db_updateShop,
  db_deleteShop,
  db_createShop,
  db_getUserById,
} from "@/lib/mockDb";

// ─── Guard de autenticación ───────────────────────────────────────────────────
// TODO: Reemplazar con middleware real de sesión/JWT cuando haya BD.
function requireAdmin(request: NextRequest): NextResponse | null {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const user = db_getUserById(userId);
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  return null; // OK
}

// ─── GET /api/admin/tiendas ───────────────────────────────────────────────────
// GET sin ?id  → lista todas las tiendas con conteo de items
// GET con ?id  → detalle completo de una tienda (con items)
export function GET(request: NextRequest) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const shop = db_getShopById(id);
    if (!shop) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json(shop);
  }

  const shops = db_getShops().map(({ items, ...rest }) => ({
    ...rest,
    itemCount: items.length,
  }));
  return NextResponse.json(shops);
}

// ─── POST /api/admin/tiendas ──────────────────────────────────────────────────
// Crea una nueva tienda.
export async function POST(request: NextRequest) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  const body = await request.json();
  const { name, description, icon, keeper, location, minLevel } = body;

  if (!name || !description || !keeper || !location) {
    return NextResponse.json(
      { error: "Nombre, descripción, tendero y ubicación son obligatorios" },
      { status: 400 },
    );
  }

  const existing = db_getShops().find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe una tienda con ese nombre" },
      { status: 409 },
    );
  }

  const newShop = db_createShop({
    name,
    description,
    icon: icon ?? "🏪",
    keeper,
    location,
    ...(minLevel ? { minLevel } : {}),
  });

  return NextResponse.json(newShop, { status: 201 });
}

// ─── PATCH /api/admin/tiendas?id=:id ─────────────────────────────────────────
// Actualiza los datos principales de una tienda (sin tocar items).
export async function PATCH(request: NextRequest) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Falta el parámetro id" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const updated = db_updateShop(id, body);

  if (!updated) {
    return NextResponse.json(
      { error: "Tienda no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json(updated);
}

// ─── DELETE /api/admin/tiendas?id=:id ────────────────────────────────────────
// Elimina una tienda.
export function DELETE(request: NextRequest) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Falta el parámetro id" },
      { status: 400 },
    );
  }

  const deleted = db_deleteShop(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Tienda no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
