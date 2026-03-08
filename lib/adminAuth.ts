import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminSession = {
  userId: string;
  email: string;
  rolSistema: string;
  db: SupabaseClient;
};

/**
 * Verifica que la petición incluye un token JWT válido y que el
 * usuario tiene es_admin = true en la tabla `perfiles`.
 *
 * Retorna `{ error: NextResponse }` si falla, o `{ session: AdminSession }`
 * con los datos del admin verificado y el cliente Supabase listo para usar.
 *
 * Uso en cualquier API route de admin:
 *
 *   const result = await requireAdmin(request);
 *   if ("error" in result) return result.error;
 *   const { session } = result;
 */
export async function requireAdmin(
  request: Request,
): Promise<{ error: NextResponse } | { session: AdminSession }> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  const db = createServerClient();

  // Verificar token con Supabase Auth (no confiar en payload sin verificar)
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);

  if (authError || !user) {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  // Verificar que el usuario tiene es_admin = true en perfiles
  const { data: perfil, error: perfilError } = await db
    .from("perfiles")
    .select("es_admin, rol_sistema")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil?.es_admin) {
    return {
      error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }),
    };
  }

  return {
    session: {
      userId: user.id,
      email: user.email ?? "",
      rolSistema: perfil.rol_sistema,
      db,
    },
  };
}
