import { NextRequest, NextResponse } from 'next/server';
import { withManager } from '@/lib/auth/middleware';
import { getRequestById, approveRequestWithCourse } from '@/lib/db/queries/course-requests';
import {
  createConfigurableCourse,
  getOperatorIdByCustomerNumber,
} from '@/lib/db/queries/courses';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/manager/requests/[id]/create-course
 *
 * Create a course in Magento from an approved request (manager only).
 * This action:
 * 1. Validates the request exists and is in a valid state
 * 2. Gets the operator ID from the customer number
 * 3. Creates a configurable product in Magento
 * 4. Updates the request status to approved with the new course ID
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async (req) => {
    try {
      const { id } = await params;
      const requestId = parseInt(id, 10);

      if (isNaN(requestId)) {
        return NextResponse.json(
          { error: 'Invalid request ID' },
          { status: 400 }
        );
      }

      // Get the course request
      const courseRequest = await getRequestById(requestId);

      if (!courseRequest) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      // Check if request is in valid state
      if (courseRequest.status === 'approved') {
        return NextResponse.json(
          { error: 'Request has already been approved' },
          { status: 400 }
        );
      }

      if (courseRequest.status === 'rejected') {
        return NextResponse.json(
          { error: 'Cannot create course from rejected request' },
          { status: 400 }
        );
      }

      // Get additional data from request body
      const body = await req.json();
      const { description, shortDescription } = body;

      // Validate required fields
      if (!description) {
        return NextResponse.json(
          { error: 'Description is required' },
          { status: 400 }
        );
      }

      // Get operator ID for this customer number
      const operatorId = await getOperatorIdByCustomerNumber([courseRequest.customer_number]);

      if (!operatorId) {
        return NextResponse.json(
          { error: 'Could not find operator for this partner' },
          { status: 400 }
        );
      }

      // Create the course in Magento
      const { entityId, sku } = await createConfigurableCourse({
        operatorId,
        name: courseRequest.course_name,
        description,
        shortDescription: shortDescription || '',
        price: parseFloat(courseRequest.base_price),
        location: courseRequest.location,
      });

      if (entityId === 0) {
        return NextResponse.json(
          { error: 'Failed to create course in Magento' },
          { status: 500 }
        );
      }

      // Update request status to approved
      const updatedRequest = await approveRequestWithCourse(requestId, entityId);

      return NextResponse.json({
        success: true,
        message: 'Course created successfully',
        course: {
          id: entityId,
          title: courseRequest.course_name,
          sku,
          status: 'active',
          description,
          basePrice: parseFloat(courseRequest.base_price),
          location: courseRequest.location,
        },
        request: updatedRequest,
      });
    } catch (error) {
      console.error('[Create Course from Request] Error:', error);
      return NextResponse.json(
        { error: 'Failed to create course' },
        { status: 500 }
      );
    }
  });
}
