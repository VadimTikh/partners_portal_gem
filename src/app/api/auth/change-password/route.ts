import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching
export const dynamic = 'force-dynamic';
import { findUserById, updatePassword } from '@/lib/db/queries/users';
import { withAuth } from '@/lib/auth/middleware';
import { hashPassword, verifyPasswordCompat } from '@/lib/auth/password';
import { logPasswordChanged, getIpFromRequest } from '@/lib/services/activity-logger';

/**
 * POST /api/auth/change-password
 *
 * Changes password for an authenticated user.
 * Requires current password verification.
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, authenticatedUser) => {
    try {
      const body = await req.json();
      const { password, newPassword } = body;

      // Validate input
      if (!password || !newPassword) {
        return NextResponse.json(
          { error: 'Current password and new password are required' },
          { status: 400 }
        );
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long' },
          { status: 400 }
        );
      }

      // Get full user data (including password hash)
      const user = await findUserById(authenticatedUser.userId);

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Verify current password
      const isValid = await verifyPasswordCompat(password, user.password);

      if (!isValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      await updatePassword(user.id, hashedPassword);

      // Log activity
      await logPasswordChanged(
        { id: user.id, email: user.email, name: user.name },
        getIpFromRequest(request)
      );

      return NextResponse.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      console.error('[Change Password] Error:', error);
      return NextResponse.json(
        { error: 'An error occurred while changing the password' },
        { status: 500 }
      );
    }
  });
}
