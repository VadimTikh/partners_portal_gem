/**
 * Partner database queries
 *
 * Partners are stored in Magento's miomente_pdf_operator table.
 * This module queries partner data for the manager view.
 */

import { query } from '../mysql';
import { queryAll } from '../postgres';
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
