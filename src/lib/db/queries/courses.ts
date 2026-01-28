/**
 * Course database queries (MySQL/Magento)
 *
 * IMPORTANT: These queries are preserved exactly from the n8n backend.
 * The Magento EAV structure is complex and these queries have been
 * carefully crafted to work correctly.
 */

import { query, queryOne, execute } from '../mysql';
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
 * Get all courses for a partner by customer numbers
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
 *
 * @param customerNumbers - Array of customer numbers (supports multiple for one user)
 */
export async function getCoursesByPartner(customerNumbers: string[]): Promise<DbCourse[]> {
  if (customerNumbers.length === 0) {
    return [];
  }

  // Build dynamic placeholders for IN clause
  const placeholders = customerNumbers.map(() => '?').join(', ');

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
      AND cpei_status.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4 LIMIT 1)
      AND cpei_status.store_id = 0
    -- Description
    LEFT JOIN catalog_product_entity_text AS cpet_desc
      ON cpe.entity_id = cpet_desc.entity_id
      AND cpet_desc.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'description' AND entity_type_id = 4 LIMIT 1)
      AND cpet_desc.store_id = 0
    -- Image
    LEFT JOIN catalog_product_entity_varchar AS img
      ON cpe.entity_id = img.entity_id
      AND img.attribute_id = 74
      AND img.store_id = 0
    -- Price
    LEFT JOIN catalog_product_entity_decimal AS cpd_price
      ON cpe.entity_id = cpd_price.entity_id
      AND cpd_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4 LIMIT 1)
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
    WHERE op.customernumber IN (${placeholders})
      AND cpe.type_id = 'configurable'
    GROUP BY cpe.entity_id
  `, customerNumbers);

  return courses;
}

/**
 * Get a single course by ID, verifying ownership by customer numbers
 *
 * @param courseId - The course entity ID
 * @param customerNumbers - Array of customer numbers to verify ownership against
 */
export async function getCourseById(
  courseId: number,
  customerNumbers: string[]
): Promise<DbCourse | null> {
  if (customerNumbers.length === 0) {
    return null;
  }

  // Build dynamic placeholders for IN clause
  const placeholders = customerNumbers.map(() => '?').join(', ');

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
      AND cpei_status.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4 LIMIT 1)
      AND cpei_status.store_id = 0
    -- Description
    LEFT JOIN catalog_product_entity_text AS cpet_desc
      ON cpe.entity_id = cpet_desc.entity_id
      AND cpet_desc.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'description' AND entity_type_id = 4 LIMIT 1)
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
      AND cpd_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4 LIMIT 1)
      AND cpd_price.store_id = 0
    -- Operator (product -> operator_id)
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
      ON cpe.entity_id = cpev_operator.entity_id
      AND cpev_operator.attribute_id = 700
      AND cpev_operator.store_id = 0
    -- Operator table (operator_id -> customernumber)
    INNER JOIN miomente_pdf_operator AS op
      ON cpev_operator.value = op.operator_id
    WHERE op.customernumber IN (${placeholders})
      AND cpe.entity_id = ?
      AND cpe.type_id = 'configurable'
    LIMIT 1
  `, [...customerNumbers, courseId]);

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
        AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4 LIMIT 1)
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
        AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4 LIMIT 1)
        AND store_id = 0
    `, [statusValue, courseId]);

    // When disabling a course, also set visibility to "Not Visible Individually" (1)
    // and clear any store-specific visibility overrides to ensure it's hidden everywhere
    if (status === 'inactive') {
      // Update global visibility to 1 (Not Visible Individually)
      await query(`
        UPDATE catalog_product_entity_int
        SET value = 1
        WHERE entity_id = ?
          AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'visibility' AND entity_type_id = 4 LIMIT 1)
          AND store_id = 0
      `, [courseId]);

      // Remove store-specific visibility overrides (they would override the global setting)
      await query(`
        DELETE FROM catalog_product_entity_int
        WHERE entity_id = ?
          AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'visibility' AND entity_type_id = 4 LIMIT 1)
          AND store_id != 0
      `, [courseId]);

      // Also disable all child products (dates)
      await query(`
        UPDATE catalog_product_entity_int
        SET value = 2
        WHERE entity_id IN (
          SELECT product_id FROM catalog_product_super_link WHERE parent_id = ?
        )
          AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4 LIMIT 1)
          AND store_id = 0
      `, [courseId]);

      // Clean up Magento index tables to immediately remove from catalog/search
      // Without this, the product would still appear until Magento reindex runs

      // Remove from price index (parent product)
      await query(`DELETE FROM catalog_product_index_price WHERE entity_id = ?`, [courseId]);

      // Remove child products from price index
      await query(`
        DELETE FROM catalog_product_index_price
        WHERE entity_id IN (SELECT product_id FROM catalog_product_super_link WHERE parent_id = ?)
      `, [courseId]);

      // Remove from search index
      await query(`DELETE FROM catalogsearch_fulltext WHERE product_id = ?`, [courseId]);

      // Remove from category index
      await query(`DELETE FROM catalog_category_product_index WHERE product_id = ?`, [courseId]);
    }

    // When enabling a course, set visibility to "Catalog, Search" (4)
    // and rebuild Magento index entries
    if (status === 'active') {
      await query(`
        UPDATE catalog_product_entity_int
        SET value = 4
        WHERE entity_id = ?
          AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'visibility' AND entity_type_id = 4 LIMIT 1)
          AND store_id = 0
      `, [courseId]);

      // Also re-enable all child products (dates)
      await query(`
        UPDATE catalog_product_entity_int
        SET value = 1
        WHERE entity_id IN (
          SELECT product_id FROM catalog_product_super_link WHERE parent_id = ?
        )
          AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4 LIMIT 1)
          AND store_id = 0
      `, [courseId]);

      // Rebuild Magento index tables to make course appear in catalog/search
      await rebuildCourseIndexes(courseId);
    }
  }
}

/**
 * Rebuild Magento index entries for a course
 * Called when re-enabling a previously disabled course
 */
async function rebuildCourseIndexes(courseId: number): Promise<void> {
  // 1. Rebuild price index for parent product
  // Get min price from child products
  await execute(`
    INSERT INTO catalog_product_index_price
      (entity_id, customer_group_id, website_id, tax_class_id, price, final_price, min_price, max_price, tier_price, group_price)
    SELECT
      ? as entity_id,
      cg.customer_group_id,
      w.website_id,
      2 as tax_class_id,
      parent_price.value as price,
      COALESCE(MIN(child_price.value), parent_price.value) as final_price,
      COALESCE(MIN(child_price.value), parent_price.value) as min_price,
      COALESCE(MAX(child_price.value), parent_price.value) as max_price,
      NULL as tier_price,
      NULL as group_price
    FROM customer_group cg
    CROSS JOIN core_website w
    LEFT JOIN catalog_product_entity_decimal parent_price
      ON parent_price.entity_id = ?
      AND parent_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4 LIMIT 1)
      AND parent_price.store_id = 0
    LEFT JOIN catalog_product_super_link sl ON sl.parent_id = ?
    LEFT JOIN catalog_product_entity_decimal child_price
      ON child_price.entity_id = sl.product_id
      AND child_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4 LIMIT 1)
      AND child_price.store_id = 0
    WHERE w.website_id > 0
    GROUP BY cg.customer_group_id, w.website_id, parent_price.value
    ON DUPLICATE KEY UPDATE
      price = VALUES(price),
      final_price = VALUES(final_price),
      min_price = VALUES(min_price),
      max_price = VALUES(max_price)
  `, [courseId, courseId, courseId]);

  // 2. Rebuild price index for child products
  await execute(`
    INSERT INTO catalog_product_index_price
      (entity_id, customer_group_id, website_id, tax_class_id, price, final_price, min_price, max_price, tier_price, group_price)
    SELECT
      sl.product_id as entity_id,
      cg.customer_group_id,
      w.website_id,
      2 as tax_class_id,
      cp.value as price,
      cp.value as final_price,
      cp.value as min_price,
      cp.value as max_price,
      NULL as tier_price,
      NULL as group_price
    FROM catalog_product_super_link sl
    CROSS JOIN customer_group cg
    CROSS JOIN core_website w
    LEFT JOIN catalog_product_entity_decimal cp
      ON cp.entity_id = sl.product_id
      AND cp.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4 LIMIT 1)
      AND cp.store_id = 0
    WHERE sl.parent_id = ? AND w.website_id > 0
    ON DUPLICATE KEY UPDATE
      price = VALUES(price),
      final_price = VALUES(final_price),
      min_price = VALUES(min_price),
      max_price = VALUES(max_price)
  `, [courseId]);

  // 3. Rebuild category index
  // Insert for each category the product belongs to, for each store
  await execute(`
    INSERT INTO catalog_category_product_index
      (category_id, product_id, position, is_parent, store_id, visibility)
    SELECT
      ccp.category_id,
      ccp.product_id,
      ccp.position,
      1 as is_parent,
      cs.store_id,
      4 as visibility
    FROM catalog_category_product ccp
    CROSS JOIN core_store cs
    WHERE ccp.product_id = ? AND cs.store_id > 0
    ON DUPLICATE KEY UPDATE
      position = VALUES(position),
      visibility = VALUES(visibility)
  `, [courseId]);

  // Also add root categories (2 and 3) which are typically required
  await execute(`
    INSERT INTO catalog_category_product_index
      (category_id, product_id, position, is_parent, store_id, visibility)
    SELECT
      cat.entity_id as category_id,
      ? as product_id,
      cpe.entity_id as position,
      0 as is_parent,
      cs.store_id,
      4 as visibility
    FROM catalog_category_entity cat
    CROSS JOIN core_store cs
    CROSS JOIN catalog_product_entity cpe
    WHERE cat.entity_id IN (2, 3)
      AND cs.store_id > 0
      AND cpe.entity_id = ?
    ON DUPLICATE KEY UPDATE
      visibility = VALUES(visibility)
  `, [courseId, courseId]);

  // 4. Rebuild search index (catalogsearch_fulltext)
  // Build data_index from product name and child names
  await execute(`
    INSERT INTO catalogsearch_fulltext (product_id, store_id, data_index)
    SELECT
      ? as product_id,
      cs.store_id,
      CONCAT(
        COALESCE(pn.value, ''),
        '|',
        COALESCE(GROUP_CONCAT(cn.value SEPARATOR '|'), ''),
        '|',
        COALESCE(pd.value, '')
      ) as data_index
    FROM core_store cs
    LEFT JOIN catalog_product_entity_varchar pn
      ON pn.entity_id = ?
      AND pn.attribute_id = 60
      AND pn.store_id = 0
    LEFT JOIN catalog_product_entity_text pd
      ON pd.entity_id = ?
      AND pd.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'meta_keyword' AND entity_type_id = 4 LIMIT 1)
      AND pd.store_id = 0
    LEFT JOIN catalog_product_super_link sl ON sl.parent_id = ?
    LEFT JOIN catalog_product_entity_varchar cn
      ON cn.entity_id = sl.product_id
      AND cn.attribute_id = 60
      AND cn.store_id = 0
    WHERE cs.store_id > 0
    GROUP BY cs.store_id, pn.value, pd.value
    ON DUPLICATE KEY UPDATE
      data_index = VALUES(data_index)
  `, [courseId, courseId, courseId, courseId]);
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
 * Get operator ID for customer numbers (returns first match)
 *
 * @param customerNumbers - Array of customer numbers to look up
 */
export async function getOperatorIdByCustomerNumber(
  customerNumbers: string[]
): Promise<string | null> {
  if (customerNumbers.length === 0) {
    return null;
  }

  // Build dynamic placeholders for IN clause
  const placeholders = customerNumbers.map(() => '?').join(', ');

  const result = await queryOne<{ operator_id: string } & RowDataPacket>(`
    SELECT operator_id
    FROM miomente_pdf_operator
    WHERE customernumber IN (${placeholders})
    LIMIT 1
  `, customerNumbers);

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

// ============================================
// Manager Course Queries
// ============================================

export interface DbManagerCourse extends RowDataPacket {
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
  available_dates: number;
  partner_id: string;
  partner_name: string;
  partner_email: string;
}

export interface ManagerCourseFilters {
  search?: string;              // Partner name/email search
  location?: string;            // Exact location match
  availableDatesRange?: 'none' | '1-5' | '5+';
  dateRangeType?: 'next7d' | 'next30d' | 'custom';
  dateFrom?: string;
  dateTo?: string;
  status?: 'active' | 'inactive';
  limit?: number;
  offset?: number;
}

/**
 * Get unique locations from all courses for filter dropdown
 */
export async function getUniqueLocations(): Promise<string[]> {
  const results = await query<Array<{ location: string } & RowDataPacket>>(`
    SELECT DISTINCT cpev_location.value AS location
    FROM catalog_product_entity AS cpe
    LEFT JOIN catalog_product_entity_varchar AS cpev_location
      ON cpe.entity_id = cpev_location.entity_id
      AND cpev_location.attribute_id = 578
      AND cpev_location.store_id = 0
    WHERE cpe.type_id = 'configurable'
      AND cpev_location.value IS NOT NULL
      AND cpev_location.value != ''
    ORDER BY cpev_location.value ASC
  `);

  return results.map(r => r.location);
}

/**
 * Get all courses for manager with server-side filters and pagination
 */
export async function getAllCoursesForManager(
  filters: ManagerCourseFilters = {}
): Promise<{ courses: DbManagerCourse[]; total: number }> {
  const {
    // search is handled at the API layer since partner info is in PostgreSQL
    location,
    availableDatesRange,
    dateRangeType,
    dateFrom,
    dateTo,
    status,
    limit = 25,
    offset = 0,
  } = filters;

  // Build WHERE conditions
  const conditions: string[] = ["cpe.type_id = 'configurable'"];
  const params: (string | number)[] = [];

  // Status filter
  if (status === 'active') {
    conditions.push('cpei_status.value = 1');
  } else if (status === 'inactive') {
    conditions.push('(cpei_status.value IS NULL OR cpei_status.value != 1)');
  }

  // Location filter
  if (location) {
    conditions.push('cpev_location.value = ?');
    params.push(location);
  }

  // Build the date subquery conditions
  let dateConditions = 'STR_TO_DATE(CONCAT(SUBSTRING_INDEX(sn.value, \'-\', -3), \' \', sb.value), \'%Y-%m-%d %H:%i\') > NOW()';

  // Date range filter
  if (dateRangeType === 'next7d') {
    dateConditions += ' AND STR_TO_DATE(CONCAT(SUBSTRING_INDEX(sn.value, \'-\', -3), \' \', sb.value), \'%Y-%m-%d %H:%i\') <= DATE_ADD(NOW(), INTERVAL 7 DAY)';
  } else if (dateRangeType === 'next30d') {
    dateConditions += ' AND STR_TO_DATE(CONCAT(SUBSTRING_INDEX(sn.value, \'-\', -3), \' \', sb.value), \'%Y-%m-%d %H:%i\') <= DATE_ADD(NOW(), INTERVAL 30 DAY)';
  } else if (dateRangeType === 'custom' && dateFrom && dateTo) {
    dateConditions += ` AND STR_TO_DATE(CONCAT(SUBSTRING_INDEX(sn.value, '-', -3), ' ', sb.value), '%Y-%m-%d %H:%i') >= '${dateFrom}'`;
    dateConditions += ` AND STR_TO_DATE(CONCAT(SUBSTRING_INDEX(sn.value, '-', -3), ' ', sb.value), '%Y-%m-%d %H:%i') <= '${dateTo} 23:59:59'`;
  }

  const baseQuery = `
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
          AND ${dateConditions}
      ) AS available_dates,
      u.id AS partner_id,
      u.name AS partner_name,
      u.email AS partner_email
    FROM catalog_product_entity AS cpe
    -- Title
    INNER JOIN catalog_product_entity_varchar AS cpev_name
      ON cpe.entity_id = cpev_name.entity_id
      AND cpev_name.attribute_id = 60
      AND cpev_name.store_id = 0
    -- Status
    LEFT JOIN catalog_product_entity_int AS cpei_status
      ON cpe.entity_id = cpei_status.entity_id
      AND cpei_status.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4 LIMIT 1)
      AND cpei_status.store_id = 0
    -- Description
    LEFT JOIN catalog_product_entity_text AS cpet_desc
      ON cpe.entity_id = cpet_desc.entity_id
      AND cpet_desc.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'description' AND entity_type_id = 4 LIMIT 1)
      AND cpet_desc.store_id = 0
    -- Image
    LEFT JOIN catalog_product_entity_varchar AS img
      ON cpe.entity_id = img.entity_id
      AND img.attribute_id = 74
      AND img.store_id = 0
    -- Price
    LEFT JOIN catalog_product_entity_decimal AS cpd_price
      ON cpe.entity_id = cpd_price.entity_id
      AND cpd_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4 LIMIT 1)
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
    -- Join to PostgreSQL users via customer_numbers table (using federated query concept)
    -- Since we can't directly join MySQL to PostgreSQL, we need to handle partner lookup separately
    -- For now, we'll use a placeholder that will be resolved in the API layer
    LEFT JOIN (
      SELECT 'placeholder' AS id, 'placeholder' AS name, 'placeholder' AS email, 'placeholder' AS customer_number
    ) AS u ON 1=0
    WHERE ${conditions.join(' AND ')}
    GROUP BY cpe.entity_id
  `;

  // For search, we need to handle it at the application layer since partner info is in PostgreSQL
  // For now, let's get all courses from MySQL first

  // Add available dates range filter using HAVING
  let havingClause = '';
  if (availableDatesRange === 'none') {
    havingClause = 'HAVING available_dates = 0';
  } else if (availableDatesRange === '1-5') {
    havingClause = 'HAVING available_dates BETWEEN 1 AND 5';
  } else if (availableDatesRange === '5+') {
    havingClause = 'HAVING available_dates > 5';
  }

  // Count query (without pagination)
  const countQuery = `
    SELECT COUNT(*) as total FROM (
      ${baseQuery}
      ${havingClause}
    ) AS count_query
  `;

  // Data query (with pagination)
  const dataQuery = `
    ${baseQuery}
    ${havingClause}
    ORDER BY cpe.entity_id DESC
    LIMIT ? OFFSET ?
  `;

  const dataParams = [...params, limit, offset];

  // Execute queries
  const [countResult, courses] = await Promise.all([
    queryOne<{ total: number } & RowDataPacket>(countQuery, params),
    query<DbManagerCourse[]>(dataQuery, dataParams),
  ]);

  return {
    courses,
    total: countResult?.total || 0,
  };
}

/**
 * Get a single course by ID (manager - no ownership check)
 */
export async function getCourseByIdForManager(
  courseId: number
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
      AND cpei_status.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4 LIMIT 1)
      AND cpei_status.store_id = 0
    -- Description
    LEFT JOIN catalog_product_entity_text AS cpet_desc
      ON cpe.entity_id = cpet_desc.entity_id
      AND cpet_desc.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'description' AND entity_type_id = 4 LIMIT 1)
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
      AND cpd_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4 LIMIT 1)
      AND cpd_price.store_id = 0
    -- Operator (product -> operator_id)
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
      ON cpe.entity_id = cpev_operator.entity_id
      AND cpev_operator.attribute_id = 700
      AND cpev_operator.store_id = 0
    -- Operator table (operator_id -> customernumber)
    INNER JOIN miomente_pdf_operator AS op
      ON cpev_operator.value = op.operator_id
    WHERE cpe.entity_id = ?
      AND cpe.type_id = 'configurable'
    LIMIT 1
  `, [courseId]);

  return course;
}

/**
 * Get dates for a course (manager - no ownership check)
 */
export async function getDatesByCourseForManager(
  courseId: number
): Promise<Array<{
  id: number;
  courseId: number;
  dateTime: string;
  capacity: number;
  booked: number;
  duration: number;
  price: number;
}>> {
  const dates = await query<Array<{
    id: number;
    courseId: number;
    dateTime: string;
    capacity: number;
    booked: number;
    duration: number;
    price: number;
  } & RowDataPacket>>(`
    SELECT
        simple.entity_id AS 'id',
        link.parent_id AS 'courseId',
        CONCAT(
            SUBSTRING_INDEX(cpev_name.value, '-', -3),
            'T',
            cpev_begin.value,
            ':00Z'
        ) AS 'dateTime',
        CAST(IFNULL(cpev_seats.value, 0) AS UNSIGNED) AS 'capacity',
        0 AS 'booked',
        CASE
            WHEN TIMESTAMPDIFF(MINUTE, STR_TO_DATE(cpev_begin.value, '%H:%i'), STR_TO_DATE(cpev_end.value, '%H:%i')) < 0
            THEN TIMESTAMPDIFF(MINUTE, STR_TO_DATE(cpev_begin.value, '%H:%i'), STR_TO_DATE(cpev_end.value, '%H:%i')) + 1440
            ELSE TIMESTAMPDIFF(MINUTE, STR_TO_DATE(cpev_begin.value, '%H:%i'), STR_TO_DATE(cpev_end.value, '%H:%i'))
        END AS 'duration',
        ROUND(cpd_simple_price.value, 2) AS 'price'
    FROM catalog_product_entity AS simple
    -- Link to configurable
    INNER JOIN catalog_product_super_link AS link
        ON simple.entity_id = link.product_id
    -- Name (to extract date)
    INNER JOIN catalog_product_entity_varchar AS cpev_name
        ON simple.entity_id = cpev_name.entity_id
        AND cpev_name.attribute_id = 60
        AND cpev_name.store_id = 0
    -- Begin time
    LEFT JOIN catalog_product_entity_varchar AS cpev_begin
        ON simple.entity_id = cpev_begin.entity_id
        AND cpev_begin.attribute_id = 717
        AND cpev_begin.store_id = 0
    -- End time
    LEFT JOIN catalog_product_entity_varchar AS cpev_end
        ON simple.entity_id = cpev_end.entity_id
        AND cpev_end.attribute_id = 718
        AND cpev_end.store_id = 0
    -- Seats
    LEFT JOIN catalog_product_entity_varchar AS cpev_seats
        ON simple.entity_id = cpev_seats.entity_id
        AND cpev_seats.attribute_id = 720
        AND cpev_seats.store_id = 0
    -- Price for simple product
    LEFT JOIN catalog_product_entity_decimal AS cpd_simple_price
        ON simple.entity_id = cpd_simple_price.entity_id
        AND cpd_simple_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4 LIMIT 1)
        AND cpd_simple_price.store_id = 0
    WHERE link.parent_id = ?
      AND simple.type_id = 'simple'
      AND cpev_begin.value IS NOT NULL
      AND STR_TO_DATE(
          CONCAT(SUBSTRING_INDEX(cpev_name.value, '-', -3), ' ', cpev_begin.value),
          '%Y-%m-%d %H:%i'
      ) > NOW()
    GROUP BY simple.entity_id
    ORDER BY STR_TO_DATE(
        CONCAT(SUBSTRING_INDEX(cpev_name.value, '-', -3), ' ', cpev_begin.value),
        '%Y-%m-%d %H:%i'
    ) ASC
  `, [courseId]);

  return dates;
}
