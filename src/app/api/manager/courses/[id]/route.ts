import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import { getCourseByIdForManager, updateCourse, transformCourse } from '@/lib/db/queries/courses';
import { getPartnerByCustomerNumber } from '@/lib/db/queries/partners';

/**
 * GET /api/manager/courses/[id]
 *
 * Get a single course by ID (manager only).
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

      const dbCourse = await getCourseByIdForManager(courseId);

      if (!dbCourse) {
        return NextResponse.json(
          { error: 'Course not found' },
          { status: 404 }
        );
      }

      // Get partner info
      let partnerInfo: { partnerId: string; partnerName: string; partnerEmail: string } | undefined;
      if (dbCourse.customer_number) {
        const partner = await getPartnerByCustomerNumber(dbCourse.customer_number);
        if (partner) {
          partnerInfo = {
            partnerId: partner.id,
            partnerName: partner.name,
            partnerEmail: partner.email,
          };
        }
      }

      const course = {
        ...transformCourse(dbCourse),
        customerNumber: dbCourse.customer_number,
        partnerId: partnerInfo?.partnerId || '',
        partnerName: partnerInfo?.partnerName || `Partner (${dbCourse.customer_number})`,
        partnerEmail: partnerInfo?.partnerEmail || '',
      };

      return NextResponse.json({
        success: true,
        course,
      });
    } catch (error) {
      console.error('[Get Manager Course] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch course' },
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/manager/courses/[id]
 *
 * Update course details (manager only).
 * Supports updating: title, status, basePrice
 */
export async function PATCH(
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
      const existingCourse = await getCourseByIdForManager(courseId);
      if (!existingCourse) {
        return NextResponse.json(
          { error: 'Course not found' },
          { status: 404 }
        );
      }

      const body = await req.json();
      const { title, status, basePrice } = body;

      // Validate inputs
      if (title !== undefined && (!title || !title.trim())) {
        return NextResponse.json(
          { error: 'Title cannot be empty' },
          { status: 400 }
        );
      }

      if (status !== undefined && !['active', 'inactive'].includes(status)) {
        return NextResponse.json(
          { error: 'Status must be "active" or "inactive"' },
          { status: 400 }
        );
      }

      if (basePrice !== undefined && (isNaN(basePrice) || basePrice < 0)) {
        return NextResponse.json(
          { error: 'Base price must be a positive number' },
          { status: 400 }
        );
      }

      // Update course
      await updateCourse(courseId, {
        title: title?.trim(),
        status,
        basePrice,
      });

      // Fetch updated course
      const updatedCourse = await getCourseByIdForManager(courseId);

      // Get partner info
      let partnerInfo: { partnerId: string; partnerName: string; partnerEmail: string } | undefined;
      if (updatedCourse?.customer_number) {
        const partner = await getPartnerByCustomerNumber(updatedCourse.customer_number);
        if (partner) {
          partnerInfo = {
            partnerId: partner.id,
            partnerName: partner.name,
            partnerEmail: partner.email,
          };
        }
      }

      const course = updatedCourse ? {
        ...transformCourse(updatedCourse),
        customerNumber: updatedCourse.customer_number,
        partnerId: partnerInfo?.partnerId || '',
        partnerName: partnerInfo?.partnerName || `Partner (${updatedCourse.customer_number})`,
        partnerEmail: partnerInfo?.partnerEmail || '',
      } : null;

      return NextResponse.json({
        success: true,
        course,
      });
    } catch (error) {
      console.error('[Update Manager Course] Error:', error);
      return NextResponse.json(
        { error: 'Failed to update course' },
        { status: 500 }
      );
    }
  });
}
