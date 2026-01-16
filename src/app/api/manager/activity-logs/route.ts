import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import {
  getActivityLogs,
  getActivityLogCount,
  getActivePartners,
  transformActivityLog,
  ActivityActionType,
} from '@/lib/db/queries/activity-logs';

/**
 * GET /api/manager/activity-logs
 *
 * Get activity logs with optional filters.
 * Query params:
 * - userId: Filter by user ID
 * - actionType: Filter by action type
 * - customerNumber: Filter by customer number
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - limit: Number of results (default 50)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const { searchParams } = new URL(request.url);

      const filters = {
        userId: searchParams.get('userId') || undefined,
        actionType: (searchParams.get('actionType') as ActivityActionType) || undefined,
        customerNumber: searchParams.get('customerNumber') || undefined,
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
        limit: parseInt(searchParams.get('limit') || '50', 10),
        offset: parseInt(searchParams.get('offset') || '0', 10),
      };

      const [logs, total, partners] = await Promise.all([
        getActivityLogs(filters),
        getActivityLogCount(filters),
        getActivePartners(),
      ]);

      return NextResponse.json({
        success: true,
        logs: logs.map(transformActivityLog),
        total,
        partners: partners.map((p) => ({
          userId: p.user_id,
          name: p.partner_name,
          email: p.partner_email,
        })),
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          hasMore: filters.offset + logs.length < total,
        },
      });
    } catch (error) {
      console.error('[Get Activity Logs] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch activity logs' },
        { status: 500 }
      );
    }
  });
}
