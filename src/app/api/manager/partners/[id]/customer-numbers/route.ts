import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import {
  getCustomerNumbersByUser,
  addCustomerNumber,
  transformCustomerNumber,
  customerNumberExists,
} from '@/lib/db/queries/customer-numbers';
import { findUserById } from '@/lib/db/queries/users';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/manager/partners/[id]/customer-numbers
 *
 * Get all customer numbers for a partner.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async () => {
    try {
      const { id } = await params;

      // Verify user exists
      const user = await findUserById(id);
      if (!user) {
        return NextResponse.json(
          { error: 'Partner not found' },
          { status: 404 }
        );
      }

      const customerNumbers = await getCustomerNumbersByUser(id);

      return NextResponse.json({
        success: true,
        customerNumbers: customerNumbers.map(transformCustomerNumber),
      });
    } catch (error) {
      console.error('[Get Customer Numbers] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch customer numbers' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/manager/partners/[id]/customer-numbers
 *
 * Add a customer number to a partner.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async (req, manager) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const { customerNumber, label, isPrimary } = body;

      if (!customerNumber) {
        return NextResponse.json(
          { error: 'Customer number is required' },
          { status: 400 }
        );
      }

      // Verify user exists
      const user = await findUserById(id);
      if (!user) {
        return NextResponse.json(
          { error: 'Partner not found' },
          { status: 404 }
        );
      }

      // Check if customer number already exists
      const exists = await customerNumberExists(customerNumber);
      if (exists) {
        return NextResponse.json(
          { error: 'Customer number is already assigned to a partner' },
          { status: 400 }
        );
      }

      const newCustomerNumber = await addCustomerNumber({
        userId: id,
        customerNumber,
        label,
        isPrimary,
        createdBy: manager.userId,
      });

      if (!newCustomerNumber) {
        return NextResponse.json(
          { error: 'Failed to add customer number' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        customerNumber: transformCustomerNumber(newCustomerNumber),
      });
    } catch (error) {
      console.error('[Add Customer Number] Error:', error);
      return NextResponse.json(
        { error: 'Failed to add customer number' },
        { status: 500 }
      );
    }
  });
}
