import { NextResponse } from 'next/server';
import { processBookingReminders } from '@/lib/services/booking-reminders';

// Disable Next.js caching
export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/booking-reminders
 *
 * Processes pending booking reminders. This is now primarily called by the
 * internal node-cron scheduler, but can also be triggered manually for testing.
 */
export async function POST() {
  console.log('[Cron] Manual trigger: Starting booking reminders processing...');

  try {
    const result = await processBookingReminders();

    console.log('[Cron] Booking reminders processed:', {
      processed: result.processed,
      reminders1Sent: result.reminders1Sent,
      reminders2Sent: result.reminders2Sent,
      escalated: result.escalated,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error) {
    console.error('[Cron] Fatal error processing booking reminders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/booking-reminders
 *
 * Health check for the cron endpoint.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    endpoint: '/api/cron/booking-reminders',
    method: 'POST',
    description: 'Processes pending booking reminders (24h, 48h) and escalations (72h)',
    note: 'Automatically scheduled via internal cron, but can be triggered manually',
    timestamp: new Date().toISOString(),
  });
}
