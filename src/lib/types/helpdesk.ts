// ============================================
// Odoo Helpdesk Types
// ============================================

/**
 * Helpdesk stage from Odoo
 */
export interface HelpdeskStage {
  id: number;
  name: string;
  sequence: number;
  fold: boolean;       // Collapsed in kanban view
  is_close: boolean;   // Marks ticket as resolved/closed
}

/**
 * Helpdesk ticket type (category) from Odoo
 */
export interface HelpdeskTicketType {
  id: number;
  name: string;
}

/**
 * Helpdesk tag from Odoo
 */
export interface HelpdeskTag {
  id: number;
  name: string;
}

/**
 * Raw ticket from Odoo API
 */
export interface OdooTicket {
  id: number;
  name: string;                           // Ticket subject
  description: string | false;            // Ticket body (false if empty in Odoo)
  stage_id: [number, string] | false;     // [id, name]
  partner_id: [number, string] | false;   // [id, name] - Customer
  partner_email: string | false;
  user_id: [number, string] | false;      // [id, name] - Assigned user
  create_date: string;                    // ISO datetime
  close_date: string | false;
  priority: string;                       // '0', '1', '2', '3'
  ticket_type_id?: [number, string] | false;  // [id, name] - Optional, may not exist
  tag_ids: number[];
}

/**
 * Message from Odoo mail.message
 */
export interface OdooMessage {
  id: number;
  res_id: number;                         // Ticket ID
  date: string;                           // ISO datetime
  author_id: [number, string] | false;    // [id, name]
  email_from: string | false;
  body: string;                           // HTML content
  message_type: 'email' | 'comment' | 'notification';
}

// ============================================
// Stage Status Types (defined early for use in Ticket)
// ============================================

/**
 * Logical status derived from stage name
 */
export type TicketLogicalStatus =
  | 'new'
  | 'in_progress'
  | 'waiting_customer'
  | 'solved'
  | 'cancelled'
  | 'resolved'
  | 'disputed';

// ============================================
// Normalized Types for Frontend
// ============================================

/**
 * Ticket for frontend use (uses snake_case to match Odoo API response)
 */
export interface Ticket {
  id: number;
  name: string;
  description: string;
  stage_id: number;
  stage_name: string;
  stage_status: TicketLogicalStatus;  // Derived status for UI styling
  is_closed: boolean;
  partner_id: number | null;
  partner_name: string;
  partner_email: string;
  user_id: number | null;
  user_name: string;
  create_date: string;
  close_date: string | null;
  priority: number;  // 0-3 from Odoo
  ticket_type_id: number | null;
  ticket_type_name: string;
  tag_ids: number[];
  // Computed fields
  age_in_hours: number;
  age_bucket: AgeBucket;
  // AI Analysis (populated separately)
  aiAnalysis?: TicketAIAnalysis;
}

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AgeBucket = '<24h' | '1-3d' | '3-7d' | '>7d';

/**
 * Ticket message for display (uses snake_case to match Odoo API response)
 */
export interface TicketMessage {
  id: number;
  ticket_id: number;
  date: string;
  author_id: number | null;
  author_name: string;
  email_from: string;
  body: string;            // HTML content
  message_type: 'email' | 'comment' | 'notification';
}

// ============================================
// AI Analysis Types
// ============================================

/**
 * AI-detected urgency level
 */
export type AIUrgency = 'critical' | 'high' | 'medium' | 'low';

/**
 * AI-detected category
 */
export type AICategory =
  | 'missing_dates'
  | 'refund_request'
  | 'voucher_not_received'
  | 'voucher_expired'
  | 'booking_change'
  | 'complaint'
  | 'general_inquiry'
  | 'partner_issue'
  | 'payment_issue'
  | 'technical_issue'
  | 'other';

/**
 * AI-detected customer intent
 */
export type AICustomerIntent =
  | 'wants_refund'
  | 'wants_dates'
  | 'wants_rebooking'
  | 'wants_info'
  | 'wants_complaint_resolved'
  | 'wants_voucher'
  | 'other';

/**
 * AI-detected sentiment
 */
export type AISentiment = 'angry' | 'frustrated' | 'neutral' | 'positive';

/**
 * AI-detected customer type
 */
export type AICustomerType = 'customer' | 'partner' | 'unknown';

/**
 * Extracted data from ticket content
 */
export interface AIExtractedData {
  orderNumber?: string;
  voucherCode?: string;
  city?: string;
  eventName?: string;
  customerEmail?: string;
  eventDate?: string;
  amount?: number;
}

/**
 * Complete AI analysis result for a ticket (Phase 1 - Must Have)
 */
export interface TicketAIAnalysisPhase1 {
  urgency: AIUrgency;
  urgencyReason: string;
  category: AICategory;
  categoryConfidence: number;  // 0-1
  extractedData: AIExtractedData;
  language: 'de' | 'en' | 'other';
}

/**
 * Extended AI analysis (Phase 2 - Should Have)
 */
export interface TicketAIAnalysisPhase2 extends TicketAIAnalysisPhase1 {
  summary: string;           // 1-2 sentences in English
  customerIntent: AICustomerIntent;
  actionRequired: string;    // What needs to be done
  sentiment: AISentiment;
}

/**
 * Full AI analysis (Phase 3 - Nice to Have)
 */
export interface TicketAIAnalysisFull extends TicketAIAnalysisPhase2 {
  responseSuggestion?: string;  // German draft response
  similarTicketIds?: number[];
  customerType: AICustomerType;
  isRepeatCustomer?: boolean;
  previousTicketCount?: number;
}

// Use Phase 2 as default for now (reasonable feature set)
export type TicketAIAnalysis = TicketAIAnalysisPhase2;

// ============================================
// Analytics Types
// ============================================

/**
 * Ticket counts by status
 */
export interface TicketStatusCounts {
  unanswered: number;
  inProgress: number;
  waitingForCustomer: number;
  resolved: number;
  total: number;
}

/**
 * Tickets grouped by age
 */
export interface TicketAgeBuckets {
  '<24h': number;
  '1-3d': number;
  '3-7d': number;
  '>7d': number;
}

/**
 * Tickets grouped by type
 */
export interface TicketTypeBreakdown {
  typeId: number;
  typeName: string;
  count: number;
  percentage: number;
}

/**
 * Response time metrics
 */
export interface ResponseTimeMetrics {
  avgFirstResponseHours: number;
  avgResolutionHours: number;
  medianFirstResponseHours: number;
  under24hPercentage: number;
}

/**
 * Complete analytics data
 */
export interface HelpdeskAnalytics {
  period: {
    from: string;
    to: string;
    label: string;
  };
  // Flat convenience properties (used by pages)
  unansweredCount: number;
  avgFirstResponseTimeHours: number | null;
  totalOpen: number;
  totalResolved: number;
  openByAgeBucket: TicketAgeBuckets;
  // Structured data
  statusCounts: TicketStatusCounts;
  ageBuckets: TicketAgeBuckets;
  typeBreakdown: TicketTypeBreakdown[];
  responseTime: ResponseTimeMetrics;
  // AI-enhanced analytics
  aiCategoryBreakdown?: Array<{
    category: AICategory;
    count: number;
    percentage: number;
  }>;
  aiUrgencyBreakdown?: Array<{
    urgency: AIUrgency;
    count: number;
  }>;
  aiSentimentBreakdown?: Array<{
    sentiment: AISentiment;
    count: number;
  }>;
}

// ============================================
// Filter & Query Types
// ============================================

export type TimePeriod = 'today' | '7d' | '30d' | 'custom';

export interface TicketFilters {
  period: TimePeriod;
  customFrom?: string;
  customTo?: string;
  stageIds?: number[];
  typeIds?: number[];
  search?: string;
  aiUrgency?: AIUrgency[];
  aiCategory?: AICategory[];
}

export interface TicketListParams {
  filters: TicketFilters;
  limit: number;
  offset: number;
  sortBy?: 'create_date' | 'priority' | 'stage_id';
  sortOrder?: 'asc' | 'desc';
}

export interface TicketListResponse {
  tickets: Ticket[];
  total: number;
  stages: HelpdeskStage[];
  types: HelpdeskTicketType[];
  analytics: HelpdeskAnalytics;
}

// ============================================
// Stage Status Mapping
// ============================================

/**
 * Maps stage names to logical statuses
 * Will be populated dynamically from Odoo stages
 */
export interface StageStatusMapping {
  [stageName: string]: TicketLogicalStatus;
}
