import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import {
  getTickets,
  getHelpdeskStages,
  getTicketTypes,
  getTicketAnalytics,
} from '@/lib/odoo';
import {
  getTicketIdsByAIFilters,
  getStoredAnalysesBatch,
  countAnalyzedTickets,
} from '@/lib/db/queries/helpdesk';
import {
  TimePeriod,
  HelpdeskAnalytics,
  TicketStatusCounts,
  TicketAgeBuckets,
  TicketTypeBreakdown,
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
 * GET /api/manager/helpdesk/tickets
 *
 * Get helpdesk tickets with filters and analytics.
 * Query params:
 * - period: 'today' | '7d' | '30d' | 'custom' (default: '30d')
 * - customFrom: ISO date (required if period is 'custom')
 * - customTo: ISO date (required if period is 'custom')
 * - stageIds: comma-separated stage IDs
 * - typeIds: comma-separated type IDs
 * - search: search term
 * - limit: number of results (default 50)
 * - offset: pagination offset (default 0)
 *
 * AI Filter params:
 * - aiUrgency: comma-separated urgency values (critical, high, medium, low)
 * - aiCategory: comma-separated category values
 * - aiSentiment: comma-separated sentiment values (angry, frustrated, neutral, satisfied, grateful)
 * - aiSatisfaction: comma-separated satisfaction levels (1-5)
 * - aiIsResolved: boolean (true/false)
 * - aiAwaitingAnswer: boolean (true = last message not from support)
 * - aiAuthorType: comma-separated author types (support_team, customer, partner)
 * - includeAnalysis: boolean (default false) - include stored AI analysis in response
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
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);

      // Parse AI filters
      const aiUrgencyParam = searchParams.get('aiUrgency');
      const aiCategoryParam = searchParams.get('aiCategory');
      const aiSentimentParam = searchParams.get('aiSentiment');
      const aiSatisfactionParam = searchParams.get('aiSatisfaction');
      const aiIsResolvedParam = searchParams.get('aiIsResolved');
      const aiAwaitingAnswerParam = searchParams.get('aiAwaitingAnswer');
      const aiAuthorTypeParam = searchParams.get('aiAuthorType');
      const includeAnalysis = searchParams.get('includeAnalysis') === 'true';

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
        ? aiSentimentParam.split(',').filter(v => ['angry', 'frustrated', 'neutral', 'satisfied', 'grateful'].includes(v)) as AISentiment[]
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

      // Check if any AI filters are applied
      const hasAIFilters = aiUrgency?.length || aiCategory?.length || aiSentiment?.length ||
        aiSatisfaction?.length || aiIsResolved !== undefined || aiAwaitingAnswer || aiAuthorType?.length;

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
        });

        // If AI filters are active but no tickets match, return empty result
        if (aiFilteredIds.length === 0) {
          const emptyStages = (await getHelpdeskStages()).map(s => ({ ...s, ticketCount: 0 }));
          return NextResponse.json({
            success: true,
            tickets: [],
            total: 0,
            stages: emptyStages,
            ticketTypes: await getTicketTypes(),
            analytics: {
              period: { from: '', to: '', label: period },
              unansweredCount: 0,
              avgFirstResponseTimeHours: 0,
              totalOpen: 0,
              totalResolved: 0,
              openByAgeBucket: { '<24h': 0, '1-3d': 0, '3-7d': 0, '>7d': 0 },
              statusCounts: { unanswered: 0, inProgress: 0, waitingForCustomer: 0, resolved: 0, total: 0 },
              ageBuckets: { '<24h': 0, '1-3d': 0, '3-7d': 0, '>7d': 0 },
              typeBreakdown: [],
              responseTime: { avgFirstResponseHours: 0, avgResolutionHours: 0, medianFirstResponseHours: 0, under24hPercentage: 0 },
            },
            pagination: { total: 0, limit, offset, hasMore: false },
            aiFiltersApplied: true,
          });
        }
      }

      // Calculate date range
      const dateRange = getDateRange(period, customFrom, customTo);

      // Fetch tickets, stages, types, and analytics in parallel
      const [ticketsResult, types, analyticsData] = await Promise.all([
        getTickets({
          ids: aiFilteredIds,
          stageIds,
          typeIds,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          search,
          limit,
          offset,
        }),
        getTicketTypes(),
        getTicketAnalytics({
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
        }),
      ]);

      const { tickets, total, stages } = ticketsResult;

      // Build status counts
      const closedStageIds = new Set(stages.filter(s => s.is_close).map(s => s.id));
      const statusCounts: TicketStatusCounts = {
        unanswered: 0,
        inProgress: 0,
        waitingForCustomer: 0,
        resolved: 0,
        total: analyticsData.totalTickets,
      };

      /**
       * Map stage name to logical status category
       * Uses comprehensive keyword matching for German and English stage names
       */
      function getStageCategory(stageName: string, isClosed: boolean): 'resolved' | 'waitingForCustomer' | 'inProgress' | 'unanswered' {
        if (isClosed) return 'resolved';

        const nameLower = stageName.toLowerCase();

        // Check for waiting/customer response keywords
        if (
          nameLower.includes('warten') ||
          nameLower.includes('waiting') ||
          (nameLower.includes('kunde') && nameLower.includes('antwort')) ||
          (nameLower.includes('customer') && nameLower.includes('response')) ||
          nameLower.includes('rückmeldung') ||
          nameLower.includes('feedback')
        ) {
          return 'waitingForCustomer';
        }

        // Check for in-progress keywords
        if (
          nameLower.includes('bearbeitung') ||
          nameLower.includes('progress') ||
          nameLower.includes('verarbeitung') ||
          nameLower.includes('processing') ||
          nameLower.includes('zugewiesen') ||
          nameLower.includes('assigned') ||
          nameLower.includes('in arbeit')
        ) {
          return 'inProgress';
        }

        // Check for new/open/unanswered keywords - these are truly unanswered
        if (
          nameLower.includes('neu') ||
          nameLower.includes('new') ||
          nameLower.includes('offen') ||
          nameLower.includes('open') ||
          nameLower.includes('eingang') ||
          nameLower.includes('inbox') ||
          nameLower.includes('unbeantwortet') ||
          nameLower.includes('unanswered')
        ) {
          return 'unanswered';
        }

        // Default: treat unknown stages as "in progress" (safer than "unanswered")
        // This prevents inflated unanswered counts for custom stage names
        return 'inProgress';
      }

      // Map stages to logical statuses based on names
      for (const [stageId, count] of analyticsData.ticketsByStage) {
        const stage = stages.find(s => s.id === stageId);
        if (!stage) continue;

        const category = getStageCategory(stage.name, closedStageIds.has(stageId));
        statusCounts[category] += count;
      }

      // Build type breakdown
      const typeBreakdown: TicketTypeBreakdown[] = [];
      for (const [typeId, count] of analyticsData.ticketsByType) {
        const type = types.find(t => t.id === typeId);
        typeBreakdown.push({
          typeId,
          typeName: type?.name || 'Unknown',
          count,
          percentage: analyticsData.totalTickets > 0
            ? Math.round((count / analyticsData.totalTickets) * 100)
            : 0,
        });
      }
      // Sort by count descending
      typeBreakdown.sort((a, b) => b.count - a.count);

      // Build analytics response
      const analytics: HelpdeskAnalytics = {
        period: {
          from: dateRange.from,
          to: dateRange.to,
          label: period,
        },
        // Flat convenience properties for UI
        unansweredCount: statusCounts.unanswered,
        avgFirstResponseTimeHours: analyticsData.avgAgeHours,
        totalOpen: analyticsData.openTickets,
        totalResolved: statusCounts.resolved,
        openByAgeBucket: analyticsData.ticketsByAgeBucket as TicketAgeBuckets,
        // Structured data
        statusCounts,
        ageBuckets: analyticsData.ticketsByAgeBucket as TicketAgeBuckets,
        typeBreakdown,
        responseTime: {
          avgFirstResponseHours: analyticsData.avgAgeHours, // Simplified for now
          avgResolutionHours: 0, // Would need more data to calculate
          medianFirstResponseHours: 0,
          under24hPercentage: analyticsData.totalTickets > 0
            ? Math.round((analyticsData.ticketsByAgeBucket['<24h'] / analyticsData.openTickets) * 100) || 0
            : 0,
        },
      };

      // Optionally fetch AI analyses for the returned tickets
      let analysisMap: Record<number, unknown> | undefined;
      if (includeAnalysis && tickets.length > 0) {
        const ticketIds = tickets.map(t => t.id);
        const analysesResult = await getStoredAnalysesBatch(ticketIds);
        analysisMap = Object.fromEntries(analysesResult);
      }

      // Count how many tickets in the TOTAL filtered result have AI analysis
      // This is used to determine if AI filters should be enabled
      let totalAnalyzedCount = 0;
      if (includeAnalysis && total > 0) {
        // Fetch all ticket IDs matching the filter (without AI filters, up to 2000)
        const MAX_IDS_FOR_COUNT = 2000;
        const allTicketsResult = await getTickets({
          ids: aiFilteredIds, // Only if AI filters were applied
          stageIds,
          typeIds,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          search,
          limit: MAX_IDS_FOR_COUNT,
          offset: 0,
        });
        const allTicketIds = allTicketsResult.tickets.map(t => t.id);
        totalAnalyzedCount = await countAnalyzedTickets(allTicketIds);
      }

      // Enrich stages with ticket counts
      const stagesWithCounts = stages.map(stage => ({
        ...stage,
        ticketCount: analyticsData.ticketsByStage.get(stage.id) || 0,
      }));

      return NextResponse.json({
        success: true,
        tickets,
        total,
        stages: stagesWithCounts,
        ticketTypes: types,  // Match the API client expected field name
        analytics,
        pagination: {
          total,  // Include total in pagination for frontend compatibility
          limit,
          offset,
          hasMore: offset + tickets.length < total,
        },
        ...(hasAIFilters && { aiFiltersApplied: true }),
        ...(analysisMap && { analysisMap }),
        ...(includeAnalysis && { totalAnalyzedCount }),
      });
    } catch (error) {
      console.error('[Helpdesk Tickets] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch tickets' },
        { status: 500 }
      );
    }
  });
}
