import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  verifyDateOwnership,
  updateDatePrice,
  updateDateSeats,
  deleteDate,
} from '@/lib/db/queries/dates';

interface RouteParams {
  params: Promise<{ id: string; dateId: string }>;
}

/**
 * PATCH /api/partner/courses/[id]/dates/[dateId]
 *
 * Update a course date (price or seats/capacity).
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
      const { price, seats } = body;

      // Update price if provided
      if (price !== undefined) {
        if (typeof price !== 'number' || price < 0) {
          return NextResponse.json(
            { error: 'Invalid price' },
            { status: 400 }
          );
        }
        await updateDatePrice(dateIdNum, price);
      }

      // Update seats if provided
      if (seats !== undefined) {
        if (typeof seats !== 'number' || seats < 1) {
          return NextResponse.json(
            { error: 'Seats must be a positive number' },
            { status: 400 }
          );
        }
        await updateDateSeats(dateIdNum, seats);
      }

      return NextResponse.json({
        success: true,
        message: 'Date updated successfully',
      });
    } catch (error) {
      console.error('[Update Date] Error:', error);
      return NextResponse.json(
        { error: 'Failed to update date' },
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/partner/courses/[id]/dates/[dateId]
 *
 * Delete a course date.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (_req, user) => {
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

      // Delete the date
      await deleteDate(dateIdNum);

      return NextResponse.json({
        success: true,
        message: 'Date deleted successfully',
      });
    } catch (error) {
      console.error('[Delete Date] Error:', error);
      return NextResponse.json(
        { error: 'Failed to delete date' },
        { status: 500 }
      );
    }
  });
}
