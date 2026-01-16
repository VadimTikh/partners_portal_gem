import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import {
  getRequestsByPartner,
  createCourseRequest,
  transformCourseRequest,
} from '@/lib/db/queries/course-requests';
import { logCourseRequestCreated, getIpFromRequest } from '@/lib/services/activity-logger';

/**
 * GET /api/partner/requests
 *
 * Get all course requests for the authenticated partner.
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    try {
      if (!user.customerNumbers || user.customerNumbers.length === 0) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      // Use the first (primary) customer number for requests
      const primaryCustomerNumber = user.customerNumbers[0];
      const dbRequests = await getRequestsByPartner(primaryCustomerNumber);
      const requests = dbRequests.map(transformCourseRequest);

      return NextResponse.json({
        success: true,
        requests,
      });
    } catch (error) {
      console.error('[Get Partner Requests] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch requests' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/partner/requests
 *
 * Create a new course request.
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      if (!user.customerNumbers || user.customerNumbers.length === 0) {
        return NextResponse.json(
          { error: 'Partner customer number not configured' },
          { status: 400 }
        );
      }

      // Use the first (primary) customer number for requests
      const primaryCustomerNumber = user.customerNumbers[0];

      const body = await req.json();
      const { name, location, basePrice, partnerDescription, requestedDates } = body;

      // Validate required fields
      if (!name || !location || basePrice === undefined) {
        return NextResponse.json(
          { error: 'Name, location, and base price are required' },
          { status: 400 }
        );
      }

      // Validate basePrice
      if (typeof basePrice !== 'number' || basePrice < 0) {
        return NextResponse.json(
          { error: 'Base price must be a non-negative number' },
          { status: 400 }
        );
      }

      // Validate requestedDates
      if (!Array.isArray(requestedDates) || requestedDates.length === 0) {
        return NextResponse.json(
          { error: 'At least one requested date is required' },
          { status: 400 }
        );
      }

      // Create the request
      const newRequest = await createCourseRequest({
        customerNumber: primaryCustomerNumber,
        partnerName: user.name,
        partnerEmail: user.email,
        courseName: name.trim(),
        location: location.trim(),
        basePrice,
        partnerDescription: partnerDescription?.trim(),
        requestedDates,
      });

      if (!newRequest) {
        return NextResponse.json(
          { error: 'Failed to create request' },
          { status: 500 }
        );
      }

      // Log activity
      await logCourseRequestCreated(
        { id: user.userId, email: user.email, name: user.name },
        newRequest.id,
        name,
        primaryCustomerNumber,
        getIpFromRequest(request)
      );

      return NextResponse.json({
        success: true,
        message: 'Course request created successfully',
        request: transformCourseRequest(newRequest),
      });
    } catch (error) {
      console.error('[Create Course Request] Error:', error);
      return NextResponse.json(
        { error: 'Failed to create course request' },
        { status: 500 }
      );
    }
  });
}
