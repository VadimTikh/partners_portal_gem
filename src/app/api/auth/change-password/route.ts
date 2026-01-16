import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching
export const dynamic = 'force-dynamic';
import { findUserById, updatePassword } from '@/lib/db/queries/users';
import { withAuth } from '@/lib/auth/middleware';
import { hashPassword, verifyPasswordCompat } from '@/lib/auth/password';
import { logPasswordChanged, getIpFromRequest } from '@/lib/services/activity-logger';
import { createRequestLogger } from '@/lib/services/app-logger';

/**
 * POST /api/auth/change-password
 *
 * Changes password for an authenticated user.
 * Requires current password verification.
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, authenticatedUser) => {
    const logger = createRequestLogger(request, 'auth.change-password', {
      userId: authenticatedUser.userId,
      userEmail: authenticatedUser.email,
      userRole: authenticatedUser.role,
    });

    try {
      const body = await req.json();
      const { password, newPassword } = body;

      // Validate input
      if (!password || !newPassword) {
        logger.validationError('Current password and new password are required');
        return NextResponse.json(
          { error: 'Current password and new password are required' },
          { status: 400 }
        );
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        logger.validationError('New password must be at least 8 characters long');
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long' },
          { status: 400 }
        );
      }

      // Get full user data (including password hash)
      const user = await findUserById(authenticatedUser.userId);

      if (!user) {
        logger.error('User not found', undefined, 404, 'USER_NOT_FOUND');
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Verify current password
      const isValid = await verifyPasswordCompat(password, user.password);

      if (!isValid) {
        logger.error('Current password is incorrect', undefined, 400, 'INVALID_PASSWORD');
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

      const responseData = {
        success: true,
        message: 'Password changed successfully',
      };

      logger.success(responseData);

      return NextResponse.json(responseData);
    } catch (error) {
      console.error('[Change Password] Error:', error);
      logger.error(error instanceof Error ? error : String(error), undefined, 500);
      return NextResponse.json(
        { error: 'An error occurred while changing the password' },
        { status: 500 }
      );
    }
  });
}
