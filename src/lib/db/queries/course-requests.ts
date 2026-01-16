/**
 * Course request database queries (PostgreSQL/Supabase)
 *
 * Course requests are stored in Supabase and track partner requests
 * for new courses that need manager approval.
 */

import { queryOne, queryAll, query } from '../postgres';

export interface DbCourseRequest {
  id: number;
  customer_number: string;
  partner_name: string;
  partner_email: string;
  course_name: string;
  location: string;
  base_price: string; // stored as decimal string
  partner_description: string | null;
  requested_dates: object; // JSONB array of dates
  status: 'pending' | 'in_moderation' | 'approved' | 'rejected';
  rejection_reason: string | null;
  rejection_recommendations: string | null;
  manager_notes: string | null;
  created_course_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCourseRequestInput {
  customerNumber: string;
  partnerName: string;
  partnerEmail: string;
  courseName: string;
  location: string;
  basePrice: number;
  partnerDescription?: string;
  requestedDates: Array<{ date: string; time: string }>;
}

export interface UpdateCourseRequestInput {
  status: 'pending' | 'in_moderation' | 'approved' | 'rejected';
  rejectionReason?: string;
  rejectionRecommendations?: string;
  managerNotes?: string;
}

/**
 * Get all course requests for a partner by customer number
 */
export async function getRequestsByPartner(customerNumber: string): Promise<DbCourseRequest[]> {
  return queryAll<DbCourseRequest>(
    `SELECT * FROM miomente_course_requests
     WHERE customer_number = $1
     ORDER BY created_at DESC`,
    [customerNumber]
  );
}

/**
 * Get all course requests (for managers)
 * Ordered by status priority (pending first) then by date
 */
export async function getAllRequests(): Promise<DbCourseRequest[]> {
  return queryAll<DbCourseRequest>(
    `SELECT * FROM miomente_course_requests
     ORDER BY
       CASE status
         WHEN 'pending' THEN 1
         WHEN 'in_moderation' THEN 2
         ELSE 3
       END,
       created_at DESC`
  );
}

/**
 * Get a single course request by ID
 */
export async function getRequestById(requestId: number): Promise<DbCourseRequest | null> {
  return queryOne<DbCourseRequest>(
    `SELECT * FROM miomente_course_requests WHERE id = $1`,
    [requestId]
  );
}

/**
 * Create a new course request
 */
export async function createCourseRequest(
  input: CreateCourseRequestInput
): Promise<DbCourseRequest | null> {
  return queryOne<DbCourseRequest>(
    `INSERT INTO miomente_course_requests (
        customer_number, partner_name, partner_email,
        course_name, location, base_price, partner_description,
        requested_dates, status
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'pending'
    ) RETURNING *`,
    [
      input.customerNumber,
      input.partnerName,
      input.partnerEmail,
      input.courseName,
      input.location,
      input.basePrice,
      input.partnerDescription || null,
      JSON.stringify(input.requestedDates),
    ]
  );
}

/**
 * Update course request status (manager action)
 */
export async function updateRequestStatus(
  requestId: number,
  input: UpdateCourseRequestInput
): Promise<DbCourseRequest | null> {
  return queryOne<DbCourseRequest>(
    `UPDATE miomente_course_requests
     SET
         status = $1,
         rejection_reason = CASE WHEN $2 = '' OR $2 IS NULL THEN rejection_reason ELSE $2 END,
         rejection_recommendations = CASE WHEN $3 = '' OR $3 IS NULL THEN rejection_recommendations ELSE $3 END,
         manager_notes = CASE WHEN $4 = '' OR $4 IS NULL THEN manager_notes ELSE $4 END,
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [
      input.status,
      input.rejectionReason || '',
      input.rejectionRecommendations || '',
      input.managerNotes || '',
      requestId,
    ]
  );
}

/**
 * Mark request as approved with created course ID
 */
export async function approveRequestWithCourse(
  requestId: number,
  createdCourseId: number
): Promise<DbCourseRequest | null> {
  return queryOne<DbCourseRequest>(
    `UPDATE miomente_course_requests
     SET
         status = 'approved',
         created_course_id = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [createdCourseId, requestId]
  );
}

/**
 * Get pending request count by partner (for dashboard stats)
 */
export async function getPendingCountsByPartner(): Promise<Array<{ customer_number: string; pending_count: number }>> {
  return queryAll<{ customer_number: string; pending_count: number }>(
    `SELECT customer_number, COUNT(*) as pending_count
     FROM miomente_course_requests
     WHERE status = 'pending'
     GROUP BY customer_number`
  );
}

/**
 * Transform database request to API response format
 */
export function transformCourseRequest(dbRequest: DbCourseRequest): {
  id: number;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  name: string;
  location: string;
  basePrice: number;
  partnerDescription: string;
  requestedDates: Array<{ date: string; time: string }>;
  status: string;
  rejectionReason: string | null;
  rejectionRecommendations: string | null;
  managerNotes: string | null;
  createdCourseId: number | null;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: dbRequest.id,
    partnerId: dbRequest.customer_number,
    partnerName: dbRequest.partner_name,
    partnerEmail: dbRequest.partner_email,
    name: dbRequest.course_name,
    location: dbRequest.location,
    basePrice: parseFloat(dbRequest.base_price),
    partnerDescription: dbRequest.partner_description || '',
    requestedDates: dbRequest.requested_dates as Array<{ date: string; time: string }>,
    status: dbRequest.status,
    rejectionReason: dbRequest.rejection_reason,
    rejectionRecommendations: dbRequest.rejection_recommendations,
    managerNotes: dbRequest.manager_notes,
    createdCourseId: dbRequest.created_course_id,
    createdAt: dbRequest.created_at,
    updatedAt: dbRequest.updated_at,
  };
}
