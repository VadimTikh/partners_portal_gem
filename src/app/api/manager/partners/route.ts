import { NextRequest, NextResponse } from 'next/server';
import { withManager } from '@/lib/auth/middleware';
import { getAllPortalPartners } from '@/lib/db/queries/partners';
import { createUser, emailExists } from '@/lib/db/queries/users';
import { addCustomerNumber } from '@/lib/db/queries/customer-numbers';
import { hashPassword } from '@/lib/auth/password';
import crypto from 'crypto';

/**
 * GET /api/manager/partners
 *
 * Get all partners (manager only).
 * Returns portal users who are partners with their aggregated stats.
 */
export async function GET(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const portalPartners = await getAllPortalPartners();

      // Transform to expected API format
      const partners = portalPartners.map(partner => ({
        id: partner.id,
        name: partner.name,
        email: partner.email,
        customerNumbers: partner.customerNumbers,
        coursesCount: partner.coursesCount,
        activeCoursesCount: partner.activeCoursesCount,
        availableDatesCount: partner.availableDatesCount,
        pendingRequestsCount: partner.pendingRequestsCount,
      }));

      return NextResponse.json({
        success: true,
        partners,
      });
    } catch (error) {
      console.error('[Get Partners] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch partners' },
        { status: 500 }
      );
    }
  });
}

/**
 * Generate a secure random password
 */
function generatePassword(length: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

/**
 * POST /api/manager/partners
 *
 * Create a new partner (manager only).
 * Required fields: name, email, customerNumbers (array)
 * Returns the generated password (shown once).
 */
export async function POST(request: NextRequest) {
  return withManager(request, async (req, manager) => {
    try {
      const body = await req.json();
      const { name, email, customerNumbers } = body;

      // Validate required fields
      if (!name || !name.trim()) {
        return NextResponse.json(
          { error: 'Name is required' },
          { status: 400 }
        );
      }

      if (!email || !email.trim()) {
        return NextResponse.json(
          { error: 'Email is required' },
          { status: 400 }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }

      if (!customerNumbers || !Array.isArray(customerNumbers) || customerNumbers.length === 0) {
        return NextResponse.json(
          { error: 'At least one customer number is required' },
          { status: 400 }
        );
      }

      // Check if email already exists
      const exists = await emailExists(email.trim());
      if (exists) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }

      // Generate password
      const plainPassword = generatePassword(12);
      const hashedPassword = await hashPassword(plainPassword);

      // Create user
      const newUser = await createUser({
        email: email.trim(),
        name: name.trim(),
        password: hashedPassword,
        isManager: false,
      });

      if (!newUser) {
        return NextResponse.json(
          { error: 'Failed to create partner' },
          { status: 500 }
        );
      }

      // Add customer numbers
      for (let i = 0; i < customerNumbers.length; i++) {
        const cn = customerNumbers[i];
        if (cn && cn.trim()) {
          await addCustomerNumber({
            userId: newUser.id,
            customerNumber: cn.trim(),
            isPrimary: i === 0, // First one is primary
            createdBy: manager.userId,
          });
        }
      }

      return NextResponse.json({
        success: true,
        partner: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
        generatedPassword: plainPassword, // Show only once
      });
    } catch (error) {
      console.error('[Create Partner] Error:', error);
      return NextResponse.json(
        { error: 'Failed to create partner' },
        { status: 500 }
      );
    }
  });
}
