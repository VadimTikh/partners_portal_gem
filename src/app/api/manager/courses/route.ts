import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import { getAllCoursesForManager, ManagerCourseFilters } from '@/lib/db/queries/courses';
import { getPartnerByCustomerNumber } from '@/lib/db/queries/partners';

/**
 * GET /api/manager/courses
 *
 * Get all courses with server-side filtering and pagination (manager only).
 * Returns courses with partner info.
 */
export async function GET(request: NextRequest) {
  return withManager(request, async (req) => {
    try {
      const { searchParams } = new URL(req.url);

      // Parse filters from query params
      const filters: ManagerCourseFilters = {
        search: searchParams.get('search') || undefined,
        location: searchParams.get('location') || undefined,
        availableDatesRange: (searchParams.get('availableDatesRange') as 'none' | '1-5' | '5+') || undefined,
        dateRangeType: (searchParams.get('dateRangeType') as 'next7d' | 'next30d' | 'custom') || undefined,
        dateFrom: searchParams.get('dateFrom') || undefined,
        dateTo: searchParams.get('dateTo') || undefined,
        status: (searchParams.get('status') as 'active' | 'inactive') || undefined,
        limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 25,
        offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0,
      };

      // Get courses from MySQL
      const { courses: dbCourses, total } = await getAllCoursesForManager(filters);

      // Enrich with partner info from PostgreSQL
      // Create a map of customer_number -> partner info
      const partnerInfoMap = new Map<string, { partnerId: string; partnerName: string; partnerEmail: string }>();

      // Collect unique customer numbers
      const uniqueCustomerNumbers = new Set<string>();
      dbCourses.forEach(course => {
        if (course.customer_number) {
          uniqueCustomerNumbers.add(course.customer_number);
        }
      });

      // Fetch partner info for each customer number
      await Promise.all(
        Array.from(uniqueCustomerNumbers).map(async (customerNumber) => {
          const partner = await getPartnerByCustomerNumber(customerNumber);
          if (partner) {
            partnerInfoMap.set(customerNumber, {
              partnerId: partner.id,
              partnerName: partner.name,
              partnerEmail: partner.email,
            });
          }
        })
      );

      // Transform courses and add partner info
      let courses = dbCourses.map(course => {
        const partnerInfo = partnerInfoMap.get(course.customer_number);
        return {
          id: course.id,
          title: course.title,
          sku: course.sku,
          status: course.status,
          description: course.description || '',
          image: course.image || '',
          basePrice: course.basePrice || 0,
          location: course.location || '',
          available_dates: course.available_dates,
          customerNumber: course.customer_number,
          partnerId: partnerInfo?.partnerId || '',
          partnerName: partnerInfo?.partnerName || `Partner (${course.customer_number})`,
          partnerEmail: partnerInfo?.partnerEmail || '',
        };
      });

      // Apply search filter (partner name/email) - done at application layer
      // since partner info is in PostgreSQL
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        courses = courses.filter(course =>
          course.partnerName.toLowerCase().includes(searchLower) ||
          course.partnerEmail.toLowerCase().includes(searchLower) ||
          course.customerNumber.includes(filters.search!)
        );
      }

      return NextResponse.json({
        success: true,
        courses,
        total: filters.search ? courses.length : total,
        pagination: {
          limit: filters.limit || 25,
          offset: filters.offset || 0,
          hasMore: (filters.offset || 0) + courses.length < (filters.search ? courses.length : total),
        },
      });
    } catch (error) {
      console.error('[Get Manager Courses] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch courses' },
        { status: 500 }
      );
    }
  });
}
