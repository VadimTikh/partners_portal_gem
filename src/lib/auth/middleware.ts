/**
 * Authentication middleware for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '../db/postgres';
import { getCustomerNumbersByUser } from '../db/queries/customer-numbers';

/**
 * Authenticated user information available in protected routes
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  role: 'partner' | 'manager';
  customerNumber: string | null;  // Primary/legacy (kept for backwards compatibility)
  customerNumbers: string[];      // All assigned customer numbers
  isManager: boolean;
  isPartner: boolean;
}

/**
 * Database user row type
 */
interface UserRow {
  id: string;
  email: string;
  name: string;
  customer_number: string | null;
  is_manager: boolean;
}

/**
 * Extract bearer token from Authorization header
 */
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;

  return token;
}

/**
 * Verify user session in database
 */
async function verifySession(token: string): Promise<UserRow | null> {
  const user = await queryOne<UserRow>(
    `SELECT u.id, u.email, u.name, u.customer_number, u.is_manager
     FROM miomente_partner_portal_sessions s
     JOIN miomente_partner_portal_users u ON u.id = s.user_id
     WHERE s.token = $1
       AND (s.expires_at IS NULL OR s.expires_at > NOW())`,
    [token]
  );

  return user;
}

/**
 * Authentication options
 */
interface AuthOptions {
  requireManager?: boolean;
}

/**
 * Higher-order function to protect API routes with authentication
 *
 * Usage:
 * ```ts
 * export async function GET(request: NextRequest) {
 *   return withAuth(request, async (req, user) => {
 *     // user is guaranteed to be authenticated
 *     return NextResponse.json({ user });
 *   });
 * }
 * ```
 */
export async function withAuth(
  request: NextRequest,
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  options: AuthOptions = {}
): Promise<NextResponse> {
  try {
    // Extract token from header
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No authentication token provided' },
        { status: 401 }
      );
    }

    // Verify session in database (session token is stored directly, not as JWT)
    const dbUser = await verifySession(token);
    if (!dbUser) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Session not found or expired' },
        { status: 401 }
      );
    }

    // Check manager role if required
    if (options.requireManager && !dbUser.is_manager) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Manager role required' },
        { status: 403 }
      );
    }

    // Fetch all customer numbers for this user
    const customerNumberRecords = await getCustomerNumbersByUser(dbUser.id);
    const customerNumbers = customerNumberRecords.map(cn => cn.customer_number);

    // Include legacy customer_number field if not already in the list
    if (dbUser.customer_number && !customerNumbers.includes(dbUser.customer_number)) {
      customerNumbers.push(dbUser.customer_number);
    }

    // Build authenticated user object
    const user: AuthenticatedUser = {
      userId: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.is_manager ? 'manager' : 'partner',
      customerNumber: dbUser.customer_number,
      customerNumbers,
      isManager: dbUser.is_manager,
      isPartner: !dbUser.is_manager,
    };

    // Call the protected handler
    return await handler(request, user);
  } catch (error) {
    console.error('[Auth Middleware] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * Convenience wrapper for manager-only routes
 */
export async function withManager(
  request: NextRequest,
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, handler, { requireManager: true });
}

/**
 * Get authenticated user from request without blocking
 * Returns null if not authenticated (useful for optional auth)
 */
export async function getAuthUser(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  try {
    const token = extractToken(request);
    if (!token) return null;

    const dbUser = await verifySession(token);
    if (!dbUser) return null;

    // Fetch all customer numbers for this user
    const customerNumberRecords = await getCustomerNumbersByUser(dbUser.id);
    const customerNumbers = customerNumberRecords.map(cn => cn.customer_number);

    // Include legacy customer_number field if not already in the list
    if (dbUser.customer_number && !customerNumbers.includes(dbUser.customer_number)) {
      customerNumbers.push(dbUser.customer_number);
    }

    return {
      userId: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.is_manager ? 'manager' : 'partner',
      customerNumber: dbUser.customer_number,
      customerNumbers,
      isManager: dbUser.is_manager,
      isPartner: !dbUser.is_manager,
    };
  } catch {
    return null;
  }
}
