import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import { getTickets, getTicketMessagesBatch } from '@/lib/odoo';
import { analyzeTicketsFullBatch } from '@/lib/gemini';
import {
  getStoredAnalysesBatch,
  upsertTicketAnalysesBatch,
} from '@/lib/db/queries/helpdesk';
import { BatchAnalysisResult, Ticket } from '@/lib/types/helpdesk';

/**
 * POST /api/manager/helpdesk/ai/analyze-batch
 *
 * Batch analyze multiple tickets using Gemini AI with parallel processing.
 * ~5x faster than sequential processing by using:
 * - Batch fetching of existing analyses from DB
 * - Batch fetching of tickets from Odoo
 * - Batch fetching of messages from Odoo
 * - Parallel Gemini API calls (concurrency=5)
 * - Batch upsert to PostgreSQL
 *
 * Request body:
 * - ticketIds: number[] - Array of ticket IDs to analyze
 * - forceReanalyze?: boolean - Re-analyze even if existing analysis exists
 * - language?: string - Output language (de, en, uk)
 */
export async function POST(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const body = await request.json();
      const { ticketIds, forceReanalyze = false, language = 'en' } = body;

      // Validate input
      if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
        return NextResponse.json(
          { error: 'ticketIds must be a non-empty array of numbers' },
          { status: 400 }
        );
      }

      // Validate ticket IDs
      const validTicketIds = ticketIds.filter(
        (id): id is number => typeof id === 'number' && !isNaN(id)
      );

      if (validTicketIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid ticket IDs provided' },
          { status: 400 }
        );
      }

      // Limit batch size
      const MAX_BATCH_SIZE = 50;
      const limitedIds = validTicketIds.slice(0, MAX_BATCH_SIZE);

      console.log(`[Batch Analysis] Starting batch of ${limitedIds.length} tickets, forceReanalyze=${forceReanalyze}`);
      const startTime = Date.now();

      // Step 1: Batch fetch existing analyses from DB
      const existingAnalyses = await getStoredAnalysesBatch(limitedIds);
      console.log(`[Batch Analysis] Found ${existingAnalyses.size} existing analyses`);

      // Step 2: Batch fetch all tickets from Odoo
      const { tickets: allTickets } = await getTickets({ ids: limitedIds });
      const ticketMap = new Map<number, Ticket>(allTickets.map(t => [t.id, t]));
      console.log(`[Batch Analysis] Fetched ${allTickets.length} tickets from Odoo`);

      // Step 3: Determine which tickets need (re)analysis
      const ticketsToAnalyze: Ticket[] = [];
      const freshAnalyses: Array<{
        ticketId: number;
        analysis: NonNullable<ReturnType<typeof existingAnalyses.get>>;
      }> = [];

      for (const id of limitedIds) {
        const ticket = ticketMap.get(id);
        if (!ticket) {
          console.warn(`[Batch Analysis] Ticket ${id} not found in Odoo`);
          continue;
        }

        const existing = existingAnalyses.get(id);
        if (existing && !forceReanalyze) {
          // Check if analysis is stale (ticket was modified after analysis)
          const analysisDate = new Date(existing.analyzedAt);
          const ticketModified = new Date(ticket.write_date);
          if (ticketModified <= analysisDate) {
            // Analysis is still fresh, skip
            freshAnalyses.push({ ticketId: id, analysis: existing });
            continue;
          }
        }
        ticketsToAnalyze.push(ticket);
      }

      console.log(`[Batch Analysis] ${freshAnalyses.length} fresh, ${ticketsToAnalyze.length} need analysis`);

      const result: BatchAnalysisResult = {
        total: limitedIds.length,
        succeeded: freshAnalyses.length,
        failed: 0,
        analyses: freshAnalyses.map(f => f.analysis),
        errors: [],
      };

      // Step 4: If no tickets need analysis, return early
      if (ticketsToAnalyze.length === 0) {
        const duration = Date.now() - startTime;
        console.log(`[Batch Analysis] Complete (all fresh) in ${duration}ms`);
        return NextResponse.json({ success: true, result });
      }

      // Step 5: Batch fetch messages for tickets needing analysis
      const messagesMap = await getTicketMessagesBatch(ticketsToAnalyze.map(t => t.id));
      console.log(`[Batch Analysis] Fetched messages for ${messagesMap.size} tickets`);

      // Step 6: Parallel analyze using Gemini (concurrency=5)
      const ticketsWithMessages = ticketsToAnalyze.map(ticket => ({
        ticket,
        messages: messagesMap.get(ticket.id) || [],
      }));

      const { results: analysisResults, errors: analysisErrors } = await analyzeTicketsFullBatch(
        ticketsWithMessages,
        language,
        5 // concurrency
      );

      console.log(`[Batch Analysis] Gemini analyzed ${analysisResults.size} tickets, ${analysisErrors.length} errors`);

      // Add errors to result
      result.errors = analysisErrors;
      result.failed = analysisErrors.length;

      // Step 7: Batch upsert successful analyses to database
      const toStore = [...analysisResults.entries()].map(([ticketId, analysis]) => ({
        ticketId,
        analysis,
        ticketWriteDate: ticketMap.get(ticketId)?.write_date || null,
      }));

      if (toStore.length > 0) {
        const storedAnalyses = await upsertTicketAnalysesBatch(toStore);
        result.analyses.push(...storedAnalyses);
        result.succeeded += storedAnalyses.length;
        console.log(`[Batch Analysis] Stored ${storedAnalyses.length} analyses in DB`);
      }

      // Account for tickets not found in Odoo
      const notFoundCount = limitedIds.length - ticketMap.size;
      if (notFoundCount > 0) {
        result.failed += notFoundCount;
        const notFoundIds = limitedIds.filter(id => !ticketMap.has(id));
        for (const id of notFoundIds) {
          result.errors?.push({ ticketId: id, error: 'Ticket not found' });
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[Batch Analysis] Complete in ${duration}ms: ${result.succeeded} succeeded, ${result.failed} failed`);

      return NextResponse.json({ success: true, result });
    } catch (error) {
      console.error('[Batch Analysis] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Batch analysis failed' },
        { status: 500 }
      );
    }
  });
}
