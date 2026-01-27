import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import { filterTicketsByName, TicketFilterData } from '@/lib/gemini';

/**
 * POST /api/manager/helpdesk/ai/filter
 *
 * Filter tickets by searching in ticket names.
 * Simple text search - no AI involved.
 *
 * Accepts either:
 * - tickets: Array of {id, name} objects (preferred)
 * - ticketIds + ticketNames: Parallel arrays (legacy)
 */
export async function POST(request: NextRequest) {
  return withManager(request, async () => {
    try {
      // Parse request body
      const body = await request.json();
      const { tickets, ticketIds, ticketNames, query: filterQuery } = body as {
        tickets?: Array<{ id: number; name: string }>;
        ticketIds?: number[];
        ticketNames?: string[];
        query: string;
      };

      // Build ticket data from either format
      let ticketData: TicketFilterData[] = [];

      if (tickets && Array.isArray(tickets) && tickets.length > 0) {
        // New format: array of {id, name} objects
        ticketData = tickets.map(t => ({
          ticketId: t.id,
          ticketName: t.name || '',
        }));
      } else if (ticketIds && ticketNames && Array.isArray(ticketIds) && Array.isArray(ticketNames)) {
        // Legacy format: parallel arrays
        ticketData = ticketIds.map((id, index) => ({
          ticketId: id,
          ticketName: ticketNames[index] || '',
        }));
      }

      if (ticketData.length === 0) {
        return NextResponse.json(
          { error: 'tickets array or ticketIds+ticketNames arrays are required' },
          { status: 400 }
        );
      }

      if (!filterQuery || typeof filterQuery !== 'string' || !filterQuery.trim()) {
        return NextResponse.json(
          { error: 'query string is required' },
          { status: 400 }
        );
      }

      // Filter tickets by name (simple text search)
      const filterResult = filterTicketsByName(ticketData, filterQuery.trim());

      return NextResponse.json({
        success: true,
        matchingIds: filterResult.matchingIds,
        interpretation: `Search: "${filterQuery.trim()}"`,
        matchCount: filterResult.matchCount,
      });

    } catch (error) {
      console.error('[Filter] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to filter tickets' },
        { status: 500 }
      );
    }
  });
}
