import { createClient } from "@supabase/supabase-js";

/**
 * Crea un cliente Supabase para uso en API routes (server-side).
 * Usa service_role si está disponible para bypassear RLS,
 * o la anon key si no.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
