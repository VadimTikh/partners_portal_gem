import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getCourseById } from '@/lib/db/queries/courses';
import {
  getDatesByCourse,
  createDate,
  transformDate,
  isValidFutureDate,
} from '@/lib/db/queries/dates';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/partner/courses/[id]/dates
 *
 * Get all dates for a course.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (_req, user) => {
    try {
      const { id } = await params;
      const courseId = parseInt(id, 10);

      if (isNaN(courseId)) {
        return NextResponse.json(
          { error: 'Invalid course ID' },
          { status: 400 }
        );
      }

      if (!user.customerNumber) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      // Verify course ownership
      const course = await getCourseById(courseId, user.customerNumber);

      if (!course) {
        return NextResponse.json(
          { error: 'Course not found' },
          { status: 404 }
        );
      }

      const dbDates = await getDatesByCourse(courseId, user.customerNumber);
      const dates = dbDates.map(transformDate);

      return NextResponse.json({
        success: true,
        dates,
      });
    } catch (error) {
      console.error('[Get Course Dates] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch course dates' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/partner/courses/[id]/dates
 *
 * Create a new date for a course.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (req, user) => {
    try {
      const { id } = await params;
      const courseId = parseInt(id, 10);

      if (isNaN(courseId)) {
        return NextResponse.json(
          { error: 'Invalid course ID' },
          { status: 400 }
        );
      }

      if (!user.customerNumber) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      // Verify course ownership
      const course = await getCourseById(courseId, user.customerNumber);

      if (!course) {
        return NextResponse.json(
          { error: 'Course not found' },
          { status: 404 }
        );
      }

      const body = await req.json();
      const { dateTime, capacity, duration, price } = body;

      // Validate required fields
      if (!dateTime || capacity === undefined) {
        return NextResponse.json(
          { error: 'dateTime and capacity are required' },
          { status: 400 }
        );
      }

      // Validate capacity
      if (typeof capacity !== 'number' || capacity < 1) {
        return NextResponse.json(
          { error: 'Capacity must be a positive number' },
          { status: 400 }
        );
      }

      // Validate date (must be at least 2 days in the future)
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
        price: price ?? course.basePrice ?? undefined,
      });

      return NextResponse.json({
        success: true,
        message: 'Date created successfully',
        date: transformDate(newDate),
      });
    } catch (error) {
      console.error('[Create Course Date] Error:', error);
      return NextResponse.json(
        { error: 'Failed to create course date' },
        { status: 500 }
      );
    }
  });
}
