/**
 * Database connections index
 * Re-exports all database utilities with aliases to avoid naming conflicts
 */

// PostgreSQL (Supabase) exports
export {
  getPool as getPgPool,
  query as pgQuery,
  queryOne as pgQueryOne,
  queryAll as pgQueryAll,
  transaction as pgTransaction,
  closePool as closePgPool,
} from './postgres';

// MySQL (Magento) exports
export {
  getPool as getMysqlPool,
  query as mysqlQuery,
  queryOne as mysqlQueryOne,
  queryRaw as mysqlQueryRaw,
  execute as mysqlExecute,
  transaction as mysqlTransaction,
  closePool as closeMysqlPool,
  MAGENTO_ATTRIBUTES,
} from './mysql';
