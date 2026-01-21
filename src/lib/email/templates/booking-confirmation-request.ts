/**
 * Booking confirmation request email template
 * Sent to partner when a new booking needs confirmation
 */

export interface BookingConfirmationRequestData {
  partnerName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  courseName: string;
  eventDate: string; // formatted date
  eventTime: string;
  participants: number;
  orderNumber: string;
  price: string; // formatted price
  confirmUrl: string;
  declineUrl: string;
  portalUrl: string;
}

/**
 * Generate booking confirmation request email HTML
 */
export function getBookingConfirmationRequestHtml(data: BookingConfirmationRequestData): string {
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
        <h2 style='color: #333333; font-size: 24px; margin-top: 0;'>Neue Buchung zur Bestätigung</h2>
        <p style='color: #666666; font-size: 16px; line-height: 1.5;'>Hallo ${escapeHtml(data.partnerName)},</p>
        <p style='color: #666666; font-size: 16px; line-height: 1.5;'>Sie haben eine neue Buchung erhalten, die Ihre Bestätigung benötigt:</p>

        <!-- Booking Details Card -->
        <div style='background-color: #f8f8f8; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #e4002b;'>
          <table width='100%' cellpadding='0' cellspacing='0'>
            <tr>
              <td style='padding: 8px 0;'>
                <strong style='color: #333;'>Kurs:</strong>
                <span style='color: #666; margin-left: 10px;'>${escapeHtml(data.courseName)}</span>
              </td>
            </tr>
            <tr>
              <td style='padding: 8px 0;'>
                <strong style='color: #333;'>Datum:</strong>
                <span style='color: #666; margin-left: 10px;'>${escapeHtml(data.eventDate)} um ${escapeHtml(data.eventTime)}</span>
              </td>
            </tr>
            <tr>
              <td style='padding: 8px 0;'>
                <strong style='color: #333;'>Teilnehmer:</strong>
                <span style='color: #666; margin-left: 10px;'>${data.participants}</span>
              </td>
            </tr>
            <tr>
              <td style='padding: 8px 0;'>
                <strong style='color: #333;'>Bestellnummer:</strong>
                <span style='color: #666; margin-left: 10px;'>${escapeHtml(data.orderNumber)}</span>
              </td>
            </tr>
            <tr>
              <td style='padding: 8px 0;'>
                <strong style='color: #333;'>Preis:</strong>
                <span style='color: #666; margin-left: 10px;'>${escapeHtml(data.price)}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Customer Details -->
        <div style='background-color: #fff8e6; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ffc107;'>
          <h3 style='color: #333; margin-top: 0; font-size: 16px;'>Kundendaten</h3>
          <table width='100%' cellpadding='0' cellspacing='0'>
            <tr>
              <td style='padding: 5px 0;'>
                <strong style='color: #333;'>Name:</strong>
                <span style='color: #666; margin-left: 10px;'>${escapeHtml(data.customerName)}</span>
              </td>
            </tr>
            <tr>
              <td style='padding: 5px 0;'>
                <strong style='color: #333;'>E-Mail:</strong>
                <span style='color: #666; margin-left: 10px;'><a href='mailto:${escapeHtml(data.customerEmail)}' style='color: #0066cc;'>${escapeHtml(data.customerEmail)}</a></span>
              </td>
            </tr>
            ${data.customerPhone ? `
            <tr>
              <td style='padding: 5px 0;'>
                <strong style='color: #333;'>Telefon:</strong>
                <span style='color: #666; margin-left: 10px;'><a href='tel:${escapeHtml(data.customerPhone)}' style='color: #0066cc;'>${escapeHtml(data.customerPhone)}</a></span>
              </td>
            </tr>
            ` : ''}
          </table>
        </div>

        <!-- Action Buttons -->
        <div style='padding: 30px 0; text-align: center;'>
          <a href="${data.confirmUrl}" style='background-color: #28a745; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; margin: 5px;'>Buchung bestätigen</a>
          <br><br>
          <a href="${data.declineUrl}" style='background-color: #dc3545; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; margin: 5px;'>Buchung ablehnen</a>
        </div>

        <p style='color: #999999; font-size: 14px; line-height: 1.5;'>Sie können die Buchung auch im <a href="${data.portalUrl}" style='color: #e4002b;'>Partner-Portal</a> verwalten.</p>
        <p style='color: #999999; font-size: 14px; line-height: 1.5;'>Dieser Link ist für <strong>7 Tage</strong> gültig.</p>
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
 * Generate booking confirmation request email subject
 */
export function getBookingConfirmationRequestSubject(courseName: string, eventDate: string): string {
  return `Neue Buchung: ${courseName} am ${eventDate} - Bestätigung erforderlich`;
}

/**
 * Generate plain text version of the email
 */
export function getBookingConfirmationRequestText(data: BookingConfirmationRequestData): string {
  return `
Neue Buchung zur Bestätigung

Hallo ${data.partnerName},

Sie haben eine neue Buchung erhalten, die Ihre Bestätigung benötigt:

BUCHUNGSDETAILS
- Kurs: ${data.courseName}
- Datum: ${data.eventDate} um ${data.eventTime}
- Teilnehmer: ${data.participants}
- Bestellnummer: ${data.orderNumber}
- Preis: ${data.price}

KUNDENDATEN
- Name: ${data.customerName}
- E-Mail: ${data.customerEmail}
${data.customerPhone ? `- Telefon: ${data.customerPhone}` : ''}

AKTIONEN
Buchung bestätigen: ${data.confirmUrl}
Buchung ablehnen: ${data.declineUrl}

Sie können die Buchung auch im Partner-Portal verwalten: ${data.portalUrl}

Dieser Link ist für 7 Tage gültig.

Herzliche Grüße,
Ihr Miomente-Team

Boni-Shop GmbH | www.miomente.de
`.trim();
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
