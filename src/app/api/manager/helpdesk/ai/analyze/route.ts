import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import { getTicket, getTicketMessages } from '@/lib/odoo';
import { analyzeTicket, analyzeTicketPhase1, analyzeTicketPhase2, generateResponseSuggestion } from '@/lib/gemini';

/**
 * POST /api/manager/helpdesk/ai/analyze
 *
 * Analyze a ticket using Gemini AI.
 *
 * Request body:
 * - ticketId: number (required)
 * - mode: 'full' | 'quick' | 'phase2' | 'response' (default: 'full')
 *   - full: Complete Phase 1 + Phase 2 analysis (single long request)
 *   - quick: Phase 1 only (faster)
 *   - phase2: Phase 2 only (requires phase1Analysis in body) - for splitting analysis into 2 shorter requests
 *   - response: Generate response suggestion (requires previous analysis)
 * - phase1Analysis: object (required for mode='phase2') - Phase 1 analysis results
 * - language: 'de' | 'en' | 'uk' (default: 'en') - output language for urgencyReason, summary, actionRequired
 */
export async function POST(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const body = await request.json();
      const { ticketId, mode = 'full', existingAnalysis, phase1Analysis, language = 'en' } = body;

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
          const analysis = await analyzeTicketPhase1(ticket, messages, language);
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

        case 'phase2': {
          // Phase 2 only - requires Phase 1 results
          // Used for splitting full analysis into 2 shorter requests to avoid timeouts
          if (!phase1Analysis) {
            return NextResponse.json(
              { error: 'phase1Analysis is required for phase2 mode' },
              { status: 400 }
            );
          }
          const analysis = await analyzeTicketPhase2(ticket, messages, phase1Analysis, language);
          return NextResponse.json({
            success: true,
            ticketId,
            analysis,
            mode: 'phase2',
          });
        }

        case 'full':
        default: {
          // Full Phase 1 + Phase 2 analysis
          const analysis = await analyzeTicket(ticket, messages, language);
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
