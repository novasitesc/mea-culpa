// Autenticación de usuario normal en API routes (para admin, ver adminAuth.ts).
// El navegador manda el JWT de Supabase en la cabecera "Authorization"; aquí se
// extrae y se valida CONTRA Supabase. Nunca se confía en el contenido del token
// sin verificarlo: un JWT es texto que el cliente puede falsificar.
import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Saca el token de la cabecera `Authorization: Bearer <token>`, o null si no viene. */
export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}

/**
 * Puerta de entrada de casi toda ruta protegida: devuelve el usuario dueño del
 * token, o `{ user: null, error }` si falta o es inválido.
 *
 * Patrón habitual en las rutas:
 *
 *   const { user, error } = await getUserFromRequest(db, request);
 *   if (error || !user) return NextResponse.json({ error }, { status: 401 });
 */
export async function getUserFromRequest(
  db: SupabaseClient,
  request: Request,
): Promise<{ user: User | null; error: string | null }> {
  const token = getBearerToken(request);
  if (!token) {
    return { user: null, error: "No autorizado" };
  }

  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: "No autorizado" };
  }

  return { user, error: null };
}
