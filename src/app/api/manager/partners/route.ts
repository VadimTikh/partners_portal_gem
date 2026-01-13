import { NextRequest, NextResponse } from 'next/server';
import { withManager } from '@/lib/auth/middleware';
import { getAllPartnersWithStats, transformPartner } from '@/lib/db/queries/partners';

/**
 * GET /api/manager/partners
 *
 * Get all partners (manager only).
 * Includes courses count and pending requests count.
 */
export async function GET(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const partnersWithStats = await getAllPartnersWithStats();
      const partners = partnersWithStats.map(transformPartner);

      return NextResponse.json({
        success: true,
        partners,
      });
    } catch (error) {
      console.error('[Get Partners] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch partners' },
        { status: 500 }
      );
    }
  });
}
