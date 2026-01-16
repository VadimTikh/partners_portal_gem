import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import { getPortalPartnerById } from '@/lib/db/queries/partners';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/manager/partners/[id]
 *
 * Get a single partner by portal user ID (manager only).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async () => {
    try {
      const { id } = await params;

      const partner = await getPortalPartnerById(id);

      if (!partner) {
        return NextResponse.json(
          { error: 'Partner not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          customerNumbers: partner.customerNumbers,
          coursesCount: partner.coursesCount,
          activeCoursesCount: partner.activeCoursesCount,
          availableDatesCount: partner.availableDatesCount,
          pendingRequestsCount: partner.pendingRequestsCount,
        },
      });
    } catch (error) {
      console.error('[Get Partner] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch partner' },
        { status: 500 }
      );
    }
  });
}
