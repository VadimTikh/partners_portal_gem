import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import {
  findBookingConfirmationByToken,
  confirmBooking,
} from '@/lib/db/queries/bookings';
import { isTokenExpired, isValidTokenFormat } from '@/lib/services/booking-tokens';
import { config } from '@/lib/config';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/booking/confirm/[token]
 *
 * One-click confirmation from email link.
 * No authentication required - uses secure token.
 * Redirects to success/error page after processing.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    // Validate token format
    if (!isValidTokenFormat(token)) {
      return redirectToResult('error', 'invalid_token');
    }

    // Find confirmation by token
    const confirmation = await findBookingConfirmationByToken(token);
    if (!confirmation) {
      return redirectToResult('error', 'not_found');
    }

    // Check if token has expired
    if (isTokenExpired(confirmation.token_expires_at)) {
      return redirectToResult('error', 'expired');
    }

    // Check if already processed
    if (confirmation.status !== 'pending') {
      return redirectToResult('already_processed', confirmation.status);
    }

    // Confirm the booking
    const updated = await confirmBooking(confirmation.id, 'email_token');

    if (!updated) {
      return redirectToResult('error', 'failed');
    }

    // TODO: Send confirmation email to customer

    return redirectToResult('success', 'confirmed');
  } catch (error) {
    console.error('[Token Confirm] Error:', error);
    return redirectToResult('error', 'server_error');
  }
}

/**
 * Redirect to result page
 */
function redirectToResult(status: string, code: string): NextResponse {
  const baseUrl = config.appUrl || 'https://partners.miomente.de';
  const url = new URL(`${baseUrl}/booking/result`);
  url.searchParams.set('status', status);
  url.searchParams.set('code', code);

  return NextResponse.redirect(url);
}
