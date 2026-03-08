import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Cliente Supabase para uso en el navegador (client components).
 * Usa la publishable key y persiste la sesión del usuario.
 *
 * Las nuevas claves sb_publishable_ no son JWTs. El SDK envía por defecto
 * "Authorization: Bearer sb_publishable_..." para requests sin sesión, lo que
 * hace que el API Gateway rechace la petición. El fetch personalizado elimina
 * ese header cuando su valor es la propia API key, dejando que el gateway
 * determine el rol (anon) directamente desde el header "apikey".
 */
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase env vars are not configured");
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: async (url, options = {}) => {
          const headers = new Headers(options.headers);
          const authHeader = headers.get("Authorization");
          // Los JWT siempre empiezan con "Bearer eyJ" (base64url de {"alg":...}).
          // Las nuevas claves sb_publishable_ / sb_secret_ NO son JWTs.
          // Si el header Authorization NO contiene un JWT real, lo eliminamos
          // para que el API Gateway de Supabase procese solo el header apikey.
          if (authHeader && !authHeader.startsWith("Bearer eyJ")) {
            console.debug(
              "[supabase] Eliminando Authorization no-JWT:",
              authHeader.slice(0, 30) + "...",
            );
            headers.delete("Authorization");
          }
          return fetch(url, { ...options, headers });
        },
      },
    });
  }
  return _supabase;
}
