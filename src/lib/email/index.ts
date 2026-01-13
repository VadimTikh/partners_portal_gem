/**
 * Email service with development override support
 *
 * In development mode, all emails are redirected to DEV_EMAIL_OVERRIDE
 * if that environment variable is set.
 */

import { sendViaSendGrid } from './sendgrid';

export interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
  originalRecipient?: string; // Set in dev mode when email was redirected
}

/**
 * Send an email with development override support
 *
 * In development mode with DEV_EMAIL_OVERRIDE set:
 * - Email is sent to the override address instead of the actual recipient
 * - Subject is prefixed with [DEV - Original: actual@email.com]
 * - Original recipient is logged
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const isDev = process.env.NODE_ENV === 'development';
  const devOverride = process.env.DEV_EMAIL_OVERRIDE;

  let finalRecipient = options.to;
  let finalSubject = options.subject;
  let originalRecipient: string | undefined;

  // Apply development override
  if (isDev && devOverride) {
    originalRecipient = options.to;
    finalRecipient = devOverride;
    finalSubject = `[DEV - To: ${options.to}] ${options.subject}`;

    console.log('[Email] Development mode - redirecting email');
    console.log(`  Original recipient: ${options.to}`);
    console.log(`  Redirected to: ${devOverride}`);
    console.log(`  Subject: ${options.subject}`);
  }

  const result = await sendViaSendGrid({
    to: finalRecipient,
    toName: options.toName,
    subject: finalSubject,
    html: options.html,
    text: options.text,
  });

  if (!result.success) {
    console.error('[Email] Failed to send:', result.error);
    return {
      success: false,
      error: result.error,
      originalRecipient,
    };
  }

  if (isDev) {
    console.log('[Email] Sent successfully in development mode');
  }

  return {
    success: true,
    originalRecipient,
  };
}

/**
 * Preview an email without sending (for debugging)
 */
export function previewEmail(options: EmailOptions): void {
  console.log('=== Email Preview ===');
  console.log('To:', options.to);
  if (options.toName) console.log('To Name:', options.toName);
  console.log('Subject:', options.subject);
  console.log('--- HTML ---');
  console.log(options.html);
  if (options.text) {
    console.log('--- Text ---');
    console.log(options.text);
  }
  console.log('===================');
}
