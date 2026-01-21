/**
 * Módulo de conexión a la base de datos Supabase
 * Usa el cliente oficial de Supabase para interactuar con la base de datos
 */

import { dbConfig, validateDbConfig } from './config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Tipo para la conexión
export type DatabaseConnection = SupabaseClient

let connection: DatabaseConnection | null = null

/**
 * Crea un cliente de Supabase
 */
function createConnection(): DatabaseConnection {
  // Validar configuración antes de crear el cliente
  validateDbConfig()
  
  const client = createClient(
    dbConfig.supabaseUrl!,
    dbConfig.supabaseKey!,
    {
      auth: {
        persistSession: false, // No persistir sesión en el servidor
      },
    }
  )

  return client
}

/**
 * Obtiene el cliente de Supabase
 * Reutiliza el cliente existente si está disponible
 */
export function getConnection(): DatabaseConnection {
  if (!connection) {
    connection = createConnection()
  }
  return connection
}

/**
 * Cierra la conexión (no es necesario con Supabase, pero mantenemos la función para compatibilidad)
 */
export async function closeConnection(): Promise<void> {
  // El cliente de Supabase no requiere cierre explícito
  connection = null
}

/**
 * Ejecuta una query SQL usando RPC o directamente desde una tabla
 * Nota: Supabase usa su API REST, no SQL directo
 * Para queries SQL personalizadas, usa .rpc() o consulta directa a tablas
 */
export async function query<T = any>(
  table: string,
  options?: {
    select?: string
    filter?: Record<string, any>
    limit?: number
    orderBy?: { column: string; ascending?: boolean }
  }
): Promise<T[]> {
  const client = getConnection()
  let query = client.from(table).select(options?.select || '*')

  // Aplicar filtros si existen
  if (options?.filter) {
    Object.entries(options.filter).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
  }

  // Aplicar ordenamiento
  if (options?.orderBy) {
    query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true })
  }

  // Aplicar límite
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Error en query: ${error.message}`)
  }

  return (data || []) as T[]
}

/**
 * Ejecuta una query y retorna un solo resultado
 */
export async function queryOne<T = any>(
  table: string,
  options?: {
    select?: string
    filter?: Record<string, any>
  }
): Promise<T | null> {
  const results = await query<T>(table, { ...options, limit: 1 })
  return results[0] || null
}

/**
 * Inserta datos en una tabla
 */
export async function insert<T = any>(
  table: string,
  data: T | T[]
): Promise<T[]> {
  const client = getConnection()
  const { data: result, error } = await client
    .from(table)
    .insert(data)
    .select()

  if (error) {
    throw new Error(`Error al insertar: ${error.message}`)
  }

  return (result || []) as T[]
}

/**
 * Actualiza datos en una tabla
 */
export async function update<T = any>(
  table: string,
  filter: Record<string, any>,
  data: Partial<T>
): Promise<T[]> {
  const client = getConnection()
  let query = client.from(table).update(data)

  // Aplicar filtros
  Object.entries(filter).forEach(([key, value]) => {
    query = query.eq(key, value)
  })

  const { data: result, error } = await query.select()

  if (error) {
    throw new Error(`Error al actualizar: ${error.message}`)
  }

  return (result || []) as T[]
}

/**
 * Elimina datos de una tabla
 */
export async function remove<T = any>(
  table: string,
  filter: Record<string, any>
): Promise<T[]> {
  const client = getConnection()
  let query = client.from(table).delete()

  // Aplicar filtros
  Object.entries(filter).forEach(([key, value]) => {
    query = query.eq(key, value)
  })

  const { data: result, error } = await query.select()

  if (error) {
    throw new Error(`Error al eliminar: ${error.message}`)
  }

  return (result || []) as T[]
}

/**
 * Ejecuta una función RPC (Remote Procedure Call) de Supabase
 */
export async function rpc<T = any>(
  functionName: string,
  params?: Record<string, any>
): Promise<T> {
  const client = getConnection()
  const { data, error } = await client.rpc(functionName, params)

  if (error) {
    throw new Error(`Error en RPC ${functionName}: ${error.message}`)
  }

  return data as T
}
