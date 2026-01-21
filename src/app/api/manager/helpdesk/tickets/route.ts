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
  TimePeriod,
  HelpdeskAnalytics,
  TicketStatusCounts,
  TicketAgeBuckets,
  TicketTypeBreakdown,
} from '@/lib/types/helpdesk';

/**
 * Calculate date range from period
 */
function getDateRange(period: TimePeriod, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  if (period === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }

  let from: Date;
  switch (period) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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
 */
export async function GET(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const { searchParams } = new URL(request.url);

      // Parse filters
      const period = (searchParams.get('period') || '30d') as TimePeriod;
      const customFrom = searchParams.get('customFrom') || undefined;
      const customTo = searchParams.get('customTo') || undefined;
      const stageIdsParam = searchParams.get('stageIds');
      const typeIdsParam = searchParams.get('typeIds');
      const search = searchParams.get('search') || undefined;
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);

      const stageIds = stageIdsParam
        ? stageIdsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id))
        : undefined;

      const typeIds = typeIdsParam
        ? typeIdsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id))
        : undefined;

      // Calculate date range
      const dateRange = getDateRange(period, customFrom, customTo);

      // Fetch tickets, stages, types, and analytics in parallel
      const [ticketsResult, types, analyticsData] = await Promise.all([
        getTickets({
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

      // Map stages to logical statuses based on names
      for (const [stageId, count] of analyticsData.ticketsByStage) {
        const stage = stages.find(s => s.id === stageId);
        if (!stage) continue;

        if (closedStageIds.has(stageId)) {
          statusCounts.resolved += count;
        } else {
          const nameLower = stage.name.toLowerCase();
          if (nameLower.includes('warten') || nameLower.includes('waiting') || nameLower.includes('kunde')) {
            statusCounts.waitingForCustomer += count;
          } else if (nameLower.includes('bearbeitung') || nameLower.includes('progress')) {
            statusCounts.inProgress += count;
          } else {
            statusCounts.unanswered += count;
          }
        }
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

      return NextResponse.json({
        success: true,
        tickets,
        total,
        stages,
        types,
        analytics,
        pagination: {
          limit,
          offset,
          hasMore: offset + tickets.length < total,
        },
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
