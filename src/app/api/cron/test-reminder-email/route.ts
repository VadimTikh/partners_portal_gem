/**
 * DEV ONLY: Test endpoint for sending a test reminder email
 * This bypasses Magento lookup and sends directly to DEV_EMAIL_OVERRIDE
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { sendBookingReminderEmail, BookingEmailData } from '@/lib/email/booking-emails';
import { generateConfirmationToken } from '@/lib/services/booking-tokens';
import { query as pgQuery } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Only allow in development
  if (config.isProd) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  // Validate cron secret
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!config.cron.secret || token !== config.cron.secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Generate a valid token for testing
  const testToken = generateConfirmationToken();
  const tokenExpiry = new Date();
  tokenExpiry.setDate(tokenExpiry.getDate() + 7);

  // Create a test booking record so the links work
  try {
    await pgQuery(
      `INSERT INTO miomente_partner_portal_booking_confirmations
       (magento_order_id, magento_order_item_id, magento_order_increment_id, customer_number,
        confirmation_token, token_expires_at, status)
       VALUES (999999, 999999, 'TEST-EMAIL-001', '554432', $1, $2, 'pending')
       ON CONFLICT (magento_order_id, magento_order_item_id)
       DO UPDATE SET confirmation_token = $1, token_expires_at = $2, status = 'pending'`,
      [testToken, tokenExpiry.toISOString()]
    );
  } catch (err) {
    console.log('[Test Email] Could not create test booking (may already exist):', err);
  }

  // Mock email data for testing
  const testEmailData: BookingEmailData = {
    partnerName: 'Test Partner',
    partnerEmail: config.email.devOverride || 'test@example.com',
    customerFirstName: 'Max',
    customerLastName: 'Mustermann',
    customerEmail: 'max@example.com',
    customerPhone: '+49 123 456789',
    courseName: 'Italienischer Kochkurs',
    eventDate: new Date('2026-02-15'),
    eventTime: '18:00',
    participants: 2,
    orderNumber: 'TEST-EMAIL-001',
    price: 149.00,
    currency: 'EUR',
    confirmationToken: testToken,
  };

  try {
    // Send first reminder
    const result1 = await sendBookingReminderEmail(testEmailData, 1, 25);

    // Send second reminder (urgent)
    const result2 = await sendBookingReminderEmail(testEmailData, 2, 49);

    const baseUrl = config.appUrl || 'http://localhost:3000';
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        reminder1: result1,
        reminder2: result2,
      },
      emailSentTo: config.email.devOverride || testEmailData.partnerEmail,
      testLinks: {
        confirm: `${baseUrl}/api/booking/confirm/${testToken}`,
        decline: `${baseUrl}/api/booking/decline/${testToken}`,
      },
    });
  } catch (error) {
    console.error('[Test Email] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
