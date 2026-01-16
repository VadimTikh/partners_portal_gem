/**
 * Activity log database queries (PostgreSQL)
 *
 * Tracks partner activities for manager visibility.
 */

import { queryOne, queryAll, query } from '../postgres';

export type ActivityActionType =
  | 'course_request_created'
  | 'date_added'
  | 'date_edited'
  | 'date_deleted'
  | 'password_changed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'login';

export interface DbActivityLog {
  id: number;
  user_id: string;
  partner_email: string;
  partner_name: string;
  action_type: ActivityActionType;
  entity_type: string | null;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  customer_number: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface CreateActivityLogInput {
  userId: string;
  partnerEmail: string;
  partnerName: string;
  actionType: ActivityActionType;
  entityType?: string;
  entityId?: number;
  details?: Record<string, unknown>;
  customerNumber?: string;
  ipAddress?: string;
}

export interface ActivityLogFilters {
  userId?: string;
  actionType?: ActivityActionType;
  customerNumber?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Create a new activity log entry
 */
export async function createActivityLog(input: CreateActivityLogInput): Promise<DbActivityLog | null> {
  return queryOne<DbActivityLog>(
    `INSERT INTO miomente_partner_activity_logs (
      user_id, partner_email, partner_name, action_type,
      entity_type, entity_id, details, customer_number, ip_address
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9
    ) RETURNING *`,
    [
      input.userId,
      input.partnerEmail,
      input.partnerName,
      input.actionType,
      input.entityType || null,
      input.entityId || null,
      input.details ? JSON.stringify(input.details) : null,
      input.customerNumber || null,
      input.ipAddress || null,
    ]
  );
}

/**
 * Get activity logs with filters (for manager dashboard)
 */
export async function getActivityLogs(filters: ActivityLogFilters = {}): Promise<DbActivityLog[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.userId);
  }

  if (filters.actionType) {
    conditions.push(`action_type = $${paramIndex++}`);
    params.push(filters.actionType);
  }

  if (filters.customerNumber) {
    conditions.push(`customer_number = $${paramIndex++}`);
    params.push(filters.customerNumber);
  }

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  return queryAll<DbActivityLog>(
    `SELECT * FROM miomente_partner_activity_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${offset}`
    ,
    params
  );
}

/**
 * Get activity log count with filters
 */
export async function getActivityLogCount(filters: ActivityLogFilters = {}): Promise<number> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.userId);
  }

  if (filters.actionType) {
    conditions.push(`action_type = $${paramIndex++}`);
    params.push(filters.actionType);
  }

  if (filters.customerNumber) {
    conditions.push(`customer_number = $${paramIndex++}`);
    params.push(filters.customerNumber);
  }

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM miomente_partner_activity_logs ${whereClause}`,
    params
  );

  return parseInt(result?.count || '0', 10);
}

/**
 * Get activity stats per partner (for dashboard overview)
 */
export async function getPartnerActivityStats(userId: string): Promise<{
  courseRequestsCreated: number;
  datesAdded: number;
  datesEdited: number;
  datesDeleted: number;
  passwordChanges: number;
  passwordResets: number;
}> {
  const result = await queryOne<{
    course_requests_created: string;
    dates_added: string;
    dates_edited: string;
    dates_deleted: string;
    password_changes: string;
    password_resets: string;
  }>(
    `SELECT
      COUNT(*) FILTER (WHERE action_type = 'course_request_created') as course_requests_created,
      COUNT(*) FILTER (WHERE action_type = 'date_added') as dates_added,
      COUNT(*) FILTER (WHERE action_type = 'date_edited') as dates_edited,
      COUNT(*) FILTER (WHERE action_type = 'date_deleted') as dates_deleted,
      COUNT(*) FILTER (WHERE action_type = 'password_changed') as password_changes,
      COUNT(*) FILTER (WHERE action_type IN ('password_reset_requested', 'password_reset_completed')) as password_resets
     FROM miomente_partner_activity_logs
     WHERE user_id = $1`,
    [userId]
  );

  return {
    courseRequestsCreated: parseInt(result?.course_requests_created || '0', 10),
    datesAdded: parseInt(result?.dates_added || '0', 10),
    datesEdited: parseInt(result?.dates_edited || '0', 10),
    datesDeleted: parseInt(result?.dates_deleted || '0', 10),
    passwordChanges: parseInt(result?.password_changes || '0', 10),
    passwordResets: parseInt(result?.password_resets || '0', 10),
  };
}

/**
 * Get all unique partners who have activity logs
 */
export async function getActivePartners(): Promise<Array<{ user_id: string; partner_name: string; partner_email: string }>> {
  return queryAll<{ user_id: string; partner_name: string; partner_email: string }>(
    `SELECT DISTINCT ON (user_id) user_id, partner_name, partner_email
     FROM miomente_partner_activity_logs
     ORDER BY user_id, created_at DESC`
  );
}

/**
 * Transform database log to API response format
 */
export function transformActivityLog(dbLog: DbActivityLog): {
  id: number;
  userId: string;
  partnerEmail: string;
  partnerName: string;
  actionType: string;
  entityType: string | null;
  entityId: number | null;
  details: Record<string, unknown> | null;
  customerNumber: string | null;
  ipAddress: string | null;
  createdAt: string;
} {
  return {
    id: dbLog.id,
    userId: dbLog.user_id,
    partnerEmail: dbLog.partner_email,
    partnerName: dbLog.partner_name,
    actionType: dbLog.action_type,
    entityType: dbLog.entity_type,
    entityId: dbLog.entity_id,
    details: dbLog.details,
    customerNumber: dbLog.customer_number,
    ipAddress: dbLog.ip_address,
    createdAt: dbLog.created_at,
  };
}
