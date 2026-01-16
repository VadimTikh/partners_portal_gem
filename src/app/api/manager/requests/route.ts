import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import { getAllRequests, transformCourseRequest } from '@/lib/db/queries/course-requests';

/**
 * GET /api/manager/requests
 *
 * Get all course requests (manager only).
 * Ordered by status priority (pending first).
 */
export async function GET(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const dbRequests = await getAllRequests();
      const requests = dbRequests.map(transformCourseRequest);

      return NextResponse.json({
        success: true,
        requests,
      });
    } catch (error) {
      console.error('[Get All Requests] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch requests' },
        { status: 500 }
      );
    }
  });
}
