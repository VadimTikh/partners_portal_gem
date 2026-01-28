import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import { getCourseByIdForManager } from '@/lib/db/queries/courses';
import { updateDateTime, isValidFutureDate } from '@/lib/db/queries/dates';

/**
 * PATCH /api/manager/courses/[id]/dates/[dateId]/datetime
 *
 * Update a date's datetime (manager only).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dateId: string }> }
) {
  return withManager(request, async (req) => {
    try {
      const { id, dateId } = await params;
      const courseId = parseInt(id, 10);
      const parsedDateId = parseInt(dateId, 10);

      if (isNaN(courseId) || isNaN(parsedDateId)) {
        return NextResponse.json(
          { error: 'Invalid course or date ID' },
          { status: 400 }
        );
      }

      // Verify course exists
      const course = await getCourseByIdForManager(courseId);
      if (!course) {
        return NextResponse.json(
          { error: 'Course not found' },
          { status: 404 }
        );
      }

      const body = await req.json();
      const { dateTime } = body;

      if (!dateTime) {
        return NextResponse.json(
          { error: 'dateTime is required' },
          { status: 400 }
        );
      }

      // Validate date is at least 2 days in the future
      if (!isValidFutureDate(dateTime)) {
        return NextResponse.json(
          { error: 'Date must be at least 2 days in the future' },
          { status: 400 }
        );
      }

      await updateDateTime(parsedDateId, dateTime);

      return NextResponse.json({
        success: true,
        message: 'DateTime updated successfully',
      });
    } catch (error) {
      console.error('[Update Manager Course Date DateTime] Error:', error);
      return NextResponse.json(
        { error: 'Failed to update datetime' },
        { status: 500 }
      );
    }
  });
}
