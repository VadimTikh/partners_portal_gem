import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { verifyDateOwnership, updateDuration } from '@/lib/db/queries/dates';
import { logDateEdited, getIpFromRequest } from '@/lib/services/activity-logger';

interface RouteParams {
  params: Promise<{ id: string; dateId: string }>;
}

/**
 * PATCH /api/partner/courses/[id]/dates/[dateId]/duration
 *
 * Update a course date's duration.
 * Preserves the begin time and recalculates end time.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (req, user) => {
    try {
      const { id, dateId } = await params;
      const courseId = parseInt(id, 10);
      const dateIdNum = parseInt(dateId, 10);

      if (isNaN(courseId) || isNaN(dateIdNum)) {
        return NextResponse.json(
          { error: 'Invalid course or date ID' },
          { status: 400 }
        );
      }

      if (user.customerNumbers.length === 0) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      // Verify date ownership
      const isOwner = await verifyDateOwnership(dateIdNum, user.customerNumbers);

      if (!isOwner) {
        return NextResponse.json(
          { error: 'Date not found' },
          { status: 404 }
        );
      }

      const body = await req.json();
      const { duration } = body;

      if (duration === undefined || typeof duration !== 'number') {
        return NextResponse.json(
          { error: 'duration is required and must be a number (minutes)' },
          { status: 400 }
        );
      }

      if (duration < 1) {
        return NextResponse.json(
          { error: 'duration must be at least 1 minute' },
          { status: 400 }
        );
      }

      await updateDuration(dateIdNum, duration);

      // Log activity
      await logDateEdited(
        { id: user.userId, email: user.email, name: user.name },
        dateIdNum,
        courseId,
        { duration: { old: null, new: duration } },
        user.customerNumbers[0] || user.customerNumber || '',
        getIpFromRequest(request)
      );

      return NextResponse.json({
        success: true,
        message: 'Duration updated successfully',
      });
    } catch (error) {
      console.error('[Update Duration] Error:', error);
      return NextResponse.json(
        { error: 'Failed to update duration' },
        { status: 500 }
      );
    }
  });
}
