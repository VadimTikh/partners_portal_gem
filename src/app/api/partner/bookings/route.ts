import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/middleware';
import {
  getBookingConfirmationsByCustomerNumbers,
  getBookingStats,
  getOrCreateBookingConfirmation,
  getActiveDeclineReasons,
} from '@/lib/db/queries/bookings';
import {
  getOrdersByPartner,
  getFutureOrdersForPartner,
  transformOrder,
} from '@/lib/db/queries/orders';
import { sendInitialConfirmationEmail } from '@/lib/services/booking-reminders';
import { Booking, BookingStatus } from '@/lib/types';

/**
 * GET /api/partner/bookings
 *
 * Get all bookings for the authenticated partner.
 * Combines Magento order data with booking confirmation status.
 *
 * Query params:
 * - status: 'pending' | 'confirmed' | 'declined' (filter by status)
 * - future: 'true' (only future events)
 * - limit: number
 * - offset: number
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    try {
      if (user.customerNumbers.length === 0) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      const { searchParams } = new URL(request.url);
      const statusFilter = searchParams.get('status') as BookingStatus | null;
      const futureOnly = searchParams.get('future') === 'true';
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
      const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined;

      // Get orders from Magento
      const orders = futureOnly
        ? await getFutureOrdersForPartner(user.customerNumbers)
        : await getOrdersByPartner(user.customerNumbers, { limit, offset });

      // Get existing confirmation records
      const confirmations = await getBookingConfirmationsByCustomerNumbers(
        user.customerNumbers,
        { status: statusFilter || undefined }
      );

      // Create a map of confirmations by order item ID for quick lookup
      const confirmationMap = new Map(
        confirmations.map(c => [`${c.magento_order_id}-${c.magento_order_item_id}`, c])
      );

      // Combine orders with confirmations
      const bookings: Booking[] = [];

      for (const order of orders) {
        const key = `${order.order_id}-${order.order_item_id}`;
        let confirmation = confirmationMap.get(key);

        // Auto-create confirmation record if it doesn't exist
        if (!confirmation) {
          confirmation = await getOrCreateBookingConfirmation({
            magentoOrderId: order.order_id,
            magentoOrderItemId: order.order_item_id,
            magentoOrderIncrementId: order.order_increment_id,
            customerNumber: order.customer_number,
          });

          // Send initial confirmation request email for new bookings
          sendInitialConfirmationEmail(confirmation).catch((error) => {
            console.error('[Bookings] Failed to send initial email for booking:', confirmation?.id, error);
          });
        }

        // Skip if status filter doesn't match
        if (statusFilter && confirmation.status !== statusFilter) {
          continue;
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

        bookings.push(booking);
      }

      // Get statistics
      const stats = await getBookingStats(user.customerNumbers);

      // Get decline reasons for UI
      const declineReasons = await getActiveDeclineReasons();

      return NextResponse.json({
        success: true,
        bookings,
        stats,
        declineReasons,
        pagination: {
          limit,
          offset,
          total: stats.total,
        },
      });
    } catch (error) {
      console.error('[Get Partner Bookings] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bookings' },
        { status: 500 }
      );
    }
  });
}
