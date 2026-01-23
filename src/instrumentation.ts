/**
 * Next.js Instrumentation Hook
 * This file runs once when the Next.js server starts
 * Used to initialize the internal cron scheduler
 */

export async function register() {
  // Only run on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Skip during build phase
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.log('[Instrumentation] Skipping scheduler during build phase');
      return;
    }

    console.log('[Instrumentation] Starting cron scheduler...');

    const { startScheduler } = await import('@/lib/cron/scheduler');
    startScheduler();
  }
}
