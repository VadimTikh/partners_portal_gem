/**
 * Password reset email template
 * Matches the exact HTML from the n8n backend
 */

export interface ResetPasswordTemplateData {
  name: string;
  resetToken: string;
  appUrl: string;
}

/**
 * Generate password reset email HTML
 */
export function getResetPasswordEmailHtml(data: ResetPasswordTemplateData): string {
  const resetUrl = `${data.appUrl}/reset-password?token=${data.resetToken}`;

  return `
<div style='background-color: #f9f9f9; padding: 40px 0; font-family: Helvetica, Arial, sans-serif;'>
  <table align='center' border='0' cellpadding='0' cellspacing='0' width='600' style='background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #eeeeee;'>
    <tr>
      <td align='center' style='padding: 30px 0; background-color: #ffffff;'>
        <img src='https://www.miomente.de/skin/frontend/ultimo/default/images/goldenwebage/logo.png' alt='Miomente' width='180' style='display: block;'>
      </td>
    </tr>
    <tr>
      <td style='padding: 40px 30px;'>
        <h2 style='color: #333333; font-size: 24px; margin-top: 0;'>Passwort zurücksetzen</h2>
        <p style='color: #666666; font-size: 16px; line-height: 1.5;'>Hallo ${escapeHtml(data.name)},</p>
        <p style='color: #666666; font-size: 16px; line-height: 1.5;'>wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten. Klicken Sie auf den untenstehenden Button, um ein neues Passwort festzulegen:</p>
        <div style='padding: 30px 0; text-align: center;'>
          <a href="${resetUrl}" style='background-color: #e4002b; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;'>Passwort jetzt zurücksetzen</a>
        </div>
        <p style='color: #999999; font-size: 14px; line-height: 1.5;'>Dieser Link ist für <strong>1 Stunde</strong> gültig. Falls Sie dies nicht angefragt haben, können Sie diese E-Mail einfach ignorieren.</p>
      </td>
    </tr>
    <tr>
      <td style='padding: 20px 30px; background-color: #f1f1f1; color: #888888; font-size: 12px; text-align: center;'>
        <p style='margin: 0;'>Herzliche Grüße,<br><strong>Ihr Miomente-Team</strong></p>
        <p style='margin-top: 15px;'>Boni-Shop GmbH | <a href='https://www.miomente.de' style='color: #888888;'>www.miomente.de</a></p>
      </td>
    </tr>
  </table>
</div>
`.trim();
}

/**
 * Generate password reset email subject
 */
export function getResetPasswordEmailSubject(): string {
  return 'Passwort zurücksetzen - Miomente Partner-Portal';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
