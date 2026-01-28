import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import { getCourseByIdForManager } from '@/lib/db/queries/courses';
import { updateDatePrice, updateDateSeats, deleteDate } from '@/lib/db/queries/dates';

/**
 * PATCH /api/manager/courses/[id]/dates/[dateId]
 *
 * Update a date's price or seats (manager only).
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
      const { price, seats } = body;

      // Update price if provided
      if (price !== undefined) {
        if (isNaN(price) || price < 0) {
          return NextResponse.json(
            { error: 'Price must be a positive number' },
            { status: 400 }
          );
        }
        await updateDatePrice(parsedDateId, price);
      }

      // Update seats if provided
      if (seats !== undefined) {
        if (isNaN(seats) || seats < 1) {
          return NextResponse.json(
            { error: 'Seats must be at least 1' },
            { status: 400 }
          );
        }
        await updateDateSeats(parsedDateId, seats);
      }

      return NextResponse.json({
        success: true,
        message: 'Date updated successfully',
      });
    } catch (error) {
      console.error('[Update Manager Course Date] Error:', error);
      return NextResponse.json(
        { error: 'Failed to update date' },
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/manager/courses/[id]/dates/[dateId]
 *
 * Delete a date (manager only).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dateId: string }> }
) {
  return withManager(request, async () => {
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

      await deleteDate(parsedDateId);

      return NextResponse.json({
        success: true,
        message: 'Date deleted successfully',
      });
    } catch (error) {
      console.error('[Delete Manager Course Date] Error:', error);
      return NextResponse.json(
        { error: 'Failed to delete date' },
        { status: 500 }
      );
    }
  });
}
