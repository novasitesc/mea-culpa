/**
 * Punto de entrada principal para la conexión a la base de datos
 * Exporta todas las funciones y configuraciones necesarias
 */

export { dbConfig, validateDbConfig } from './config'
export {
  getConnection,
  closeConnection,
  query,
  queryOne,
  insert,
  update,
  remove,
  rpc,
  type DatabaseConnection,
} from './connection'
