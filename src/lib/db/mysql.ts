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
      // SSL for production
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : undefined,
    });
  }

  return pool;
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

  try {
    const [rows] = await client.execute<T>(sql, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('[MySQL] Query executed', {
        duration: `${duration}ms`,
        rows: Array.isArray(rows) ? rows.length : 0,
      });
    }

    return rows;
  } catch (error) {
    console.error('[MySQL] Query error:', error);
    throw error;
  }
}

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 */
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<ResultSetHeader> {
  const client = getPool();
  const start = Date.now();

  try {
    const [result] = await client.execute<ResultSetHeader>(sql, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('[MySQL] Execute completed', {
        duration: `${duration}ms`,
        affectedRows: result.affectedRows,
        insertId: result.insertId,
      });
    }

    return result;
  } catch (error) {
    console.error('[MySQL] Execute error:', error);
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

  try {
    const [rows] = await client.query<T>(sql);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('[MySQL] Raw query executed', {
        duration: `${duration}ms`,
      });
    }

    return rows;
  } catch (error) {
    console.error('[MySQL] Raw query error:', error);
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

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
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
