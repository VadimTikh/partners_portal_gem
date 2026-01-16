/**
 * MySQL (Magento) database connection
 * Used for: courses, dates, products (EAV structure)
 */

import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const host = process.env.MAGENTO_DB_HOST;
    const user = process.env.MAGENTO_DB_USER;
    const password = process.env.MAGENTO_DB_PASSWORD;
    const database = process.env.MAGENTO_DB_NAME;

    if (!host || !user || !password || !database) {
      throw new Error('Magento database environment variables are not set');
    }

    pool = mysql.createPool({
      host,
      port: parseInt(process.env.MAGENTO_DB_PORT || '3306', 10),
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      multipleStatements: true, // Required for SET statements and multi-statement queries
      // SSL only if explicitly enabled via MAGENTO_DB_SSL=true
      ssl: process.env.MAGENTO_DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  return pool;
}

/**
 * Log helper for development/debugging
 * Use DEBUG_MYSQL=true to enable (NODE_ENV is baked at build time in Next.js)
 */
function devLog(operation: string, data: Record<string, unknown>) {
  if (process.env.DEBUG_MYSQL === 'true') {
    console.log(`[MySQL] ${operation}`, JSON.stringify(data, null, 2));
  }
}

/**
 * Truncate SQL for logging (first 500 chars)
 */
function truncateSql(sql: string): string {
  const clean = sql.replace(/\s+/g, ' ').trim();
  return clean.length > 500 ? clean.substring(0, 500) + '...' : clean;
}

/**
 * Execute a query on the MySQL database
 */
export async function query<T extends RowDataPacket[]>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  const client = getPool();
  const start = Date.now();

  devLog('Query START', {
    sql: truncateSql(sql),
    params: params || [],
  });

  try {
    const [rows] = await client.execute<T>(sql, params);
    const duration = Date.now() - start;

    devLog('Query SUCCESS', {
      duration: `${duration}ms`,
      rowCount: Array.isArray(rows) ? rows.length : 0,
    });

    return rows;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('[MySQL] Query ERROR', {
      sql: truncateSql(sql),
      params: params || [],
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 * Uses query() instead of execute() to support multi-statement queries with SET variables
 */
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<ResultSetHeader | ResultSetHeader[]> {
  const client = getPool();
  const start = Date.now();

  devLog('Execute START', {
    sql: truncateSql(sql),
    params: params || [],
  });

  try {
    // Use query() for multi-statement support (execute() doesn't support multi-statements)
    const [result] = await client.query<ResultSetHeader | ResultSetHeader[]>(sql, params);
    const duration = Date.now() - start;

    devLog('Execute SUCCESS', {
      duration: `${duration}ms`,
      affectedRows: Array.isArray(result) ? 'multiple statements' : result.affectedRows,
      insertId: Array.isArray(result) ? 'multiple' : result.insertId,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('[MySQL] Execute ERROR', {
      sql: truncateSql(sql),
      params: params || [],
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Get a single row from query result
 */
export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T[]>(sql, params);
  return rows[0] || null;
}

/**
 * Execute raw SQL (for complex queries with SET variables, transactions, etc.)
 * WARNING: Use with caution - this does not use prepared statements
 */
export async function queryRaw<T extends RowDataPacket[]>(
  sql: string
): Promise<T> {
  const client = getPool();
  const start = Date.now();

  devLog('Raw Query START', {
    sql: truncateSql(sql),
  });

  try {
    const [rows] = await client.query<T>(sql);
    const duration = Date.now() - start;

    devLog('Raw Query SUCCESS', {
      duration: `${duration}ms`,
      rowCount: Array.isArray(rows) ? rows.length : 0,
    });

    return rows;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('[MySQL] Raw Query ERROR', {
      sql: truncateSql(sql),
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Execute a transaction with multiple queries
 */
export async function transaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getPool().getConnection();
  const start = Date.now();

  devLog('Transaction START', {});

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    const duration = Date.now() - start;

    devLog('Transaction COMMIT', { duration: `${duration}ms` });

    return result;
  } catch (error) {
    await connection.rollback();
    const duration = Date.now() - start;

    console.error('[MySQL] Transaction ROLLBACK', {
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Close the pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Magento EAV attribute IDs
 * These are specific to the Miomente Magento installation
 */
export const MAGENTO_ATTRIBUTES = {
  // VARCHAR attributes (catalog_product_entity_varchar)
  NAME: 60,
  SUBTITLE: 548,
  LOCATION: 578,
  KEYWORD: 590,
  PARTICIPANTS: 588,
  OPERATOR_ID: 700,
  BEGIN_TIME: 717,
  END_TIME: 718,
  ORIGINAL_NAME: 719,
  SEATS: 720,
  IMAGE: 74,
  URL_KEY: 86,

  // INT attributes (catalog_product_entity_int)
  DATES: 525,
  STATUS: 84,
  VISIBILITY: 89,

  // DECIMAL attributes (catalog_product_entity_decimal)
  PRICE: 64,

  // TEXT attributes (catalog_product_entity_text)
  DESCRIPTION: 61,
  SHORT_DESCRIPTION: 62,
} as const;

export { getPool };
