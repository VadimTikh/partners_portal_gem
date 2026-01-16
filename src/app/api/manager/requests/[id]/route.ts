import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import {
  getRequestById,
  updateRequestStatus,
  transformCourseRequest,
} from '@/lib/db/queries/course-requests';
import { createRequestLogger } from '@/lib/services/app-logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/manager/requests/[id]
 *
 * Get a single course request (manager only).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async () => {
    try {
      const { id } = await params;
      const requestId = parseInt(id, 10);

      if (isNaN(requestId)) {
        return NextResponse.json(
          { error: 'Invalid request ID' },
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

/**
 * PATCH /api/manager/requests/[id]
 *
 * Update course request status (manager only).
 * Used to approve, reject, or change status.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async (req, user) => {
    const logger = createRequestLogger(request, 'manager.request.update', {
      userId: user.userId,
      userEmail: user.email,
      userRole: user.role,
    });

    try {
      const { id } = await params;
      const requestId = parseInt(id, 10);

      if (isNaN(requestId)) {
        logger.validationError('Invalid request ID', { id });
        return NextResponse.json(
          { error: 'Invalid request ID' },
          { status: 400 }
        );
      }

      const dbRequest = await getRequestById(requestId);

      if (!dbRequest) {
        logger.error('Request not found', { requestId }, 404, 'REQUEST_NOT_FOUND');
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      const body = await req.json();
      const { status, rejectionReason, rejectionRecommendations, managerNotes } = body;

      // Validate status
      const validStatuses = ['pending', 'in_moderation', 'approved', 'rejected'];
      if (!status || !validStatuses.includes(status)) {
        logger.validationError('Invalid status', { status, requestId });
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }

      // Require rejection reason when rejecting
      if (status === 'rejected' && !rejectionReason) {
        logger.validationError('Rejection reason is required when rejecting', { requestId, status });
        return NextResponse.json(
          { error: 'Rejection reason is required when rejecting a request' },
          { status: 400 }
        );
      }

      // Update the request
      const updatedRequest = await updateRequestStatus(requestId, {
        status,
        rejectionReason,
        rejectionRecommendations,
        managerNotes,
      });

      if (!updatedRequest) {
        logger.error('Failed to update request', { requestId, status }, 500, 'UPDATE_FAILED');
        return NextResponse.json(
          { error: 'Failed to update request' },
          { status: 500 }
        );
      }

      const responseData = {
        success: true,
        message: 'Request updated successfully',
        request: transformCourseRequest(updatedRequest),
      };

      logger.success(responseData, { requestId, status });

      return NextResponse.json(responseData);
    } catch (error) {
      console.error('[Update Request] Error:', error);
      logger.error(error instanceof Error ? error : String(error), undefined, 500);
      return NextResponse.json(
        { error: 'Failed to update request' },
        { status: 500 }
      );
    }
  });
}
