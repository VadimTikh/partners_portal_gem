import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import { getTicket, getTicketMessages } from '@/lib/odoo';
import { analyzeTicket, analyzeTicketPhase1, generateResponseSuggestion } from '@/lib/gemini';

/**
 * POST /api/manager/helpdesk/ai/analyze
 *
 * Analyze a ticket using Gemini AI.
 *
 * Request body:
 * - ticketId: number (required)
 * - mode: 'full' | 'quick' | 'response' (default: 'full')
 *   - full: Complete Phase 1 + Phase 2 analysis
 *   - quick: Phase 1 only (faster)
 *   - response: Generate response suggestion (requires previous analysis)
 */
export async function POST(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const body = await request.json();
      const { ticketId, mode = 'full', existingAnalysis } = body;

      if (!ticketId || typeof ticketId !== 'number') {
        return NextResponse.json(
          { error: 'ticketId is required and must be a number' },
          { status: 400 }
        );
      }

      // Fetch ticket and messages
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

      // Handle different analysis modes
      switch (mode) {
        case 'quick': {
          // Phase 1 only - faster
          const analysis = await analyzeTicketPhase1(ticket, messages);
          return NextResponse.json({
            success: true,
            ticketId,
            analysis,
            mode: 'quick',
          });
        }

        case 'response': {
          // Generate response suggestion
          if (!existingAnalysis) {
            return NextResponse.json(
              { error: 'existingAnalysis is required for response mode' },
              { status: 400 }
            );
          }
          const suggestion = await generateResponseSuggestion(ticket, messages, existingAnalysis);
          return NextResponse.json({
            success: true,
            ticketId,
            responseSuggestion: suggestion,
            mode: 'response',
          });
        }

        case 'full':
        default: {
          // Full Phase 1 + Phase 2 analysis
          const analysis = await analyzeTicket(ticket, messages);
          return NextResponse.json({
            success: true,
            ticketId,
            analysis,
            mode: 'full',
          });
        }
      }
    } catch (error) {
      console.error('[AI Analyze] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'AI analysis failed' },
        { status: 500 }
      );
    }
  });
}
