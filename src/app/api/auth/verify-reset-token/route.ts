import { NextRequest, NextResponse } from 'next/server';
import { findUserByResetToken } from '@/lib/db/queries/users';

/**
 * POST /api/auth/verify-reset-token
 *
 * Verifies that a password reset token is valid and not expired.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    // Validate input
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Find user by reset token
    const user = await findUserByResetToken(token);

    if (!user) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (user.reset_token_expires) {
      const expiresAt = new Date(user.reset_token_expires);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { valid: false, error: 'Reset token has expired' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      valid: true,
      email: user.email,
    });
  } catch (error) {
    console.error('[Verify Reset Token] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred while verifying the token' },
      { status: 500 }
    );
  }
}
