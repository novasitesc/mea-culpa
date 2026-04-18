import type { SupabaseClient, User } from "@supabase/supabase-js";

export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}

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
