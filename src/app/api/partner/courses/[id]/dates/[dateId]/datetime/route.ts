import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { verifyDateOwnership, updateDateTime } from '@/lib/db/queries/dates';

interface RouteParams {
  params: Promise<{ id: string; dateId: string }>;
}

/**
 * PATCH /api/partner/courses/[id]/dates/[dateId]/datetime
 *
 * Update a course date's datetime (date and time).
 * Maintains the same duration by recalculating end time.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (req, user) => {
    try {
      const { id, dateId } = await params;
      const courseId = parseInt(id, 10);
      const dateIdNum = parseInt(dateId, 10);

      if (isNaN(courseId) || isNaN(dateIdNum)) {
        return NextResponse.json(
          { error: 'Invalid course or date ID' },
          { status: 400 }
        );
      }

      if (!user.customerNumber) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      // Verify date ownership
      const isOwner = await verifyDateOwnership(dateIdNum, user.customerNumber);

      if (!isOwner) {
        return NextResponse.json(
          { error: 'Date not found' },
          { status: 404 }
        );
      }

      const body = await req.json();
      const { dateTime } = body;

      if (!dateTime || typeof dateTime !== 'string') {
        return NextResponse.json(
          { error: 'dateTime is required and must be a string in ISO format' },
          { status: 400 }
        );
      }

      // Validate dateTime format (should be like 2024-03-15T14:00:00)
      const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
      if (!dateTimeRegex.test(dateTime)) {
        return NextResponse.json(
          { error: 'dateTime must be in ISO format (YYYY-MM-DDTHH:mm:ss)' },
          { status: 400 }
        );
      }

      await updateDateTime(dateIdNum, dateTime);

      return NextResponse.json({
        success: true,
        message: 'DateTime updated successfully',
      });
    } catch (error) {
      console.error('[Update DateTime] Error:', error);
      return NextResponse.json(
        { error: 'Failed to update datetime' },
        { status: 500 }
      );
    }
  });
}
