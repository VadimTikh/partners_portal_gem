/**
 * Course date database queries (MySQL/Magento)
 *
 * IMPORTANT: These queries are preserved exactly from the n8n backend.
 * The Magento EAV structure is complex and these queries have been
 * carefully crafted to work correctly. DO NOT modify without understanding
 * the full implications.
 */

import { query, queryOne, execute } from '../mysql';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface DbCourseDate extends RowDataPacket {
  id: number;
  courseId: number;
  dateTime: string;
  capacity: number;
  booked: number;
  duration: number;
  price: number;
  customer_number: string;
  operator_ids: string;
}

export interface CreateDateInput {
  courseId: number;
  dateTime: string; // ISO format: 2024-03-15T14:00:00
  capacity: number;
  duration?: number; // minutes, defaults to 180
  price?: number; // optional, uses parent course price if not provided
}

/**
 * Get all dates for a course
 *
 * This query:
 * - Extracts date from product name (format: Name-YYYY-MM-DD)
 * - Extracts times from EAV attributes (717=begin, 718=end)
 * - Calculates duration in minutes
 * - Only returns future dates
 * - Verifies ownership via operator_id -> customernumber
 *
 * @param courseId - The parent course entity ID
 * @param customerNumbers - Array of customer numbers to verify ownership against
 */
export async function getDatesByCourse(
  courseId: number,
  customerNumbers: string[]
): Promise<DbCourseDate[]> {
  if (customerNumbers.length === 0) {
    return [];
  }

  // Build dynamic placeholders for IN clause
  const placeholders = customerNumbers.map(() => '?').join(', ');

  const dates = await query<DbCourseDate[]>(`
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
        TIMESTAMPDIFF(
            MINUTE,
            STR_TO_DATE(cpev_begin.value, '%H:%i'),
            STR_TO_DATE(cpev_end.value, '%H:%i')
        ) AS 'duration',
        ROUND(cpd_simple_price.value, 2) AS 'price',
        op.customernumber AS 'customer_number',
        (
            SELECT GROUP_CONCAT(DISTINCT o2.operator_id ORDER BY o2.operator_id)
            FROM miomente_pdf_operator AS o2
            WHERE o2.customernumber = op.customernumber
        ) AS 'operator_ids'
    FROM catalog_product_entity AS simple
    -- Link to configurable
    INNER JOIN catalog_product_super_link AS link
        ON simple.entity_id = link.product_id
    -- Parent configurable
    INNER JOIN catalog_product_entity AS parent
        ON link.parent_id = parent.entity_id
    -- Operator (from parent)
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
        ON parent.entity_id = cpev_operator.entity_id
        AND cpev_operator.attribute_id = 700
        AND cpev_operator.store_id = 0
    -- Operator table
    INNER JOIN miomente_pdf_operator AS op
        ON cpev_operator.value = op.operator_id
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
        AND cpd_simple_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4)
        AND cpd_simple_price.store_id = 0
    WHERE op.customernumber IN (${placeholders})
      AND link.parent_id = ?
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
  `, [...customerNumbers, courseId]);

  return dates;
}

/**
 * Verify date ownership by customer numbers
 *
 * @param dateId - The date entity ID to verify
 * @param customerNumbers - Array of customer numbers to check ownership against
 */
export async function verifyDateOwnership(
  dateId: number,
  customerNumbers: string[]
): Promise<boolean> {
  if (customerNumbers.length === 0) {
    return false;
  }

  // Build dynamic placeholders for IN clause
  const placeholders = customerNumbers.map(() => '?').join(', ');

  const result = await queryOne<{ count: number } & RowDataPacket>(`
    SELECT COUNT(*) as count
    FROM catalog_product_entity AS simple
    INNER JOIN catalog_product_super_link AS link
        ON simple.entity_id = link.product_id
    INNER JOIN catalog_product_entity AS parent
        ON link.parent_id = parent.entity_id
    INNER JOIN catalog_product_entity_varchar AS cpev_operator
        ON parent.entity_id = cpev_operator.entity_id
        AND cpev_operator.attribute_id = 700
        AND cpev_operator.store_id = 0
    INNER JOIN miomente_pdf_operator AS op
        ON cpev_operator.value = op.operator_id
    WHERE simple.entity_id = ?
      AND op.customernumber IN (${placeholders})
  `, [dateId, ...customerNumbers]);

  return result !== null && result.count > 0;
}

/**
 * Update date price
 *
 * Updates both:
 * - EAV decimal table (attribute_id 64 = price)
 * - wishdatefinder index (for frontend listing)
 */
export async function updateDatePrice(dateId: number, price: number): Promise<void> {
  // Update EAV price
  await query(`
    UPDATE catalog_product_entity_decimal
    SET value = ?
    WHERE entity_id = ?
      AND attribute_id = 64
      AND store_id = 0
  `, [price, dateId]);

  // Update wishdatefinder price
  await query(`
    UPDATE miomente_wishdatefinder_index
    SET simple_product_price = ?,
        updated = NOW()
    WHERE simple_product_id = ?
  `, [price, dateId]);
}

/**
 * Update date seats/capacity
 *
 * Updates 5 tables:
 * 1. wishdatefinder_index (frontend listing)
 * 2. simple product EAV varchar (attribute 720)
 * 3. parent product EAV varchar (attribute 720)
 * 4. stock_item qty
 * 5. stock_status qty
 */
export async function updateDateSeats(dateId: number, seats: number): Promise<void> {
  // 1. Update wishdatefinder (frontend listing)
  await query(`
    UPDATE miomente_wishdatefinder_index
    SET simple_product_seats = ?,
        updated = NOW()
    WHERE simple_product_id = ?
  `, [seats, dateId]);

  // 2. Update simple product (booking capacity)
  await query(`
    UPDATE catalog_product_entity_varchar
    SET value = ?
    WHERE entity_id = ?
      AND attribute_id = 720
      AND store_id = 0
  `, [String(seats), dateId]);

  // 3. Update parent product (display on page)
  await query(`
    UPDATE catalog_product_entity_varchar
    SET value = ?
    WHERE entity_id = (
        SELECT parent_id FROM catalog_product_super_link
        WHERE product_id = ?
    )
      AND attribute_id = 720
      AND store_id = 0
  `, [String(seats), dateId]);

  // 4. Update stock item qty
  await query(`
    UPDATE cataloginventory_stock_item
    SET qty = ?
    WHERE product_id = ?
  `, [seats, dateId]);

  // 5. Update stock status qty
  await query(`
    UPDATE cataloginventory_stock_status
    SET qty = ?
    WHERE product_id = ?
  `, [seats, dateId]);
}

/**
 * Delete a course date
 *
 * Cascading delete across all Magento EAV tables:
 * - All EAV attribute tables (varchar, text, int, decimal, datetime)
 * - Super link table
 * - Stock tables
 * - Main entity table
 */
export async function deleteDate(dateId: number): Promise<void> {
  await execute(`
    SET @event_id = ?;

    START TRANSACTION;

    -- Delete from EAV tables
    DELETE FROM catalog_product_entity_varchar WHERE entity_id = @event_id;
    DELETE FROM catalog_product_entity_text WHERE entity_id = @event_id;
    DELETE FROM catalog_product_entity_int WHERE entity_id = @event_id;
    DELETE FROM catalog_product_entity_decimal WHERE entity_id = @event_id;
    DELETE FROM catalog_product_entity_datetime WHERE entity_id = @event_id;

    -- Delete from link table
    DELETE FROM catalog_product_super_link WHERE product_id = @event_id;

    -- Delete from stock tables
    DELETE FROM cataloginventory_stock_item WHERE product_id = @event_id;
    DELETE FROM cataloginventory_stock_status WHERE product_id = @event_id;

    -- Delete from main entity table
    DELETE FROM catalog_product_entity WHERE entity_id = @event_id;

    COMMIT;
  `, [dateId]);
}

/**
 * Create a new course date
 *
 * This is the most complex query - creates a simple product linked to
 * the parent configurable product. It:
 * - Creates the product entity
 * - Sets all EAV attributes (varchar, text, int, decimal)
 * - Creates super_link and product_relation
 * - Creates stock item and status
 * - Creates wishdatefinder index entries for stores 6 and 4
 * - Creates price index for all 9 customer groups
 *
 * IMPORTANT: This SQL is preserved exactly from n8n. Do not modify
 * without fully understanding the Magento EAV structure.
 */
export async function createDate(input: CreateDateInput): Promise<DbCourseDate> {
  const { courseId, dateTime, capacity, duration = 180, price } = input;

  // The SQL uses MySQL variables and a transaction
  // We need to use execute for multi-statement queries
  const createSQL = `
    -- Parse input
    SET @parent_id = ?;
    SET @date_time = ?;
    SET @capacity = ?;
    SET @duration = ?;
    SET @input_price = ?;

    -- Extract date and time from ISO string
    SET @event_date = DATE_FORMAT(STR_TO_DATE(@date_time, '%Y-%m-%dT%H:%i:%s'), '%Y-%m-%d');
    SET @begin_time = DATE_FORMAT(STR_TO_DATE(@date_time, '%Y-%m-%dT%H:%i:%s'), '%H:%i');
    SET @end_time = DATE_FORMAT(DATE_ADD(STR_TO_DATE(@date_time, '%Y-%m-%dT%H:%i:%s'), INTERVAL @duration MINUTE), '%H:%i');

    -- Get parent course data
    SET @attribute_set_id = (SELECT attribute_set_id FROM catalog_product_entity WHERE entity_id = @parent_id);
    SET @parent_sku = (SELECT sku FROM catalog_product_entity WHERE entity_id = @parent_id);
    SET @parent_name = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 60 AND store_id = 0);
    SET @operator_id = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 700 AND store_id = 0);
    SET @location = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 578 AND store_id = 0);
    SET @tax_class_id = (SELECT value FROM catalog_product_entity_int WHERE entity_id = @parent_id AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'tax_class_id' AND entity_type_id = 4) AND store_id = 0);
    SET @parent_price = (SELECT value FROM catalog_product_entity_decimal WHERE entity_id = @parent_id AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4) AND store_id = 0);

    -- Use input price if provided, otherwise parent price
    SET @price = IFNULL(@input_price, @parent_price);

    -- Get additional parent attributes
    SET @keyword = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 590 AND store_id = 0);
    SET @subtitle = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 548 AND store_id = 0);
    SET @orginalname = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 719 AND store_id = 0);
    SET @participants = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 588 AND store_id = 0);
    SET @short_description = (SELECT value FROM catalog_product_entity_text WHERE entity_id = @parent_id AND attribute_id = 62 AND store_id = 0);
    SET @description = (SELECT value FROM catalog_product_entity_text WHERE entity_id = @parent_id AND attribute_id = 61 AND store_id = 0);
    SET @meta_title = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'meta_title' AND entity_type_id = 4) AND store_id = 0);
    SET @meta_description = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'meta_description' AND entity_type_id = 4) AND store_id = 0);
    SET @parent_urlpath = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'url_path' AND entity_type_id = 4) AND store_id = 0);
    SET @parent_image = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 74 AND store_id = 0);
    SET @parent_image_label = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'image_label' AND entity_type_id = 4) AND store_id = 0);

    -- Get category IDs for parent
    SET @parent_cat_ids = (
        SELECT GROUP_CONCAT(category_id ORDER BY category_id)
        FROM catalog_category_product
        WHERE product_id = @parent_id
    );

    -- Get website_id from parent product
    SET @website_id = (SELECT website_id FROM catalog_product_website WHERE product_id = @parent_id LIMIT 1);

    -- Find or create date option in eav_attribute_option
    SET @date_formatted = DATE_FORMAT(STR_TO_DATE(@event_date, '%Y-%m-%d'), '%Y-%m-%d');
    SET @existing_date_option = (
        SELECT ao.option_id
        FROM eav_attribute_option ao
        JOIN eav_attribute_option_value aov ON ao.option_id = aov.option_id
        WHERE ao.attribute_id = 525 AND aov.value = @date_formatted
        LIMIT 1
    );

    -- Calculate if weekend
    SET @is_weekend = (DAYOFWEEK(STR_TO_DATE(@event_date, '%Y-%m-%d')) IN (1, 7));

    -- Generate SKU, name, url_key
    SET @sku = CONCAT(@parent_sku, '-', @begin_time, '-', @event_date);
    SET @name = CONCAT(@parent_name, '-', @event_date);
    SET @url_key = LOWER(REPLACE(REPLACE(@name, ' ', '-'), 'ü', 'ue'));
    SET @url_path = CONCAT(@url_key, '/');

    -- Build image URL
    SET @image_url = CONCAT('https://www.miomente.de/media/catalog/product/cache/0/small_image/848x/040ec09b1e35df139433887a97daa66f', @parent_image);

    START TRANSACTION;

    -- Create date option if not exists
    SET @date_option_id = @existing_date_option;
    IF @date_option_id IS NULL THEN
        INSERT INTO eav_attribute_option (attribute_id, sort_order) VALUES (525, 0);
        SET @date_option_id = LAST_INSERT_ID();
        INSERT INTO eav_attribute_option_value (option_id, store_id, value) VALUES (@date_option_id, 0, @date_formatted);
    END IF;

    -- 1. Insert main product entity
    INSERT INTO catalog_product_entity (
        entity_type_id,
        attribute_set_id,
        type_id,
        sku,
        created_at,
        updated_at
    ) VALUES (
        4,
        @attribute_set_id,
        'simple',
        @sku,
        NOW(),
        NOW()
    );

    SET @new_id = LAST_INSERT_ID();

    -- 2. Insert VARCHAR attributes
    INSERT INTO catalog_product_entity_varchar (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES
        (4, 60, 0, @new_id, @name),
        (4, 700, 0, @new_id, @operator_id),
        (4, 717, 0, @new_id, @begin_time),
        (4, 718, 0, @new_id, @end_time),
        (4, 720, 0, @new_id, @capacity),
        (4, 578, 0, @new_id, @location),
        (4, 590, 0, @new_id, @keyword),
        (4, 548, 0, @new_id, @subtitle),
        (4, 719, 0, @new_id, @orginalname),
        (4, 588, 0, @new_id, @participants),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'url_key' AND entity_type_id = 4), 0, @new_id, @url_key),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'url_path' AND entity_type_id = 4), 0, @new_id, @url_path),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'meta_title' AND entity_type_id = 4), 0, @new_id, @meta_title),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'meta_description' AND entity_type_id = 4), 0, @new_id, @meta_description),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'msrp_display_actual_price_type' AND entity_type_id = 4), 0, @new_id, '4'),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'msrp_enabled' AND entity_type_id = 4), 0, @new_id, '2'),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'options_container' AND entity_type_id = 4), 0, @new_id, 'container2');

    -- 3. Insert TEXT attributes
    INSERT INTO catalog_product_entity_text (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES
        (4, 61, 0, @new_id, @description),
        (4, 62, 0, @new_id, @short_description);

    -- 4. Insert INT attributes (including dates!)
    INSERT INTO catalog_product_entity_int (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES
        (4, 525, 0, @new_id, @date_option_id),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4), 0, @new_id, 1),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'visibility' AND entity_type_id = 4), 0, @new_id, 1),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'tax_class_id' AND entity_type_id = 4), 0, @new_id, @tax_class_id),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'is_imported' AND entity_type_id = 4), 0, @new_id, 0),
        (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'is_recurring' AND entity_type_id = 4), 0, @new_id, 0);

    -- 5. Insert DECIMAL attributes
    INSERT INTO catalog_product_entity_decimal (entity_type_id, attribute_id, store_id, entity_id, value)
    VALUES (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4), 0, @new_id, @price);

    -- 6. Link to parent (super_link)
    INSERT INTO catalog_product_super_link (product_id, parent_id)
    VALUES (@new_id, @parent_id);

    -- 7. Product relation (parent-child)
    INSERT INTO catalog_product_relation (parent_id, child_id)
    VALUES (@parent_id, @new_id);

    -- 8. Website assignment
    INSERT INTO catalog_product_website (product_id, website_id)
    VALUES (@new_id, @website_id);

    -- 9. Insert stock item
    INSERT INTO cataloginventory_stock_item (
        product_id, stock_id, qty, is_in_stock, manage_stock, use_config_manage_stock
    ) VALUES (
        @new_id, 1, @capacity, 1, 0, 1
    );

    -- 10. Insert stock status
    INSERT INTO cataloginventory_stock_status (
        product_id, website_id, stock_id, qty, stock_status
    ) VALUES (
        @new_id, @website_id, 1, @capacity, 1
    );

    -- 11. Insert into miomente_wishdatefinder_index for BOTH stores (6 and 4)
    INSERT INTO miomente_wishdatefinder_index (
        simple_product_id, simple_product_date, simple_product_price, simple_product_seats,
        configurable_product_id, configurable_product_name, configurable_product_subtitle,
        configurable_product_cat_ids, configurable_product_urlpath, configurable_product_image,
        configurable_product_imagelabel, configurable_product_operator_id, configurable_product_location,
        store_id, we, updated
    ) VALUES
        (@new_id, @event_date, @price, @capacity, @parent_id, @parent_name, IFNULL(@subtitle, ''),
         IFNULL(@parent_cat_ids, ''), IFNULL(@parent_urlpath, ''), @image_url,
         IFNULL(@parent_image_label, ''), @operator_id, IFNULL(@location, ''), 6, @is_weekend, NOW()),
        (@new_id, @event_date, @price, @capacity, @parent_id, @parent_name, IFNULL(@subtitle, ''),
         IFNULL(@parent_cat_ids, ''), IFNULL(@parent_urlpath, ''), @image_url,
         IFNULL(@parent_image_label, ''), @operator_id, IFNULL(@location, ''), 4, @is_weekend, NOW());

    -- 12. Insert price index for all customer groups
    INSERT INTO catalog_product_index_price (entity_id, customer_group_id, website_id, tax_class_id, price, final_price, min_price, max_price)
    VALUES
        (@new_id, 0, 1, @tax_class_id, @price, @price, @price, @price),
        (@new_id, 1, 1, @tax_class_id, @price, @price, @price, @price),
        (@new_id, 2, 1, @tax_class_id, @price, @price, @price, @price),
        (@new_id, 4, 1, @tax_class_id, @price, @price, @price, @price),
        (@new_id, 5, 1, @tax_class_id, @price, @price, @price, @price),
        (@new_id, 6, 1, @tax_class_id, @price, @price, @price, @price),
        (@new_id, 7, 1, @tax_class_id, @price, @price, @price, @price),
        (@new_id, 8, 1, @tax_class_id, @price, @price, @price, @price),
        (@new_id, 9, 1, @tax_class_id, @price, @price, @price, @price);

    COMMIT;

    -- Return new course date
    SELECT
        @new_id AS 'id',
        @parent_id AS 'courseId',
        @date_time AS 'dateTime',
        @capacity AS 'capacity',
        0 AS 'booked',
        @duration AS 'duration',
        @price AS 'price';
  `;

  // Execute the multi-statement query
  const results = await execute(createSQL, [
    courseId,
    dateTime,
    capacity,
    duration,
    price ?? null,
  ]);

  // The last result set contains the SELECT with the new date data
  // mysql2 returns an array of result sets for multi-statement queries
  const resultSets = results as unknown as Array<RowDataPacket[] | ResultSetHeader>;
  const lastResultSet = resultSets[resultSets.length - 1];

  if (Array.isArray(lastResultSet) && lastResultSet.length > 0) {
    return lastResultSet[0] as DbCourseDate;
  }

  // Fallback: construct the response from input
  return {
    id: 0,
    courseId,
    dateTime,
    capacity,
    booked: 0,
    duration,
    price: price ?? 0,
    customer_number: '',
    operator_ids: '',
  } as DbCourseDate;
}

/**
 * Transform database date to API response format
 */
export function transformDate(dbDate: DbCourseDate): {
  id: number;
  courseId: number;
  dateTime: string;
  capacity: number;
  booked: number;
  duration: number;
  price: number;
} {
  return {
    id: dbDate.id,
    courseId: dbDate.courseId,
    dateTime: dbDate.dateTime,
    capacity: dbDate.capacity,
    booked: dbDate.booked || 0,
    duration: dbDate.duration,
    price: dbDate.price,
  };
}

/**
 * Validate that a date is at least 2 days in the future
 */
export function isValidFutureDate(dateTime: string): boolean {
  const date = new Date(dateTime);
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  twoDaysFromNow.setHours(0, 0, 0, 0);

  return date >= twoDaysFromNow;
}

/**
 * Update date datetime (date and time)
 *
 * This complex query:
 * - Parses the new datetime
 * - Gets current begin/end to calculate existing duration
 * - Calculates new end time maintaining same duration
 * - Updates product name with new date
 * - Finds or creates date option for the new date
 * - Updates multiple EAV attributes (name, begin_time, date option)
 * - Updates wishdatefinder index
 */
export async function updateDateTime(dateId: number, dateTime: string): Promise<void> {
  await execute(`
    -- Parse input
    SET @event_id = ?;
    SET @date_time = ?;

    -- Extract date and time
    SET @event_date = DATE_FORMAT(STR_TO_DATE(@date_time, '%Y-%m-%dT%H:%i:%s'), '%Y-%m-%d');
    SET @begin_time = DATE_FORMAT(STR_TO_DATE(@date_time, '%Y-%m-%dT%H:%i:%s'), '%H:%i');

    -- Get current end time to calculate duration
    SET @current_begin = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @event_id AND attribute_id = 717 AND store_id = 0);
    SET @current_end = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @event_id AND attribute_id = 718 AND store_id = 0);
    SET @duration = TIMESTAMPDIFF(MINUTE, STR_TO_DATE(@current_begin, '%H:%i'), STR_TO_DATE(@current_end, '%H:%i'));

    -- Calculate new end time (keep same duration)
    SET @end_time = DATE_FORMAT(DATE_ADD(STR_TO_DATE(@date_time, '%Y-%m-%dT%H:%i:%s'), INTERVAL @duration MINUTE), '%H:%i');

    -- Get parent name for new product name
    SET @parent_name = (
        SELECT cpev.value
        FROM catalog_product_super_link sl
        JOIN catalog_product_entity_varchar cpev ON sl.parent_id = cpev.entity_id
        WHERE sl.product_id = @event_id AND cpev.attribute_id = 60 AND cpev.store_id = 0
    );
    SET @new_name = CONCAT(@parent_name, '-', @event_date);

    -- Find or create date option
    SET @existing_date_option = (
        SELECT ao.option_id
        FROM eav_attribute_option ao
        JOIN eav_attribute_option_value aov ON ao.option_id = aov.option_id
        WHERE ao.attribute_id = 525 AND aov.value = @event_date
        LIMIT 1
    );

    SET @date_option_id = @existing_date_option;
    IF @date_option_id IS NULL THEN
        INSERT INTO eav_attribute_option (attribute_id, sort_order) VALUES (525, 0);
        SET @date_option_id = LAST_INSERT_ID();
        INSERT INTO eav_attribute_option_value (option_id, store_id, value) VALUES (@date_option_id, 0, @event_date);
    END IF;

    -- Calculate if weekend for wishdatefinder
    SET @is_weekend = (DAYOFWEEK(STR_TO_DATE(@event_date, '%Y-%m-%d')) IN (1, 7));

    -- 1. Update name
    UPDATE catalog_product_entity_varchar
    SET value = @new_name
    WHERE entity_id = @event_id AND attribute_id = 60 AND store_id = 0;

    -- 2. Update begin time
    UPDATE catalog_product_entity_varchar
    SET value = @begin_time
    WHERE entity_id = @event_id AND attribute_id = 717 AND store_id = 0;

    -- 3. Update end time
    UPDATE catalog_product_entity_varchar
    SET value = @end_time
    WHERE entity_id = @event_id AND attribute_id = 718 AND store_id = 0;

    -- 4. Update date option
    UPDATE catalog_product_entity_int
    SET value = @date_option_id
    WHERE entity_id = @event_id AND attribute_id = 525 AND store_id = 0;

    -- 5. Update wishdatefinder index
    UPDATE miomente_wishdatefinder_index
    SET simple_product_date = @event_date,
        we = @is_weekend,
        updated = NOW()
    WHERE simple_product_id = @event_id;
  `, [dateId, dateTime]);
}

/**
 * Update date duration
 *
 * Updates the end time based on begin time + new duration.
 * This preserves the begin time and just extends/shortens the event.
 */
export async function updateDuration(dateId: number, duration: number): Promise<void> {
  await execute(`
    -- Parse input
    SET @event_id = ?;
    SET @duration = ?;

    -- Get current begin time
    SET @begin_time = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @event_id AND attribute_id = 717 AND store_id = 0);

    -- Calculate new end time
    SET @end_time = DATE_FORMAT(DATE_ADD(STR_TO_DATE(@begin_time, '%H:%i'), INTERVAL @duration MINUTE), '%H:%i');

    -- Update end time
    UPDATE catalog_product_entity_varchar
    SET value = @end_time
    WHERE entity_id = @event_id AND attribute_id = 718 AND store_id = 0;
  `, [dateId, duration]);
}
