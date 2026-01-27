/**
 * PDF Export for Helpdesk Tickets
 *
 * Generates PDF documents containing ticket details, AI analysis, and message threads.
 * Uses pdfkit for server-side PDF generation with streaming support.
 */

import PDFDocument from 'pdfkit';
import { Ticket, TicketMessage, StoredTicketAnalysis, AICategory, AIUrgency, AISentiment } from '../types/helpdesk';

// ============================================
// Types
// ============================================

export interface PDFExportOptions {
  includeAnalysis: boolean;
  includeMessages: boolean;
  language: string;
}

export interface TicketExportData {
  ticket: Ticket;
  analysis?: StoredTicketAnalysis;
  messages?: TicketMessage[];
}

// ============================================
// Translations
// ============================================

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Helpdesk Tickets Export',
    generated: 'Generated',
    ticket: 'Ticket',
    status: 'Status',
    priority: 'Priority',
    created: 'Created',
    customer: 'Customer',
    aiAnalysis: 'AI Analysis',
    urgency: 'Urgency',
    category: 'Category',
    sentiment: 'Sentiment',
    summary: 'Summary',
    actionRequired: 'Action Required',
    description: 'Description',
    messages: 'Messages',
    noMessages: 'No messages',
    noDescription: 'No description',
    page: 'Page',
    of: 'of',
    // Category labels
    missing_dates: 'Missing Dates',
    refund_request: 'Refund Request',
    voucher_not_received: 'Voucher Not Received',
    voucher_expired: 'Voucher Expired',
    booking_change: 'Booking Change',
    complaint: 'Complaint',
    general_inquiry: 'General Inquiry',
    partner_issue: 'Partner Issue',
    payment_issue: 'Payment Issue',
    technical_issue: 'Technical Issue',
    other: 'Other',
    // Urgency labels
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    // Sentiment labels
    angry: 'Angry',
    frustrated: 'Frustrated',
    neutral: 'Neutral',
    positive: 'Positive',
  },
  de: {
    title: 'Helpdesk-Tickets Export',
    generated: 'Erstellt',
    ticket: 'Ticket',
    status: 'Status',
    priority: 'Priorität',
    created: 'Erstellt',
    customer: 'Kunde',
    aiAnalysis: 'KI-Analyse',
    urgency: 'Dringlichkeit',
    category: 'Kategorie',
    sentiment: 'Stimmung',
    summary: 'Zusammenfassung',
    actionRequired: 'Erforderliche Aktion',
    description: 'Beschreibung',
    messages: 'Nachrichten',
    noMessages: 'Keine Nachrichten',
    noDescription: 'Keine Beschreibung',
    page: 'Seite',
    of: 'von',
    // Category labels
    missing_dates: 'Fehlende Termine',
    refund_request: 'Rückerstattung',
    voucher_not_received: 'Gutschein nicht erhalten',
    voucher_expired: 'Gutschein abgelaufen',
    booking_change: 'Buchungsänderung',
    complaint: 'Beschwerde',
    general_inquiry: 'Allgemeine Anfrage',
    partner_issue: 'Partner-Problem',
    payment_issue: 'Zahlungsproblem',
    technical_issue: 'Technisches Problem',
    other: 'Sonstiges',
    // Urgency labels
    critical: 'Kritisch',
    high: 'Hoch',
    medium: 'Mittel',
    low: 'Niedrig',
    // Sentiment labels
    angry: 'Verärgert',
    frustrated: 'Frustriert',
    neutral: 'Neutral',
    positive: 'Positiv',
  },
  uk: {
    title: 'Експорт тікетів',
    generated: 'Створено',
    ticket: 'Тікет',
    status: 'Статус',
    priority: 'Пріоритет',
    created: 'Створено',
    customer: 'Клієнт',
    aiAnalysis: 'ШІ-аналіз',
    urgency: 'Терміновість',
    category: 'Категорія',
    sentiment: 'Настрій',
    summary: 'Резюме',
    actionRequired: 'Необхідна дія',
    description: 'Опис',
    messages: 'Повідомлення',
    noMessages: 'Немає повідомлень',
    noDescription: 'Немає опису',
    page: 'Сторінка',
    of: 'з',
    // Category labels
    missing_dates: 'Відсутні дати',
    refund_request: 'Запит на повернення',
    voucher_not_received: 'Ваучер не отримано',
    voucher_expired: 'Ваучер прострочено',
    booking_change: 'Зміна бронювання',
    complaint: 'Скарга',
    general_inquiry: 'Загальний запит',
    partner_issue: 'Проблема з партнером',
    payment_issue: 'Проблема з оплатою',
    technical_issue: 'Технічна проблема',
    other: 'Інше',
    // Urgency labels
    critical: 'Критичний',
    high: 'Високий',
    medium: 'Середній',
    low: 'Низький',
    // Sentiment labels
    angry: 'Злий',
    frustrated: 'Розчарований',
    neutral: 'Нейтральний',
    positive: 'Позитивний',
  },
};

function t(key: string, language: string): string {
  const lang = translations[language] || translations.en;
  return lang[key] || translations.en[key] || key;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get priority label
 */
function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 3: return 'Urgent';
    case 2: return 'High';
    case 1: return 'Normal';
    default: return 'Low';
  }
}

// ============================================
// PDF Generation
// ============================================

/**
 * Generate PDF document for helpdesk tickets
 */
export async function generateTicketsPDF(
  tickets: TicketExportData[],
  options: PDFExportOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
      });

      // Collect output chunks
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { language } = options;

      // Title page
      doc.fontSize(24).text(t('title', language), { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`${t('generated', language)}: ${formatDate(new Date().toISOString())}`, { align: 'center' });
      doc.text(`${tickets.length} tickets`, { align: 'center' });
      doc.moveDown(2);

      // Process each ticket
      tickets.forEach((ticketData, index) => {
        if (index > 0) {
          doc.addPage();
        }

        renderTicket(doc, ticketData, options, language);
      });

      // Add page numbers
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(10)
          .text(
            `${t('page', language)} ${i + 1} ${t('of', language)} ${pageCount}`,
            50,
            doc.page.height - 50,
            { align: 'center', width: doc.page.width - 100 }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render a single ticket to the PDF document
 */
function renderTicket(
  doc: PDFKit.PDFDocument,
  data: TicketExportData,
  options: PDFExportOptions,
  language: string
): void {
  const { ticket, analysis, messages } = data;
  const { includeAnalysis, includeMessages } = options;

  // Ticket header
  doc.fontSize(16).fillColor('#1a1a1a')
    .text(`${t('ticket', language)} #${ticket.id}`, { continued: true })
    .fontSize(12).fillColor('#666666')
    .text(` - ${ticket.name}`);

  doc.moveDown(0.5);

  // Ticket metadata
  doc.fontSize(10).fillColor('#333333');
  const metadata = [
    `${t('status', language)}: ${ticket.stage_name}`,
    `${t('priority', language)}: ${getPriorityLabel(ticket.priority)}`,
    `${t('created', language)}: ${formatDate(ticket.create_date)}`,
    `${t('customer', language)}: ${ticket.partner_name || ticket.partner_email || '-'}`,
  ];
  doc.text(metadata.join(' | '));
  doc.moveDown();

  // Horizontal line
  doc.strokeColor('#e0e0e0').lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .stroke();
  doc.moveDown(0.5);

  // AI Analysis section
  if (includeAnalysis && analysis) {
    doc.fontSize(12).fillColor('#6b21a8').text(t('aiAnalysis', language), { underline: true });
    doc.moveDown(0.3);

    doc.fontSize(10).fillColor('#333333');
    const urgencyLabel = t(analysis.urgency, language);
    const categoryLabel = t(analysis.category, language);
    const sentimentLabel = analysis.sentiment ? t(analysis.sentiment, language) : '-';

    doc.text(`${t('urgency', language)}: ${urgencyLabel}`);
    doc.text(`${t('category', language)}: ${categoryLabel}`);
    doc.text(`${t('sentiment', language)}: ${sentimentLabel}`);

    if (analysis.summary) {
      doc.moveDown(0.3);
      doc.text(`${t('summary', language)}:`, { continued: false });
      doc.fillColor('#444444').text(analysis.summary);
    }

    if (analysis.actionRequired) {
      doc.moveDown(0.3);
      doc.fillColor('#333333').text(`${t('actionRequired', language)}:`, { continued: false });
      doc.fillColor('#444444').text(analysis.actionRequired);
    }

    doc.moveDown();
    doc.strokeColor('#e0e0e0').lineWidth(0.5)
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke();
    doc.moveDown(0.5);
  }

  // Description section
  doc.fontSize(12).fillColor('#1a1a1a').text(t('description', language), { underline: true });
  doc.moveDown(0.3);

  const description = ticket.description
    ? stripHtml(ticket.description)
    : t('noDescription', language);

  doc.fontSize(10).fillColor('#333333').text(description, {
    width: doc.page.width - 100,
    align: 'left',
  });
  doc.moveDown();

  // Messages section
  if (includeMessages && messages && messages.length > 0) {
    // Check if we need a new page
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }

    doc.strokeColor('#e0e0e0').lineWidth(0.5)
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke();
    doc.moveDown(0.5);

    doc.fontSize(12).fillColor('#1a1a1a').text(t('messages', language), { underline: true });
    doc.moveDown(0.5);

    messages.forEach((message, index) => {
      // Check if we need a new page
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
      }

      // Message header
      const author = message.author_name || message.email_from || 'Unknown';
      const date = formatDate(message.date);
      const isInternal = message.message_type === 'comment';

      doc.fontSize(9).fillColor(isInternal ? '#9333ea' : '#0369a1')
        .text(`--- ${date} - ${author}${isInternal ? ' (Internal)' : ''} ---`);

      // Message body
      const body = stripHtml(message.body);
      if (body) {
        doc.fontSize(10).fillColor('#333333').text(body, {
          width: doc.page.width - 100,
          align: 'left',
        });
      }

      if (index < messages.length - 1) {
        doc.moveDown(0.5);
      }
    });
  } else if (includeMessages) {
    doc.fontSize(10).fillColor('#666666').text(t('noMessages', language));
  }
}

/**
 * Generate PDF for a batch of tickets with streaming support
 */
export function createTicketsPDFStream(
  tickets: TicketExportData[],
  options: PDFExportOptions
): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    autoFirstPage: true,
  });

  const { language } = options;

  // Title page
  doc.fontSize(24).text(t('title', language), { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`${t('generated', language)}: ${formatDate(new Date().toISOString())}`, { align: 'center' });
  doc.text(`${tickets.length} tickets`, { align: 'center' });
  doc.moveDown(2);

  // Process each ticket
  tickets.forEach((ticketData, index) => {
    if (index > 0) {
      doc.addPage();
    }

    renderTicket(doc, ticketData, options, language);
  });

  return doc;
}
