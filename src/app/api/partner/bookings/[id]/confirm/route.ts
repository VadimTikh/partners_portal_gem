import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/middleware';
import {
  findBookingConfirmationById,
  confirmBooking,
} from '@/lib/db/queries/bookings';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/partner/bookings/[id]/confirm
 *
 * Confirm a booking via the portal (authenticated).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (_req, user) => {
    try {
      const { id } = await params;
      const bookingId = parseInt(id, 10);

      if (isNaN(bookingId)) {
        return NextResponse.json(
          { error: 'Invalid booking ID' },
          { status: 400 }
        );
      }

      if (user.customerNumbers.length === 0) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      // Get confirmation record
      const confirmation = await findBookingConfirmationById(bookingId);
      if (!confirmation) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }

      // Verify partner owns this booking
      if (!user.customerNumbers.includes(confirmation.customer_number)) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }

      // Check if already processed
      if (confirmation.status !== 'pending') {
        return NextResponse.json(
          {
            error: 'Booking already processed',
            message: `This booking has already been ${confirmation.status}`,
          },
          { status: 400 }
        );
      }

      // Confirm the booking
      const updated = await confirmBooking(bookingId, 'portal');

      if (!updated) {
        return NextResponse.json(
          { error: 'Failed to confirm booking' },
          { status: 500 }
        );
      }

      // TODO: Send confirmation email to customer

      return NextResponse.json({
        success: true,
        message: 'Booking confirmed successfully',
        booking: {
          id: updated.id,
          status: updated.status,
          confirmedAt: updated.confirmed_at,
          confirmedBy: updated.confirmed_by,
        },
      });
    } catch (error) {
      console.error('[Confirm Booking] Error:', error);
      return NextResponse.json(
        { error: 'Failed to confirm booking' },
        { status: 500 }
      );
    }
  });
}
