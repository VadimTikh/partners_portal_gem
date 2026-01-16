import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import {
  getAppLogs,
  getAppLogCount,
  getUniqueActions,
  getAppLogStats,
  transformAppLog,
  AppLogFilters,
} from '@/lib/db/queries/app-logs';
import { AppLogStatus } from '@/lib/types';

/**
 * GET /api/manager/app-logs
 *
 * Get app logs with optional filters.
 * Query params:
 * - status: Filter by status ('success' | 'error' | 'validation_error' | 'all_errors')
 * - action: Filter by action type
 * - startDate: Filter by start date (YYYY-MM-DD)
 * - endDate: Filter by end date (YYYY-MM-DD)
 * - limit: Number of results (default 50)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const { searchParams } = new URL(request.url);

      const statusParam = searchParams.get('status');
      const filters: AppLogFilters = {
        status: statusParam as AppLogStatus | 'all_errors' | undefined,
        action: searchParams.get('action') || undefined,
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
        limit: parseInt(searchParams.get('limit') || '50', 10),
        offset: parseInt(searchParams.get('offset') || '0', 10),
      };

      const [logs, total, actions, stats] = await Promise.all([
        getAppLogs(filters),
        getAppLogCount(filters),
        getUniqueActions(),
        getAppLogStats(),
      ]);

      return NextResponse.json({
        success: true,
        logs: logs.map(transformAppLog),
        total,
        actions,
        stats,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          hasMore: (filters.offset || 0) + logs.length < total,
        },
      });
    } catch (error) {
      console.error('[Get App Logs] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch app logs' },
        { status: 500 }
      );
    }
  });
}
