/**
 * Gemini AI Client for Helpdesk Ticket Analysis
 *
 * Uses Google's Gemini 3 Flash Preview model for analyzing support tickets.
 * Implements phased AI features: urgency detection, categorization, extraction,
 * sentiment analysis, and more.
 */

import {
  TicketAIAnalysis,
  TicketAIAnalysisPhase1,
  AIUrgency,
  AICategory,
  AICustomerIntent,
  AISentiment,
  AIExtractedData,
  Ticket,
  TicketMessage,
} from './types/helpdesk';

// ============================================
// Configuration
// ============================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// ============================================
// API Helper
// ============================================

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Call Gemini API with a prompt
 */
async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,  // Low temperature for consistent analysis
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 2048,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as GeminiResponse;

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No response from Gemini API');
  }

  return text;
}

/**
 * Parse JSON from Gemini response (handles markdown code blocks)
 */
function parseGeminiJSON<T>(response: string): T {
  // Remove markdown code blocks if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Failed to parse Gemini response as JSON:', cleaned);
    throw new Error('Failed to parse AI response');
  }
}

// ============================================
// System Instructions
// ============================================

const SYSTEM_INSTRUCTION = `You are an AI assistant analyzing customer support tickets for Miomente, a German company that sells culinary experience vouchers and cooking courses.

Context about Miomente:
- Sells vouchers for cooking courses, wine tastings, and culinary experiences
- Operates mainly in Germany (German-speaking customers)
- Partners are the chefs/venues who run the courses
- Common issues: missing course dates, voucher problems, refund requests, booking changes

Your task is to analyze support tickets and provide structured insights to help support agents prioritize and resolve issues efficiently.

Always respond with valid JSON only, no additional text or markdown formatting.`;

// ============================================
// Prompt Templates
// ============================================

/**
 * Phase 1: Basic analysis (urgency, category, extraction, language)
 */
function buildPhase1Prompt(ticket: Ticket, messages: TicketMessage[]): string {
  const conversationHistory = messages
    .map(m => `[${m.date}] ${m.author_name || m.email_from}: ${stripHtml(m.body)}`)
    .join('\n\n');

  return `Analyze this support ticket and provide structured analysis.

TICKET SUBJECT: ${ticket.name}

TICKET DESCRIPTION:
${ticket.description || '(no description)'}

CONVERSATION HISTORY:
${conversationHistory || '(no messages yet)'}

---

Analyze the ticket and return a JSON object with EXACTLY this structure:
{
  "urgency": "critical" | "high" | "medium" | "low",
  "urgencyReason": "brief explanation why this urgency level",
  "category": "missing_dates" | "refund_request" | "voucher_not_received" | "voucher_expired" | "booking_change" | "complaint" | "general_inquiry" | "partner_issue" | "payment_issue" | "technical_issue" | "other",
  "categoryConfidence": 0.0-1.0,
  "extractedData": {
    "orderNumber": "string or null",
    "voucherCode": "string or null",
    "city": "string or null",
    "eventName": "string or null",
    "customerEmail": "string or null",
    "eventDate": "string or null",
    "amount": number or null
  },
  "language": "de" | "en" | "other"
}

Urgency guidelines:
- critical: Legal threats, repeated complaints, angry tone, urgent time pressure, VIP customers
- high: Refund requests, voucher expiring soon, time-sensitive issues
- medium: Standard requests, booking changes, general inquiries
- low: Simple questions, positive feedback, non-urgent requests

Category guidelines:
- missing_dates: Customer wants dates for a course that has no available dates
- refund_request: Customer explicitly asks for money back
- voucher_not_received: Customer didn't receive their voucher
- voucher_expired: Issues with expired vouchers
- booking_change: Customer wants to change their booking
- complaint: Customer is unhappy with service/experience
- general_inquiry: General questions about products/services
- partner_issue: Problems related to partners/venues
- payment_issue: Payment problems
- technical_issue: Website/technical problems
- other: Doesn't fit other categories`;
}

/**
 * Phase 2: Extended analysis (summary, intent, action, sentiment)
 */
function buildPhase2Prompt(ticket: Ticket, messages: TicketMessage[], phase1: TicketAIAnalysisPhase1): string {
  const conversationHistory = messages
    .map(m => `[${m.date}] ${m.author_name || m.email_from}: ${stripHtml(m.body)}`)
    .join('\n\n');

  return `Based on the initial analysis, provide extended insights for this support ticket.

TICKET SUBJECT: ${ticket.name}

TICKET DESCRIPTION:
${ticket.description || '(no description)'}

CONVERSATION HISTORY:
${conversationHistory || '(no messages yet)'}

INITIAL ANALYSIS:
- Urgency: ${phase1.urgency}
- Category: ${phase1.category}
- Language: ${phase1.language}

---

Return a JSON object with EXACTLY this structure:
{
  "summary": "1-2 sentence summary in English of what the customer wants",
  "customerIntent": "wants_refund" | "wants_dates" | "wants_rebooking" | "wants_info" | "wants_complaint_resolved" | "wants_voucher" | "other",
  "actionRequired": "brief description of what support agent should do to resolve this",
  "sentiment": "angry" | "frustrated" | "neutral" | "positive"
}

Intent guidelines:
- wants_refund: Customer wants their money back
- wants_dates: Customer looking for available dates
- wants_rebooking: Customer wants to change their booking
- wants_info: Customer needs information
- wants_complaint_resolved: Customer wants their complaint addressed
- wants_voucher: Customer needs a new/replacement voucher
- other: None of the above

Sentiment guidelines:
- angry: Explicit anger, threats, ALL CAPS, aggressive language
- frustrated: Disappointment, multiple follow-ups, exasperation
- neutral: Matter-of-fact tone, simple request
- positive: Thankful, understanding, complimentary`;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validate and sanitize Phase 1 response
 */
function validatePhase1Response(raw: unknown): TicketAIAnalysisPhase1 {
  const data = raw as Record<string, unknown>;

  // Validate urgency
  const validUrgencies: AIUrgency[] = ['critical', 'high', 'medium', 'low'];
  const urgency = validUrgencies.includes(data.urgency as AIUrgency)
    ? (data.urgency as AIUrgency)
    : 'medium';

  // Validate category
  const validCategories: AICategory[] = [
    'missing_dates', 'refund_request', 'voucher_not_received', 'voucher_expired',
    'booking_change', 'complaint', 'general_inquiry', 'partner_issue',
    'payment_issue', 'technical_issue', 'other',
  ];
  const category = validCategories.includes(data.category as AICategory)
    ? (data.category as AICategory)
    : 'other';

  // Validate language
  const validLanguages = ['de', 'en', 'other'] as const;
  const language = validLanguages.includes(data.language as typeof validLanguages[number])
    ? (data.language as 'de' | 'en' | 'other')
    : 'other';

  // Extract data with defaults
  const extracted = (data.extractedData as Record<string, unknown>) || {};

  return {
    urgency,
    urgencyReason: String(data.urgencyReason || ''),
    category,
    categoryConfidence: typeof data.categoryConfidence === 'number'
      ? Math.max(0, Math.min(1, data.categoryConfidence))
      : 0.5,
    extractedData: {
      orderNumber: extracted.orderNumber ? String(extracted.orderNumber) : undefined,
      voucherCode: extracted.voucherCode ? String(extracted.voucherCode) : undefined,
      city: extracted.city ? String(extracted.city) : undefined,
      eventName: extracted.eventName ? String(extracted.eventName) : undefined,
      customerEmail: extracted.customerEmail ? String(extracted.customerEmail) : undefined,
      eventDate: extracted.eventDate ? String(extracted.eventDate) : undefined,
      amount: typeof extracted.amount === 'number' ? extracted.amount : undefined,
    },
    language,
  };
}

/**
 * Validate and merge Phase 2 response
 */
function validatePhase2Response(raw: unknown, phase1: TicketAIAnalysisPhase1): TicketAIAnalysis {
  const data = raw as Record<string, unknown>;

  // Validate intent
  const validIntents: AICustomerIntent[] = [
    'wants_refund', 'wants_dates', 'wants_rebooking', 'wants_info',
    'wants_complaint_resolved', 'wants_voucher', 'other',
  ];
  const customerIntent = validIntents.includes(data.customerIntent as AICustomerIntent)
    ? (data.customerIntent as AICustomerIntent)
    : 'other';

  // Validate sentiment
  const validSentiments: AISentiment[] = ['angry', 'frustrated', 'neutral', 'positive'];
  const sentiment = validSentiments.includes(data.sentiment as AISentiment)
    ? (data.sentiment as AISentiment)
    : 'neutral';

  return {
    ...phase1,
    summary: String(data.summary || 'Unable to generate summary'),
    customerIntent,
    actionRequired: String(data.actionRequired || 'Review ticket and respond to customer'),
    sentiment,
  };
}

// ============================================
// Public API
// ============================================

/**
 * Analyze a ticket using Gemini AI
 * Performs Phase 1 and Phase 2 analysis in sequence
 */
export async function analyzeTicket(
  ticket: Ticket,
  messages: TicketMessage[]
): Promise<TicketAIAnalysis> {
  // Phase 1: Basic analysis
  const phase1Prompt = buildPhase1Prompt(ticket, messages);
  const phase1Response = await callGemini(phase1Prompt, SYSTEM_INSTRUCTION);
  const phase1Raw = parseGeminiJSON(phase1Response);
  const phase1 = validatePhase1Response(phase1Raw);

  // Phase 2: Extended analysis
  const phase2Prompt = buildPhase2Prompt(ticket, messages, phase1);
  const phase2Response = await callGemini(phase2Prompt, SYSTEM_INSTRUCTION);
  const phase2Raw = parseGeminiJSON(phase2Response);
  const analysis = validatePhase2Response(phase2Raw, phase1);

  return analysis;
}

/**
 * Analyze a ticket - Phase 1 only (faster, less detailed)
 */
export async function analyzeTicketPhase1(
  ticket: Ticket,
  messages: TicketMessage[]
): Promise<TicketAIAnalysisPhase1> {
  const prompt = buildPhase1Prompt(ticket, messages);
  const response = await callGemini(prompt, SYSTEM_INSTRUCTION);
  const raw = parseGeminiJSON(response);
  return validatePhase1Response(raw);
}

/**
 * Batch analyze multiple tickets (Phase 1 only for efficiency)
 */
export async function analyzeTicketsBatch(
  tickets: Array<{ ticket: Ticket; messages: TicketMessage[] }>
): Promise<Map<number, TicketAIAnalysisPhase1>> {
  const results = new Map<number, TicketAIAnalysisPhase1>();

  // Process in parallel with concurrency limit
  const BATCH_SIZE = 5;

  for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
    const batch = tickets.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async ({ ticket, messages }) => {
      try {
        const analysis = await analyzeTicketPhase1(ticket, messages);
        return { ticketId: ticket.id, analysis };
      } catch (error) {
        console.error(`Failed to analyze ticket ${ticket.id}:`, error);
        return { ticketId: ticket.id, analysis: null };
      }
    });

    const batchResults = await Promise.all(promises);
    for (const { ticketId, analysis } of batchResults) {
      if (analysis) {
        results.set(ticketId, analysis);
      }
    }
  }

  return results;
}

/**
 * Generate a response suggestion for a ticket (Phase 3 feature)
 */
export async function generateResponseSuggestion(
  ticket: Ticket,
  messages: TicketMessage[],
  analysis: TicketAIAnalysis
): Promise<string> {
  const conversationHistory = messages
    .map(m => `[${m.date}] ${m.author_name || m.email_from}: ${stripHtml(m.body)}`)
    .join('\n\n');

  const prompt = `Generate a professional, friendly response in German for this support ticket.

TICKET: ${ticket.name}
CATEGORY: ${analysis.category}
CUSTOMER INTENT: ${analysis.customerIntent}
ACTION REQUIRED: ${analysis.actionRequired}

CONVERSATION:
${conversationHistory}

Write a response that:
1. Acknowledges the customer's concern
2. Addresses their specific issue
3. Provides next steps or resolution
4. Is professional but warm
5. Is in German

Response (German only, ready to send):`;

  const response = await callGemini(prompt, SYSTEM_INSTRUCTION);
  return response.trim();
}

/**
 * Check if Gemini API is configured and working
 */
export async function checkGeminiConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!GEMINI_API_KEY) {
      return { ok: false, error: 'GEMINI_API_KEY is not configured' };
    }

    // Simple test call
    const response = await callGemini('Respond with just the word "OK"');
    return { ok: response.toLowerCase().includes('ok') };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
