import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase singleton para API routes (server-side).
 * Usa service_role para bypassear RLS, o la anon key como fallback.
 * Singleton: en Next.js el módulo se cachea por proceso, así que una sola
 * instancia sirve todas las API routes sin reconectar en cada request.
 */
let _serverClient: SupabaseClient | null = null;

export function createServerClient(): SupabaseClient {
  if (_serverClient) return _serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  _serverClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _serverClient;
}
