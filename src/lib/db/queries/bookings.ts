/**
 * Booking confirmation database queries (PostgreSQL)
 *
 * Handles CRUD operations for booking confirmations and decline reasons.
 */

import { queryOne, queryAll, query, transaction } from '../postgres';
import { BookingConfirmation, BookingStatus, DeclineReason } from '@/lib/types';
import { generateTokenSet } from '@/lib/services/booking-tokens';

// Database row type for booking confirmation
interface DbBookingConfirmation {
  id: number;
  magento_order_id: number;
  magento_order_item_id: number;
  magento_order_increment_id: string | null;
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

// Database row type for decline reason
interface DbDeclineReason {
  id: number;
  code: string;
  label_de: string;
  label_en: string;
  label_uk: string | null;
  requires_notes: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

/**
 * Transform database row to BookingConfirmation type
 */
function transformBookingConfirmation(row: DbBookingConfirmation): BookingConfirmation {
  return {
    id: row.id,
    magento_order_id: row.magento_order_id,
    magento_order_item_id: row.magento_order_item_id,
    magento_order_increment_id: row.magento_order_increment_id || '',
    customer_number: row.customer_number,
    status: row.status,
    confirmation_token: row.confirmation_token,
    token_expires_at: row.token_expires_at,
    confirmed_at: row.confirmed_at,
    confirmed_by: row.confirmed_by,
    declined_at: row.declined_at,
    declined_by: row.declined_by,
    decline_reason: row.decline_reason,
    decline_notes: row.decline_notes,
    reminder_count: row.reminder_count,
    last_reminder_at: row.last_reminder_at,
    escalated_at: row.escalated_at,
    odoo_ticket_id: row.odoo_ticket_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Transform database row to DeclineReason type
 */
function transformDeclineReason(row: DbDeclineReason): DeclineReason {
  return {
    id: row.id,
    code: row.code,
    labelDe: row.label_de,
    labelEn: row.label_en,
    labelUk: row.label_uk || '',
    requiresNotes: row.requires_notes,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

// ============================================
// Booking Confirmation Queries
// ============================================

/**
 * Create a new booking confirmation record
 */
export async function createBookingConfirmation(data: {
  magentoOrderId: number;
  magentoOrderItemId: number;
  magentoOrderIncrementId: string;
  customerNumber: string;
}): Promise<BookingConfirmation | null> {
  const { token, expiresAt } = generateTokenSet();

  const row = await queryOne<DbBookingConfirmation>(
    `INSERT INTO miomente_partner_portal_booking_confirmations (
      magento_order_id,
      magento_order_item_id,
      magento_order_increment_id,
      customer_number,
      confirmation_token,
      token_expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      data.magentoOrderId,
      data.magentoOrderItemId,
      data.magentoOrderIncrementId,
      data.customerNumber,
      token,
      expiresAt,
    ]
  );

  return row ? transformBookingConfirmation(row) : null;
}

/**
 * Find booking confirmation by ID
 */
export async function findBookingConfirmationById(
  id: number
): Promise<BookingConfirmation | null> {
  const row = await queryOne<DbBookingConfirmation>(
    `SELECT * FROM miomente_partner_portal_booking_confirmations WHERE id = $1`,
    [id]
  );
  return row ? transformBookingConfirmation(row) : null;
}

/**
 * Find booking confirmation by token
 */
export async function findBookingConfirmationByToken(
  token: string
): Promise<BookingConfirmation | null> {
  const row = await queryOne<DbBookingConfirmation>(
    `SELECT * FROM miomente_partner_portal_booking_confirmations WHERE confirmation_token = $1`,
    [token]
  );
  return row ? transformBookingConfirmation(row) : null;
}

/**
 * Find booking confirmation by Magento order item
 */
export async function findBookingConfirmationByOrderItem(
  magentoOrderId: number,
  magentoOrderItemId: number
): Promise<BookingConfirmation | null> {
  const row = await queryOne<DbBookingConfirmation>(
    `SELECT * FROM miomente_partner_portal_booking_confirmations
     WHERE magento_order_id = $1 AND magento_order_item_id = $2`,
    [magentoOrderId, magentoOrderItemId]
  );
  return row ? transformBookingConfirmation(row) : null;
}

/**
 * Get all booking confirmations for a partner (by customer number)
 */
export async function getBookingConfirmationsByCustomerNumber(
  customerNumber: string,
  options?: {
    status?: BookingStatus;
    limit?: number;
    offset?: number;
  }
): Promise<BookingConfirmation[]> {
  let sql = `SELECT * FROM miomente_partner_portal_booking_confirmations
             WHERE customer_number = $1`;
  const params: unknown[] = [customerNumber];

  if (options?.status) {
    sql += ` AND status = $${params.length + 1}`;
    params.push(options.status);
  }

  sql += ` ORDER BY created_at DESC`;

  if (options?.limit) {
    sql += ` LIMIT $${params.length + 1}`;
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += ` OFFSET $${params.length + 1}`;
    params.push(options.offset);
  }

  const rows = await queryAll<DbBookingConfirmation>(sql, params);
  return rows.map(transformBookingConfirmation);
}

/**
 * Get all booking confirmations for multiple customer numbers
 * Used when partner has multiple customer numbers
 */
export async function getBookingConfirmationsByCustomerNumbers(
  customerNumbers: string[],
  options?: {
    status?: BookingStatus;
    limit?: number;
    offset?: number;
  }
): Promise<BookingConfirmation[]> {
  if (customerNumbers.length === 0) {
    return [];
  }

  const placeholders = customerNumbers.map((_, i) => `$${i + 1}`).join(', ');
  let sql = `SELECT * FROM miomente_partner_portal_booking_confirmations
             WHERE customer_number IN (${placeholders})`;
  const params: unknown[] = [...customerNumbers];

  if (options?.status) {
    sql += ` AND status = $${params.length + 1}`;
    params.push(options.status);
  }

  sql += ` ORDER BY created_at DESC`;

  if (options?.limit) {
    sql += ` LIMIT $${params.length + 1}`;
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += ` OFFSET $${params.length + 1}`;
    params.push(options.offset);
  }

  const rows = await queryAll<DbBookingConfirmation>(sql, params);
  return rows.map(transformBookingConfirmation);
}

/**
 * Confirm a booking
 */
export async function confirmBooking(
  id: number,
  confirmedBy: 'email_token' | 'portal'
): Promise<BookingConfirmation | null> {
  const row = await queryOne<DbBookingConfirmation>(
    `UPDATE miomente_partner_portal_booking_confirmations
     SET status = 'confirmed',
         confirmed_at = NOW(),
         confirmed_by = $1
     WHERE id = $2 AND status = 'pending'
     RETURNING *`,
    [confirmedBy, id]
  );
  return row ? transformBookingConfirmation(row) : null;
}

/**
 * Decline a booking
 */
export async function declineBooking(
  id: number,
  declinedBy: 'email_token' | 'portal',
  declineReason: string,
  declineNotes?: string
): Promise<BookingConfirmation | null> {
  const row = await queryOne<DbBookingConfirmation>(
    `UPDATE miomente_partner_portal_booking_confirmations
     SET status = 'declined',
         declined_at = NOW(),
         declined_by = $1,
         decline_reason = $2,
         decline_notes = $3
     WHERE id = $4 AND status = 'pending'
     RETURNING *`,
    [declinedBy, declineReason, declineNotes || null, id]
  );
  return row ? transformBookingConfirmation(row) : null;
}

/**
 * Update reminder count and last reminder timestamp
 */
export async function updateReminderSent(id: number): Promise<void> {
  await query(
    `UPDATE miomente_partner_portal_booking_confirmations
     SET reminder_count = reminder_count + 1,
         last_reminder_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

/**
 * Mark booking as escalated and store Odoo ticket ID
 */
export async function markAsEscalated(
  id: number,
  odooTicketId: string
): Promise<void> {
  await query(
    `UPDATE miomente_partner_portal_booking_confirmations
     SET escalated_at = NOW(),
         odoo_ticket_id = $1
     WHERE id = $2`,
    [odooTicketId, id]
  );
}

/**
 * Regenerate token for a booking (e.g., after expiry)
 */
export async function regenerateToken(
  id: number
): Promise<BookingConfirmation | null> {
  const { token, expiresAt } = generateTokenSet();

  const row = await queryOne<DbBookingConfirmation>(
    `UPDATE miomente_partner_portal_booking_confirmations
     SET confirmation_token = $1,
         token_expires_at = $2
     WHERE id = $3
     RETURNING *`,
    [token, expiresAt, id]
  );
  return row ? transformBookingConfirmation(row) : null;
}

/**
 * Get pending bookings that need reminders
 *
 * Used by the reminder service to find bookings requiring action.
 *
 * @param minReminderCount - Minimum number of reminders already sent
 * @param thresholdHours - Hours since creation to qualify
 */
export async function getPendingBookingsForReminder(
  minReminderCount: number,
  thresholdHours: number
): Promise<BookingConfirmation[]> {
  const rows = await queryAll<DbBookingConfirmation>(
    `SELECT * FROM miomente_partner_portal_booking_confirmations
     WHERE status = 'pending'
       AND escalated_at IS NULL
       AND reminder_count = $1
       AND created_at < NOW() - INTERVAL '1 hour' * $2
     ORDER BY created_at ASC`,
    [minReminderCount, thresholdHours]
  );
  return rows.map(transformBookingConfirmation);
}

/**
 * Increment the reminder count for a booking
 * Used by the reminder service after sending a reminder email
 */
export async function incrementReminderCount(id: number): Promise<void> {
  await query(
    `UPDATE miomente_partner_portal_booking_confirmations
     SET reminder_count = reminder_count + 1,
         last_reminder_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

/**
 * Get bookings that should be escalated
 * Returns pending bookings with 2+ reminders that haven't been escalated
 */
export async function getBookingsForEscalation(): Promise<BookingConfirmation[]> {
  const rows = await queryAll<DbBookingConfirmation>(
    `SELECT * FROM miomente_partner_portal_booking_confirmations
     WHERE status = 'pending'
       AND escalated_at IS NULL
       AND reminder_count >= 2
     ORDER BY created_at ASC`,
    []
  );
  return rows.map(transformBookingConfirmation);
}

/**
 * Get booking statistics for a partner
 */
export async function getBookingStats(
  customerNumbers: string[]
): Promise<{
  total: number;
  pending: number;
  confirmed: number;
  declined: number;
  needsAttention: number;
}> {
  if (customerNumbers.length === 0) {
    return { total: 0, pending: 0, confirmed: 0, declined: 0, needsAttention: 0 };
  }

  const placeholders = customerNumbers.map((_, i) => `$${i + 1}`).join(', ');

  const result = await queryOne<{
    total: string;
    pending: string;
    confirmed: string;
    declined: string;
    needs_attention: string;
  }>(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'pending') as pending,
       COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
       COUNT(*) FILTER (WHERE status = 'declined') as declined,
       COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours') as needs_attention
     FROM miomente_partner_portal_booking_confirmations
     WHERE customer_number IN (${placeholders})`,
    customerNumbers
  );

  return {
    total: parseInt(result?.total || '0', 10),
    pending: parseInt(result?.pending || '0', 10),
    confirmed: parseInt(result?.confirmed || '0', 10),
    declined: parseInt(result?.declined || '0', 10),
    needsAttention: parseInt(result?.needs_attention || '0', 10),
  };
}

/**
 * Create or get existing booking confirmation for an order item
 * Uses transaction to prevent duplicates
 */
export async function getOrCreateBookingConfirmation(data: {
  magentoOrderId: number;
  magentoOrderItemId: number;
  magentoOrderIncrementId: string;
  customerNumber: string;
}): Promise<BookingConfirmation> {
  return transaction(async (client) => {
    // Check if exists
    const existing = await client.query<DbBookingConfirmation>(
      `SELECT * FROM miomente_partner_portal_booking_confirmations
       WHERE magento_order_id = $1 AND magento_order_item_id = $2
       FOR UPDATE`,
      [data.magentoOrderId, data.magentoOrderItemId]
    );

    if (existing.rows.length > 0) {
      return transformBookingConfirmation(existing.rows[0]);
    }

    // Create new
    const { token, expiresAt } = generateTokenSet();
    const created = await client.query<DbBookingConfirmation>(
      `INSERT INTO miomente_partner_portal_booking_confirmations (
        magento_order_id,
        magento_order_item_id,
        magento_order_increment_id,
        customer_number,
        confirmation_token,
        token_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        data.magentoOrderId,
        data.magentoOrderItemId,
        data.magentoOrderIncrementId,
        data.customerNumber,
        token,
        expiresAt,
      ]
    );

    return transformBookingConfirmation(created.rows[0]);
  });
}

// ============================================
// Decline Reason Queries
// ============================================

/**
 * Get all active decline reasons
 */
export async function getActiveDeclineReasons(): Promise<DeclineReason[]> {
  const rows = await queryAll<DbDeclineReason>(
    `SELECT * FROM miomente_partner_portal_decline_reasons
     WHERE is_active = true
     ORDER BY sort_order, id`,
    []
  );
  return rows.map(transformDeclineReason);
}

/**
 * Get decline reason by code
 */
export async function getDeclineReasonByCode(
  code: string
): Promise<DeclineReason | null> {
  const row = await queryOne<DbDeclineReason>(
    `SELECT * FROM miomente_partner_portal_decline_reasons WHERE code = $1`,
    [code]
  );
  return row ? transformDeclineReason(row) : null;
}
