/**
 * Configuración de la base de datos Supabase
 * Lee las variables de entorno desde .env.local
 */

export const dbConfig = {
  // URL de conexión directa a PostgreSQL de Supabase
  url: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  
  // Variables de Supabase (para usar el cliente oficial)
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  
  // Variables individuales (alternativa)
  host: process.env.DB_HOST || process.env.POSTGRES_HOST,
  port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
  user: process.env.DB_USER || process.env.POSTGRES_USER,
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
  database: process.env.DB_NAME || process.env.POSTGRES_DATABASE || process.env.POSTGRES_DB,
  
  // Configuraciones adicionales
  ssl: process.env.DB_SSL !== 'false', // Por defecto true para Supabase
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
}

/**
 * Valida que las variables de entorno necesarias estén configuradas
 */
export function validateDbConfig(): void {
  if (!dbConfig.url && (!dbConfig.host || !dbConfig.user || !dbConfig.database)) {
    throw new Error(
      'Error de configuración de base de datos Supabase: ' +
      'Debes proporcionar DATABASE_URL (o SUPABASE_DB_URL) en .env.local'
    )
  }
}
