/**
 * App log database queries (PostgreSQL)
 *
 * Tracks all API/database operations for monitoring and debugging.
 */

import { queryOne, queryAll } from '../postgres';
import { AppLogStatus } from '@/lib/types';

export interface DbAppLog {
  id: number;
  timestamp: string;
  endpoint: string;
  method: string;
  action: string;
  status: AppLogStatus;
  status_code: number;
  error_message: string | null;
  error_code: string | null;
  error_stack: string | null;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  request_body: Record<string, unknown> | null;
  response_summary: Record<string, unknown> | null;
  duration_ms: number;
  ip_address: string | null;
}

export interface CreateAppLogInput {
  endpoint: string;
  method: string;
  action: string;
  status: AppLogStatus;
  statusCode: number;
  errorMessage?: string;
  errorCode?: string;
  errorStack?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  requestBody?: Record<string, unknown>;
  responseSummary?: Record<string, unknown>;
  durationMs: number;
  ipAddress?: string;
}

export interface AppLogFilters {
  status?: AppLogStatus | 'all_errors';
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Create a new app log entry
 */
export async function createAppLog(input: CreateAppLogInput): Promise<DbAppLog | null> {
  return queryOne<DbAppLog>(
    `INSERT INTO miomente_partner_app_logs (
      endpoint, method, action, status, status_code,
      error_message, error_code, error_stack,
      user_id, user_email, user_role,
      request_body, response_summary, duration_ms, ip_address
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15
    ) RETURNING *`,
    [
      input.endpoint,
      input.method,
      input.action,
      input.status,
      input.statusCode,
      input.errorMessage || null,
      input.errorCode || null,
      input.errorStack || null,
      input.userId || null,
      input.userEmail || null,
      input.userRole || null,
      input.requestBody ? JSON.stringify(input.requestBody) : null,
      input.responseSummary ? JSON.stringify(input.responseSummary) : null,
      input.durationMs,
      input.ipAddress || null,
    ]
  );
}

/**
 * Get app logs with filters
 */
export async function getAppLogs(filters: AppLogFilters = {}): Promise<DbAppLog[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Handle 'all_errors' filter specially
  if (filters.status === 'all_errors') {
    conditions.push(`status IN ('error', 'validation_error')`);
  } else if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(filters.action);
  }

  if (filters.startDate) {
    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(filters.endDate + ' 23:59:59');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  return queryAll<DbAppLog>(
    `SELECT * FROM miomente_partner_app_logs
     ${whereClause}
     ORDER BY timestamp DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
}

/**
 * Get app log count with filters
 */
export async function getAppLogCount(filters: AppLogFilters = {}): Promise<number> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Handle 'all_errors' filter specially
  if (filters.status === 'all_errors') {
    conditions.push(`status IN ('error', 'validation_error')`);
  } else if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(filters.action);
  }

  if (filters.startDate) {
    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(filters.endDate + ' 23:59:59');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM miomente_partner_app_logs ${whereClause}`,
    params
  );

  return parseInt(result?.count || '0', 10);
}

/**
 * Get all unique actions from app logs (for filter dropdown)
 */
export async function getUniqueActions(): Promise<string[]> {
  const result = await queryAll<{ action: string }>(
    `SELECT DISTINCT action FROM miomente_partner_app_logs ORDER BY action ASC`
  );
  return result.map(r => r.action);
}

/**
 * Get error statistics for dashboard
 */
export async function getAppLogStats(): Promise<{
  totalLogs: number;
  errorCount: number;
  validationErrorCount: number;
  successCount: number;
  last24hErrors: number;
}> {
  const result = await queryOne<{
    total_logs: string;
    error_count: string;
    validation_error_count: string;
    success_count: string;
    last_24h_errors: string;
  }>(
    `SELECT
      COUNT(*) as total_logs,
      COUNT(*) FILTER (WHERE status = 'error') as error_count,
      COUNT(*) FILTER (WHERE status = 'validation_error') as validation_error_count,
      COUNT(*) FILTER (WHERE status = 'success') as success_count,
      COUNT(*) FILTER (WHERE status IN ('error', 'validation_error') AND timestamp > NOW() - INTERVAL '24 hours') as last_24h_errors
     FROM miomente_partner_app_logs`
  );

  return {
    totalLogs: parseInt(result?.total_logs || '0', 10),
    errorCount: parseInt(result?.error_count || '0', 10),
    validationErrorCount: parseInt(result?.validation_error_count || '0', 10),
    successCount: parseInt(result?.success_count || '0', 10),
    last24hErrors: parseInt(result?.last_24h_errors || '0', 10),
  };
}

/**
 * Transform database log to API response format
 */
export function transformAppLog(dbLog: DbAppLog): {
  id: number;
  timestamp: string;
  endpoint: string;
  method: string;
  action: string;
  status: AppLogStatus;
  statusCode: number;
  errorMessage: string | null;
  errorCode: string | null;
  errorStack: string | null;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  requestBody: Record<string, unknown> | null;
  responseSummary: Record<string, unknown> | null;
  durationMs: number;
  ipAddress: string | null;
} {
  return {
    id: dbLog.id,
    timestamp: dbLog.timestamp,
    endpoint: dbLog.endpoint,
    method: dbLog.method,
    action: dbLog.action,
    status: dbLog.status,
    statusCode: dbLog.status_code,
    errorMessage: dbLog.error_message,
    errorCode: dbLog.error_code,
    errorStack: dbLog.error_stack,
    userId: dbLog.user_id,
    userEmail: dbLog.user_email,
    userRole: dbLog.user_role,
    requestBody: dbLog.request_body,
    responseSummary: dbLog.response_summary,
    durationMs: dbLog.duration_ms,
    ipAddress: dbLog.ip_address,
  };
}
