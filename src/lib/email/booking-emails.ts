/**
 * Booking email service
 * Handles sending all booking-related emails
 */

import { sendEmail } from './index';
import {
  getBookingConfirmationRequestHtml,
  getBookingConfirmationRequestText,
  getBookingConfirmationRequestSubject,
  BookingConfirmationRequestData,
} from './templates/booking-confirmation-request';
import {
  getBookingReminderHtml,
  getBookingReminderText,
  getBookingReminderSubject,
  BookingReminderData,
} from './templates/booking-reminder';
import { buildConfirmationUrl, buildDeclineUrl } from '@/lib/services/booking-tokens';
import { config } from '@/lib/config';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * Booking data for email
 */
export interface BookingEmailData {
  partnerName: string;
  partnerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  courseName: string;
  eventDate: Date;
  eventTime: string;
  participants: number;
  orderNumber: string;
  price: number;
  currency: string;
  confirmationToken: string;
}

/**
 * Send booking confirmation request email to partner
 */
export async function sendBookingConfirmationRequestEmail(
  data: BookingEmailData
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = config.appUrl || 'https://partners.miomente.de';
  const formattedDate = format(data.eventDate, 'PPP', { locale: de });
  const formattedPrice = `${data.price.toFixed(2)} ${data.currency}`;

  const templateData: BookingConfirmationRequestData = {
    partnerName: data.partnerName,
    customerName: `${data.customerFirstName} ${data.customerLastName}`,
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone,
    courseName: data.courseName,
    eventDate: formattedDate,
    eventTime: data.eventTime,
    participants: data.participants,
    orderNumber: data.orderNumber,
    price: formattedPrice,
    confirmUrl: buildConfirmationUrl(data.confirmationToken, baseUrl),
    declineUrl: buildDeclineUrl(data.confirmationToken, baseUrl),
    portalUrl: `${baseUrl}/dashboard/bookings`,
  };

  const subject = getBookingConfirmationRequestSubject(data.courseName, formattedDate);
  const html = getBookingConfirmationRequestHtml(templateData);
  const text = getBookingConfirmationRequestText(templateData);

  const result = await sendEmail({
    to: data.partnerEmail,
    toName: data.partnerName,
    subject,
    html,
    text,
  });

  if (!result.success) {
    console.error('[Booking Email] Failed to send confirmation request:', result.error);
  } else {
    console.log(
      '[Booking Email] Confirmation request sent to:',
      result.originalRecipient || data.partnerEmail
    );
  }

  return result;
}

/**
 * Send booking reminder email to partner
 */
export async function sendBookingReminderEmail(
  data: BookingEmailData,
  reminderNumber: 1 | 2,
  hoursWaiting: number
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = config.appUrl || 'https://partners.miomente.de';
  const formattedDate = format(data.eventDate, 'PPP', { locale: de });
  const formattedPrice = `${data.price.toFixed(2)} ${data.currency}`;

  const templateData: BookingReminderData = {
    partnerName: data.partnerName,
    customerName: `${data.customerFirstName} ${data.customerLastName}`,
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone,
    courseName: data.courseName,
    eventDate: formattedDate,
    eventTime: data.eventTime,
    participants: data.participants,
    orderNumber: data.orderNumber,
    price: formattedPrice,
    confirmUrl: buildConfirmationUrl(data.confirmationToken, baseUrl),
    declineUrl: buildDeclineUrl(data.confirmationToken, baseUrl),
    portalUrl: `${baseUrl}/dashboard/bookings`,
    reminderNumber,
    hoursWaiting,
  };

  const subject = getBookingReminderSubject(data.courseName, formattedDate, reminderNumber);
  const html = getBookingReminderHtml(templateData);
  const text = getBookingReminderText(templateData);

  const result = await sendEmail({
    to: data.partnerEmail,
    toName: data.partnerName,
    subject,
    html,
    text,
  });

  if (!result.success) {
    console.error('[Booking Email] Failed to send reminder:', result.error);
  } else {
    console.log(
      `[Booking Email] Reminder ${reminderNumber} sent to:`,
      result.originalRecipient || data.partnerEmail
    );
  }

  return result;
}
