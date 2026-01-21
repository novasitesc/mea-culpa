/**
 * Configuración de la base de datos Supabase
 * Lee las variables de entorno desde .env.local
 */

// Función para obtener las variables de entorno de forma dinámica
// Esto asegura que las variables se lean después de que dotenv las cargue
function getEnvVar(key: string): string | undefined {
  return process.env[key]
}

export const dbConfig = {
  // Variables de Supabase (requeridas) - leídas dinámicamente
  get supabaseUrl() {
    return getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || getEnvVar('SUPABASE_URL')
  },
  get supabaseAnonKey() {
    return getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY')
  },
  get supabaseServiceRoleKey() {
    return getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
  },
  
  // Usar service role key si está disponible (para operaciones del servidor)
  // De lo contrario, usar anon key
  get supabaseKey() {
    return this.supabaseServiceRoleKey || this.supabaseAnonKey
  },
}

/**
 * Valida que las variables de entorno necesarias estén configuradas
 */
export function validateDbConfig(): void {
  if (!dbConfig.supabaseUrl) {
    throw new Error(
      'Error de configuración de base de datos Supabase: ' +
      'Debes proporcionar NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL en .env.local'
    )
  }
  
  if (!dbConfig.supabaseAnonKey && !dbConfig.supabaseServiceRoleKey) {
    throw new Error(
      'Error de configuración de base de datos Supabase: ' +
      'Debes proporcionar NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env.local'
    )
  }
}
