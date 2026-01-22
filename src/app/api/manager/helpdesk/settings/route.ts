import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

import { withManager } from '@/lib/auth/middleware';
import {
  getUserHelpdeskSettings,
  upsertUserHelpdeskSettings,
  updateFilterPreferences,
} from '@/lib/db/queries/helpdesk';
import { FilterPreferences } from '@/lib/types/helpdesk';

/**
 * GET /api/manager/helpdesk/settings
 *
 * Get the current user's helpdesk settings (stage preferences).
 */
export async function GET(request: NextRequest) {
  return withManager(request, async (_, user) => {
    try {
      const settings = await getUserHelpdeskSettings(user.userId);

      return NextResponse.json({
        success: true,
        settings: settings || {
          userId: user.userId,
          inProgressStageIds: [],
          filterPreferences: {},
        },
      });
    } catch (error) {
      console.error('[Helpdesk Settings GET] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to get settings' },
        { status: 500 }
      );
    }
  });
}

/**
 * PUT /api/manager/helpdesk/settings
 *
 * Update the current user's helpdesk settings.
 *
 * Request body:
 * - inProgressStageIds?: number[] - Array of stage IDs the user considers "in progress"
 * - filterPreferences?: FilterPreferences - User's filter preferences
 */
export async function PUT(request: NextRequest) {
  return withManager(request, async (_, user) => {
    try {
      const body = await request.json();
      const { inProgressStageIds, filterPreferences } = body;

      // If only updating filter preferences
      if (filterPreferences && !inProgressStageIds) {
        const settings = await updateFilterPreferences(user.userId, filterPreferences as FilterPreferences);
        return NextResponse.json({
          success: true,
          settings,
        });
      }

      // Validate input for inProgressStageIds
      if (inProgressStageIds !== undefined && !Array.isArray(inProgressStageIds)) {
        return NextResponse.json(
          { error: 'inProgressStageIds must be an array of numbers' },
          { status: 400 }
        );
      }

      // Validate all items are numbers
      const validStageIds = inProgressStageIds
        ? inProgressStageIds.filter(
            (id: unknown): id is number => typeof id === 'number' && !isNaN(id)
          )
        : [];

      const settings = await upsertUserHelpdeskSettings(
        user.userId,
        validStageIds,
        filterPreferences as FilterPreferences | undefined
      );

      return NextResponse.json({
        success: true,
        settings,
      });
    } catch (error) {
      console.error('[Helpdesk Settings PUT] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to save settings' },
        { status: 500 }
      );
    }
  });
}
