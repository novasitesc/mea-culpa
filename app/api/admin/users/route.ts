import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// Devuelve todos los usuarios con sus datos de perfil y email.
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const { data: perfiles, error: perfilesError } = await db
    .from("perfiles")
    .select("id, nombre, rol, nivel, hogar, es_admin, rol_sistema, creado_en")
    .order("creado_en", { ascending: false });

  if (perfilesError) {
    return NextResponse.json({ error: perfilesError.message }, { status: 500 });
  }

  // Obtener emails desde auth.users (requiere service_role)
  const { data: authData } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  const users = (perfiles ?? []).map((p: any) => ({
    id: p.id,
    email: emailMap.get(p.id) ?? "",
    name: p.nombre,
    role: p.rol,
    level: p.nivel,
    home: p.hogar,
    isAdmin: p.es_admin,
    rolSistema: p.rol_sistema,
    createdAt: p.creado_en,
  }));

  return NextResponse.json(users);
}

// ─── POST /api/admin/users ────────────────────────────────────────────────────
// Crea un usuario en auth.users + perfil.
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { db } = result.session;

  const body = await request.json();
  const { name, email, password, role, level } = body;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json(
      { error: "Nombre, email y contraseña son obligatorios" },
      { status: 400 },
    );
  }

  // Crear usuario en Supabase Auth
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // sin necesidad de verificar desde el panel admin
  });

  if (createError || !created.user) {
    const msg = createError?.message ?? "Error al crear usuario";
    const isConflict = msg.toLowerCase().includes("already");
    return NextResponse.json(
      { error: isConflict ? "Ya existe un usuario con ese email" : msg },
      { status: isConflict ? 409 : 500 },
    );
  }

  // El trigger de Supabase ya crea el perfil; actualizamos nombre, rol y nivel
  await db
    .from("perfiles")
    .update({
      nombre: name,
      rol: role ?? "Dungeon Explorer",
      nivel: level ?? 1,
    })
    .eq("id", created.user.id);

  const { data: perfil } = await db
    .from("perfiles")
    .select("id, nombre, rol, nivel, hogar, es_admin, rol_sistema, creado_en")
    .eq("id", created.user.id)
    .single();

  return NextResponse.json(
    {
      id: created.user.id,
      email: created.user.email ?? "",
      name: (perfil as any)?.nombre ?? name,
      role: (perfil as any)?.rol ?? role,
      level: (perfil as any)?.nivel ?? level,
      home: (perfil as any)?.hogar ?? "",
      isAdmin: false,
      rolSistema: "usuario",
      createdAt: (perfil as any)?.creado_en ?? new Date().toISOString(),
    },
    { status: 201 },
  );
}

// ─── PATCH /api/admin/users?id=:id ───────────────────────────────────────────
// Actualiza nombre, rol narrativo y nivel.
// Solo super_admin puede cambiar rol_sistema / es_admin.
export async function PATCH(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("id");
  if (!targetId) {
    return NextResponse.json(
      { error: "Falta el parámetro id" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { name, role, level, rolSistema } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.nombre = name;
  if (role !== undefined) updates.rol = role;
  if (level !== undefined) updates.nivel = level;

  // Solo super_admin puede cambiar rol_sistema y es_admin
  if (rolSistema !== undefined) {
    if (session.rolSistema !== "super_admin") {
      return NextResponse.json(
        { error: "Solo un super_admin puede cambiar roles de sistema" },
        { status: 403 },
      );
    }
    if (!["usuario", "admin", "super_admin"].includes(rolSistema)) {
      return NextResponse.json(
        { error: "Rol de sistema inválido" },
        { status: 400 },
      );
    }
    updates.rol_sistema = rolSistema;
    updates.es_admin = rolSistema !== "usuario";
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No hay campos para actualizar" },
      { status: 400 },
    );
  }

  const { error } = await session.db
    .from("perfiles")
    .update(updates)
    .eq("id", targetId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: perfil } = await session.db
    .from("perfiles")
    .select("id, nombre, rol, nivel, hogar, es_admin, rol_sistema, creado_en")
    .eq("id", targetId)
    .single();

  const { data: authUser } = await session.db.auth.admin.getUserById(targetId);

  return NextResponse.json({
    id: targetId,
    email: authUser?.user?.email ?? "",
    name: (perfil as any)?.nombre,
    role: (perfil as any)?.rol,
    level: (perfil as any)?.nivel,
    home: (perfil as any)?.hogar,
    isAdmin: (perfil as any)?.es_admin,
    rolSistema: (perfil as any)?.rol_sistema,
    createdAt: (perfil as any)?.creado_en,
  });
}

// ─── DELETE /api/admin/users?id=:id ──────────────────────────────────────────
// Elimina la cuenta (auth.users + perfil en cascada).
export async function DELETE(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("id");
  if (!targetId) {
    return NextResponse.json(
      { error: "Falta el parámetro id" },
      { status: 400 },
    );
  }

  // Un admin no puede eliminarse a sí mismo
  if (targetId === session.userId) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 },
    );
  }

  const { error } = await session.db.auth.admin.deleteUser(targetId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
