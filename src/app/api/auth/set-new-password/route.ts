import { NextRequest, NextResponse } from 'next/server';
import { findUserByResetToken, updatePassword } from '@/lib/db/queries/users';
import { hashPassword } from '@/lib/auth/password';

/**
 * POST /api/auth/set-new-password
 *
 * Sets a new password using a valid reset token.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    // Validate input
    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Find user by reset token
    const user = await findUserByResetToken(token);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (user.reset_token_expires) {
      const expiresAt = new Date(user.reset_token_expires);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Reset token has expired' },
          { status: 400 }
        );
      }
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password);

    // Update password and clear reset token
    await updatePassword(user.id, hashedPassword);

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    console.error('[Set New Password] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred while setting the new password' },
      { status: 500 }
    );
  }
}
