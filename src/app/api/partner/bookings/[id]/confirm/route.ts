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

      // Get related confirmation IDs from request body (for grouped bookings)
      let relatedIds: number[] = [bookingId];
      try {
        const body = await request.json();
        if (body.relatedConfirmationIds && Array.isArray(body.relatedConfirmationIds)) {
          // Verify all related IDs belong to the same partner
          for (const relatedId of body.relatedConfirmationIds) {
            if (relatedId === bookingId) continue;
            const related = await findBookingConfirmationById(relatedId);
            if (related && user.customerNumbers.includes(related.customer_number)) {
              relatedIds.push(relatedId);
            }
          }
        }
      } catch {
        // No body or invalid JSON - just confirm the single booking
      }

      // Confirm all related bookings
      const confirmedBookings = [];
      for (const idToConfirm of relatedIds) {
        const updated = await confirmBooking(idToConfirm, 'portal');
        if (updated) {
          confirmedBookings.push({
            id: updated.id,
            status: updated.status,
            confirmedAt: updated.confirmed_at,
            confirmedBy: updated.confirmed_by,
          });
        }
      }

      if (confirmedBookings.length === 0) {
        return NextResponse.json(
          { error: 'Failed to confirm booking' },
          { status: 500 }
        );
      }

      // TODO: Send confirmation email to customer

      return NextResponse.json({
        success: true,
        message: `Booking${confirmedBookings.length > 1 ? 's' : ''} confirmed successfully`,
        booking: confirmedBookings[0], // Primary booking
        confirmedCount: confirmedBookings.length,
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
