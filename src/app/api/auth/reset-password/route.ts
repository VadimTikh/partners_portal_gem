import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching
export const dynamic = 'force-dynamic';
import { findUserByEmail, updateResetToken } from '@/lib/db/queries/users';
import { generateResetToken } from '@/lib/auth/jwt';
import { sendEmail } from '@/lib/email';
import {
  getResetPasswordEmailHtml,
  getResetPasswordEmailSubject,
} from '@/lib/email/templates/reset-password';
import { config } from '@/lib/config';
import { logPasswordResetRequested, getIpFromRequest } from '@/lib/services/activity-logger';

/**
 * POST /api/auth/reset-password
 *
 * Initiates password reset process.
 * Generates a reset token and sends an email.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await findUserByEmail(email.toLowerCase().trim());

    // Always return success to prevent email enumeration attacks
    // But only send email if user exists
    if (user) {
      // Generate reset token (expires in 1 hour)
      const resetToken = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save reset token to database
      await updateResetToken(user.id, resetToken, expiresAt);

      // Send reset email
      const emailHtml = getResetPasswordEmailHtml({
        name: user.name,
        resetToken,
        appUrl: config.appUrl,
      });

      await sendEmail({
        to: user.email,
        toName: user.name,
        subject: getResetPasswordEmailSubject(),
        html: emailHtml,
      });

      // Log activity
      await logPasswordResetRequested(
        { id: user.id, email: user.email, name: user.name },
        getIpFromRequest(request)
      );
    }

    // Always return success (security best practice)
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('[Reset Password] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
