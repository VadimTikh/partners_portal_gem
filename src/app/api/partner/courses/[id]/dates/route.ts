import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
import { getCourseById } from '@/lib/db/queries/courses';
import {
  getDatesByCourse,
  createDate,
  transformDate,
  isValidFutureDate,
} from '@/lib/db/queries/dates';
import { logDateAdded, getIpFromRequest } from '@/lib/services/activity-logger';
import { createRequestLogger } from '@/lib/services/app-logger';

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

      if (user.customerNumbers.length === 0) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      // Verify course ownership
      const course = await getCourseById(courseId, user.customerNumbers);

      if (!course) {
        return NextResponse.json(
          { error: 'Course not found' },
          { status: 404 }
        );
      }

      const dbDates = await getDatesByCourse(courseId, user.customerNumbers);
      const dates = dbDates.map(transformDate);

      return NextResponse.json({
        success: true,
        dates,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
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
    const logger = createRequestLogger(request, 'partner.date.create', {
      userId: user.userId,
      userEmail: user.email,
      userRole: user.role,
    });

    try {
      const { id } = await params;
      const courseId = parseInt(id, 10);

      if (isNaN(courseId)) {
        logger.validationError('Invalid course ID', { courseId: id });
        return NextResponse.json(
          { error: 'Invalid course ID' },
          { status: 400 }
        );
      }

      if (user.customerNumbers.length === 0) {
        logger.validationError('Partner customer number not configured');
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      // Verify course ownership
      const course = await getCourseById(courseId, user.customerNumbers);

      if (!course) {
        logger.error('Course not found', { courseId }, 404, 'COURSE_NOT_FOUND');
        return NextResponse.json(
          { error: 'Course not found' },
          { status: 404 }
        );
      }

      const body = await req.json();
      const { dateTime, capacity, duration, price } = body;

      // Validate required fields
      if (!dateTime || capacity === undefined) {
        logger.validationError('dateTime and capacity are required', { courseId });
        return NextResponse.json(
          { error: 'dateTime and capacity are required' },
          { status: 400 }
        );
      }

      // Validate capacity
      if (typeof capacity !== 'number' || capacity < 1) {
        logger.validationError('Capacity must be a positive number', { courseId, capacity });
        return NextResponse.json(
          { error: 'Capacity must be a positive number' },
          { status: 400 }
        );
      }

      // Validate date (must be at least 2 days in the future)
      if (!isValidFutureDate(dateTime)) {
        logger.validationError('Date must be at least 2 days in the future', { courseId, dateTime });
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

      // Log activity (use first customer number for logging)
      await logDateAdded(
        { id: user.userId, email: user.email, name: user.name },
        newDate.id,
        courseId,
        dateTime,
        user.customerNumbers[0] || user.customerNumber || '',
        getIpFromRequest(request)
      );

      const responseData = {
        success: true,
        message: 'Date created successfully',
        date: transformDate(newDate),
      };

      logger.success(responseData, { courseId, dateTime, capacity });

      return NextResponse.json(responseData);
    } catch (error) {
      console.error('[Create Course Date] Error:', error);
      logger.error(error instanceof Error ? error : String(error), undefined, 500);
      return NextResponse.json(
        { error: 'Failed to create course date' },
        { status: 500 }
      );
    }
  });
}
