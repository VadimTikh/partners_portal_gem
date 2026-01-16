import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/db/queries/users';
import { createSession } from '@/lib/db/queries/sessions';
import { verifyPasswordCompat } from '@/lib/auth/password';
import { generateSessionToken } from '@/lib/auth/jwt';

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password.
 * Returns user data and creates a session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await findUserByEmail(email.toLowerCase().trim());

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password (supports both bcrypt and legacy plain text)
    const isValid = await verifyPasswordCompat(password, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate session token
    const token = generateSessionToken(user.email);

    // Create session in database
    await createSession(user.id, token);

    // Return user data (without password)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        customerNumber: user.customer_number,
        isManager: user.is_manager,
      },
      token,
    });
  } catch (error) {
    console.error('[Login] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
