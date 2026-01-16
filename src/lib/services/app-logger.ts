/**
 * App Logger Service
 *
 * Logs all API/database operations for monitoring and debugging.
 * Designed to be non-blocking - errors in logging won't affect the main operation.
 */

import { NextRequest } from 'next/server';
import { createAppLog, CreateAppLogInput } from '@/lib/db/queries/app-logs';
import { AppLogStatus } from '@/lib/types';

// Fields that should be removed from request bodies for security
const SENSITIVE_FIELDS = ['password', 'newPassword', 'token', 'currentPassword', 'confirmPassword'];

/**
 * Sanitize request body by removing sensitive fields
 */
export function sanitizeRequestBody(body: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return body;

  const sanitized = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}

/**
 * Extract request context from NextRequest
 */
export function extractRequestContext(request: NextRequest): {
  endpoint: string;
  method: string;
  ipAddress: string | undefined;
} {
  const url = new URL(request.url);
  const endpoint = url.pathname;
  const method = request.method;

  // Extract IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ipAddress = forwardedFor?.split(',')[0].trim() || realIp || undefined;

  return { endpoint, method, ipAddress };
}

/**
 * Create a response summary from the response data
 */
export function createResponseSummary(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;

  const summary: Record<string, unknown> = {};
  const obj = data as Record<string, unknown>;

  // Include common fields
  if ('success' in obj) summary.success = obj.success;
  if ('error' in obj) summary.error = obj.error;
  if ('message' in obj) summary.message = obj.message;

  // Include counts for arrays
  for (const key of Object.keys(obj)) {
    if (Array.isArray(obj[key])) {
      summary[`${key}Count`] = (obj[key] as unknown[]).length;
    }
  }

  // Include IDs
  if ('id' in obj) summary.id = obj.id;
  if ('courseId' in obj) summary.courseId = obj.courseId;
  if ('requestId' in obj) summary.requestId = obj.requestId;

  return Object.keys(summary).length > 0 ? summary : null;
}

export interface LogAppOperationParams {
  request: NextRequest;
  action: string;
  status: AppLogStatus;
  statusCode: number;
  startTime: number;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  requestBody?: Record<string, unknown> | null;
  responseData?: unknown;
  errorMessage?: string;
  errorCode?: string;
  error?: Error;
}

/**
 * Log an API operation
 * Fails silently to not block the main operation
 */
export async function logAppOperation(params: LogAppOperationParams): Promise<void> {
  try {
    const { endpoint, method, ipAddress } = extractRequestContext(params.request);
    const durationMs = Date.now() - params.startTime;

    const sanitizedBody = sanitizeRequestBody(params.requestBody || null);
    const responseSummary = createResponseSummary(params.responseData);

    const input: CreateAppLogInput = {
      endpoint,
      method,
      action: params.action,
      status: params.status,
      statusCode: params.statusCode,
      durationMs,
      ipAddress,
      userId: params.userId,
      userEmail: params.userEmail,
      userRole: params.userRole,
      requestBody: sanitizedBody || undefined,
      responseSummary: responseSummary || undefined,
      errorMessage: params.errorMessage || params.error?.message,
      errorCode: params.errorCode,
      errorStack: params.error?.stack?.slice(0, 2000), // Limit stack trace length
    };

    // Fire and forget - don't await in production to avoid blocking
    createAppLog(input).catch((err) => {
      console.error('[App Logger] Failed to write log:', err);
    });
  } catch (error) {
    // Log error but don't throw - app logging should not block main operations
    console.error('[App Logger] Failed to process log:', error);
  }
}

/**
 * Helper for logging successful operations
 */
export function logSuccess(
  request: NextRequest,
  action: string,
  startTime: number,
  options?: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    requestBody?: Record<string, unknown> | null;
    responseData?: unknown;
    statusCode?: number;
  }
): void {
  logAppOperation({
    request,
    action,
    status: 'success',
    statusCode: options?.statusCode || 200,
    startTime,
    ...options,
  });
}

/**
 * Helper for logging errors
 */
export function logError(
  request: NextRequest,
  action: string,
  startTime: number,
  error: Error | string,
  options?: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    requestBody?: Record<string, unknown> | null;
    statusCode?: number;
    errorCode?: string;
  }
): void {
  const errorObj = typeof error === 'string' ? new Error(error) : error;

  logAppOperation({
    request,
    action,
    status: 'error',
    statusCode: options?.statusCode || 500,
    startTime,
    error: errorObj,
    errorMessage: errorObj.message,
    errorCode: options?.errorCode,
    ...options,
  });
}

/**
 * Helper for logging validation errors
 */
export function logValidationError(
  request: NextRequest,
  action: string,
  startTime: number,
  message: string,
  options?: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    requestBody?: Record<string, unknown> | null;
    errorCode?: string;
  }
): void {
  logAppOperation({
    request,
    action,
    status: 'validation_error',
    statusCode: 400,
    startTime,
    errorMessage: message,
    errorCode: options?.errorCode || 'VALIDATION_ERROR',
    ...options,
  });
}

/**
 * Creates a logger bound to a specific request for convenience
 */
export function createRequestLogger(
  request: NextRequest,
  action: string,
  options?: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
  }
) {
  const startTime = Date.now();

  return {
    success: (responseData?: unknown, requestBody?: Record<string, unknown> | null, statusCode = 200) => {
      logSuccess(request, action, startTime, {
        ...options,
        requestBody,
        responseData,
        statusCode,
      });
    },
    error: (error: Error | string, requestBody?: Record<string, unknown> | null, statusCode = 500, errorCode?: string) => {
      logError(request, action, startTime, error, {
        ...options,
        requestBody,
        statusCode,
        errorCode,
      });
    },
    validationError: (message: string, requestBody?: Record<string, unknown> | null, errorCode?: string) => {
      logValidationError(request, action, startTime, message, {
        ...options,
        requestBody,
        errorCode,
      });
    },
  };
}
