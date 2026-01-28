import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import { getCourseByIdForManager } from '@/lib/db/queries/courses';
import { updateDuration } from '@/lib/db/queries/dates';

/**
 * PATCH /api/manager/courses/[id]/dates/[dateId]/duration
 *
 * Update a date's duration (manager only).
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
      const { duration } = body;

      if (duration === undefined || duration < 1) {
        return NextResponse.json(
          { error: 'Duration must be at least 1 minute' },
          { status: 400 }
        );
      }

      await updateDuration(parsedDateId, duration);

      return NextResponse.json({
        success: true,
        message: 'Duration updated successfully',
      });
    } catch (error) {
      console.error('[Update Manager Course Date Duration] Error:', error);
      return NextResponse.json(
        { error: 'Failed to update duration' },
        { status: 500 }
      );
    }
  });
}
