import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { getRequestById, transformCourseRequest } from '@/lib/db/queries/course-requests';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/partner/requests/[id]
 *
 * Get a single course request by ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (_req, user) => {
    try {
      const { id } = await params;
      const requestId = parseInt(id, 10);

      if (isNaN(requestId)) {
        return NextResponse.json(
          { error: 'Invalid request ID' },
          { status: 400 }
        );
      }

      if (!user.customerNumber) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      const dbRequest = await getRequestById(requestId);

      if (!dbRequest) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      // Verify ownership
      if (dbRequest.customer_number !== user.customerNumber) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        request: transformCourseRequest(dbRequest),
      });
    } catch (error) {
      console.error('[Get Request] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch request' },
        { status: 500 }
      );
    }
  });
}
