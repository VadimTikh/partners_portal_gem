import { NextRequest, NextResponse } from 'next/server';
import { withManager } from '@/lib/auth/middleware';
import {
  getCustomerNumberById,
  updateCustomerNumber,
  removeCustomerNumber,
  transformCustomerNumber,
} from '@/lib/db/queries/customer-numbers';
import { query } from '@/lib/db/postgres';

interface RouteParams {
  params: Promise<{ id: string; cnId: string }>;
}

/**
 * PATCH /api/manager/partners/[id]/customer-numbers/[cnId]
 *
 * Update a customer number (label, isPrimary).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async (req) => {
    try {
      const { id, cnId } = await params;
      const customerNumberId = parseInt(cnId, 10);

      if (isNaN(customerNumberId)) {
        return NextResponse.json(
          { error: 'Invalid customer number ID' },
          { status: 400 }
        );
      }

      // Verify ownership
      const existing = await getCustomerNumberById(customerNumberId);
      if (!existing || existing.user_id !== id) {
        return NextResponse.json(
          { error: 'Customer number not found' },
          { status: 404 }
        );
      }

      const body = await req.json();
      const { label, isPrimary } = body;

      const updated = await updateCustomerNumber(customerNumberId, {
        label,
        isPrimary,
      });

      if (!updated) {
        return NextResponse.json(
          { error: 'Failed to update customer number' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        customerNumber: transformCustomerNumber(updated),
      });
    } catch (error) {
      console.error('[Update Customer Number] Error:', error);
      return NextResponse.json(
        { error: 'Failed to update customer number' },
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/manager/partners/[id]/customer-numbers/[cnId]
 *
 * Remove a customer number from a partner.
 * If cnId is -1, it's a legacy customer number (from users table only).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async () => {
    try {
      const { id, cnId } = await params;
      const customerNumberId = parseInt(cnId, 10);

      if (isNaN(customerNumberId)) {
        return NextResponse.json(
          { error: 'Invalid customer number ID' },
          { status: 400 }
        );
      }

      // Handle legacy customer number (id = -1)
      if (customerNumberId === -1) {
        // Just clear the legacy field
        await query(
          `UPDATE miomente_partner_portal_users
           SET customer_number = NULL
           WHERE id = $1`,
          [id]
        );

        return NextResponse.json({
          success: true,
          message: 'Legacy customer number removed',
        });
      }

      // Verify ownership
      const existing = await getCustomerNumberById(customerNumberId);
      if (!existing || existing.user_id !== id) {
        return NextResponse.json(
          { error: 'Customer number not found' },
          { status: 404 }
        );
      }

      // Store the customer number value before deleting
      const customerNumberValue = existing.customer_number;

      const deleted = await removeCustomerNumber(customerNumberId);

      if (!deleted) {
        return NextResponse.json(
          { error: 'Failed to remove customer number' },
          { status: 500 }
        );
      }

      // Also clear the legacy customer_number field if it matches
      await query(
        `UPDATE miomente_partner_portal_users
         SET customer_number = NULL
         WHERE id = $1 AND customer_number = $2`,
        [id, customerNumberValue]
      );

      return NextResponse.json({
        success: true,
        message: 'Customer number removed',
      });
    } catch (error) {
      console.error('[Remove Customer Number] Error:', error);
      return NextResponse.json(
        { error: 'Failed to remove customer number' },
        { status: 500 }
      );
    }
  });
}
