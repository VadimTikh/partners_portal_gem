import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import { getCourseByIdForManager, getDatesByCourseForManager } from '@/lib/db/queries/courses';
import { createDate, isValidFutureDate, transformDate } from '@/lib/db/queries/dates';

/**
 * GET /api/manager/courses/[id]/dates
 *
 * Get all dates for a course (manager only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withManager(request, async () => {
    try {
      const { id } = await params;
      const courseId = parseInt(id, 10);

      if (isNaN(courseId)) {
        return NextResponse.json(
          { error: 'Invalid course ID' },
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

      const dates = await getDatesByCourseForManager(courseId);

      return NextResponse.json({
        success: true,
        dates,
      });
    } catch (error) {
      console.error('[Get Manager Course Dates] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch dates' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/manager/courses/[id]/dates
 *
 * Create a new date for a course (manager only).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withManager(request, async (req) => {
    try {
      const { id } = await params;
      const courseId = parseInt(id, 10);

      if (isNaN(courseId)) {
        return NextResponse.json(
          { error: 'Invalid course ID' },
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
      const { dateTime, capacity, duration, price } = body;

      // Validate required fields
      if (!dateTime) {
        return NextResponse.json(
          { error: 'dateTime is required' },
          { status: 400 }
        );
      }

      if (!capacity || capacity < 1) {
        return NextResponse.json(
          { error: 'capacity must be at least 1' },
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

      // Create the date
      const newDate = await createDate({
        courseId,
        dateTime,
        capacity,
        duration: duration || 180,
        price: price ?? course.basePrice,
      });

      return NextResponse.json({
        success: true,
        date: transformDate(newDate),
      });
    } catch (error) {
      console.error('[Create Manager Course Date] Error:', error);
      return NextResponse.json(
        { error: 'Failed to create date' },
        { status: 500 }
      );
    }
  });
}
