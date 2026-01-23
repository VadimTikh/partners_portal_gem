import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/middleware';
import {
  findBookingConfirmationById,
  declineBooking,
  getDeclineReasonByCode,
  markAsEscalated,
} from '@/lib/db/queries/bookings';
import { getOrderItem } from '@/lib/db/queries/orders';
import { createSupportTicket } from '@/lib/services/odoo';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface DeclineRequestBody {
  reasonCode: string;
  notes?: string;
  relatedConfirmationIds?: number[];
}

/**
 * POST /api/partner/bookings/[id]/decline
 *
 * Decline a booking via the portal (authenticated).
 * Creates an Odoo support ticket for the decline.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (req, user) => {
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

      // Parse request body
      let body: DeclineRequestBody;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: 'Invalid request body' },
          { status: 400 }
        );
      }

      const { reasonCode, notes, relatedConfirmationIds } = body;

      if (!reasonCode) {
        return NextResponse.json(
          { error: 'Decline reason is required' },
          { status: 400 }
        );
      }

      // Validate decline reason
      const reason = await getDeclineReasonByCode(reasonCode);
      if (!reason) {
        return NextResponse.json(
          { error: 'Invalid decline reason' },
          { status: 400 }
        );
      }

      // Check if notes are required
      if (reason.requiresNotes && !notes) {
        return NextResponse.json(
          { error: 'Additional notes are required for this reason' },
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

      // Build list of all booking IDs to decline (for grouped bookings)
      let idsToDecline: number[] = [bookingId];
      if (relatedConfirmationIds && Array.isArray(relatedConfirmationIds)) {
        for (const relatedId of relatedConfirmationIds) {
          if (relatedId === bookingId) continue;
          const related = await findBookingConfirmationById(relatedId);
          if (related && user.customerNumbers.includes(related.customer_number)) {
            idsToDecline.push(relatedId);
          }
        }
      }

      // Decline all related bookings
      const declinedBookings = [];
      for (const idToDecline of idsToDecline) {
        const updated = await declineBooking(
          idToDecline,
          'portal',
          reasonCode,
          notes
        );
        if (updated) {
          declinedBookings.push(updated);
        }
      }

      if (declinedBookings.length === 0) {
        return NextResponse.json(
          { error: 'Failed to decline booking' },
          { status: 500 }
        );
      }

      // Get order details for Odoo ticket (using first booking)
      const order = await getOrderItem(
        confirmation.magento_order_id,
        confirmation.magento_order_item_id,
        user.customerNumbers
      );

      // Create single Odoo support ticket for all declined bookings
      let odooTicketId: string | undefined;
      try {
        const participantCount = idsToDecline.length;
        const ticketSubject = `Buchung abgelehnt: ${order?.product_name || 'Kurs'} - ${order?.customer_firstname} ${order?.customer_lastname}${participantCount > 1 ? ` (${participantCount} Teilnehmer)` : ''}`;
        const ticketMessage = `
Partner: ${user.name} (${user.email})
Bestellnummer: ${confirmation.magento_order_increment_id}
Kunde: ${order?.customer_firstname} ${order?.customer_lastname}
E-Mail: ${order?.customer_email}
Kurs: ${order?.product_name}
Datum: ${order?.event_date || 'Unbekannt'}
Teilnehmer: ${participantCount}

Ablehnungsgrund: ${reason.labelDe}
${notes ? `Anmerkungen: ${notes}` : ''}

Diese Buchung wurde vom Partner abgelehnt. Bitte kontaktieren Sie den Kunden für eine Umbuchung.
        `.trim();

        const result = await createSupportTicket({
          userName: user.name,
          userEmail: user.email,
          subject: ticketSubject,
          message: ticketMessage,
        });

        odooTicketId = result.ticketId.toString();
        // Mark all declined bookings with the same Odoo ticket
        for (const id of idsToDecline) {
          await markAsEscalated(id, odooTicketId);
        }
      } catch (error) {
        console.error('[Decline Booking] Failed to create Odoo ticket:', error);
        // Don't fail the decline if Odoo ticket creation fails
      }

      // TODO: Send decline notification email to customer

      const primaryDeclined = declinedBookings[0];
      return NextResponse.json({
        success: true,
        message: `Booking${declinedBookings.length > 1 ? 's' : ''} declined successfully`,
        booking: {
          id: primaryDeclined.id,
          status: primaryDeclined.status,
          declinedAt: primaryDeclined.declined_at,
          declinedBy: primaryDeclined.declined_by,
          declineReason: primaryDeclined.decline_reason,
        },
        declinedCount: declinedBookings.length,
        odooTicketId,
      });
    } catch (error) {
      console.error('[Decline Booking] Error:', error);
      return NextResponse.json(
        { error: 'Failed to decline booking' },
        { status: 500 }
      );
    }
  });
}
