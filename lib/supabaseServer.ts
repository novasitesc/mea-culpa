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

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase server client no está configurado. Define SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (!key.startsWith("sb_secret_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY inválida. Debe comenzar con sb_secret_.",
    );
  }

  _serverClient = createClient(url, key, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
  });

  return _serverClient;
}
