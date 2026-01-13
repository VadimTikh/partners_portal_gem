/**
 * Password hashing utilities using bcrypt
 */

import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 * Returns true if the password matches the hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check if a password meets minimum requirements
 * - At least 8 characters
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

/**
 * Legacy password verification (plain text comparison)
 * Used for migrating from n8n where passwords were stored in plain text
 * TODO: Remove this after migrating all users to hashed passwords
 */
export function verifyLegacyPassword(
  password: string,
  storedPassword: string
): boolean {
  return password === storedPassword;
}

/**
 * Check if a stored password is a bcrypt hash
 * Bcrypt hashes start with $2a$, $2b$, or $2y$
 */
export function isHashedPassword(storedPassword: string): boolean {
  return /^\$2[aby]\$\d+\$/.test(storedPassword);
}

/**
 * Verify password - handles both hashed and legacy plain text passwords
 */
export async function verifyPasswordCompat(
  password: string,
  storedPassword: string
): Promise<boolean> {
  if (isHashedPassword(storedPassword)) {
    return verifyPassword(password, storedPassword);
  }
  // Legacy plain text comparison
  return verifyLegacyPassword(password, storedPassword);
}
