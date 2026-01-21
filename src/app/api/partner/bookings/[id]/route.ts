import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/middleware';
import { findBookingConfirmationById } from '@/lib/db/queries/bookings';
import { getOrderItem, transformOrder } from '@/lib/db/queries/orders';
import { Booking } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/partner/bookings/[id]
 *
 * Get a single booking by confirmation ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

      // Get order data from Magento
      const order = await getOrderItem(
        confirmation.magento_order_id,
        confirmation.magento_order_item_id,
        user.customerNumbers
      );

      if (!order) {
        return NextResponse.json(
          { error: 'Order not found in Magento' },
          { status: 404 }
        );
      }

      const transformed = transformOrder(order);

      const booking: Booking = {
        id: confirmation.id,
        magentoOrderId: order.order_id,
        magentoOrderItemId: order.order_item_id,
        orderNumber: transformed.orderNumber,
        customer: transformed.customer,
        course: transformed.course,
        eventDate: transformed.eventDate,
        eventTime: transformed.eventTime,
        participants: transformed.participants,
        price: transformed.price,
        currency: 'EUR',
        status: confirmation.status,
        confirmationStatus: {
          confirmedAt: confirmation.confirmed_at || undefined,
          confirmedBy: confirmation.confirmed_by || undefined,
          declinedAt: confirmation.declined_at || undefined,
          declinedBy: confirmation.declined_by || undefined,
          declineReason: confirmation.decline_reason || undefined,
          declineNotes: confirmation.decline_notes || undefined,
        },
        reminderCount: confirmation.reminder_count,
        lastReminderAt: confirmation.last_reminder_at || undefined,
        escalatedAt: confirmation.escalated_at || undefined,
        odooTicketId: confirmation.odoo_ticket_id || undefined,
        orderDate: transformed.orderDate,
        paymentStatus: transformed.orderStatus,
        createdAt: confirmation.created_at,
        updatedAt: confirmation.updated_at,
      };

      return NextResponse.json({
        success: true,
        booking,
      });
    } catch (error) {
      console.error('[Get Booking] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch booking' },
        { status: 500 }
      );
    }
  });
}
