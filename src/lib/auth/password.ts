/**
 * Password hashing utilities using SHA256 (n8n compatible)
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Hash a password using SHA256 (HEX, no salt) - n8n compatible
 */
export async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verify a password against a SHA256 hash
 * Returns true if the password matches the hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const inputHash = crypto.createHash('sha256').update(password).digest('hex');
  return inputHash === hash;
}

/**
 * Verify a password against a bcrypt hash (legacy support)
 */
export async function verifyBcryptPassword(
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
export function isBcryptHash(storedPassword: string): boolean {
  return /^\$2[aby]\$\d+\$/.test(storedPassword);
}

/**
 * Check if a stored password is a SHA256 hash (64 hex characters)
 */
export function isSha256Hash(storedPassword: string): boolean {
  return /^[a-f0-9]{64}$/i.test(storedPassword);
}

/**
 * Verify password - handles SHA256, bcrypt (legacy), and plain text passwords
 */
export async function verifyPasswordCompat(
  password: string,
  storedPassword: string
): Promise<boolean> {
  // SHA256 hash (current method)
  if (isSha256Hash(storedPassword)) {
    return verifyPassword(password, storedPassword);
  }
  // Bcrypt hash (legacy)
  if (isBcryptHash(storedPassword)) {
    return verifyBcryptPassword(password, storedPassword);
  }
  // Plain text comparison (very old legacy)
  return verifyLegacyPassword(password, storedPassword);
}
