import { NextRequest, NextResponse } from 'next/server';
import { withManager } from '@/lib/auth/middleware';
import { getPartnerById, getCustomerNumbersByOperator } from '@/lib/db/queries/partners';
import { getCoursesByPartner, transformCourse } from '@/lib/db/queries/courses';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/manager/partners/[id]/courses
 *
 * Get all courses for a specific partner (manager only).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async () => {
    try {
      const { id } = await params;

      // Verify partner exists
      const partner = await getPartnerById(id);

      if (!partner) {
        return NextResponse.json(
          { error: 'Partner not found' },
          { status: 404 }
        );
      }

      // Get customer numbers for this operator
      const customerNumbers = await getCustomerNumbersByOperator(id);

      if (customerNumbers.length === 0) {
        return NextResponse.json({
          success: true,
          courses: [],
        });
      }

      // Get courses for all customer numbers
      const allCourses = await Promise.all(
        customerNumbers.map(cn => getCoursesByPartner(cn))
      );

      // Flatten and dedupe by ID
      const courseMap = new Map();
      allCourses.flat().forEach(course => {
        if (!courseMap.has(course.id)) {
          courseMap.set(course.id, course);
        }
      });

      const courses = Array.from(courseMap.values()).map(transformCourse);

      return NextResponse.json({
        success: true,
        courses,
      });
    } catch (error) {
      console.error('[Get Partner Courses] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch partner courses' },
        { status: 500 }
      );
    }
  });
}
