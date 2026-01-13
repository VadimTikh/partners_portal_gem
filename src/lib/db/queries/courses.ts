/**
 * Course database queries (MySQL/Magento)
 *
 * IMPORTANT: These queries are preserved exactly from the n8n backend.
 * The Magento EAV structure is complex and these queries have been
 * carefully crafted to work correctly.
 */

import { query, queryOne } from '../mysql';
import { RowDataPacket } from 'mysql2';

export interface DbCourse extends RowDataPacket {
  id: number;
  title: string;
  sku: string;
  status: 'active' | 'inactive';
  description: string | null;
  image: string | null;
  basePrice: number | null;
  location: string | null;
  customer_number: string;
  operator_ids: string;
  available_dates?: number;
}

/**
 * Get all courses for a partner by customer number
 *
 * This query joins across multiple Magento EAV tables to get course data:
 * - catalog_product_entity (main product table)
 * - catalog_product_entity_varchar (name, location, operator_id, image)
 * - catalog_product_entity_int (status)
 * - catalog_product_entity_text (description)
 * - catalog_product_entity_decimal (price)
 * - miomente_pdf_operator (partner mapping)
 *
 * Also includes a subquery to count available future dates.
 */
export async function getCoursesByPartner(customerNumber: string): Promise<DbCourse[]> {
  const courses = await query<DbCourse[]>(`
    SELECT
      cpe.entity_id AS id,
      cpev_name.value AS title,
      cpe.sku AS sku,
      CASE
        WHEN cpei_status.value = 1 THEN 'active'
        ELSE 'inactive'
      END AS status,
      cpet_desc.value AS description,
      CONCAT('https://www.miomente.de/media/catalog/product', img.value) AS image,
      ROUND(cpd_price.value, 2) AS basePrice,
      cpev_location.value AS location,
      op.customernumber AS customer_number,
      (
        SELECT GROUP_CONCAT(DISTINCT o2.operator_id ORDER BY o2.operator_id)
        FROM miomente_pdf_operator AS o2
        WHERE o2.customernumber = op.customernumber
      ) AS operator_ids,
      (
        SELECT COUNT(*)
        FROM catalog_product_entity AS s
        INNER JOIN catalog_product_super_link AS sl
          ON s.entity_id = sl.product_id
        INNER JOIN catalog_product_entity_varchar AS sn
          ON s.entity_id = sn.entity_id
          AND sn.attribute_id = 60
          AND sn.store_id = 0
        INNER JOIN catalog_product_entity_varchar AS sb
          ON s.entity_id = sb.entity_id
          AND sb.attribute_id = 717
          AND sb.store_id = 0
        WHERE sl.parent_id = cpe.entity_id
          AND s.type_id = 'simple'
          AND sb.value IS NOT NULL
          AND STR_TO_DATE(
            CONCAT(SUBSTRING_INDEX(sn.value, '-', -3), ' ', sb.value),
            '%Y-%m-%d %H:%i'
          ) > NOW()
      ) AS available_dates
    FROM catalog_product_entity AS cpe
    -- Title
    INNER JOIN catalog_product_entity_varchar AS cpev_name
      ON cpe.entity_id = cpev_name.entity_id
      AND cpev_name.attribute_id = 60
      AND cpev_name.store_id = 0
    -- Status
    LEFT JOIN catalog_product_entity_int AS cpei_status
      ON cpe.entity_id = cpei_status.entity_id
      AND cpei_status.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4)
      AND cpei_status.store_id = 0
    -- Description
    LEFT JOIN catalog_product_entity_text AS cpet_desc
      ON cpe.entity_id = cpet_desc.entity_id
      AND cpet_desc.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'description' AND entity_type_id = 4)
      AND cpet_desc.store_id = 0
    -- Image
    LEFT JOIN catalog_product_entity_varchar AS img
      ON cpe.entity_id = img.entity_id
      AND img.attribute_id = 74
      AND img.store_id = 0
    -- Price
    LEFT JOIN catalog_product_entity_decimal AS cpd_price
      ON cpe.entity_id = cpd_price.entity_id
      AND cpd_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4)
      AND cpd_price.store_id = 0
    -- Location (attribute_id = 578)
    LEFT JOIN catalog_product_entity_varchar AS cpev_location
      ON cpe.entity_id = cpev_location.entity_id
      AND cpev_location.attribute_id = 578
      AND cpev_location.store_id = 0
    -- Operator (product -> operator_id)
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
      ON cpe.entity_id = cpev_operator.entity_id
      AND cpev_operator.attribute_id = 700
      AND cpev_operator.store_id = 0
    -- Operator table (operator_id -> customernumber)
    INNER JOIN miomente_pdf_operator AS op
      ON cpev_operator.value = op.operator_id
    WHERE op.customernumber = ?
      AND cpe.type_id = 'configurable'
    GROUP BY cpe.entity_id
  `, [customerNumber]);

  return courses;
}

/**
 * Get a single course by ID, verifying ownership by customer number
 */
export async function getCourseById(
  courseId: number,
  customerNumber: string
): Promise<DbCourse | null> {
  const course = await queryOne<DbCourse>(`
    SELECT
      cpe.entity_id AS id,
      cpev_name.value AS title,
      cpev_location.value AS location,
      cpe.sku AS sku,
      CASE
        WHEN cpei_status.value = 1 THEN 'active'
        ELSE 'inactive'
      END AS status,
      cpet_desc.value AS description,
      CONCAT('https://www.miomente.de/media/catalog/product', img.value) AS image,
      ROUND(cpd_price.value, 2) AS basePrice,
      op.customernumber AS customer_number,
      (
        SELECT GROUP_CONCAT(DISTINCT o2.operator_id ORDER BY o2.operator_id)
        FROM miomente_pdf_operator AS o2
        WHERE o2.customernumber = op.customernumber
      ) AS operator_ids
    FROM catalog_product_entity AS cpe
    -- Title
    INNER JOIN catalog_product_entity_varchar AS cpev_name
      ON cpe.entity_id = cpev_name.entity_id
      AND cpev_name.attribute_id = 60
      AND cpev_name.store_id = 0
    -- Status
    LEFT JOIN catalog_product_entity_int AS cpei_status
      ON cpe.entity_id = cpei_status.entity_id
      AND cpei_status.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4)
      AND cpei_status.store_id = 0
    -- Description
    LEFT JOIN catalog_product_entity_text AS cpet_desc
      ON cpe.entity_id = cpet_desc.entity_id
      AND cpet_desc.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'description' AND entity_type_id = 4)
      AND cpet_desc.store_id = 0
    -- Location
    LEFT JOIN catalog_product_entity_varchar AS cpev_location
      ON cpe.entity_id = cpev_location.entity_id
      AND cpev_location.attribute_id = 578
      AND cpev_location.store_id = 0
    -- Image
    LEFT JOIN catalog_product_entity_varchar AS img
      ON cpe.entity_id = img.entity_id
      AND img.attribute_id = 74
      AND img.store_id = 0
    -- Price
    LEFT JOIN catalog_product_entity_decimal AS cpd_price
      ON cpe.entity_id = cpd_price.entity_id
      AND cpd_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4)
      AND cpd_price.store_id = 0
    -- Operator (product -> operator_id)
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
      ON cpe.entity_id = cpev_operator.entity_id
      AND cpev_operator.attribute_id = 700
      AND cpev_operator.store_id = 0
    -- Operator table (operator_id -> customernumber)
    INNER JOIN miomente_pdf_operator AS op
      ON cpev_operator.value = op.operator_id
    WHERE op.customernumber = ?
      AND cpe.entity_id = ?
      AND cpe.type_id = 'configurable'
    LIMIT 1
  `, [customerNumber, courseId]);

  return course;
}

/**
 * Update course title, status, and base price
 */
export async function updateCourse(
  courseId: number,
  data: { title?: string; status?: 'active' | 'inactive'; basePrice?: number }
): Promise<void> {
  const { title, status, basePrice } = data;

  // Update title
  if (title !== undefined) {
    await query(`
      UPDATE catalog_product_entity_varchar
      SET value = ?
      WHERE entity_id = ?
        AND attribute_id = 60
        AND store_id = 0
    `, [title.trim(), courseId]);
  }

  // Update price
  if (basePrice !== undefined) {
    await query(`
      UPDATE catalog_product_entity_decimal
      SET value = ?
      WHERE entity_id = ?
        AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4)
        AND store_id = 0
    `, [basePrice, courseId]);
  }

  // Update status (1 = enabled, 2 = disabled)
  if (status !== undefined) {
    const statusValue = status === 'active' ? 1 : 2;
    await query(`
      UPDATE catalog_product_entity_int
      SET value = ?
      WHERE entity_id = ?
        AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4)
        AND store_id = 0
    `, [statusValue, courseId]);
  }
}

export interface CreateCourseInput {
  operatorId: string;
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  location: string;
  urlKey?: string;
}

/**
 * Create a new configurable course in Magento
 *
 * This SQL is preserved from n8n backend. It creates:
 * - Product entity (configurable type)
 * - Name attribute
 * - URL key attribute
 * - Description and short description
 * - Price
 * - Status (enabled)
 * - Visibility (catalog, search)
 * - Operator ID
 * - Location
 */
export async function createConfigurableCourse(
  input: CreateCourseInput
): Promise<{ entityId: number; sku: string }> {
  const timestamp = Date.now();
  const sku = `PP-${input.operatorId}-${timestamp}`;

  // Generate URL key if not provided
  const urlKey = input.urlKey || input.name
    .toLowerCase()
    .replace(/[äöüß]/g, m => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' } as Record<string, string>)[m] || m)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') + '-' + timestamp;

  // Escape single quotes for SQL
  const escapeSql = (str: string) => str.replace(/'/g, "''");

  const sql = `
    INSERT INTO catalog_product_entity
    (entity_type_id, attribute_set_id, type_id, sku, has_options, required_options, created_at, updated_at)
    VALUES (4, 26, 'configurable', '${escapeSql(sku)}', 1, 0, NOW(), NOW());

    SET @product_id = LAST_INSERT_ID();

    -- Name (attribute_id = 60)
    INSERT INTO catalog_product_entity_varchar (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES (4, 60, 0, @product_id, '${escapeSql(input.name)}');

    -- URL key (attribute_id = 86)
    INSERT INTO catalog_product_entity_varchar (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES (4, 86, 0, @product_id, '${escapeSql(urlKey)}');

    -- Description (attribute_id = 61)
    INSERT INTO catalog_product_entity_text (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES (4, 61, 0, @product_id, '${escapeSql(input.description)}');

    -- Short description (attribute_id = 62)
    INSERT INTO catalog_product_entity_text (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES (4, 62, 0, @product_id, '${escapeSql(input.shortDescription)}');

    -- Price (attribute_id = 64)
    INSERT INTO catalog_product_entity_decimal (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES (4, 64, 0, @product_id, ${input.price});

    -- Status (attribute_id = 84, value 1 = enabled)
    INSERT INTO catalog_product_entity_int (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES (4, 84, 0, @product_id, 1);

    -- Visibility (attribute_id = 89, value 4 = catalog, search)
    INSERT INTO catalog_product_entity_int (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES (4, 89, 0, @product_id, 4);

    -- Operator (attribute_id = 700)
    INSERT INTO catalog_product_entity_varchar (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES (4, 700, 0, @product_id, '${escapeSql(input.operatorId)}');

    -- Location (attribute_id = 578)
    INSERT INTO catalog_product_entity_varchar (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES (4, 578, 0, @product_id, '${escapeSql(input.location)}');

    SELECT @product_id as entity_id, '${escapeSql(sku)}' as sku;
  `;

  const results = await query(sql);

  // The last result set contains the SELECT
  const resultSets = results as unknown as Array<Array<{ entity_id: number; sku: string }>>;
  const lastResultSet = resultSets[resultSets.length - 1];

  if (Array.isArray(lastResultSet) && lastResultSet.length > 0) {
    return {
      entityId: lastResultSet[0].entity_id,
      sku: lastResultSet[0].sku,
    };
  }

  // Fallback
  return { entityId: 0, sku };
}

/**
 * Get operator ID for a customer number
 */
export async function getOperatorIdByCustomerNumber(
  customerNumber: string
): Promise<string | null> {
  const result = await queryOne<{ operator_id: string } & RowDataPacket>(`
    SELECT operator_id
    FROM miomente_pdf_operator
    WHERE customernumber = ?
    LIMIT 1
  `, [customerNumber]);

  return result?.operator_id || null;
}

/**
 * Transform database course to API response format
 */
export function transformCourse(dbCourse: DbCourse): {
  id: number;
  title: string;
  sku: string;
  status: 'active' | 'inactive';
  description: string;
  image: string;
  basePrice: number;
  location: string;
  available_dates?: number;
  operator_ids: string[];
} {
  return {
    id: dbCourse.id,
    title: dbCourse.title,
    sku: dbCourse.sku,
    status: dbCourse.status,
    description: dbCourse.description || '',
    image: dbCourse.image || '',
    basePrice: dbCourse.basePrice || 0,
    location: dbCourse.location || '',
    available_dates: dbCourse.available_dates,
    operator_ids: dbCourse.operator_ids ? dbCourse.operator_ids.split(',') : [],
  };
}
