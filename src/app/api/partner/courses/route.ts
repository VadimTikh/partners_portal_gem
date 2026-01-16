import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getCoursesByPartner, transformCourse } from '@/lib/db/queries/courses';

/**
 * GET /api/partner/courses
 *
 * Get all courses for the authenticated partner.
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    try {
      if (user.customerNumbers.length === 0) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      const dbCourses = await getCoursesByPartner(user.customerNumbers);
      const courses = dbCourses.map(transformCourse);

      return NextResponse.json({
        success: true,
        courses,
      });
    } catch (error) {
      console.error('[Get Partner Courses] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch courses' },
        { status: 500 }
      );
    }
  });
}
