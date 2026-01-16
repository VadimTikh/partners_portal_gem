import { NextRequest, NextResponse } from 'next/server';
import { withManager } from '@/lib/auth/middleware';
import { queryOne } from '@/lib/db/postgres';
import { getCustomerNumbersByUser, transformCustomerNumber } from '@/lib/db/queries/customer-numbers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface DbUser {
  id: string;
  email: string;
  name: string;
  customer_number: string | null;
}

/**
 * GET /api/manager/partners/[id]/users
 *
 * Get the partner user and their customer numbers.
 * The partner ID is the portal user's UUID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async () => {
    try {
      const { id: partnerId } = await params;

      // Get the partner user by UUID (including legacy customer_number field)
      const user = await queryOne<DbUser>(
        `SELECT id, email, name, customer_number
         FROM miomente_partner_portal_users
         WHERE id = $1`,
        [partnerId]
      );

      if (!user) {
        return NextResponse.json(
          { error: 'Partner not found' },
          { status: 404 }
        );
      }

      // Get their customer numbers from new table
      const customerNumberRecords = await getCustomerNumbersByUser(user.id);
      const customerNumbers = customerNumberRecords.map(transformCustomerNumber);

      // Check if legacy customer_number exists and is not in the new table
      if (user.customer_number) {
        const existsInNewTable = customerNumbers.some(
          cn => cn.customerNumber === user.customer_number
        );
        if (!existsInNewTable) {
          // Add legacy customer number with a special indicator
          customerNumbers.unshift({
            id: -1, // Special ID to indicate legacy
            userId: user.id,
            customerNumber: user.customer_number,
            label: '(Legacy)',
            isPrimary: customerNumbers.length === 0,
            createdAt: '',
            createdBy: null,
          });
        }
      }

      return NextResponse.json({
        success: true,
        users: [{
          id: user.id,
          email: user.email,
          name: user.name,
          customerNumbers,
        }],
      });
    } catch (error) {
      console.error('[Get Partner Users] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch partner users' },
        { status: 500 }
      );
    }
  });
}
