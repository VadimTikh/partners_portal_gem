/**
 * Helpdesk AI database queries
 *
 * Provides functions for managing:
 * - User helpdesk settings (stage preferences)
 * - Stored AI analysis results
 */

import { query, queryOne, queryAll } from '../postgres';
import {
  StoredTicketAnalysis,
  HelpdeskUserSettings,
  FilterPreferences,
  AIUrgency,
  AICategory,
  AICustomerIntent,
  AISentiment,
  MessageAuthorType,
  SatisfactionLevel,
  AIExtractedData,
  ExtendedAIAnalysis,
} from '../../types/helpdesk';

// ============================================
// Type definitions for DB rows
// ============================================

interface UserSettingsRow {
  id: number;
  user_id: string;
  in_progress_stage_ids: number[];
  filter_preferences: FilterPreferences | null;
  created_at: string;
  updated_at: string;
}

interface AIAnalysisRow {
  id: number;
  ticket_id: number;
  analyzed_at: string;
  ticket_write_date: string | null;
  urgency: string;
  urgency_reason: string | null;
  category: string;
  category_confidence: string | null;
  extracted_data: AIExtractedData | null;
  language: string | null;
  summary: string | null;
  customer_intent: string | null;
  action_required: string | null;
  sentiment: string | null;
  satisfaction_level: number | null;
  ai_is_resolved: boolean | null;
  last_message_author_type: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Helper functions
// ============================================

function transformSettingsRow(row: UserSettingsRow): HelpdeskUserSettings {
  return {
    id: row.id,
    userId: row.user_id,
    inProgressStageIds: row.in_progress_stage_ids || [],
    filterPreferences: row.filter_preferences || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function transformAnalysisRow(row: AIAnalysisRow): StoredTicketAnalysis {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    analyzedAt: row.analyzed_at,
    ticketWriteDate: row.ticket_write_date,
    urgency: row.urgency as AIUrgency,
    urgencyReason: row.urgency_reason,
    category: row.category as AICategory,
    categoryConfidence: row.category_confidence ? parseFloat(row.category_confidence) : null,
    extractedData: row.extracted_data,
    language: row.language as 'de' | 'en' | 'other' | null,
    summary: row.summary,
    customerIntent: row.customer_intent as AICustomerIntent | null,
    actionRequired: row.action_required,
    sentiment: row.sentiment as AISentiment | null,
    satisfactionLevel: row.satisfaction_level as SatisfactionLevel | null,
    aiIsResolved: row.ai_is_resolved,
    lastMessageAuthorType: row.last_message_author_type as MessageAuthorType | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// User Settings Queries
// ============================================

/**
 * Get user's helpdesk settings
 */
export async function getUserHelpdeskSettings(
  userId: string
): Promise<HelpdeskUserSettings | null> {
  const row = await queryOne<UserSettingsRow>(
    `SELECT id, user_id, in_progress_stage_ids, filter_preferences, created_at, updated_at
     FROM miomente_partner_helpdesk_user_settings
     WHERE user_id = $1`,
    [userId]
  );

  return row ? transformSettingsRow(row) : null;
}

/**
 * Create or update user's helpdesk settings
 */
export async function upsertUserHelpdeskSettings(
  userId: string,
  inProgressStageIds: number[],
  filterPreferences?: FilterPreferences
): Promise<HelpdeskUserSettings> {
  const result = await queryOne<UserSettingsRow>(
    `INSERT INTO miomente_partner_helpdesk_user_settings (user_id, in_progress_stage_ids, filter_preferences)
     VALUES ($1, $2::jsonb, $3::jsonb)
     ON CONFLICT (user_id)
     DO UPDATE SET
       in_progress_stage_ids = $2::jsonb,
       filter_preferences = COALESCE($3::jsonb, miomente_partner_helpdesk_user_settings.filter_preferences),
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, user_id, in_progress_stage_ids, filter_preferences, created_at, updated_at`,
    [userId, JSON.stringify(inProgressStageIds), filterPreferences ? JSON.stringify(filterPreferences) : null]
  );

  if (!result) {
    throw new Error('Failed to save helpdesk settings');
  }

  return transformSettingsRow(result);
}

/**
 * Update only filter preferences (without changing inProgressStageIds)
 */
export async function updateFilterPreferences(
  userId: string,
  filterPreferences: FilterPreferences
): Promise<HelpdeskUserSettings> {
  const result = await queryOne<UserSettingsRow>(
    `INSERT INTO miomente_partner_helpdesk_user_settings (user_id, in_progress_stage_ids, filter_preferences)
     VALUES ($1, '[]'::jsonb, $2::jsonb)
     ON CONFLICT (user_id)
     DO UPDATE SET
       filter_preferences = $2::jsonb,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, user_id, in_progress_stage_ids, filter_preferences, created_at, updated_at`,
    [userId, JSON.stringify(filterPreferences)]
  );

  if (!result) {
    throw new Error('Failed to save filter preferences');
  }

  return transformSettingsRow(result);
}

// ============================================
// AI Analysis Queries
// ============================================

/**
 * Get stored AI analysis for a single ticket
 */
export async function getStoredAnalysis(
  ticketId: number
): Promise<StoredTicketAnalysis | null> {
  const row = await queryOne<AIAnalysisRow>(
    `SELECT * FROM miomente_partner_helpdesk_ai_analysis
     WHERE ticket_id = $1`,
    [ticketId]
  );

  return row ? transformAnalysisRow(row) : null;
}

/**
 * Get stored AI analyses for multiple tickets
 */
export async function getStoredAnalysesBatch(
  ticketIds: number[]
): Promise<Map<number, StoredTicketAnalysis>> {
  if (ticketIds.length === 0) {
    return new Map();
  }

  const rows = await queryAll<AIAnalysisRow>(
    `SELECT * FROM miomente_partner_helpdesk_ai_analysis
     WHERE ticket_id = ANY($1)`,
    [ticketIds]
  );

  const result = new Map<number, StoredTicketAnalysis>();
  for (const row of rows) {
    result.set(row.ticket_id, transformAnalysisRow(row));
  }

  return result;
}

/**
 * Get all stored analyses with optional filters
 */
export async function getStoredAnalysesFiltered(params: {
  urgency?: AIUrgency[];
  category?: AICategory[];
  sentiment?: AISentiment[];
  satisfactionLevel?: SatisfactionLevel[];
  aiIsResolved?: boolean;
  lastMessageAuthorType?: MessageAuthorType[];
  limit?: number;
  offset?: number;
}): Promise<{ analyses: StoredTicketAnalysis[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.urgency?.length) {
    conditions.push(`urgency = ANY($${paramIndex})`);
    values.push(params.urgency);
    paramIndex++;
  }

  if (params.category?.length) {
    conditions.push(`category = ANY($${paramIndex})`);
    values.push(params.category);
    paramIndex++;
  }

  if (params.sentiment?.length) {
    conditions.push(`sentiment = ANY($${paramIndex})`);
    values.push(params.sentiment);
    paramIndex++;
  }

  if (params.satisfactionLevel?.length) {
    conditions.push(`satisfaction_level = ANY($${paramIndex})`);
    values.push(params.satisfactionLevel);
    paramIndex++;
  }

  if (params.aiIsResolved !== undefined) {
    conditions.push(`ai_is_resolved = $${paramIndex}`);
    values.push(params.aiIsResolved);
    paramIndex++;
  }

  if (params.lastMessageAuthorType?.length) {
    conditions.push(`last_message_author_type = ANY($${paramIndex})`);
    values.push(params.lastMessageAuthorType);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM miomente_partner_helpdesk_ai_analysis ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count || '0', 10);

  // Get paginated results
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  const rows = await queryAll<AIAnalysisRow>(
    `SELECT * FROM miomente_partner_helpdesk_ai_analysis
     ${whereClause}
     ORDER BY analyzed_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  return {
    analyses: rows.map(transformAnalysisRow),
    total,
  };
}

/**
 * Save or update AI analysis for a ticket
 */
export async function upsertTicketAnalysis(
  ticketId: number,
  analysis: ExtendedAIAnalysis,
  ticketWriteDate: string | null
): Promise<StoredTicketAnalysis> {
  const result = await queryOne<AIAnalysisRow>(
    `INSERT INTO miomente_partner_helpdesk_ai_analysis (
      ticket_id, ticket_write_date,
      urgency, urgency_reason, category, category_confidence,
      extracted_data, language,
      summary, customer_intent, action_required, sentiment,
      satisfaction_level, ai_is_resolved, last_message_author_type
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (ticket_id)
    DO UPDATE SET
      ticket_write_date = $2,
      urgency = $3, urgency_reason = $4, category = $5, category_confidence = $6,
      extracted_data = $7, language = $8,
      summary = $9, customer_intent = $10, action_required = $11, sentiment = $12,
      satisfaction_level = $13, ai_is_resolved = $14, last_message_author_type = $15,
      analyzed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      ticketId,
      ticketWriteDate,
      analysis.urgency,
      analysis.urgencyReason || null,
      analysis.category,
      analysis.categoryConfidence || null,
      analysis.extractedData ? JSON.stringify(analysis.extractedData) : null,
      analysis.language || null,
      analysis.summary || null,
      analysis.customerIntent || null,
      analysis.actionRequired || null,
      analysis.sentiment || null,
      analysis.satisfactionLevel || null,
      analysis.aiIsResolved ?? null,
      analysis.lastMessageAuthorType || null,
    ]
  );

  if (!result) {
    throw new Error('Failed to save ticket analysis');
  }

  return transformAnalysisRow(result);
}

/**
 * Bulk upsert AI analyses
 */
export async function upsertTicketAnalysesBatch(
  analyses: Array<{
    ticketId: number;
    analysis: ExtendedAIAnalysis;
    ticketWriteDate: string | null;
  }>
): Promise<StoredTicketAnalysis[]> {
  if (analyses.length === 0) {
    return [];
  }

  // Build VALUES clause
  const values: unknown[] = [];
  const valuePlaceholders: string[] = [];
  let paramIndex = 1;

  for (const { ticketId, analysis, ticketWriteDate } of analyses) {
    valuePlaceholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14})`
    );
    values.push(
      ticketId,
      ticketWriteDate,
      analysis.urgency,
      analysis.urgencyReason || null,
      analysis.category,
      analysis.categoryConfidence || null,
      analysis.extractedData ? JSON.stringify(analysis.extractedData) : null,
      analysis.language || null,
      analysis.summary || null,
      analysis.customerIntent || null,
      analysis.actionRequired || null,
      analysis.sentiment || null,
      analysis.satisfactionLevel || null,
      analysis.aiIsResolved ?? null,
      analysis.lastMessageAuthorType || null
    );
    paramIndex += 15;
  }

  const rows = await queryAll<AIAnalysisRow>(
    `INSERT INTO miomente_partner_helpdesk_ai_analysis (
      ticket_id, ticket_write_date,
      urgency, urgency_reason, category, category_confidence,
      extracted_data, language,
      summary, customer_intent, action_required, sentiment,
      satisfaction_level, ai_is_resolved, last_message_author_type
    )
    VALUES ${valuePlaceholders.join(', ')}
    ON CONFLICT (ticket_id)
    DO UPDATE SET
      ticket_write_date = EXCLUDED.ticket_write_date,
      urgency = EXCLUDED.urgency,
      urgency_reason = EXCLUDED.urgency_reason,
      category = EXCLUDED.category,
      category_confidence = EXCLUDED.category_confidence,
      extracted_data = EXCLUDED.extracted_data,
      language = EXCLUDED.language,
      summary = EXCLUDED.summary,
      customer_intent = EXCLUDED.customer_intent,
      action_required = EXCLUDED.action_required,
      sentiment = EXCLUDED.sentiment,
      satisfaction_level = EXCLUDED.satisfaction_level,
      ai_is_resolved = EXCLUDED.ai_is_resolved,
      last_message_author_type = EXCLUDED.last_message_author_type,
      analyzed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    values
  );

  return rows.map(transformAnalysisRow);
}

/**
 * Delete AI analysis for a ticket
 */
export async function deleteTicketAnalysis(ticketId: number): Promise<boolean> {
  const result = await query(
    `DELETE FROM miomente_partner_helpdesk_ai_analysis WHERE ticket_id = $1`,
    [ticketId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get ticket IDs that have stored analysis
 */
export async function getAnalyzedTicketIds(): Promise<number[]> {
  const rows = await queryAll<{ ticket_id: number }>(
    `SELECT ticket_id FROM miomente_partner_helpdesk_ai_analysis`
  );
  return rows.map(r => r.ticket_id);
}

/**
 * Count how many tickets from a given list have AI analysis stored
 */
export async function countAnalyzedTickets(ticketIds: number[]): Promise<number> {
  if (ticketIds.length === 0) {
    return 0;
  }

  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM miomente_partner_helpdesk_ai_analysis
     WHERE ticket_id = ANY($1)`,
    [ticketIds]
  );

  return parseInt(result?.count || '0', 10);
}

/**
 * Get analyzed ticket IDs from a given list
 * Returns a Set of ticket IDs that have AI analysis stored
 */
export async function getAnalyzedTicketIdsFromList(ticketIds: number[]): Promise<Set<number>> {
  if (ticketIds.length === 0) return new Set();

  const rows = await queryAll<{ ticket_id: number }>(
    `SELECT ticket_id FROM miomente_partner_helpdesk_ai_analysis
     WHERE ticket_id = ANY($1)`,
    [ticketIds]
  );

  return new Set(rows.map(r => r.ticket_id));
}

/**
 * Get ticket IDs filtered by AI criteria
 * Returns ticket IDs that match the given AI filters
 */
export async function getTicketIdsByAIFilters(params: {
  urgency?: AIUrgency[];
  category?: AICategory[];
  sentiment?: AISentiment[];
  satisfactionLevel?: SatisfactionLevel[];
  aiIsResolved?: boolean;
  lastMessageAuthorType?: MessageAuthorType[];
  awaitingAnswer?: boolean;
}): Promise<number[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.urgency?.length) {
    conditions.push(`urgency = ANY($${paramIndex})`);
    values.push(params.urgency);
    paramIndex++;
  }

  if (params.category?.length) {
    conditions.push(`category = ANY($${paramIndex})`);
    values.push(params.category);
    paramIndex++;
  }

  if (params.sentiment?.length) {
    conditions.push(`sentiment = ANY($${paramIndex})`);
    values.push(params.sentiment);
    paramIndex++;
  }

  if (params.satisfactionLevel?.length) {
    conditions.push(`satisfaction_level = ANY($${paramIndex})`);
    values.push(params.satisfactionLevel);
    paramIndex++;
  }

  if (params.aiIsResolved !== undefined) {
    conditions.push(`ai_is_resolved = $${paramIndex}`);
    values.push(params.aiIsResolved);
    paramIndex++;
  }

  if (params.lastMessageAuthorType?.length) {
    conditions.push(`last_message_author_type = ANY($${paramIndex})`);
    values.push(params.lastMessageAuthorType);
    paramIndex++;
  }

  // Awaiting answer = last message not from support team (or null, which means unknown)
  if (params.awaitingAnswer) {
    conditions.push(`(last_message_author_type IS NULL OR last_message_author_type != 'support_team')`);
  }

  if (conditions.length === 0) {
    return [];
  }

  const rows = await queryAll<{ ticket_id: number }>(
    `SELECT ticket_id FROM miomente_partner_helpdesk_ai_analysis
     WHERE ${conditions.join(' AND ')}`,
    values
  );

  return rows.map(r => r.ticket_id);
}
