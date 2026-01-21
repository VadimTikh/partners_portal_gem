/**
 * Booking reminder service
 * Processes pending bookings and sends reminder emails
 */

import {
  getPendingBookingsForReminder,
  incrementReminderCount,
  markAsEscalated,
} from '@/lib/db/queries/bookings';
import { getOrderItem } from '@/lib/db/queries/orders';
import { getPartnerByCustomerNumber } from '@/lib/db/queries/partners';
import {
  sendBookingConfirmationRequestEmail,
  sendBookingReminderEmail,
  BookingEmailData,
} from '@/lib/email/booking-emails';
import { createSupportTicket } from '@/lib/services/odoo';

// Reminder thresholds in hours
const REMINDER_1_THRESHOLD_HOURS = 24;
const REMINDER_2_THRESHOLD_HOURS = 48;
const ESCALATION_THRESHOLD_HOURS = 72;

interface ReminderProcessingResult {
  processed: number;
  reminders1Sent: number;
  reminders2Sent: number;
  escalated: number;
  errors: Array<{ bookingId: number; error: string }>;
}

/**
 * Process all pending booking reminders
 *
 * This function should be called periodically (e.g., every hour via cron)
 * to check for bookings that need reminders or escalation.
 */
export async function processBookingReminders(): Promise<ReminderProcessingResult> {
  const result: ReminderProcessingResult = {
    processed: 0,
    reminders1Sent: 0,
    reminders2Sent: 0,
    escalated: 0,
    errors: [],
  };

  try {
    // Get bookings needing first reminder (24+ hours, 0 reminders sent)
    const needingReminder1 = await getPendingBookingsForReminder(
      0, // min reminder count
      REMINDER_1_THRESHOLD_HOURS
    );

    // Get bookings needing second reminder (48+ hours, 1 reminder sent)
    const needingReminder2 = await getPendingBookingsForReminder(
      1, // min reminder count
      REMINDER_2_THRESHOLD_HOURS
    );

    // Get bookings needing escalation (72+ hours, 2+ reminders sent)
    const needingEscalation = await getPendingBookingsForReminder(
      2, // min reminder count
      ESCALATION_THRESHOLD_HOURS
    );

    // Process first reminders
    for (const booking of needingReminder1) {
      try {
        const emailData = await prepareEmailData(booking);
        if (emailData) {
          const hours = calculateHoursWaiting(booking.created_at);
          await sendBookingReminderEmail(emailData, 1, hours);
          await incrementReminderCount(booking.id);
          result.reminders1Sent++;
        }
        result.processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({ bookingId: booking.id, error: errorMessage });
        console.error(`[Reminder] Error processing booking ${booking.id}:`, error);
      }
    }

    // Process second reminders
    for (const booking of needingReminder2) {
      try {
        const emailData = await prepareEmailData(booking);
        if (emailData) {
          const hours = calculateHoursWaiting(booking.created_at);
          await sendBookingReminderEmail(emailData, 2, hours);
          await incrementReminderCount(booking.id);
          result.reminders2Sent++;
        }
        result.processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({ bookingId: booking.id, error: errorMessage });
        console.error(`[Reminder] Error processing booking ${booking.id}:`, error);
      }
    }

    // Process escalations
    for (const booking of needingEscalation) {
      // Skip if already escalated
      if (booking.escalated_at) {
        continue;
      }

      try {
        await escalateBooking(booking);
        result.escalated++;
        result.processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({ bookingId: booking.id, error: errorMessage });
        console.error(`[Reminder] Error escalating booking ${booking.id}:`, error);
      }
    }

    console.log('[Reminder] Processing complete:', result);
    return result;
  } catch (error) {
    console.error('[Reminder] Fatal error during processing:', error);
    throw error;
  }
}

/**
 * Prepare email data for a booking
 */
async function prepareEmailData(
  booking: Awaited<ReturnType<typeof getPendingBookingsForReminder>>[0]
): Promise<BookingEmailData | null> {
  // Get partner info
  const partner = await getPartnerByCustomerNumber(booking.customer_number);
  if (!partner) {
    console.warn(`[Reminder] Partner not found for customer number: ${booking.customer_number}`);
    return null;
  }

  // Get order details from Magento
  const order = await getOrderItem(
    booking.magento_order_id,
    booking.magento_order_item_id,
    [booking.customer_number]
  );

  if (!order) {
    console.warn(`[Reminder] Order not found: ${booking.magento_order_id}`);
    return null;
  }

  // Parse event date, handling invalid dates like "0000-00-00"
  let eventDate: Date;
  if (order.event_date && order.event_date !== '0000-00-00' && !order.event_date.startsWith('0000')) {
    const parsedDate = new Date(order.event_date);
    eventDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  } else {
    eventDate = new Date();
  }

  return {
    partnerName: partner.name,
    partnerEmail: partner.email,
    customerFirstName: order.customer_firstname,
    customerLastName: order.customer_lastname,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone || '',
    courseName: order.product_name,
    eventDate,
    eventTime: order.event_time || 'TBD',
    participants: order.qty_ordered,
    orderNumber: booking.magento_order_increment_id,
    price: Number(order.item_price) || 0,
    currency: 'EUR',
    confirmationToken: booking.confirmation_token,
  };
}

/**
 * Escalate a booking by creating an Odoo support ticket
 */
async function escalateBooking(
  booking: Awaited<ReturnType<typeof getPendingBookingsForReminder>>[0]
): Promise<void> {
  // Get order details for ticket
  const order = await getOrderItem(
    booking.magento_order_id,
    booking.magento_order_item_id,
    [booking.customer_number]
  );

  // Get partner info
  const partner = await getPartnerByCustomerNumber(booking.customer_number);

  const ticketSubject = `Buchungsbestätigung ausstehend: ${order?.product_name || 'Kurs'} - Bestellung ${booking.magento_order_increment_id}`;

  const ticketMessage = `
Eine Buchung wartet seit mehr als 72 Stunden auf Bestätigung durch den Partner.

BUCHUNGSDETAILS
- Bestellnummer: ${booking.magento_order_increment_id}
- Kurs: ${order?.product_name || 'Unbekannt'}
- Datum: ${order?.event_date || 'Unbekannt'}
- Kunde: ${order?.customer_firstname} ${order?.customer_lastname}
- E-Mail: ${order?.customer_email}
- Telefon: ${order?.customer_phone || 'Nicht angegeben'}
- Teilnehmer: ${order?.qty_ordered || 1}

PARTNER
- Name: ${partner?.name || 'Unbekannt'}
- E-Mail: ${partner?.email || 'Unbekannt'}
- Kundennummer: ${booking.customer_number}

STATUS
- Erstellt: ${booking.created_at}
- Erinnerungen gesendet: ${booking.reminder_count}

AKTION ERFORDERLICH
Bitte kontaktieren Sie den Partner telefonisch, um die Buchung zu klären.
`.trim();

  // Create Odoo ticket
  const ticketResult = await createSupportTicket({
    userName: 'System (Automatische Eskalation)',
    userEmail: 'system@partners.miomente.de',
    subject: ticketSubject,
    message: ticketMessage,
  });

  // Mark as escalated
  await markAsEscalated(booking.id, ticketResult.ticketId.toString());

  console.log(`[Reminder] Escalated booking ${booking.id} - Ticket ID: ${ticketResult.ticketId}`);
}

/**
 * Calculate hours since booking was created
 */
function calculateHoursWaiting(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

/**
 * Send initial confirmation request email for a new booking
 * Called when a new booking confirmation is created
 */
export async function sendInitialConfirmationEmail(
  booking: {
    id: number;
    magento_order_id: number;
    magento_order_item_id: number;
    magento_order_increment_id: string;
    customer_number: string;
    confirmation_token: string;
  }
): Promise<boolean> {
  try {
    const emailData = await prepareEmailData(booking as any);
    if (!emailData) {
      return false;
    }

    const result = await sendBookingConfirmationRequestEmail(emailData);
    return result.success;
  } catch (error) {
    console.error('[Reminder] Error sending initial confirmation email:', error);
    return false;
  }
}
