import { NextRequest, NextResponse } from 'next/server';
import { withManager } from '@/lib/auth/middleware';
import {
  getPartnerById,
  getPendingRequestCounts,
} from '@/lib/db/queries/partners';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/manager/partners/[id]
 *
 * Get a single partner by operator ID (manager only).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withManager(request, async () => {
    try {
      const { id } = await params;

      const partner = await getPartnerById(id);

      if (!partner) {
        return NextResponse.json(
          { error: 'Partner not found' },
          { status: 404 }
        );
      }

      // Get pending request count
      const pendingMap = await getPendingRequestCounts();
      const pendingRequestsCount = pendingMap.get(id) || 0;

      return NextResponse.json({
        success: true,
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          companyName: partner.companyName,
          coursesCount: partner.coursesCount,
          pendingRequestsCount,
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
