/**
 * Internal Cron Scheduler
 * Uses node-cron to run scheduled jobs within the Next.js server process
 */

import cron, { ScheduledTask } from 'node-cron';
import { config } from '@/lib/config';
import { runBookingRemindersJob } from './jobs/booking-reminders';

let schedulerStarted = false;
const scheduledTasks: ScheduledTask[] = [];

/**
 * Start all cron jobs
 * Called from instrumentation.ts on server startup
 */
export function startScheduler(): void {
  if (schedulerStarted) {
    console.log('[Cron] Scheduler already started, skipping...');
    return;
  }

  console.log('[Cron] Starting internal scheduler...');

  // Booking reminders - default: every hour at minute 0
  const bookingRemindersSchedule = config.cron.bookingRemindersSchedule;

  if (!cron.validate(bookingRemindersSchedule)) {
    console.error('[Cron] Invalid booking reminders schedule:', bookingRemindersSchedule);
  } else {
    const task = cron.schedule(bookingRemindersSchedule, () => {
      runBookingRemindersJob();
    }, {
      name: 'booking-reminders',
      timezone: 'Europe/Berlin',
    });

    scheduledTasks.push(task);
    console.log('[Cron] Booking reminders scheduled:', bookingRemindersSchedule, '(Europe/Berlin)');
  }

  schedulerStarted = true;
  console.log('[Cron] Scheduler started with', scheduledTasks.length, 'job(s)');

  // Register graceful shutdown
  process.on('SIGTERM', stopScheduler);
  process.on('SIGINT', stopScheduler);
}

/**
 * Stop all cron jobs gracefully
 */
export function stopScheduler(): void {
  if (!schedulerStarted) {
    return;
  }

  console.log('[Cron] Stopping scheduler...');

  for (const task of scheduledTasks) {
    task.stop();
  }

  scheduledTasks.length = 0;
  schedulerStarted = false;

  console.log('[Cron] Scheduler stopped');
}
