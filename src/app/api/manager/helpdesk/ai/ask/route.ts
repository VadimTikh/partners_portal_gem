import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import { getStoredAnalysesBatch } from '@/lib/db/queries/helpdesk';
import { askAboutTickets } from '@/lib/gemini';
import {
  UltraAnalysisAggregatedData,
  AICategory,
  AIUrgency,
  AISentiment,
  AICustomerIntent,
  StoredTicketAnalysis,
} from '@/lib/types/helpdesk';

/**
 * POST /api/manager/helpdesk/ai/ask
 *
 * Ask AI a custom question about helpdesk ticket data.
 *
 * Request body:
 * - ticketIds: number[] - Array of ticket IDs to analyze
 * - question: string - User's question about the ticket data
 * - language: string - Output language (de, en, uk)
 */
export async function POST(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const body = await request.json();
      const { ticketIds, question, language = 'en' } = body;

      // Validate input
      if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
        return NextResponse.json(
          { error: 'ticketIds must be a non-empty array of numbers' },
          { status: 400 }
        );
      }

      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return NextResponse.json(
          { error: 'question must be a non-empty string' },
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

      console.log(`[Ask AI] Processing question for ${validTicketIds.length} tickets`);
      const startTime = Date.now();

      // Fetch all stored analyses
      const analysesMap = await getStoredAnalysesBatch(validTicketIds);
      const analyses = Array.from(analysesMap.values());

      if (analyses.length === 0) {
        const noAnalysisMessage =
          language === 'de'
            ? 'Keine AI-Analysen für die ausgewählten Tickets gefunden. Bitte führen Sie zuerst eine AI-Analyse durch.'
            : language === 'uk'
            ? 'Не знайдено AI-аналізу для вибраних тікетів. Будь ласка, спочатку запустіть AI-аналіз.'
            : 'No AI analyses found for the selected tickets. Please run AI analysis first.';
        return NextResponse.json({
          success: true,
          answer: noAnalysisMessage,
          ticketCount: validTicketIds.length,
          analyzedCount: 0,
        });
      }

      console.log(`[Ask AI] Found ${analyses.length} analyses`);

      // Build aggregated data
      const aggregatedData = buildAggregatedData(analyses);

      // Call Gemini to answer the question
      const answer = await askAboutTickets(aggregatedData, question.trim(), language);

      const duration = Date.now() - startTime;
      console.log(`[Ask AI] Complete in ${duration}ms`);

      return NextResponse.json({
        success: true,
        answer,
        ticketCount: validTicketIds.length,
        analyzedCount: analyses.length,
      });
    } catch (error) {
      console.error('[Ask AI] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to process question' },
        { status: 500 }
      );
    }
  });
}

/**
 * Build aggregated data from stored analyses
 */
function buildAggregatedData(
  analyses: StoredTicketAnalysis[]
): UltraAnalysisAggregatedData {
  // Category distribution
  const categoryCount = new Map<AICategory, number>();
  for (const a of analyses) {
    if (a.category) {
      categoryCount.set(a.category, (categoryCount.get(a.category) || 0) + 1);
    }
  }

  // Urgency distribution
  const urgencyCount = new Map<AIUrgency, number>();
  for (const a of analyses) {
    if (a.urgency) {
      urgencyCount.set(a.urgency, (urgencyCount.get(a.urgency) || 0) + 1);
    }
  }

  // Sentiment distribution
  const sentimentCount = new Map<AISentiment, number>();
  for (const a of analyses) {
    if (a.sentiment) {
      sentimentCount.set(a.sentiment, (sentimentCount.get(a.sentiment) || 0) + 1);
    }
  }

  // Intent distribution
  const intentCount = new Map<AICustomerIntent, number>();
  for (const a of analyses) {
    if (a.customerIntent) {
      intentCount.set(a.customerIntent, (intentCount.get(a.customerIntent) || 0) + 1);
    }
  }

  // Get top summaries per category (max 5 per category, max 50 total)
  const summariesByCategory = new Map<AICategory, StoredTicketAnalysis[]>();
  for (const a of analyses) {
    if (a.category && a.summary) {
      const existing = summariesByCategory.get(a.category);
      if (existing) {
        existing.push(a);
      } else {
        summariesByCategory.set(a.category, [a]);
      }
    }
  }

  const topSummaries: UltraAnalysisAggregatedData['topSummaries'] = [];
  const MAX_PER_CATEGORY = 5;
  const MAX_TOTAL = 50;

  // Prioritize by urgency (critical > high > medium > low) within each category
  const urgencyOrder: AIUrgency[] = ['critical', 'high', 'medium', 'low'];

  for (const [category, categoryAnalyses] of summariesByCategory) {
    // Sort by urgency
    const sorted = categoryAnalyses.sort((a, b) => {
      const aIdx = urgencyOrder.indexOf(a.urgency);
      const bIdx = urgencyOrder.indexOf(b.urgency);
      return aIdx - bIdx;
    });

    // Take top N for this category
    const top = sorted.slice(0, MAX_PER_CATEGORY);
    for (const a of top) {
      if (topSummaries.length >= MAX_TOTAL) break;
      topSummaries.push({
        ticketId: a.ticketId,
        category: a.category,
        summary: a.summary || '',
        urgency: a.urgency,
        sentiment: a.sentiment || undefined,
      });
    }
    if (topSummaries.length >= MAX_TOTAL) break;
  }

  // Determine period from data
  const dates = analyses
    .map(a => a.analyzedAt)
    .filter((d): d is string => !!d)
    .sort();

  const period = {
    from: dates[0] || new Date().toISOString(),
    to: dates[dates.length - 1] || new Date().toISOString(),
  };

  return {
    totalTickets: analyses.length,
    period,
    categoryDistribution: Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    urgencyDistribution: Array.from(urgencyCount.entries())
      .map(([urgency, count]) => ({ urgency, count }))
      .sort((a, b) => {
        const order: AIUrgency[] = ['critical', 'high', 'medium', 'low'];
        return order.indexOf(a.urgency) - order.indexOf(b.urgency);
      }),
    sentimentDistribution: Array.from(sentimentCount.entries())
      .map(([sentiment, count]) => ({ sentiment, count }))
      .sort((a, b) => b.count - a.count),
    intentDistribution: Array.from(intentCount.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count),
    topSummaries,
  };
}
