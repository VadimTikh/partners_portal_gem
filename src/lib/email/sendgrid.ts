/**
 * SendGrid email client
 */

interface SendGridMailContent {
  type: 'text/plain' | 'text/html';
  value: string;
}

interface SendGridPersonalization {
  to: { email: string; name?: string }[];
  subject?: string;
}

interface SendGridRequest {
  personalizations: SendGridPersonalization[];
  from: { email: string; name?: string };
  subject: string;
  content: SendGridMailContent[];
  tracking_settings?: {
    click_tracking?: { enable: boolean; enable_text?: boolean };
    open_tracking?: { enable: boolean };
  };
}

interface SendGridResponse {
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Send email using SendGrid API
 */
export async function sendViaSendGrid(options: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendGridResponse> {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.error('[SendGrid] SENDGRID_API_KEY not configured');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const fromEmail = process.env.EMAIL_FROM || 'bestellung@miomente.de';
  const fromName = process.env.EMAIL_FROM_NAME || 'Miomente Partner-Portal';

  const requestBody: SendGridRequest = {
    personalizations: [
      {
        to: [{ email: options.to, name: options.toName }],
      },
    ],
    from: { email: fromEmail, name: fromName },
    subject: options.subject,
    content: [
      ...(options.text ? [{ type: 'text/plain' as const, value: options.text }] : []),
      { type: 'text/html' as const, value: options.html },
    ],
    // Disable tracking for privacy
    tracking_settings: {
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
    },
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok || response.status === 202) {
      return { success: true, statusCode: response.status };
    }

    const errorText = await response.text();
    console.error('[SendGrid] API error:', response.status, errorText);
    return {
      success: false,
      statusCode: response.status,
      error: errorText,
    };
  } catch (error) {
    console.error('[SendGrid] Request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
