/**
 * Partner customer numbers database queries (PostgreSQL)
 *
 * Manages the relationship between partners and Magento customer numbers.
 * A partner can have multiple customer numbers (one-to-many).
 */

import { queryOne, queryAll, query } from '../postgres';

export interface DbCustomerNumber {
  id: number;
  user_id: string;
  customer_number: string;
  label: string | null;
  is_primary: boolean;
  created_at: string;
  created_by: string | null;
}

export interface CreateCustomerNumberInput {
  userId: string;
  customerNumber: string;
  label?: string;
  isPrimary?: boolean;
  createdBy?: string;
}

/**
 * Get all customer numbers for a user
 */
export async function getCustomerNumbersByUser(userId: string): Promise<DbCustomerNumber[]> {
  return queryAll<DbCustomerNumber>(
    `SELECT * FROM miomente_partner_customer_numbers
     WHERE user_id = $1
     ORDER BY is_primary DESC, created_at ASC`,
    [userId]
  );
}

/**
 * Get a single customer number by ID
 */
export async function getCustomerNumberById(id: number): Promise<DbCustomerNumber | null> {
  return queryOne<DbCustomerNumber>(
    `SELECT * FROM miomente_partner_customer_numbers WHERE id = $1`,
    [id]
  );
}

/**
 * Add a customer number to a user
 */
export async function addCustomerNumber(input: CreateCustomerNumberInput): Promise<DbCustomerNumber | null> {
  // If this is marked as primary, unset other primary flags first
  if (input.isPrimary) {
    await query(
      `UPDATE miomente_partner_customer_numbers
       SET is_primary = false
       WHERE user_id = $1`,
      [input.userId]
    );
  }

  // If this is the first customer number for the user, make it primary
  const existing = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM miomente_partner_customer_numbers WHERE user_id = $1`,
    [input.userId]
  );
  const isFirst = parseInt(existing?.count || '0', 10) === 0;

  return queryOne<DbCustomerNumber>(
    `INSERT INTO miomente_partner_customer_numbers (
      user_id, customer_number, label, is_primary, created_by
    ) VALUES (
      $1, $2, $3, $4, $5
    ) RETURNING *`,
    [
      input.userId,
      input.customerNumber,
      input.label || null,
      input.isPrimary || isFirst,
      input.createdBy || null,
    ]
  );
}

/**
 * Update a customer number
 */
export async function updateCustomerNumber(
  id: number,
  updates: { customerNumber?: string; label?: string; isPrimary?: boolean }
): Promise<DbCustomerNumber | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (updates.customerNumber !== undefined) {
    setClauses.push(`customer_number = $${paramIndex++}`);
    params.push(updates.customerNumber);
  }

  if (updates.label !== undefined) {
    setClauses.push(`label = $${paramIndex++}`);
    params.push(updates.label);
  }

  if (updates.isPrimary !== undefined) {
    setClauses.push(`is_primary = $${paramIndex++}`);
    params.push(updates.isPrimary);

    // If setting as primary, unset others first
    if (updates.isPrimary) {
      const current = await getCustomerNumberById(id);
      if (current) {
        await query(
          `UPDATE miomente_partner_customer_numbers
           SET is_primary = false
           WHERE user_id = $1 AND id != $2`,
          [current.user_id, id]
        );
      }
    }
  }

  if (setClauses.length === 0) {
    return getCustomerNumberById(id);
  }

  params.push(id);

  return queryOne<DbCustomerNumber>(
    `UPDATE miomente_partner_customer_numbers
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    params
  );
}

/**
 * Remove a customer number
 */
export async function removeCustomerNumber(id: number): Promise<boolean> {
  const result = await query(
    `DELETE FROM miomente_partner_customer_numbers WHERE id = $1`,
    [id]
  );
  return (result.rowCount || 0) > 0;
}

/**
 * Check if a customer number exists for any user
 */
export async function customerNumberExists(customerNumber: string): Promise<boolean> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM miomente_partner_customer_numbers WHERE customer_number = $1`,
    [customerNumber]
  );
  return parseInt(result?.count || '0', 10) > 0;
}

/**
 * Get user by any of their customer numbers
 */
export async function getUserByCustomerNumber(customerNumber: string): Promise<{ user_id: string } | null> {
  return queryOne<{ user_id: string }>(
    `SELECT user_id FROM miomente_partner_customer_numbers WHERE customer_number = $1`,
    [customerNumber]
  );
}

/**
 * Get all customer numbers for display (with user info)
 */
export async function getAllCustomerNumbersWithUsers(): Promise<Array<DbCustomerNumber & { user_email: string; user_name: string }>> {
  return queryAll<DbCustomerNumber & { user_email: string; user_name: string }>(
    `SELECT cn.*, u.email as user_email, u.name as user_name
     FROM miomente_partner_customer_numbers cn
     JOIN miomente_partner_portal_users u ON cn.user_id = u.id
     ORDER BY u.name, cn.is_primary DESC`
  );
}

/**
 * Migrate existing customer_number from users table to new table
 * Call this once during migration
 */
export async function migrateExistingCustomerNumbers(): Promise<number> {
  const result = await query(
    `INSERT INTO miomente_partner_customer_numbers (user_id, customer_number, is_primary)
     SELECT id, customer_number, true
     FROM miomente_partner_portal_users
     WHERE customer_number IS NOT NULL
       AND customer_number != ''
       AND NOT EXISTS (
         SELECT 1 FROM miomente_partner_customer_numbers
         WHERE user_id = miomente_partner_portal_users.id
           AND customer_number = miomente_partner_portal_users.customer_number
       )`
  );
  return result.rowCount || 0;
}

/**
 * Transform database record to API response format
 */
export function transformCustomerNumber(dbRecord: DbCustomerNumber): {
  id: number;
  userId: string;
  customerNumber: string;
  label: string | null;
  isPrimary: boolean;
  createdAt: string;
  createdBy: string | null;
} {
  return {
    id: dbRecord.id,
    userId: dbRecord.user_id,
    customerNumber: dbRecord.customer_number,
    label: dbRecord.label,
    isPrimary: dbRecord.is_primary,
    createdAt: dbRecord.created_at,
    createdBy: dbRecord.created_by,
  };
}
