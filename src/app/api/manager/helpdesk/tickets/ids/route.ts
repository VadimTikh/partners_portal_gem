import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import { getTickets } from '@/lib/odoo';
import { getTicketIdsByAIFilters, getAnalyzedTicketIdsFromList } from '@/lib/db/queries/helpdesk';
import {
  TimePeriod,
  AIUrgency,
  AICategory,
  AISentiment,
  SatisfactionLevel,
  MessageAuthorType,
} from '@/lib/types/helpdesk';

/**
 * Calculate date range from period
 */
function getDateRange(period: TimePeriod, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  if (period === 'custom' && customFrom && customTo) {
    // Ensure custom dates include full day by adjusting times
    const fromDate = new Date(customFrom);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(customTo);
    toDate.setHours(23, 59, 59, 999);
    return { from: fromDate.toISOString(), to: toDate.toISOString() };
  }

  let from: Date;
  switch (period) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      // Use a date far in the past (2000-01-01) for "all time"
      from = new Date(2000, 0, 1);
      break;
    case '30d':
    default:
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  return { from: from.toISOString(), to };
}

/**
 * GET /api/manager/helpdesk/tickets/ids
 *
 * Get ALL ticket IDs matching the given filters (no pagination limit).
 * This is used for "Analyze All Filtered" feature.
 *
 * Returns only ticket IDs for efficiency (not full ticket data).
 *
 * Query params: Same as /api/manager/helpdesk/tickets
 */
export async function GET(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const { searchParams } = new URL(request.url);

      // Parse basic filters
      const period = (searchParams.get('period') || '30d') as TimePeriod;
      const customFrom = searchParams.get('customFrom') || undefined;
      const customTo = searchParams.get('customTo') || undefined;
      const stageIdsParam = searchParams.get('stageIds');
      const typeIdsParam = searchParams.get('typeIds');
      const search = searchParams.get('search') || undefined;

      // Parse special filters
      const onlyUnanalyzed = searchParams.get('onlyUnanalyzed') === 'true';

      // Parse AI filters
      const aiUrgencyParam = searchParams.get('aiUrgency');
      const aiCategoryParam = searchParams.get('aiCategory');
      const aiSentimentParam = searchParams.get('aiSentiment');
      const aiSatisfactionParam = searchParams.get('aiSatisfaction');
      const aiIsResolvedParam = searchParams.get('aiIsResolved');
      const aiAwaitingAnswerParam = searchParams.get('aiAwaitingAnswer');
      const aiAuthorTypeParam = searchParams.get('aiAuthorType');
      const isB2BParam = searchParams.get('isB2B');

      const stageIds = stageIdsParam
        ? stageIdsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id))
        : undefined;

      const typeIds = typeIdsParam
        ? typeIdsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id))
        : undefined;

      // Parse AI filter values
      const aiUrgency = aiUrgencyParam
        ? aiUrgencyParam.split(',').filter(v => ['critical', 'high', 'medium', 'low'].includes(v)) as AIUrgency[]
        : undefined;

      const aiCategory = aiCategoryParam
        ? aiCategoryParam.split(',') as AICategory[]
        : undefined;

      const aiSentiment = aiSentimentParam
        ? aiSentimentParam.split(',').filter(v => ['angry', 'frustrated', 'neutral', 'positive'].includes(v)) as AISentiment[]
        : undefined;

      const aiSatisfaction = aiSatisfactionParam
        ? aiSatisfactionParam.split(',').map(v => parseInt(v, 10)).filter(v => v >= 1 && v <= 5) as SatisfactionLevel[]
        : undefined;

      const aiIsResolved = aiIsResolvedParam !== null
        ? aiIsResolvedParam === 'true'
        : undefined;

      const aiAwaitingAnswer = aiAwaitingAnswerParam === 'true';

      const aiAuthorType = aiAuthorTypeParam
        ? aiAuthorTypeParam.split(',').filter(v => ['support_team', 'customer', 'partner'].includes(v)) as MessageAuthorType[]
        : undefined;

      const isB2B = isB2BParam !== null
        ? isB2BParam === 'true'
        : undefined;

      // Check if any AI filters are applied
      const hasAIFilters = aiUrgency?.length || aiCategory?.length || aiSentiment?.length ||
        aiSatisfaction?.length || aiIsResolved !== undefined || aiAwaitingAnswer || aiAuthorType?.length || isB2B !== undefined;

      // If AI filters are applied, get filtered ticket IDs from PostgreSQL first
      let aiFilteredIds: number[] | undefined;
      if (hasAIFilters) {
        aiFilteredIds = await getTicketIdsByAIFilters({
          urgency: aiUrgency,
          category: aiCategory,
          sentiment: aiSentiment,
          satisfactionLevel: aiSatisfaction,
          aiIsResolved,
          lastMessageAuthorType: aiAuthorType,
          awaitingAnswer: aiAwaitingAnswer,
          isB2B,
        });

        // If AI filters are active but no tickets match, return empty result
        if (aiFilteredIds.length === 0) {
          return NextResponse.json({
            success: true,
            ticketIds: [],
            total: 0,
          });
        }
      }

      // Calculate date range
      const dateRange = getDateRange(period, customFrom, customTo);

      // Fetch ALL tickets matching filters (no limit)
      // We only need the IDs, but getTickets returns full tickets
      // For very large result sets, consider adding a dedicated Odoo function
      const MAX_TICKETS = 5000; // Safety limit (increased from 1000 to support larger datasets)
      const { tickets, total } = await getTickets({
        ids: aiFilteredIds,
        stageIds,
        typeIds,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        search,
        limit: MAX_TICKETS,
        offset: 0,
      });

      // Extract IDs and names
      let ticketData = tickets.map(t => ({ id: t.id, name: t.name }));

      // If onlyUnanalyzed is true, filter out tickets that already have analysis
      if (onlyUnanalyzed && ticketData.length > 0) {
        const analyzedIds = await getAnalyzedTicketIdsFromList(ticketData.map(t => t.id));
        ticketData = ticketData.filter(t => !analyzedIds.has(t.id));
      }

      return NextResponse.json({
        success: true,
        ticketIds: ticketData.map(t => t.id),
        tickets: ticketData, // Include names for search
        total: ticketData.length,
        truncated: total > MAX_TICKETS,
      });
    } catch (error) {
      console.error('[Helpdesk Ticket IDs] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch ticket IDs' },
        { status: 500 }
      );
    }
  });
}
