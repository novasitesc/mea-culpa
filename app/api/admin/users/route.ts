import { NextRequest, NextResponse } from "next/server";
import {
  db_getUsers,
  db_updateUser,
  db_deleteUser,
  db_createUser,
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

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// Devuelve todos los usuarios (sin contraseña).
export function GET(request: NextRequest) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  // Simular delay de BD
  const users = db_getUsers();
  return NextResponse.json(users);
}

// ─── POST /api/admin/users ────────────────────────────────────────────────────
// Crea un nuevo usuario.
export async function POST(request: NextRequest) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  const body = await request.json();
  const { name, email, password, role, level } = body;

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Nombre, email y contraseña son obligatorios" },
      { status: 400 },
    );
  }

  const existing = db_getUsers().find((u) => u.email === email);
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe un usuario con ese email" },
      { status: 409 },
    );
  }

  // isAdmin no puede asignarse desde este endpoint — solo SUPER_ADMIN podrá hacerlo (próximamente).
  const newUser = db_createUser({
    name,
    email,
    password,
    role: role ?? "Adventurer",
    level: level ?? 1,
    home: "",
    isAdmin: false,
  });

  return NextResponse.json(newUser, { status: 201 });
}

// ─── PATCH /api/admin/users?id=:id ───────────────────────────────────────────
// Actualiza un usuario existente.
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

  // Solo se permiten modificar estos campos desde el panel de admin normal.
  // Email y contraseña no son editables; isAdmin lo gestiona únicamente SUPER_ADMIN (próximamente).
  const { name, role, level } = body;
  const updated = db_updateUser(id, { name, role, level });

  if (!updated) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json(updated);
}

// ─── DELETE /api/admin/users?id=:id ──────────────────────────────────────────
// Elimina un usuario.
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

  // No permitir que un admin se elimine a sí mismo
  const requesterId = request.headers.get("x-user-id");
  if (id === requesterId) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 },
    );
  }

  const deleted = db_deleteUser(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
