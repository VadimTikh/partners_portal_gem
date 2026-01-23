/**
 * Partner database queries
 *
 * Partners can be queried from:
 * - Magento's miomente_pdf_operator table (legacy)
 * - PostgreSQL's miomente_partner_portal_users table (portal users)
 *
 * This module supports both approaches.
 */

import { query } from '../mysql';
import { queryAll, queryOne } from '../postgres';
import { RowDataPacket } from 'mysql2';

export interface DbPartner extends RowDataPacket {
  id: string; // operator_id
  name: string; // partnername
  email: string; // contact_email
  companyName: string; // name field
  coursesCount: number;
}

export interface PartnerWithStats {
  id: string;
  name: string;
  email: string;
  companyName: string;
  coursesCount: number;
  pendingRequestsCount: number;
}

/**
 * Portal partner - a partner from the portal users database
 */
export interface PortalPartner {
  id: string;           // Portal user ID (UUID)
  name: string;         // User name from portal
  email: string;        // User email
  customerNumbers: string[]; // All assigned customer numbers
  coursesCount: number;
  activeCoursesCount: number;
  availableDatesCount: number;
  pendingRequestsCount: number;
}

/**
 * Get all active partners from Magento
 *
 * Retrieves partners from miomente_pdf_operator table with
 * a count of their courses (configurable products).
 */
export async function getAllPartners(): Promise<DbPartner[]> {
  const partners = await query<DbPartner[]>(`
    SELECT
        o.operator_id as id,
        o.partnername as name,
        o.contact_email as email,
        o.name as companyName,
        (
            SELECT COUNT(*) FROM catalog_product_entity cpe
            INNER JOIN catalog_product_entity_varchar cpev
            ON cpe.entity_id = cpev.entity_id AND cpev.attribute_id = 700
            WHERE cpev.value = CAST(o.operator_id AS CHAR)
            AND cpe.type_id = 'configurable'
        ) as coursesCount
    FROM miomente_pdf_operator o
    WHERE o.status = 1
    ORDER BY o.name
  `);

  return partners;
}

/**
 * Get a single partner by operator ID
 */
export async function getPartnerById(operatorId: string): Promise<DbPartner | null> {
  const partners = await query<DbPartner[]>(`
    SELECT
        o.operator_id as id,
        o.partnername as name,
        o.contact_email as email,
        o.name as companyName,
        (
            SELECT COUNT(*) FROM catalog_product_entity cpe
            INNER JOIN catalog_product_entity_varchar cpev
            ON cpe.entity_id = cpev.entity_id AND cpev.attribute_id = 700
            WHERE cpev.value = CAST(o.operator_id AS CHAR)
            AND cpe.type_id = 'configurable'
        ) as coursesCount
    FROM miomente_pdf_operator o
    WHERE o.operator_id = ?
      AND o.status = 1
  `, [operatorId]);

  return partners.length > 0 ? partners[0] : null;
}

/**
 * Get pending course request counts by partner (from PostgreSQL)
 */
export async function getPendingRequestCounts(): Promise<Map<string, number>> {
  const counts = await queryAll<{ customer_number: string; pending_count: string }>(
    `SELECT customer_number, COUNT(*) as pending_count
     FROM miomente_course_requests
     WHERE status = 'pending'
     GROUP BY customer_number`
  );

  const map = new Map<string, number>();
  counts.forEach(row => {
    map.set(row.customer_number, parseInt(row.pending_count, 10));
  });

  return map;
}

/**
 * Get all partners with their pending request counts
 *
 * Combines data from Magento (partners, courses) and PostgreSQL (pending requests)
 */
export async function getAllPartnersWithStats(): Promise<PartnerWithStats[]> {
  // Fetch data from both databases in parallel
  const [partners, pendingMap] = await Promise.all([
    getAllPartners(),
    getPendingRequestCounts(),
  ]);

  // Merge the data
  return partners.map(partner => ({
    id: partner.id,
    name: partner.name,
    email: partner.email,
    companyName: partner.companyName,
    coursesCount: partner.coursesCount,
    pendingRequestsCount: pendingMap.get(partner.id) || 0,
  }));
}

/**
 * Get customer number(s) for a partner by operator ID
 *
 * A partner may have multiple customer numbers linked to the same operator_id.
 */
export async function getCustomerNumbersByOperator(operatorId: string): Promise<string[]> {
  const results = await query<Array<{ customernumber: string } & RowDataPacket>>(`
    SELECT DISTINCT customernumber
    FROM miomente_pdf_operator
    WHERE operator_id = ?
  `, [operatorId]);

  return results.map(r => r.customernumber);
}

/**
 * Transform partner data for API response
 */
export function transformPartner(partner: PartnerWithStats): {
  id: string;
  name: string;
  email: string;
  companyName: string;
  coursesCount: number;
  pendingRequestsCount: number;
} {
  return {
    id: partner.id,
    name: partner.name,
    email: partner.email,
    companyName: partner.companyName,
    coursesCount: partner.coursesCount,
    pendingRequestsCount: partner.pendingRequestsCount,
  };
}

/**
 * Get all portal users who are partners (not managers)
 *
 * Returns users from miomente_partner_portal_users with their customer numbers
 * and aggregated stats from Magento.
 */
export async function getAllPortalPartners(): Promise<PortalPartner[]> {
  // Get all partner users (non-managers) from PostgreSQL
  const portalUsers = await queryAll<{
    id: string;
    name: string;
    email: string;
    customer_number: string | null;
  }>(
    `SELECT id, name, email, customer_number
     FROM miomente_partner_portal_users
     WHERE is_manager = false
     ORDER BY name`
  );

  if (portalUsers.length === 0) {
    return [];
  }

  // Get all customer numbers for all users
  const allCustomerNumbers = await queryAll<{
    user_id: string;
    customer_number: string;
  }>(
    `SELECT user_id, customer_number
     FROM miomente_partner_customer_numbers
     ORDER BY user_id, is_primary DESC, created_at ASC`
  );

  // Build a map of user_id -> customer_numbers
  const customerNumbersMap = new Map<string, string[]>();
  allCustomerNumbers.forEach(cn => {
    const existing = customerNumbersMap.get(cn.user_id) || [];
    existing.push(cn.customer_number);
    customerNumbersMap.set(cn.user_id, existing);
  });

  // Include legacy customer_number field if not already in the list
  portalUsers.forEach(user => {
    if (user.customer_number) {
      const existing = customerNumbersMap.get(user.id) || [];
      if (!existing.includes(user.customer_number)) {
        existing.push(user.customer_number);
        customerNumbersMap.set(user.id, existing);
      }
    }
  });

  // Collect all unique customer numbers for Magento query
  const allUniqueCustomerNumbers = new Set<string>();
  customerNumbersMap.forEach(numbers => {
    numbers.forEach(cn => allUniqueCustomerNumbers.add(cn));
  });

  // Get course stats from Magento for all customer numbers
  // Wrapped in try-catch to not block partner list if Magento is slow/unavailable
  const courseStatsMap = new Map<string, { coursesCount: number; activeCoursesCount: number; availableDatesCount: number }>();

  if (allUniqueCustomerNumbers.size > 0) {
    try {
      const customerNumbersArray = Array.from(allUniqueCustomerNumbers);
      const placeholders = customerNumbersArray.map(() => '?').join(', ');

      // Simplified query without the expensive available_dates_count subquery
      const courseStats = await query<Array<{
        customernumber: string;
        courses_count: number;
        active_courses_count: number;
      } & RowDataPacket>>(`
        SELECT
          op.customernumber,
          COUNT(DISTINCT cpe.entity_id) as courses_count,
          COUNT(DISTINCT CASE WHEN cpei_status.value = 1 THEN cpe.entity_id END) as active_courses_count
        FROM miomente_pdf_operator AS op
        INNER JOIN catalog_product_entity_varchar AS cpev_operator
          ON cpev_operator.value = op.operator_id
          AND cpev_operator.attribute_id = 700
          AND cpev_operator.store_id = 0
        INNER JOIN catalog_product_entity AS cpe
          ON cpev_operator.entity_id = cpe.entity_id
          AND cpe.type_id = 'configurable'
        LEFT JOIN catalog_product_entity_int AS cpei_status
          ON cpe.entity_id = cpei_status.entity_id
          AND cpei_status.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4 LIMIT 1)
          AND cpei_status.store_id = 0
        WHERE op.customernumber IN (${placeholders})
        GROUP BY op.customernumber
      `, customerNumbersArray);

      courseStats.forEach(stat => {
        courseStatsMap.set(stat.customernumber, {
          coursesCount: stat.courses_count,
          activeCoursesCount: stat.active_courses_count,
          availableDatesCount: 0, // Skip expensive calculation for list view
        });
      });
    } catch (error) {
      console.error('[getAllPortalPartners] Magento query failed, returning partners without course stats:', error);
      // Continue without course stats - partners will show 0 courses
    }
  }

  // Get pending request counts
  const pendingCounts = await getPendingRequestCountsByUserId();

  // Build the final result
  return portalUsers.map(user => {
    const customerNumbers = customerNumbersMap.get(user.id) || [];

    // Aggregate stats across all customer numbers
    let totalCourses = 0;
    let totalActiveCourses = 0;
    let totalAvailableDates = 0;

    customerNumbers.forEach(cn => {
      const stats = courseStatsMap.get(cn);
      if (stats) {
        totalCourses += stats.coursesCount;
        totalActiveCourses += stats.activeCoursesCount;
        totalAvailableDates += stats.availableDatesCount;
      }
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      customerNumbers,
      coursesCount: totalCourses,
      activeCoursesCount: totalActiveCourses,
      availableDatesCount: totalAvailableDates,
      pendingRequestsCount: pendingCounts.get(user.id) || 0,
    };
  });
}

/**
 * Get pending course request counts by user ID (from PostgreSQL)
 */
async function getPendingRequestCountsByUserId(): Promise<Map<string, number>> {
  // Join requests with customer_numbers to get user_id
  const counts = await queryAll<{ user_id: string; pending_count: string }>(
    `SELECT cn.user_id, COUNT(r.id) as pending_count
     FROM miomente_course_requests r
     INNER JOIN miomente_partner_customer_numbers cn ON r.customer_number = cn.customer_number
     WHERE r.status = 'pending'
     GROUP BY cn.user_id
     UNION
     SELECT u.id as user_id, COUNT(r.id) as pending_count
     FROM miomente_course_requests r
     INNER JOIN miomente_partner_portal_users u ON r.customer_number = u.customer_number
     WHERE r.status = 'pending' AND u.customer_number IS NOT NULL
     GROUP BY u.id`
  );

  const map = new Map<string, number>();
  counts.forEach(row => {
    const existing = map.get(row.user_id) || 0;
    map.set(row.user_id, existing + parseInt(row.pending_count, 10));
  });

  return map;
}

/**
 * Get a single portal partner by user ID
 */
export async function getPortalPartnerById(userId: string): Promise<PortalPartner | null> {
  const user = await queryOne<{
    id: string;
    name: string;
    email: string;
    customer_number: string | null;
  }>(
    `SELECT id, name, email, customer_number
     FROM miomente_partner_portal_users
     WHERE id = $1 AND is_manager = false`,
    [userId]
  );

  if (!user) {
    return null;
  }

  // Get customer numbers for this user
  const customerNumberRecords = await queryAll<{ customer_number: string }>(
    `SELECT customer_number
     FROM miomente_partner_customer_numbers
     WHERE user_id = $1
     ORDER BY is_primary DESC, created_at ASC`,
    [userId]
  );

  const customerNumbers = customerNumberRecords.map(cn => cn.customer_number);

  // Include legacy field if not already present
  if (user.customer_number && !customerNumbers.includes(user.customer_number)) {
    customerNumbers.push(user.customer_number);
  }

  if (customerNumbers.length === 0) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      customerNumbers: [],
      coursesCount: 0,
      activeCoursesCount: 0,
      availableDatesCount: 0,
      pendingRequestsCount: 0,
    };
  }

  // Get course stats from Magento
  // Wrapped in try-catch to not block if Magento is slow/unavailable
  let stats = { courses_count: 0, active_courses_count: 0, available_dates_count: 0 };

  try {
    const placeholders = customerNumbers.map(() => '?').join(', ');

    const courseStats = await query<Array<{
      courses_count: number;
      active_courses_count: number;
    } & RowDataPacket>>(`
      SELECT
        COUNT(DISTINCT cpe.entity_id) as courses_count,
        COUNT(DISTINCT CASE WHEN cpei_status.value = 1 THEN cpe.entity_id END) as active_courses_count
      FROM miomente_pdf_operator AS op
      INNER JOIN catalog_product_entity_varchar AS cpev_operator
        ON cpev_operator.value = op.operator_id
        AND cpev_operator.attribute_id = 700
        AND cpev_operator.store_id = 0
      INNER JOIN catalog_product_entity AS cpe
        ON cpev_operator.entity_id = cpe.entity_id
        AND cpe.type_id = 'configurable'
      LEFT JOIN catalog_product_entity_int AS cpei_status
        ON cpe.entity_id = cpei_status.entity_id
        AND cpei_status.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4 LIMIT 1)
        AND cpei_status.store_id = 0
      WHERE op.customernumber IN (${placeholders})
    `, customerNumbers);

    if (courseStats[0]) {
      stats = { ...courseStats[0], available_dates_count: 0 };
    }
  } catch (error) {
    console.error('[getPortalPartnerById] Magento query failed:', error);
    // Continue with 0 stats
  }

  // Get pending request count
  const pendingCounts = await getPendingRequestCountsByUserId();

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    customerNumbers,
    coursesCount: stats.courses_count,
    activeCoursesCount: stats.active_courses_count,
    availableDatesCount: stats.available_dates_count,
    pendingRequestsCount: pendingCounts.get(user.id) || 0,
  };
}

/**
 * Simple partner info for email sending
 */
export interface PartnerEmailInfo {
  id: string;
  name: string;
  email: string;
}

/**
 * Get partner by customer number
 *
 * Looks up the portal user associated with a customer number.
 * Checks both the miomente_partner_customer_numbers table and
 * the legacy customer_number field on users.
 */
export async function getPartnerByCustomerNumber(
  customerNumber: string
): Promise<PartnerEmailInfo | null> {
  // First check the customer numbers junction table
  const fromJunction = await queryOne<{
    id: string;
    name: string;
    email: string;
  }>(
    `SELECT u.id, u.name, u.email
     FROM miomente_partner_portal_users u
     INNER JOIN miomente_partner_customer_numbers cn ON u.id = cn.user_id
     WHERE cn.customer_number = $1
     LIMIT 1`,
    [customerNumber]
  );

  if (fromJunction) {
    return fromJunction;
  }

  // Fall back to legacy customer_number field on users table
  const fromLegacy = await queryOne<{
    id: string;
    name: string;
    email: string;
  }>(
    `SELECT id, name, email
     FROM miomente_partner_portal_users
     WHERE customer_number = $1
     LIMIT 1`,
    [customerNumber]
  );

  return fromLegacy || null;
}
