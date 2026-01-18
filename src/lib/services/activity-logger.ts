/**
 * Activity Logger Service
 *
 * Simple service to log partner activities throughout the application.
 */

import { createActivityLog, ActivityActionType } from '@/lib/db/queries/activity-logs';

interface LogActivityParams {
  userId: string;
  partnerEmail: string;
  partnerName: string;
  actionType: ActivityActionType;
  entityType?: string;
  entityId?: number;
  details?: Record<string, unknown>;
  customerNumber?: string;
  ipAddress?: string;
}

/**
 * Log a partner activity
 * Fails silently to not block the main operation
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await createActivityLog({
      userId: params.userId,
      partnerEmail: params.partnerEmail,
      partnerName: params.partnerName,
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details,
      customerNumber: params.customerNumber,
      ipAddress: params.ipAddress,
    });
  } catch (error) {
    // Log error but don't throw - activity logging should not block main operations
    console.error('[Activity Logger] Failed to log activity:', error);
  }
}

/**
 * Helper to extract IP from request
 */
export function getIpFromRequest(request: Request): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return undefined;
}

// Convenience functions for common log types

export async function logCourseRequestCreated(
  user: { id: string; email: string; name: string },
  requestId: number,
  courseName: string,
  customerNumber?: string,
  ipAddress?: string
): Promise<void> {
  await logActivity({
    userId: user.id,
    partnerEmail: user.email,
    partnerName: user.name,
    actionType: 'course_request_created',
    entityType: 'course_request',
    entityId: requestId,
    details: { courseName },
    customerNumber,
    ipAddress,
  });
}

export async function logDateAdded(
  user: { id: string; email: string; name: string },
  dateId: number,
  courseId: number,
  dateTime: string,
  customerNumber?: string,
  ipAddress?: string
): Promise<void> {
  await logActivity({
    userId: user.id,
    partnerEmail: user.email,
    partnerName: user.name,
    actionType: 'date_added',
    entityType: 'date',
    entityId: dateId,
    details: { courseId, dateTime },
    customerNumber,
    ipAddress,
  });
}

export async function logDateEdited(
  user: { id: string; email: string; name: string },
  dateId: number,
  courseId: number,
  changedFields: Record<string, { old: unknown; new: unknown }>,
  customerNumber?: string,
  ipAddress?: string
): Promise<void> {
  await logActivity({
    userId: user.id,
    partnerEmail: user.email,
    partnerName: user.name,
    actionType: 'date_edited',
    entityType: 'date',
    entityId: dateId,
    details: { courseId, changedFields },
    customerNumber,
    ipAddress,
  });
}

export async function logDateDeleted(
  user: { id: string; email: string; name: string },
  dateId: number,
  courseId: number,
  customerNumber?: string,
  ipAddress?: string
): Promise<void> {
  await logActivity({
    userId: user.id,
    partnerEmail: user.email,
    partnerName: user.name,
    actionType: 'date_deleted',
    entityType: 'date',
    entityId: dateId,
    details: { courseId },
    customerNumber,
    ipAddress,
  });
}

export async function logPasswordChanged(
  user: { id: string; email: string; name: string },
  ipAddress?: string
): Promise<void> {
  await logActivity({
    userId: user.id,
    partnerEmail: user.email,
    partnerName: user.name,
    actionType: 'password_changed',
    ipAddress,
  });
}

export async function logPasswordResetRequested(
  user: { id: string; email: string; name: string },
  ipAddress?: string
): Promise<void> {
  await logActivity({
    userId: user.id,
    partnerEmail: user.email,
    partnerName: user.name,
    actionType: 'password_reset_requested',
    ipAddress,
  });
}

export async function logPasswordResetCompleted(
  user: { id: string; email: string; name: string },
  ipAddress?: string
): Promise<void> {
  await logActivity({
    userId: user.id,
    partnerEmail: user.email,
    partnerName: user.name,
    actionType: 'password_reset_completed',
    ipAddress,
  });
}

export async function logLogin(
  user: { id: string; email: string; name: string },
  ipAddress?: string
): Promise<void> {
  await logActivity({
    userId: user.id,
    partnerEmail: user.email,
    partnerName: user.name,
    actionType: 'login',
    ipAddress,
  });
}

export async function logTicketCreated(
  user: { id: string; email: string; name: string },
  ticketId: number,
  subject: string,
  customerNumber?: string,
  ipAddress?: string
): Promise<void> {
  await logActivity({
    userId: user.id,
    partnerEmail: user.email,
    partnerName: user.name,
    actionType: 'ticket_created',
    entityType: 'ticket',
    entityId: ticketId,
    details: { subject },
    customerNumber,
    ipAddress,
  });
}
