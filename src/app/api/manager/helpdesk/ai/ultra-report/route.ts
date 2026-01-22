import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import { getStoredAnalysesBatch } from '@/lib/db/queries/helpdesk';
import { generateUltraReport } from '@/lib/gemini';
import {
  UltraAnalysisAggregatedData,
  UltraAnalysisReport,
  AICategory,
  AIUrgency,
  AISentiment,
  AICustomerIntent,
  StoredTicketAnalysis,
} from '@/lib/types/helpdesk';

/**
 * POST /api/manager/helpdesk/ai/ultra-report
 *
 * Generate a comprehensive ultra analysis report from ticket analyses.
 *
 * Request body:
 * - ticketIds: number[] - Array of ticket IDs to include in report
 * - language: string - Output language (de, en, uk)
 * - period: { from: string; to: string } - Date range for the report
 */
export async function POST(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const body = await request.json();
      const { ticketIds, language = 'en', period } = body;

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

      console.log(`[Ultra Report] Starting report generation for ${validTicketIds.length} tickets`);
      const startTime = Date.now();

      // Fetch all stored analyses
      const analysesMap = await getStoredAnalysesBatch(validTicketIds);
      const analyses = Array.from(analysesMap.values());

      if (analyses.length === 0) {
        return NextResponse.json(
          { error: 'No AI analyses found for the provided tickets. Please run AI analysis first.' },
          { status: 400 }
        );
      }

      console.log(`[Ultra Report] Found ${analyses.length} analyses`);

      // Build aggregated data
      const aggregatedData = buildAggregatedData(analyses, period);

      console.log(`[Ultra Report] Aggregated data: ${aggregatedData.categoryDistribution.length} categories, ${aggregatedData.topSummaries.length} summaries`);

      // Generate ultra report using Gemini
      const report = await generateUltraReport(aggregatedData, language);

      const duration = Date.now() - startTime;
      console.log(`[Ultra Report] Complete in ${duration}ms`);

      return NextResponse.json({
        success: true,
        report,
      });
    } catch (error) {
      console.error('[Ultra Report] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to generate ultra report' },
        { status: 500 }
      );
    }
  });
}

/**
 * Build aggregated data from stored analyses
 */
function buildAggregatedData(
  analyses: StoredTicketAnalysis[],
  period?: { from: string; to: string }
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
      const existing = summariesByCategory.get(a.category) || [];
      summariesByCategory.set(a.category, [...existing, a]);
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

  // Determine period from data if not provided
  const dates = analyses
    .map(a => a.analyzedAt)
    .filter((d): d is string => !!d)
    .sort();

  const effectivePeriod = period || {
    from: dates[0] || new Date().toISOString(),
    to: dates[dates.length - 1] || new Date().toISOString(),
  };

  return {
    totalTickets: analyses.length,
    period: effectivePeriod,
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
