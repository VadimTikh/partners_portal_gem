import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import { getStoredAnalysesBatch } from '@/lib/db/queries/helpdesk';
import { getTickets } from '@/lib/odoo';
import { StoredTicketAnalysis } from '@/lib/types/helpdesk';

/**
 * GET /api/manager/helpdesk/ai/analysis
 *
 * Get stored AI analyses for specified tickets.
 * Includes staleness detection by comparing analyzed_at with ticket write_date.
 *
 * Query params:
 * - ticketIds: comma-separated list of ticket IDs (required)
 */
export async function GET(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const ticketIdsParam = searchParams.get('ticketIds');

      if (!ticketIdsParam) {
        return NextResponse.json(
          { error: 'ticketIds query parameter is required' },
          { status: 400 }
        );
      }

      // Parse ticket IDs
      const ticketIds = ticketIdsParam
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));

      if (ticketIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid ticket IDs provided' },
          { status: 400 }
        );
      }

      // Limit to prevent abuse
      const MAX_IDS = 200;
      if (ticketIds.length > MAX_IDS) {
        return NextResponse.json(
          { error: `Maximum ${MAX_IDS} ticket IDs allowed` },
          { status: 400 }
        );
      }

      // Get stored analyses (returns a Map)
      const analysesMap = await getStoredAnalysesBatch(ticketIds);
      const analyses = Array.from(analysesMap.values());

      // Get current ticket write_dates to detect staleness
      if (analyses.length > 0) {
        const analyzedTicketIds = analyses.map((a) => a.ticketId);
        const ticketsResult = await getTickets({
          ids: analyzedTicketIds,
        });

        // Create a map of ticket write_dates
        const ticketWriteDates = new Map<string, string>();
        for (const ticket of ticketsResult.tickets) {
          ticketWriteDates.set(String(ticket.id), ticket.write_date);
        }

        // Mark analyses as stale if ticket was modified after analysis
        for (const analysis of analyses) {
          const currentWriteDate = ticketWriteDates.get(String(analysis.ticketId));
          if (currentWriteDate && analysis.ticketWriteDate) {
            const analysisWriteDate = new Date(analysis.ticketWriteDate);
            const ticketModified = new Date(currentWriteDate);
            analysis.isStale = ticketModified > analysisWriteDate;
          } else {
            // If we can't compare, assume not stale
            analysis.isStale = false;
          }
        }
      }

      // Convert to object map for JSON response
      const resultMap: Record<number, StoredTicketAnalysis> = {};
      for (const analysis of analyses) {
        resultMap[analysis.ticketId] = analysis;
      }

      return NextResponse.json({
        success: true,
        analyses,
        analysisMap: resultMap,
        total: analyses.length,
        requested: ticketIds.length,
      });
    } catch (error) {
      console.error('[Stored Analysis GET] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to get analyses' },
        { status: 500 }
      );
    }
  });
}
