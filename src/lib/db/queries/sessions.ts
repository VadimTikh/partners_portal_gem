/**
 * Session database queries (PostgreSQL/Supabase)
 */

import { queryOne, query } from '../postgres';

export interface DbSession {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
  expires_at: string | null;
}

/**
 * Create a new session
 */
export async function createSession(
  userId: string,
  token: string,
  expiryDays: number = 14
): Promise<void> {
  await query(
    `INSERT INTO miomente_partner_portal_sessions (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '${expiryDays} days')`,
    [userId, token]
  );
}

/**
 * Find session by token
 */
export async function findSessionByToken(token: string): Promise<DbSession | null> {
  return queryOne<DbSession>(
    `SELECT id, user_id, token, created_at, expires_at
     FROM miomente_partner_portal_sessions
     WHERE token = $1
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [token]
  );
}

/**
 * Delete a session by token (logout)
 */
export async function deleteSession(token: string): Promise<void> {
  await query(
    `DELETE FROM miomente_partner_portal_sessions
     WHERE token = $1`,
    [token]
  );
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await query(
    `DELETE FROM miomente_partner_portal_sessions
     WHERE user_id = $1`,
    [userId]
  );
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await query(
    `DELETE FROM miomente_partner_portal_sessions
     WHERE expires_at IS NOT NULL AND expires_at < NOW()`
  );
  return result.rowCount || 0;
}

/**
 * Extend session expiry
 */
export async function extendSession(token: string, expiryDays: number = 14): Promise<void> {
  await query(
    `UPDATE miomente_partner_portal_sessions
     SET expires_at = NOW() + INTERVAL '${expiryDays} days'
     WHERE token = $1`,
    [token]
  );
}
