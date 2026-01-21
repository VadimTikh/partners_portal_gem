/**
 * Magento Order queries (MySQL)
 *
 * Queries for fetching order data from Magento to populate booking confirmations.
 * Orders are linked to partners via: Order Item → Product → operator_id → customer_number
 */

import { query, queryOne, MAGENTO_ATTRIBUTES } from '../mysql';
import { RowDataPacket } from 'mysql2';

// Database row type for order with customer and product info
export interface DbOrder extends RowDataPacket {
  order_id: number;
  order_item_id: number;
  order_increment_id: string;
  order_status: string;
  order_created_at: string;
  customer_firstname: string;
  customer_lastname: string;
  customer_email: string;
  customer_phone: string | null;
  product_id: number;
  product_name: string;
  product_sku: string;
  qty_ordered: number;
  item_price: number;
  event_date: string | null; // From date variant name (YYYY-MM-DD)
  event_time: string | null; // From begin_time attribute
  customer_number: string;
  operator_id: string;
}

// Simple order info for listing
export interface DbOrderSummary extends RowDataPacket {
  order_id: number;
  order_item_id: number;
  order_increment_id: string;
  order_status: string;
  order_created_at: string;
  customer_name: string;
  customer_email: string;
  product_name: string;
  qty_ordered: number;
  item_price: number;
  customer_number: string;
}

/**
 * Get all orders for a partner's courses by customer numbers
 *
 * This query joins Magento order data with product data to find orders
 * where the product belongs to the specified partner(s).
 *
 * Order Item → Product → operator_id → customer_number
 *
 * @param customerNumbers - Array of partner customer numbers
 * @param options - Optional filters
 */
export async function getOrdersByPartner(
  customerNumbers: string[],
  options?: {
    status?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<DbOrder[]> {
  if (customerNumbers.length === 0) {
    return [];
  }

  const placeholders = customerNumbers.map(() => '?').join(', ');
  const params: unknown[] = [...customerNumbers];

  let sql = `
    SELECT
      so.entity_id AS order_id,
      soi.item_id AS order_item_id,
      so.increment_id AS order_increment_id,
      so.status AS order_status,
      so.created_at AS order_created_at,
      so.customer_firstname,
      so.customer_lastname,
      so.customer_email,
      soa.telephone AS customer_phone,
      soi.product_id,
      soi.name AS product_name,
      soi.sku AS product_sku,
      CAST(soi.qty_ordered AS UNSIGNED) AS qty_ordered,
      ROUND(COALESCE(soi_parent.row_total, soi.row_total, 0), 2) AS item_price,
      -- Extract date from SKU or product name (format: Course-Name-YYYY-MM-DD)
      CASE
        WHEN soi.sku REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.sku, '-', -3)
        WHEN soi.name REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.name, '-', -3)
        ELSE NULL
      END AS event_date,
      -- Get begin_time from product
      begin_time.value AS event_time,
      op.customernumber AS customer_number,
      op.operator_id
    FROM sales_flat_order AS so
    -- Order items (tickets)
    INNER JOIN sales_flat_order_item AS soi
      ON so.entity_id = soi.order_id
      AND soi.parent_item_id IS NOT NULL -- Only child items (actual tickets, not parent row)
    -- Billing address for phone
    LEFT JOIN sales_flat_order_address AS soa
      ON so.entity_id = soa.parent_id
      AND soa.address_type = 'billing'
    -- Get parent product ID from order item
    LEFT JOIN sales_flat_order_item AS soi_parent
      ON soi.parent_item_id = soi_parent.item_id
    -- Get operator_id from parent product
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
      ON COALESCE(soi_parent.product_id, soi.product_id) = cpev_operator.entity_id
      AND cpev_operator.attribute_id = ${MAGENTO_ATTRIBUTES.OPERATOR_ID}
      AND cpev_operator.store_id = 0
    -- Operator table to get customer_number
    INNER JOIN miomente_pdf_operator AS op
      ON cpev_operator.value = op.operator_id
    -- Get begin_time for event time
    LEFT JOIN catalog_product_entity_varchar AS begin_time
      ON soi.product_id = begin_time.entity_id
      AND begin_time.attribute_id = ${MAGENTO_ATTRIBUTES.BEGIN_TIME}
      AND begin_time.store_id = 0
    WHERE op.customernumber IN (${placeholders})
      AND so.status NOT IN ('canceled', 'closed', 'holded')
  `;

  // Add optional filters
  if (options?.status) {
    sql += ` AND so.status = ?`;
    params.push(options.status);
  }

  if (options?.fromDate) {
    sql += ` AND so.created_at >= ?`;
    params.push(options.fromDate);
  }

  if (options?.toDate) {
    sql += ` AND so.created_at <= ?`;
    params.push(options.toDate);
  }

  sql += ` ORDER BY so.created_at DESC`;

  if (options?.limit) {
    sql += ` LIMIT ?`;
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += ` OFFSET ?`;
    params.push(options.offset);
  }

  return query<DbOrder[]>(sql, params);
}

/**
 * Get a single order item by Magento order ID and item ID
 * Used when confirming/declining a specific booking
 *
 * @param orderId - Magento order entity_id
 * @param orderItemId - Magento order item_id
 * @param customerNumbers - Partner's customer numbers for authorization
 */
export async function getOrderItem(
  orderId: number,
  orderItemId: number,
  customerNumbers: string[]
): Promise<DbOrder | null> {
  if (customerNumbers.length === 0) {
    return null;
  }

  const placeholders = customerNumbers.map(() => '?').join(', ');

  const sql = `
    SELECT
      so.entity_id AS order_id,
      soi.item_id AS order_item_id,
      so.increment_id AS order_increment_id,
      so.status AS order_status,
      so.created_at AS order_created_at,
      so.customer_firstname,
      so.customer_lastname,
      so.customer_email,
      soa.telephone AS customer_phone,
      soi.product_id,
      soi.name AS product_name,
      soi.sku AS product_sku,
      CAST(soi.qty_ordered AS UNSIGNED) AS qty_ordered,
      ROUND(COALESCE(soi_parent.row_total, soi.row_total, 0), 2) AS item_price,
      CASE
        WHEN soi.sku REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.sku, '-', -3)
        WHEN soi.name REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.name, '-', -3)
        ELSE NULL
      END AS event_date,
      begin_time.value AS event_time,
      op.customernumber AS customer_number,
      op.operator_id
    FROM sales_flat_order AS so
    INNER JOIN sales_flat_order_item AS soi
      ON so.entity_id = soi.order_id
      AND soi.parent_item_id IS NOT NULL
    LEFT JOIN sales_flat_order_address AS soa
      ON so.entity_id = soa.parent_id
      AND soa.address_type = 'billing'
    LEFT JOIN sales_flat_order_item AS soi_parent
      ON soi.parent_item_id = soi_parent.item_id
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
      ON COALESCE(soi_parent.product_id, soi.product_id) = cpev_operator.entity_id
      AND cpev_operator.attribute_id = ${MAGENTO_ATTRIBUTES.OPERATOR_ID}
      AND cpev_operator.store_id = 0
    INNER JOIN miomente_pdf_operator AS op
      ON cpev_operator.value = op.operator_id
    LEFT JOIN catalog_product_entity_varchar AS begin_time
      ON soi.product_id = begin_time.entity_id
      AND begin_time.attribute_id = ${MAGENTO_ATTRIBUTES.BEGIN_TIME}
      AND begin_time.store_id = 0
    WHERE so.entity_id = ?
      AND soi.item_id = ?
      AND op.customernumber IN (${placeholders})
    LIMIT 1
  `;

  return queryOne<DbOrder>(sql, [orderId, orderItemId, ...customerNumbers]);
}

/**
 * Get all order items for a specific Magento order
 * Used to create booking confirmations for all items in an order
 *
 * @param orderId - Magento order entity_id
 */
export async function getOrderItemsByOrderId(orderId: number): Promise<DbOrder[]> {
  const sql = `
    SELECT
      so.entity_id AS order_id,
      soi.item_id AS order_item_id,
      so.increment_id AS order_increment_id,
      so.status AS order_status,
      so.created_at AS order_created_at,
      so.customer_firstname,
      so.customer_lastname,
      so.customer_email,
      soa.telephone AS customer_phone,
      soi.product_id,
      soi.name AS product_name,
      soi.sku AS product_sku,
      CAST(soi.qty_ordered AS UNSIGNED) AS qty_ordered,
      ROUND(COALESCE(soi_parent.row_total, soi.row_total, 0), 2) AS item_price,
      CASE
        WHEN soi.sku REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.sku, '-', -3)
        WHEN soi.name REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.name, '-', -3)
        ELSE NULL
      END AS event_date,
      begin_time.value AS event_time,
      op.customernumber AS customer_number,
      op.operator_id
    FROM sales_flat_order AS so
    INNER JOIN sales_flat_order_item AS soi
      ON so.entity_id = soi.order_id
      AND soi.parent_item_id IS NOT NULL
    LEFT JOIN sales_flat_order_address AS soa
      ON so.entity_id = soa.parent_id
      AND soa.address_type = 'billing'
    LEFT JOIN sales_flat_order_item AS soi_parent
      ON soi.parent_item_id = soi_parent.item_id
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
      ON COALESCE(soi_parent.product_id, soi.product_id) = cpev_operator.entity_id
      AND cpev_operator.attribute_id = ${MAGENTO_ATTRIBUTES.OPERATOR_ID}
      AND cpev_operator.store_id = 0
    INNER JOIN miomente_pdf_operator AS op
      ON cpev_operator.value = op.operator_id
    LEFT JOIN catalog_product_entity_varchar AS begin_time
      ON soi.product_id = begin_time.entity_id
      AND begin_time.attribute_id = ${MAGENTO_ATTRIBUTES.BEGIN_TIME}
      AND begin_time.store_id = 0
    WHERE so.entity_id = ?
    ORDER BY soi.item_id
  `;

  return query<DbOrder[]>(sql, [orderId]);
}

/**
 * Get recent orders that need booking confirmations created
 * Used by cron job to auto-create confirmation records for new orders
 *
 * Returns orders from the last N days that don't have confirmation records yet.
 *
 * @param customerNumbers - Partner's customer numbers
 * @param daysBack - How many days back to look (default: 30)
 * @param existingOrderItemIds - Order item IDs that already have confirmations
 */
export async function getOrdersNeedingConfirmations(
  customerNumbers: string[],
  daysBack: number = 30,
  existingOrderItemIds: number[] = []
): Promise<DbOrder[]> {
  if (customerNumbers.length === 0) {
    return [];
  }

  const placeholders = customerNumbers.map(() => '?').join(', ');
  const params: unknown[] = [...customerNumbers, daysBack];

  let sql = `
    SELECT
      so.entity_id AS order_id,
      soi.item_id AS order_item_id,
      so.increment_id AS order_increment_id,
      so.status AS order_status,
      so.created_at AS order_created_at,
      so.customer_firstname,
      so.customer_lastname,
      so.customer_email,
      soa.telephone AS customer_phone,
      soi.product_id,
      soi.name AS product_name,
      soi.sku AS product_sku,
      CAST(soi.qty_ordered AS UNSIGNED) AS qty_ordered,
      ROUND(COALESCE(soi_parent.row_total, soi.row_total, 0), 2) AS item_price,
      CASE
        WHEN soi.sku REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.sku, '-', -3)
        WHEN soi.name REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.name, '-', -3)
        ELSE NULL
      END AS event_date,
      begin_time.value AS event_time,
      op.customernumber AS customer_number,
      op.operator_id
    FROM sales_flat_order AS so
    INNER JOIN sales_flat_order_item AS soi
      ON so.entity_id = soi.order_id
      AND soi.parent_item_id IS NOT NULL
    LEFT JOIN sales_flat_order_address AS soa
      ON so.entity_id = soa.parent_id
      AND soa.address_type = 'billing'
    LEFT JOIN sales_flat_order_item AS soi_parent
      ON soi.parent_item_id = soi_parent.item_id
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
      ON COALESCE(soi_parent.product_id, soi.product_id) = cpev_operator.entity_id
      AND cpev_operator.attribute_id = ${MAGENTO_ATTRIBUTES.OPERATOR_ID}
      AND cpev_operator.store_id = 0
    INNER JOIN miomente_pdf_operator AS op
      ON cpev_operator.value = op.operator_id
    LEFT JOIN catalog_product_entity_varchar AS begin_time
      ON soi.product_id = begin_time.entity_id
      AND begin_time.attribute_id = ${MAGENTO_ATTRIBUTES.BEGIN_TIME}
      AND begin_time.store_id = 0
    WHERE op.customernumber IN (${placeholders})
      AND so.status NOT IN ('canceled', 'closed', 'holded')
      AND so.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
  `;

  // Exclude items that already have confirmations
  if (existingOrderItemIds.length > 0) {
    const itemPlaceholders = existingOrderItemIds.map(() => '?').join(', ');
    sql += ` AND soi.item_id NOT IN (${itemPlaceholders})`;
    params.push(...existingOrderItemIds);
  }

  sql += ` ORDER BY so.created_at DESC`;

  return query<DbOrder[]>(sql, params);
}

/**
 * Get orders with future event dates that need confirmation
 * Used for initial population and for finding orders that need action
 *
 * @param customerNumbers - Partner's customer numbers
 */
export async function getFutureOrdersForPartner(
  customerNumbers: string[]
): Promise<DbOrder[]> {
  if (customerNumbers.length === 0) {
    return [];
  }

  const placeholders = customerNumbers.map(() => '?').join(', ');

  const sql = `
    SELECT
      so.entity_id AS order_id,
      soi.item_id AS order_item_id,
      so.increment_id AS order_increment_id,
      so.status AS order_status,
      so.created_at AS order_created_at,
      so.customer_firstname,
      so.customer_lastname,
      so.customer_email,
      soa.telephone AS customer_phone,
      soi.product_id,
      soi.name AS product_name,
      soi.sku AS product_sku,
      CAST(soi.qty_ordered AS UNSIGNED) AS qty_ordered,
      ROUND(COALESCE(soi_parent.row_total, soi.row_total, 0), 2) AS item_price,
      CASE
        WHEN soi.sku REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.sku, '-', -3)
        WHEN soi.name REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.name, '-', -3)
        ELSE NULL
      END AS event_date,
      begin_time.value AS event_time,
      op.customernumber AS customer_number,
      op.operator_id
    FROM sales_flat_order AS so
    INNER JOIN sales_flat_order_item AS soi
      ON so.entity_id = soi.order_id
      AND soi.parent_item_id IS NOT NULL
    LEFT JOIN sales_flat_order_address AS soa
      ON so.entity_id = soa.parent_id
      AND soa.address_type = 'billing'
    LEFT JOIN sales_flat_order_item AS soi_parent
      ON soi.parent_item_id = soi_parent.item_id
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
      ON COALESCE(soi_parent.product_id, soi.product_id) = cpev_operator.entity_id
      AND cpev_operator.attribute_id = ${MAGENTO_ATTRIBUTES.OPERATOR_ID}
      AND cpev_operator.store_id = 0
    INNER JOIN miomente_pdf_operator AS op
      ON cpev_operator.value = op.operator_id
    LEFT JOIN catalog_product_entity_varchar AS begin_time
      ON soi.product_id = begin_time.entity_id
      AND begin_time.attribute_id = ${MAGENTO_ATTRIBUTES.BEGIN_TIME}
      AND begin_time.store_id = 0
    WHERE op.customernumber IN (${placeholders})
      AND so.status NOT IN ('canceled', 'closed', 'holded')
      -- Filter for future dates only
      AND (
        (soi.sku REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         AND STR_TO_DATE(SUBSTRING_INDEX(soi.sku, '-', -3), '%Y-%m-%d') >= CURDATE())
        OR
        (soi.name REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         AND STR_TO_DATE(SUBSTRING_INDEX(soi.name, '-', -3), '%Y-%m-%d') >= CURDATE())
      )
    ORDER BY event_date ASC, event_time ASC
  `;

  return query<DbOrder[]>(sql, customerNumbers);
}

/**
 * Count total orders for a partner
 */
export async function countOrdersForPartner(
  customerNumbers: string[]
): Promise<number> {
  if (customerNumbers.length === 0) {
    return 0;
  }

  const placeholders = customerNumbers.map(() => '?').join(', ');

  const result = await queryOne<{ count: number } & RowDataPacket>(`
    SELECT COUNT(DISTINCT soi.item_id) AS count
    FROM sales_flat_order AS so
    INNER JOIN sales_flat_order_item AS soi
      ON so.entity_id = soi.order_id
      AND soi.parent_item_id IS NOT NULL
    LEFT JOIN sales_flat_order_item AS soi_parent
      ON soi.parent_item_id = soi_parent.item_id
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
      ON COALESCE(soi_parent.product_id, soi.product_id) = cpev_operator.entity_id
      AND cpev_operator.attribute_id = ${MAGENTO_ATTRIBUTES.OPERATOR_ID}
      AND cpev_operator.store_id = 0
    INNER JOIN miomente_pdf_operator AS op
      ON cpev_operator.value = op.operator_id
    WHERE op.customernumber IN (${placeholders})
      AND so.status NOT IN ('canceled', 'closed', 'holded')
  `, customerNumbers);

  return result?.count || 0;
}

/**
 * Transform Magento order to API-friendly format
 */
export function transformOrder(dbOrder: DbOrder): {
  orderId: number;
  orderItemId: number;
  orderNumber: string;
  orderStatus: string;
  orderDate: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  course: {
    id: number;
    name: string;
    sku: string;
  };
  eventDate: string;
  eventTime: string;
  participants: number;
  price: number;
  customerNumber: string;
} {
  return {
    orderId: dbOrder.order_id,
    orderItemId: dbOrder.order_item_id,
    orderNumber: dbOrder.order_increment_id,
    orderStatus: dbOrder.order_status,
    orderDate: dbOrder.order_created_at,
    customer: {
      firstName: dbOrder.customer_firstname,
      lastName: dbOrder.customer_lastname,
      email: dbOrder.customer_email,
      phone: dbOrder.customer_phone || '',
    },
    course: {
      id: dbOrder.product_id,
      name: dbOrder.product_name,
      sku: dbOrder.product_sku,
    },
    eventDate: dbOrder.event_date || '',
    eventTime: dbOrder.event_time || '',
    participants: dbOrder.qty_ordered,
    price: dbOrder.item_price,
    customerNumber: dbOrder.customer_number,
  };
}
