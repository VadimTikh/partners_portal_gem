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
  email: string;
  name: string;
  token?: string;
  role: UserRole;
  partnerId?: number; // For partners: their partner ID
  partnerName?: string; // For partners: their company name
}

// Partner information for manager view
export interface Partner {
  id: number;
  name: string;
  email: string;
  companyName: string;
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
