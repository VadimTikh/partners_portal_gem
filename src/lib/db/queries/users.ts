/**
 * User database queries (PostgreSQL/Supabase)
 */

import { queryOne, queryAll, query } from '../postgres';

export interface DbUser {
  id: string;
  email: string;
  name: string;
  password: string;
  customer_number: string | null;
  is_manager: boolean;
  created_at: string;
  reset_token: string | null;
  reset_token_expires: string | null;
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<DbUser | null> {
  return queryOne<DbUser>(
    `SELECT id, email, name, password, customer_number, is_manager, created_at, reset_token, reset_token_expires
     FROM miomente_partner_portal_users
     WHERE LOWER(email) = $1`,
    [email.toLowerCase()]
  );
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<DbUser | null> {
  return queryOne<DbUser>(
    `SELECT id, email, name, password, customer_number, is_manager, created_at, reset_token, reset_token_expires
     FROM miomente_partner_portal_users
     WHERE id = $1`,
    [id]
  );
}

/**
 * Find user by reset token
 */
export async function findUserByResetToken(token: string): Promise<DbUser | null> {
  return queryOne<DbUser>(
    `SELECT id, email, name, password, customer_number, is_manager, created_at, reset_token, reset_token_expires
     FROM miomente_partner_portal_users
     WHERE reset_token = $1`,
    [token]
  );
}

/**
 * Update user's reset token
 */
export async function updateResetToken(
  userId: string,
  resetToken: string,
  expiresAt: Date
): Promise<void> {
  await query(
    `UPDATE miomente_partner_portal_users
     SET reset_token = $1, reset_token_expires = $2
     WHERE id = $3`,
    [resetToken, expiresAt.toISOString(), userId]
  );
}

/**
 * Update user's password
 */
export async function updatePassword(
  userId: string,
  newPassword: string
): Promise<void> {
  await query(
    `UPDATE miomente_partner_portal_users
     SET password = $1, reset_token = NULL, reset_token_expires = NULL
     WHERE id = $2`,
    [newPassword, userId]
  );
}

/**
 * Clear reset token after password change
 */
export async function clearResetToken(userId: string): Promise<void> {
  await query(
    `UPDATE miomente_partner_portal_users
     SET reset_token = NULL, reset_token_expires = NULL
     WHERE id = $1`,
    [userId]
  );
}

/**
 * Get all partners (non-manager users) from PostgreSQL
 * Note: For Magento partner data, use getAllPartners from ./partners.ts
 */
export async function getAllPartnerUsers(): Promise<DbUser[]> {
  return queryAll<DbUser>(
    `SELECT id, email, name, password, customer_number, is_manager, created_at, reset_token, reset_token_expires
     FROM miomente_partner_portal_users
     WHERE is_manager = false
     ORDER BY name`
  );
}

/**
 * Create a new user (partner)
 */
export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  isManager?: boolean;
}): Promise<DbUser | null> {
  return queryOne<DbUser>(
    `INSERT INTO miomente_partner_portal_users (email, name, password, is_manager)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, password, customer_number, is_manager, created_at, reset_token, reset_token_expires`,
    [input.email, input.name, input.password, input.isManager || false]
  );
}

/**
 * Check if email already exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM miomente_partner_portal_users WHERE LOWER(email) = $1`,
    [email.toLowerCase()]
  );
  return parseInt(result?.count || '0', 10) > 0;
}
