/**
 * Booking token generation and validation service
 *
 * Generates cryptographically secure tokens for email-based
 * booking confirmations and declines.
 */

import crypto from 'crypto';

// Token configuration
const TOKEN_LENGTH = 32; // 32 bytes = 64 hex characters
const TOKEN_EXPIRY_DAYS = 7; // Tokens expire after 7 days

/**
 * Generate a cryptographically secure token for booking confirmation
 *
 * @returns A 64-character hexadecimal token
 */
export function generateConfirmationToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Calculate token expiration date
 *
 * @param days Number of days until expiration (default: 7)
 * @returns ISO timestamp string of expiration date
 */
export function calculateTokenExpiry(days: number = TOKEN_EXPIRY_DAYS): string {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate.toISOString();
}

/**
 * Check if a token has expired
 *
 * @param expiryDate ISO timestamp string of expiration
 * @returns true if expired, false if still valid
 */
export function isTokenExpired(expiryDate: string): boolean {
  return new Date(expiryDate) < new Date();
}

/**
 * Generate a complete token set for a new booking confirmation
 *
 * @returns Object containing token and expiry timestamp
 */
export function generateTokenSet(): { token: string; expiresAt: string } {
  return {
    token: generateConfirmationToken(),
    expiresAt: calculateTokenExpiry(),
  };
}

/**
 * Generate a URL-safe token for email links
 * Uses base64url encoding instead of hex for shorter URLs
 *
 * @returns A URL-safe base64 encoded token (43 characters)
 */
export function generateUrlSafeToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('base64url');
}

/**
 * Build confirmation URL for email links
 *
 * @param token The confirmation token
 * @param baseUrl The base URL of the portal
 * @returns Full confirmation URL
 */
export function buildConfirmationUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/api/booking/confirm/${token}`;
}

/**
 * Build decline URL for email links
 * Decline redirects to portal for reason selection
 *
 * @param token The confirmation token
 * @param baseUrl The base URL of the portal
 * @returns Full decline URL
 */
export function buildDeclineUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/api/booking/decline/${token}`;
}

/**
 * Validate token format
 *
 * @param token Token to validate
 * @returns true if valid format, false otherwise
 */
export function isValidTokenFormat(token: string): boolean {
  // Hex token: exactly 64 hex characters
  const hexPattern = /^[a-f0-9]{64}$/i;
  // Base64url token: approximately 43 characters
  const base64urlPattern = /^[A-Za-z0-9_-]{43}$/;

  return hexPattern.test(token) || base64urlPattern.test(token);
}

/**
 * Generate a short reference code for display purposes
 * This is NOT for authentication, just for human reference
 *
 * @returns A 6-character uppercase alphanumeric code
 */
export function generateReferenceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0, O, 1, I)
  let code = '';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}
