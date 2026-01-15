/**
 * JWT token utilities for authentication
 */

import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  role: 'partner' | 'manager';
  customerNumber?: string;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return jwt.sign(payload, secret, {
    expiresIn: '14d', // Match the session expiry from n8n
    algorithm: 'HS256',
  });
}

/**
 * Verify and decode a JWT token
 * Returns null if token is invalid or expired
 */
export function verifyToken(token: string): TokenPayload | null {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    });

    return decoded as TokenPayload;
  } catch (error) {
    // Token is invalid, expired, or tampered with
    if (process.env.NODE_ENV === 'development') {
      console.log('[JWT] Token verification failed:', (error as Error).message);
    }
    return null;
  }
}

/**
 * Decode a token without verification (for debugging)
 * WARNING: Do not use for authentication - use verifyToken instead
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as TokenPayload | null;
  } catch {
    return null;
  }
}

/**
 * Generate a random token for password reset
 */
export function generateResetToken(): string {
  const chars = 'abcdef0123456789';
  return Array.from(
    { length: 64 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/**
 * Generate a simple session token (for database storage)
 * Format: {email_prefix}-{timestamp}-{random}
 * This matches the n8n implementation for compatibility
 */
export function generateSessionToken(email: string): string {
  const emailPrefix = email.split('@')[0];
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${emailPrefix}-${timestamp}-${random}`;
}
