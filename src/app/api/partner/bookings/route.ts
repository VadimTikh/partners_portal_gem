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

      // Combine orders with confirmations, grouping by order + event
      // This handles cases where multiple order items represent tickets for the same event
      const bookingGroups = new Map<string, {
        orders: typeof orders;
        confirmations: typeof confirmations;
        totalParticipants: number;
        totalPrice: number;
      }>();

      for (const order of orders) {
        const itemKey = `${order.order_id}-${order.order_item_id}`;
        let confirmation = confirmationMap.get(itemKey);

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

          // Add to confirmation map
          confirmationMap.set(itemKey, confirmation);
        }

        // Skip if status filter doesn't match
        if (statusFilter && confirmation.status !== statusFilter) {
          continue;
        }

        const transformed = transformOrder(order);

        // Group by order_id + event_date + event_time (same event in same order)
        // Don't include course name as it might vary slightly between order items
        const groupKey = `${order.order_id}-${transformed.eventDate}-${transformed.eventTime}`;

        if (!bookingGroups.has(groupKey)) {
          bookingGroups.set(groupKey, {
            orders: [],
            confirmations: [],
            totalParticipants: 0,
            totalPrice: 0,
          });
        }

        const group = bookingGroups.get(groupKey)!;
        group.orders.push(order);
        group.confirmations.push(confirmation);
        group.totalParticipants += transformed.participants;
        group.totalPrice += transformed.price;
      }

      // Build final bookings list from groups
      const bookings: Booking[] = [];

      for (const [, group] of bookingGroups) {
        // Use the first order/confirmation as the representative
        const order = group.orders[0];
        const confirmation = group.confirmations[0];
        const transformed = transformOrder(order);

        // Collect all confirmation IDs in the group for bulk actions
        const relatedConfirmationIds = group.confirmations.map(c => c.id);

        const booking: Booking = {
          id: confirmation.id,
          magentoOrderId: order.order_id,
          magentoOrderItemId: order.order_item_id,
          orderNumber: transformed.orderNumber,
          customer: transformed.customer,
          course: transformed.course,
          eventDate: transformed.eventDate,
          eventTime: transformed.eventTime,
          participants: group.totalParticipants, // Aggregated participants
          price: group.totalPrice, // Aggregated price
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
          // Include related IDs for bulk confirm/decline
          relatedConfirmationIds: relatedConfirmationIds.length > 1 ? relatedConfirmationIds : undefined,
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
