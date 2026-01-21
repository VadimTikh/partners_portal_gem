import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import {
  findBookingConfirmationByToken,
} from '@/lib/db/queries/bookings';
import { isTokenExpired, isValidTokenFormat } from '@/lib/services/booking-tokens';
import { config } from '@/lib/config';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/booking/decline/[token]
 *
 * Decline initiation from email link.
 * No authentication required - uses secure token.
 * Redirects to portal decline page where partner selects reason.
 *
 * Note: Unlike confirm, decline requires selecting a reason,
 * so we redirect to the portal instead of processing directly.
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

    // Redirect to portal decline page with token
    // Partner will need to log in and select decline reason
    return redirectToDeclinePage(token, confirmation.id);
  } catch (error) {
    console.error('[Token Decline] Error:', error);
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

/**
 * Redirect to portal decline page
 */
function redirectToDeclinePage(token: string, bookingId: number): NextResponse {
  const baseUrl = config.appUrl || 'https://partners.miomente.de';
  const url = new URL(`${baseUrl}/dashboard/bookings/${bookingId}/decline`);
  url.searchParams.set('token', token);

  return NextResponse.redirect(url);
}
