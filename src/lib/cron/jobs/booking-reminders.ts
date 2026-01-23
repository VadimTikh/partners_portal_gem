/**
 * Booking Reminders Cron Job
 * Wraps the booking reminders service for scheduled execution
 */

import { processBookingReminders } from '@/lib/services/booking-reminders';

let isRunning = false;

/**
 * Execute the booking reminders job with overlap prevention and logging
 */
export async function runBookingRemindersJob(): Promise<void> {
  // Prevent overlapping executions
  if (isRunning) {
    console.log('[Cron] Booking reminders job already running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  console.log('[Cron] Booking reminders job started at', new Date().toISOString());

  try {
    const result = await processBookingReminders();
    const duration = Date.now() - startTime;

    console.log('[Cron] Booking reminders job completed:', {
      duration: `${duration}ms`,
      processed: result.processed,
      reminders1Sent: result.reminders1Sent,
      reminders2Sent: result.reminders2Sent,
      escalated: result.escalated,
      errors: result.errors.length,
    });

    if (result.errors.length > 0) {
      console.warn('[Cron] Booking reminders job had errors:', result.errors);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Cron] Booking reminders job failed after', `${duration}ms:`, error);
    // Don't rethrow - let the scheduler continue running
  } finally {
    isRunning = false;
  }
}
