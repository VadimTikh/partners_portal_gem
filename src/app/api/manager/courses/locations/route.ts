import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import { getUniqueLocations } from '@/lib/db/queries/courses';

/**
 * GET /api/manager/courses/locations
 *
 * Get unique locations from all courses for filter dropdown (manager only).
 */
export async function GET(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const locations = await getUniqueLocations();

      return NextResponse.json({
        success: true,
        locations,
      });
    } catch (error) {
      console.error('[Get Course Locations] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch locations' },
        { status: 500 }
      );
    }
  });
}
