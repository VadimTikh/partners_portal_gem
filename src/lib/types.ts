export interface Course {
  id: number;
  title: string;
  sku: string;
  status: 'active' | 'inactive';
  description: string;
  image: string;
  basePrice: number;
  available_dates?: number;
  location: string;
}

export interface CourseDate {
  id: number;
  courseId: number;
  dateTime: string; // ISO string
  capacity: number;
  booked: number;
  duration?: number; // Duration in minutes
  price: number; // Price for this specific date
}

export type UserRole = 'partner' | 'manager';

export interface User {
  id?: string; // User ID from database
  email: string;
  name: string;
  token?: string;
  role: UserRole;
  partnerId?: number; // For partners: their partner ID
  partnerName?: string; // For partners: their company name
}

// Partner information for manager view
export interface Partner {
  id: string;  // Portal user UUID
  name: string;
  email: string;
  customerNumbers?: string[];  // All assigned customer numbers
  coursesCount: number;
  activeCoursesCount?: number;
  availableDatesCount?: number;
  pendingRequestsCount: number;
}

// Course request status
export type CourseRequestStatus = 'pending' | 'in_moderation' | 'approved' | 'rejected';

// Simplified course request from partner
export interface CourseRequest {
  id: number;
  partnerId: number;
  partnerName: string;
  partnerEmail: string;
  // Partner fills these
  name: string;
  location: string;
  basePrice: number;
  partnerDescription: string; // Short description for manager
  requestedDates?: CourseRequestDate[];
  // System/Manager fills these
  status: CourseRequestStatus;
  rejectionReason?: string;
  rejectionRecommendations?: string;
  createdCourseId?: number; // Set when approved and course created
  createdAt: string;
  updatedAt: string;
  // Manager fills these when creating full course
  managerNotes?: string;
}

// Optional date in course request
export interface CourseRequestDate {
  id?: number;
  dateTime: string; // ISO string
  duration: number; // Duration in minutes
  capacity: number;
  customPrice?: number; // Optional - basePrice used if not set
}

// Data for creating full course from request (manager fills)
export interface CreateCourseFromRequest {
  requestId: number;
  // Title from partner (manager can edit)
  name?: string; // Course title - pre-filled from request, editable by manager
  // Required fields manager must fill
  description: string; // Full HTML description
  shortDescription: string; // Short teaser
  subtitle: string; // Course subtitle/tagline
  beginTime: string; // Default start time (HH:MM)
  endTime: string; // Default end time (HH:MM)
  seats: string; // Default capacity
  participants: string; // Display text like "2-8 Personen"
  categoryIds: string; // Comma-separated category IDs
  // Optional fields
  keyword?: string;
  metaTitle?: string;
  metaDescription?: string;
  image?: string;
}

// ============================================
// Booking Confirmation Types (Feature 01)
// ============================================

// Booking status for partner confirmations
export type BookingStatus = 'pending' | 'confirmed' | 'declined';

// Customer information from Magento order
export interface BookingCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

// Course info attached to booking
export interface BookingCourse {
  id: number;
  name: string;
  sku: string;
}

// Main booking interface (combines Magento order data with confirmation status)
export interface Booking {
  id: number; // PostgreSQL confirmation record ID
  magentoOrderId: number;
  magentoOrderItemId: number;
  orderNumber: string; // Magento increment_id (human-readable)
  customer: BookingCustomer;
  course: BookingCourse;
  eventDate: string; // ISO date
  eventTime: string; // HH:MM format
  participants: number;
  price: number;
  currency: string;
  status: BookingStatus;
  confirmationStatus: {
    confirmedAt?: string;
    confirmedBy?: 'email_token' | 'portal';
    declinedAt?: string;
    declinedBy?: 'email_token' | 'portal';
    declineReason?: string;
    declineNotes?: string;
  };
  reminderCount: number;
  lastReminderAt?: string;
  escalatedAt?: string;
  odooTicketId?: string;
  orderDate: string; // When order was placed
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  // Related confirmation IDs when multiple items are grouped (for bulk confirm/decline)
  relatedConfirmationIds?: number[];
}

// Database record for booking confirmation (PostgreSQL)
export interface BookingConfirmation {
  id: number;
  magento_order_id: number;
  magento_order_item_id: number;
  magento_order_increment_id: string;
  customer_number: string;
  status: BookingStatus;
  confirmation_token: string;
  token_expires_at: string;
  confirmed_at: string | null;
  confirmed_by: 'email_token' | 'portal' | null;
  declined_at: string | null;
  declined_by: 'email_token' | 'portal' | null;
  decline_reason: string | null;
  decline_notes: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  escalated_at: string | null;
  odoo_ticket_id: string | null;
  created_at: string;
  updated_at: string;
}

// Standardized decline reasons
export interface DeclineReason {
  id: number;
  code: string;
  labelDe: string;
  labelEn: string;
  labelUk: string;
  requiresNotes: boolean;
  sortOrder: number;
  isActive: boolean;
}

// API request for declining a booking
export interface DeclineBookingRequest {
  reasonCode: string;
  notes?: string;
}

// API request for confirming a booking
export interface ConfirmBookingRequest {
  method: 'portal' | 'email_token';
}

// Booking list filters
export interface BookingFilters {
  status?: BookingStatus;
  courseId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string; // Search by customer name, email, or order number
}

// Booking statistics for dashboard
export interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  declined: number;
  needsAttention: number; // Pending for >24h
}

// ============================================
// App Log Types
// ============================================

// App Log types for tracking API/database operations
export type AppLogStatus = 'success' | 'error' | 'validation_error';

// ============================================
// Manager Booking Types (Manager Dashboard)
// ============================================

// Booking with partner info for manager view
export interface ManagerBooking {
  // Booking confirmation fields
  id: number;
  status: BookingStatus;
  reminderCount: number;
  odooTicketId: string | null;
  createdAt: string;
  confirmedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  declineNotes: string | null;
  escalatedAt: string | null;

  // Partner info
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  customerNumber: string;

  // Order info (from Magento)
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  courseName: string;
  eventDate: string;
  eventTime: string;
  participants: number;
  price: number;
}

// Partner summary for filter dropdown
export interface PartnerSummary {
  id: string;
  name: string;
  email: string;
}

// Manager booking statistics
export interface ManagerBookingStats {
  total: number;
  pending: number;
  confirmed: number;
  declined: number;
}

export interface AppLog {
  id: number;
  timestamp: string;
  endpoint: string;
  method: string;
  action: string;
  status: AppLogStatus;
  statusCode: number;
  errorMessage: string | null;
  errorCode: string | null;
  errorStack: string | null;
  userId: string | null;
  userEmail: string | null;
  userRole: UserRole | null;
  requestBody: Record<string, unknown> | null;
  responseSummary: Record<string, unknown> | null;
  durationMs: number;
  ipAddress: string | null;
}

// ============================================
// Manager Courses Types
// ============================================

// Course with partner info for manager view
export interface ManagerCourse extends Course {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  customerNumber: string;
}
