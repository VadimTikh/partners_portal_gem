import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import { getTicket, getTicketMessages } from '@/lib/odoo';

/**
 * GET /api/manager/helpdesk/ticket/[id]
 *
 * Get a single helpdesk ticket with its messages.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withManager(request, async () => {
    try {
      const resolvedParams = await params;
      const ticketId = parseInt(resolvedParams.id, 10);

      if (isNaN(ticketId)) {
        return NextResponse.json(
          { error: 'Invalid ticket ID' },
          { status: 400 }
        );
      }

      // Fetch ticket and messages in parallel
      const [ticket, messages] = await Promise.all([
        getTicket(ticketId),
        getTicketMessages(ticketId),
      ]);

      if (!ticket) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        ticket,
        messages,
      });
    } catch (error) {
      console.error('[Helpdesk Ticket] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch ticket' },
        { status: 500 }
      );
    }
  });
}
