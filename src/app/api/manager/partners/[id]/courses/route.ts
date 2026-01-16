import { NextRequest, NextResponse } from 'next/server';
import { withManager } from '@/lib/auth/middleware';
import { getPortalPartnerById } from '@/lib/db/queries/partners';
import { getCoursesByPartner, transformCourse } from '@/lib/db/queries/courses';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/manager/partners/[id]/courses
 *
 * Get all courses for a specific partner (manager only).
 * ID is the portal user UUID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async () => {
    try {
      const { id } = await params;

      // Verify partner exists and get their customer numbers
      const partner = await getPortalPartnerById(id);

      if (!partner) {
        return NextResponse.json(
          { error: 'Partner not found' },
          { status: 404 }
        );
      }

      if (partner.customerNumbers.length === 0) {
        return NextResponse.json({
          success: true,
          courses: [],
        });
      }

      // Get courses for all customer numbers
      const dbCourses = await getCoursesByPartner(partner.customerNumbers);
      const courses = dbCourses.map(transformCourse);

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
