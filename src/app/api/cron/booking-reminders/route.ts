import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { processBookingReminders } from '@/lib/services/booking-reminders';

// Disable Next.js caching
export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/booking-reminders
 *
 * Processes pending booking reminders. This endpoint should be called
 * by a scheduled task (e.g., Google Cloud Scheduler) every hour.
 *
 * Authentication: Bearer token must match CRON_SECRET environment variable
 */
export async function POST(request: NextRequest) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!config.cron.secret) {
    console.error('[Cron] CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Cron endpoint not configured' },
      { status: 503 }
    );
  }

  if (token !== config.cron.secret) {
    console.warn('[Cron] Invalid cron secret attempted');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[Cron] Starting booking reminders processing...');

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
 * Returns information about when reminders were last processed.
 */
export async function GET(request: NextRequest) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!config.cron.secret || token !== config.cron.secret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: 'ready',
    endpoint: '/api/cron/booking-reminders',
    method: 'POST',
    description: 'Processes pending booking reminders (24h, 48h) and escalations (72h)',
    timestamp: new Date().toISOString(),
  });
}
