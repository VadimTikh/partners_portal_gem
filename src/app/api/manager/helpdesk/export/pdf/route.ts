import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
// Increase timeout for large exports
export const maxDuration = 60;

import { withManager } from '@/lib/auth/middleware';
import { query } from '@/lib/db/postgres';
import { getTicket, getTicketMessages } from '@/lib/odoo';
import { generateTicketsPDF, TicketExportData } from '@/lib/pdf/helpdesk-export';
import { StoredTicketAnalysis, AIExtractedData } from '@/lib/types/helpdesk';

/**
 * POST /api/manager/helpdesk/export/pdf
 *
 * Export tickets to PDF with full details and messages.
 * Returns a PDF file stream.
 */
export async function POST(request: NextRequest) {
  return withManager(request, async () => {
    try {
      // Parse request body
      const body = await request.json();
      const {
        ticketIds,
        includeAnalysis = true,
        includeMessages = true,
        language = 'en',
      } = body as {
        ticketIds: number[];
        includeAnalysis?: boolean;
        includeMessages?: boolean;
        language?: string;
      };

      if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
        return NextResponse.json(
          { error: 'ticketIds array is required' },
          { status: 400 }
        );
      }

      // Limit export size to prevent memory issues
      const MAX_TICKETS = 200;
      const limitedTicketIds = ticketIds.slice(0, MAX_TICKETS);

      console.log(`[PDF Export] Exporting ${limitedTicketIds.length} tickets...`);

      // Fetch stored analyses if needed
      const analysesMap: Map<number, StoredTicketAnalysis> = new Map();
      if (includeAnalysis && limitedTicketIds.length > 0) {
        const placeholders = limitedTicketIds.map((_, i) => `$${i + 1}`).join(', ');
        const result = await query(
          `SELECT
            id, ticket_id, analyzed_at, ticket_write_date,
            urgency, urgency_reason, category, category_confidence,
            extracted_data, language, summary, customer_intent,
            action_required, sentiment, satisfaction_level,
            ai_is_resolved, last_message_author_type,
            created_at, updated_at
          FROM helpdesk_ticket_analysis
          WHERE ticket_id IN (${placeholders})`,
          limitedTicketIds
        );

        for (const row of result.rows) {
          analysesMap.set(row.ticket_id, {
            id: row.id,
            ticketId: row.ticket_id,
            analyzedAt: row.analyzed_at,
            ticketWriteDate: row.ticket_write_date,
            urgency: row.urgency,
            urgencyReason: row.urgency_reason,
            category: row.category,
            categoryConfidence: row.category_confidence ? parseFloat(row.category_confidence) : null,
            extractedData: row.extracted_data as AIExtractedData | null,
            language: row.language,
            summary: row.summary,
            customerIntent: row.customer_intent,
            actionRequired: row.action_required,
            sentiment: row.sentiment,
            satisfactionLevel: row.satisfaction_level,
            aiIsResolved: row.ai_is_resolved,
            lastMessageAuthorType: row.last_message_author_type,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          });
        }
      }

      // Fetch tickets and messages in batches to avoid overloading
      const BATCH_SIZE = 10;
      const ticketExportData: TicketExportData[] = [];

      for (let i = 0; i < limitedTicketIds.length; i += BATCH_SIZE) {
        const batchIds = limitedTicketIds.slice(i, i + BATCH_SIZE);

        // Fetch tickets and messages in parallel for this batch
        const batchPromises = batchIds.map(async (ticketId) => {
          try {
            const [ticket, messages] = await Promise.all([
              getTicket(ticketId),
              includeMessages ? getTicketMessages(ticketId) : Promise.resolve([]),
            ]);

            if (ticket) {
              return {
                ticket,
                analysis: analysesMap.get(ticketId),
                messages: includeMessages ? messages : undefined,
              };
            }
            return null;
          } catch (error) {
            console.error(`[PDF Export] Failed to fetch ticket ${ticketId}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        for (const result of batchResults) {
          if (result !== null) {
            ticketExportData.push(result);
          }
        }
      }

      if (ticketExportData.length === 0) {
        return NextResponse.json(
          { error: 'No tickets found to export' },
          { status: 404 }
        );
      }

      console.log(`[PDF Export] Generating PDF for ${ticketExportData.length} tickets...`);

      // Generate PDF
      const pdfBuffer = await generateTicketsPDF(ticketExportData, {
        includeAnalysis,
        includeMessages,
        language,
      });

      // Generate filename
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `helpdesk-tickets-${dateStr}.pdf`;

      // Return PDF as response
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });

    } catch (error) {
      console.error('[PDF Export] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to export tickets' },
        { status: 500 }
      );
    }
  });
}
