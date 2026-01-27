import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import { filterTicketsByQuery, TicketFilterSummary } from '@/lib/gemini';
import { query } from '@/lib/db/postgres';

/**
 * POST /api/manager/helpdesk/ai/filter
 *
 * Filter tickets using AI based on natural language query.
 * Requires ticket IDs and a query string.
 */
export async function POST(request: NextRequest) {
  return withManager(request, async () => {
    try {
      // Parse request body
      const body = await request.json();
      const { ticketIds, query: filterQuery, language = 'en' } = body as {
        ticketIds: number[];
        query: string;
        language?: string;
      };

      if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
        return NextResponse.json(
          { error: 'ticketIds array is required' },
          { status: 400 }
        );
      }

      if (!filterQuery || typeof filterQuery !== 'string' || !filterQuery.trim()) {
        return NextResponse.json(
          { error: 'query string is required' },
          { status: 400 }
        );
      }

      // Fetch stored analyses for the given ticket IDs
      const placeholders = ticketIds.map((_, i) => `$${i + 1}`).join(', ');
      const result = await query(
        `SELECT
          ticket_id,
          urgency,
          category,
          sentiment,
          summary,
          customer_intent
        FROM helpdesk_ticket_analysis
        WHERE ticket_id IN (${placeholders})`,
        ticketIds
      );

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: true,
          matchingIds: [],
          interpretation: 'No analyzed tickets found to filter',
          matchCount: 0,
        });
      }

      // Transform to TicketFilterSummary format
      const ticketSummaries: TicketFilterSummary[] = result.rows.map(row => ({
        ticketId: row.ticket_id,
        category: row.category,
        urgency: row.urgency,
        sentiment: row.sentiment || undefined,
        summary: row.summary || '',
        customerIntent: row.customer_intent || undefined,
      }));

      // Call AI to filter tickets
      const filterResult = await filterTicketsByQuery(ticketSummaries, filterQuery.trim(), language);

      return NextResponse.json({
        success: true,
        matchingIds: filterResult.matchingIds,
        interpretation: filterResult.interpretation,
        matchCount: filterResult.matchCount,
      });

    } catch (error) {
      console.error('[AI Filter] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to filter tickets' },
        { status: 500 }
      );
    }
  });
}
