import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getCourseById, updateCourse, transformCourse } from '@/lib/db/queries/courses';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/partner/courses/[id]
 *
 * Get a single course by ID.
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

      const dbCourse = await getCourseById(courseId, user.customerNumbers);

      if (!dbCourse) {
        return NextResponse.json(
          { error: 'Course not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        course: transformCourse(dbCourse),
      });
    } catch (error) {
      console.error('[Get Course] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch course' },
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/partner/courses/[id]
 *
 * Update a course (title, status, base price).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

      if (user.customerNumbers.length === 0) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      // Verify course ownership
      const existingCourse = await getCourseById(courseId, user.customerNumbers);

      if (!existingCourse) {
        return NextResponse.json(
          { error: 'Course not found' },
          { status: 404 }
        );
      }

      const body = await req.json();
      const { title, status, basePrice } = body;

      // Validate status if provided
      if (status !== undefined && !['active', 'inactive'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be "active" or "inactive"' },
          { status: 400 }
        );
      }

      // Validate basePrice if provided
      if (basePrice !== undefined && (typeof basePrice !== 'number' || basePrice < 0)) {
        return NextResponse.json(
          { error: 'Invalid base price' },
          { status: 400 }
        );
      }

      // Update course
      await updateCourse(courseId, {
        title: title?.trim(),
        status,
        basePrice,
      });

      // Fetch and return updated course
      const updatedCourse = await getCourseById(courseId, user.customerNumbers);

      return NextResponse.json({
        success: true,
        message: 'Course updated successfully',
        course: updatedCourse ? transformCourse(updatedCourse) : null,
      });
    } catch (error) {
      console.error('[Update Course] Error:', error);
      return NextResponse.json(
        { error: 'Failed to update course' },
        { status: 500 }
      );
    }
  });
}
