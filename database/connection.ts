/**
 * Módulo de conexión a la base de datos Supabase
 * Gestiona la conexión y el pool de conexiones usando PostgreSQL
 */

import { dbConfig, validateDbConfig } from './config'
import { Pool } from 'pg'

// Validar configuración al importar
validateDbConfig()

// Tipo para la conexión
export type DatabaseConnection = Pool

let connection: DatabaseConnection | null = null
let connectionPromise: Promise<DatabaseConnection> | null = null

/**
 * Crea una nueva conexión a la base de datos Supabase
 * Usa PostgreSQL connection pool para Supabase
 */
async function createConnection(): Promise<DatabaseConnection> {
  const pool = new Pool({
    connectionString: dbConfig.url,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
    max: dbConfig.maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })

  // Probar la conexión
  try {
    await pool.query('SELECT NOW()')
  } catch (error) {
    pool.end()
    throw new Error(`Error al conectar con Supabase: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }

  return pool
}

/**
 * Obtiene una conexión a la base de datos
 * Reutiliza la conexión existente si está disponible
 */
export async function getConnection(): Promise<DatabaseConnection> {
  if (connection) {
    return connection
  }

  if (!connectionPromise) {
    connectionPromise = createConnection()
  }

  try {
    connection = await connectionPromise
    return connection
  } catch (error) {
    connectionPromise = null
    throw error
  }
}

/**
 * Cierra la conexión a la base de datos
 */
export async function closeConnection(): Promise<void> {
  if (connection) {
    await connection.end()
    connection = null
    connectionPromise = null
  }
}

/**
 * Ejecuta una query en la base de datos
 * Función helper para facilitar el uso
 */
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const conn = await getConnection()
  const result = await conn.query(sql, params)
  return result.rows as T[]
}

/**
 * Ejecuta una query y retorna un solo resultado
 */
export async function queryOne<T = any>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const results = await query<T>(sql, params)
  return results[0] || null
}
