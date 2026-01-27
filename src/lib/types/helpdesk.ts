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
  ticketCount?: number; // Number of tickets in this stage
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
  write_date: string;                     // ISO datetime - last modified
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
  write_date: string;  // Last modified date from Odoo
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
  // Stored AI analysis from database (populated separately)
  storedAnalysis?: StoredTicketAnalysis;
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

export type TimePeriod = 'today' | '7d' | '30d' | 'all' | 'custom';

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

// ============================================
// Extended AI Analysis Types (Phase 2 Refactor)
// ============================================

/**
 * Type of author for the last message in a ticket
 */
export type MessageAuthorType = 'support_team' | 'customer' | 'partner';

/**
 * Satisfaction level (1-5 scale)
 */
export type SatisfactionLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Extended AI analysis with new fields
 */
export interface ExtendedAIAnalysis extends TicketAIAnalysisPhase2 {
  satisfactionLevel?: SatisfactionLevel;
  aiIsResolved?: boolean;
  lastMessageAuthorType?: MessageAuthorType;
}

/**
 * Stored AI analysis from PostgreSQL database
 */
export interface StoredTicketAnalysis {
  id: number;
  ticketId: number;
  analyzedAt: string;  // ISO timestamp
  ticketWriteDate: string | null;  // Odoo write_date at analysis time

  // Phase 1 fields
  urgency: AIUrgency;
  urgencyReason: string | null;
  category: AICategory;
  categoryConfidence: number | null;
  extractedData: AIExtractedData | null;
  language: 'de' | 'en' | 'other' | null;

  // Phase 2 fields
  summary: string | null;
  customerIntent: AICustomerIntent | null;
  actionRequired: string | null;
  sentiment: AISentiment | null;

  // Extended fields
  satisfactionLevel: SatisfactionLevel | null;
  aiIsResolved: boolean | null;
  lastMessageAuthorType: MessageAuthorType | null;

  // Computed field (not in DB)
  isStale?: boolean;  // ticket.write_date > analyzed_at

  createdAt: string;
  updatedAt: string;
}

/**
 * Filter preferences stored in database
 */
export interface FilterPreferences {
  period?: TimePeriod;
  customFrom?: string;
  customTo?: string;
  selectedStageIds?: number[];  // Multi-select stages
  searchQuery?: string;
  // AI filters
  aiUrgency?: AIUrgency[];
  aiCategory?: AICategory[];
  aiSentiment?: AISentiment[];
  aiSatisfaction?: SatisfactionLevel[];
  aiIsResolved?: boolean;
  awaitingAnswer?: boolean;
}

/**
 * User helpdesk settings stored in PostgreSQL
 */
export interface HelpdeskUserSettings {
  id: number;
  userId: string;
  inProgressStageIds: number[];  // Keep for backward compat
  filterPreferences: FilterPreferences;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extended AI ticket filters (for the refactored filtering)
 */
export interface AITicketFilters extends TicketFilters {
  // AI-based filters
  aiUrgency?: AIUrgency[];
  aiCategory?: AICategory[];
  aiSentiment?: AISentiment[];
  aiSatisfaction?: SatisfactionLevel[];
  aiIsResolved?: boolean;
  lastMessageAuthorType?: MessageAuthorType[];
  awaitingAnswer?: boolean;  // Where last author != support_team
  staleOnly?: boolean;  // Only tickets with outdated analysis
  hasAnalysis?: boolean;  // Only tickets with AI analysis
}

/**
 * Batch analysis request
 */
export interface BatchAnalysisRequest {
  ticketIds: number[];
  forceReanalyze?: boolean;  // Re-analyze even if not stale
}

/**
 * Batch analysis progress
 */
export interface BatchAnalysisProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentTicketId: number | null;
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  errors?: Array<{ ticketId: number; error: string }>;
}

/**
 * Batch analysis result
 */
export interface BatchAnalysisResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped?: number; // Already analyzed tickets that were skipped
  analyses: StoredTicketAnalysis[];
  errors?: Array<{ ticketId: number; error: string }>;
}

// ============================================
// Ultra Analysis Types
// ============================================

/**
 * Top problem identified in the ultra analysis
 */
export interface UltraTopProblem {
  rank: number;
  title: string;
  description: string;
  frequency: number; // percentage
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedSegment: 'customers' | 'partners' | 'both';
  exampleTicketIds: number[];
  recommendedActions: string[];
}

/**
 * Category insight from the ultra analysis
 */
export interface UltraCategoryInsight {
  category: AICategory;
  count: number;
  percentage: number;
  commonPatterns: string[];
  suggestedImprovements: string[];
}

/**
 * Sentiment analysis from the ultra analysis
 */
export interface UltraSentimentAnalysis {
  distribution: {
    angry: number;
    frustrated: number;
    neutral: number;
    positive: number;
  };
  trend: string;
}

/**
 * Action plan from the ultra analysis
 */
export interface UltraActionPlan {
  immediate: string[];  // This week
  shortTerm: string[];  // This month
  longTerm: string[];   // Next quarter
}

/**
 * Complete ultra analysis report
 */
export interface UltraAnalysisReport {
  generatedAt: string;
  ticketCount: number;
  period: { from: string; to: string };

  executiveSummary: string;

  topProblems: UltraTopProblem[];

  categoryInsights: UltraCategoryInsight[];

  sentimentAnalysis: UltraSentimentAnalysis;

  actionPlan: UltraActionPlan;
}

/**
 * Aggregated data sent to Gemini for ultra analysis
 */
export interface UltraAnalysisAggregatedData {
  totalTickets: number;
  period: { from: string; to: string };
  categoryDistribution: Array<{ category: AICategory; count: number }>;
  urgencyDistribution: Array<{ urgency: AIUrgency; count: number }>;
  sentimentDistribution: Array<{ sentiment: AISentiment; count: number }>;
  intentDistribution: Array<{ intent: AICustomerIntent; count: number }>;
  topSummaries: Array<{
    ticketId: number;
    category: AICategory;
    summary: string;
    urgency: AIUrgency;
    sentiment?: AISentiment;
  }>;
}

// ============================================
// Ask AI Types (Custom Reports)
// ============================================

/**
 * Request for "Ask AI" custom report feature
 */
export interface AskAIRequest {
  ticketIds: number[];
  question: string;
  language?: string;
}

/**
 * Response from "Ask AI" custom report feature
 */
export interface AskAIResponse {
  answer: string;
  ticketCount: number;
  analyzedCount: number;
}
