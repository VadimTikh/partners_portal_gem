# Miomente Magento Course Structure Documentation

## Overview

This document describes the database structure for courses in the Miomente Magento 1.x system. Courses are implemented using Magento's configurable/simple product architecture.

## Product Types

### Configurable Products (Base Courses)
- **Type**: `configurable`
- **Purpose**: Abstract course definition without specific dates
- **Examples**: "Feine vegetarische Mittelmeerküche", "Happy Dumplings"
- **Contains**: Course title, description, base price, location, operator assignment

### Simple Products (Course Events/Dates)
- **Type**: `simple`
- **Purpose**: Specific scheduled instances of a course with date and time
- **Examples**: "Feine vegetarische Mittelmeerküche-2025-03-15"
- **Contains**: Date, start time, end time, capacity (seats), linked to parent configurable

## Database Tables

### Core Tables

| Table | Purpose |
|-------|---------|
| `catalog_product_entity` | Main product table (entity_id, sku, type_id) |
| `catalog_product_entity_varchar` | VARCHAR attribute values |
| `catalog_product_entity_text` | TEXT attribute values (descriptions) |
| `catalog_product_entity_int` | INT attribute values (status, visibility) |
| `catalog_product_entity_decimal` | DECIMAL attribute values (price) |
| `catalog_product_entity_datetime` | DATETIME attribute values |
| `catalog_product_super_link` | Links simple products to configurable parents |
| `cataloginventory_stock_item` | Stock/inventory data |
| `cataloginventory_stock_status` | Stock status |
| `miomente_pdf_operator` | Custom operator/partner table |
| `eav_attribute` | Attribute definitions |

### Key Relationships

```
Customer (customernumber)
    ↓
miomente_pdf_operator (operator_id ↔ customernumber)
    ↓
Configurable Product (operator attribute = operator_id)
    ↓
Simple Products (via catalog_product_super_link)
```

## Attribute IDs

### Verified Attribute IDs (entity_type_id = 4)

| Attribute Code | Attribute ID | Backend Type | Description |
|----------------|--------------|--------------|-------------|
| `name` | 60 | varchar | Product name |
| `image` | 74 | varchar | Main image path |
| `small_image` | 75 | varchar | Small image path |
| `thumbnail` | 76 | varchar | Thumbnail path |
| `description` | * | text | Full description |
| `short_description` | * | text | Short description |
| `price` | * | decimal | Product price |
| `status` | * | int | 1=enabled, 2=disabled |
| `visibility` | * | int | 1=not visible, 4=catalog/search |
| `tax_class_id` | * | int | Tax class |
| `location` | 578 | varchar | Course location |
| `operator` | 700 | varchar | Operator ID |
| `begin` | 717 | varchar | Start time (HH:MM) |
| `end` | 718 | varchar | End time (HH:MM) |
| `seats` | 720 | varchar | Capacity/seats available |

*Note: Verify these IDs with query below*

### Query to Verify Attribute IDs

```sql
SELECT attribute_id, attribute_code, backend_type
FROM eav_attribute
WHERE entity_type_id = 4
AND attribute_code IN (
    'name', 'description', 'short_description', 'price', 
    'status', 'visibility', 'tax_class_id', 'image',
    'location', 'operator', 'begin', 'end', 'seats',
    'url_key', 'url_path'
);
```

## Operator/Customer Structure

### miomente_pdf_operator Table

| Field | Type | Description |
|-------|------|-------------|
| `operator_id` | int (PK) | Unique operator identifier |
| `customernumber` | varchar | Kundennummer - groups operators by client |
| `partnername` | varchar | Partner/operator name |
| `name` | varchar | Display name |
| `street` | varchar | Address street |
| `zip` | varchar | Postal code |
| `city` | varchar | City |
| `contact_email` | varchar | Contact email |
| `phone` | varchar | Phone number |
| `status` | int | Active status |

### Key Concept: Customer Number (Kundennummer)

- Multiple operators can share the same `customernumber`
- Products are filtered by `customernumber`, not individual `operator_id`
- This allows one client to have multiple operator locations

---

## READ Operations

### Get All Base Courses for a Customer

```sql
SELECT 
    cpe.entity_id AS 'id',
    cpev_name.value AS 'title',
    cpe.sku AS 'sku',
    CASE 
        WHEN cpei_status.value = 1 THEN 'active'
        ELSE 'inactive'
    END AS 'status',
    cpet_desc.value AS 'description',
    CONCAT('https://www.miomente.de/media/catalog/product', img.value) AS 'image',
    ROUND(cpd_price.value, 2) AS 'basePrice',
    cpev_location.value AS 'location',
    op.customernumber AS 'customer_number',
    (
        SELECT GROUP_CONCAT(DISTINCT o2.operator_id ORDER BY o2.operator_id)
        FROM miomente_pdf_operator AS o2
        WHERE o2.customernumber = op.customernumber
    ) AS 'operator_ids',
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
    ) AS 'available_dates'
FROM catalog_product_entity AS cpe
INNER JOIN catalog_product_entity_varchar AS cpev_name 
    ON cpe.entity_id = cpev_name.entity_id 
    AND cpev_name.attribute_id = 60
    AND cpev_name.store_id = 0
LEFT JOIN catalog_product_entity_int AS cpei_status
    ON cpe.entity_id = cpei_status.entity_id
    AND cpei_status.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4)
    AND cpei_status.store_id = 0
LEFT JOIN catalog_product_entity_text AS cpet_desc
    ON cpe.entity_id = cpet_desc.entity_id
    AND cpet_desc.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'description' AND entity_type_id = 4)
    AND cpet_desc.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS img
    ON cpe.entity_id = img.entity_id
    AND img.attribute_id = 74
    AND img.store_id = 0
LEFT JOIN catalog_product_entity_decimal AS cpd_price
    ON cpe.entity_id = cpd_price.entity_id
    AND cpd_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4)
    AND cpd_price.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_location
    ON cpe.entity_id = cpev_location.entity_id
    AND cpev_location.attribute_id = 578
    AND cpev_location.store_id = 0
INNER JOIN catalog_product_entity_varchar AS cpev_operator 
    ON cpe.entity_id = cpev_operator.entity_id 
    AND cpev_operator.attribute_id = 700
    AND cpev_operator.store_id = 0
INNER JOIN miomente_pdf_operator AS op
    ON cpev_operator.value = op.operator_id
WHERE op.customernumber = $1
  AND cpe.type_id = 'configurable'
GROUP BY cpe.entity_id;
```

**Parameters:**
- `$1` - customer_number (string, e.g., '543063')

**Response Format:**
```json
{
  "id": 116025,
  "title": "Feine vegetarische Mittelmeerküche",
  "sku": "9-15-543063-01",
  "status": "active",
  "description": "<h3>Course description HTML...</h3>",
  "image": "https://www.miomente.de/media/catalog/product/path/to/image.jpg",
  "basePrice": 151.00,
  "location": "Berlin-Schöneberg",
  "customer_number": "543063",
  "operator_ids": "4527,4708",
  "available_dates": 5
}
```

### Get Single Course by ID

```sql
SELECT 
    cpe.entity_id AS 'id',
    cpev_name.value AS 'title',
    cpe.sku AS 'sku',
    CASE 
        WHEN cpei_status.value = 1 THEN 'active'
        ELSE 'inactive'
    END AS 'status',
    cpet_desc.value AS 'description',
    CONCAT('https://www.miomente.de/media/catalog/product', img.value) AS 'image',
    ROUND(cpd_price.value, 2) AS 'basePrice',
    cpev_location.value AS 'location',
    op.customernumber AS 'customer_number',
    (
        SELECT GROUP_CONCAT(DISTINCT o2.operator_id ORDER BY o2.operator_id)
        FROM miomente_pdf_operator AS o2
        WHERE o2.customernumber = op.customernumber
    ) AS 'operator_ids'
FROM catalog_product_entity AS cpe
INNER JOIN catalog_product_entity_varchar AS cpev_name 
    ON cpe.entity_id = cpev_name.entity_id 
    AND cpev_name.attribute_id = 60
    AND cpev_name.store_id = 0
LEFT JOIN catalog_product_entity_int AS cpei_status
    ON cpe.entity_id = cpei_status.entity_id
    AND cpei_status.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4)
    AND cpei_status.store_id = 0
LEFT JOIN catalog_product_entity_text AS cpet_desc
    ON cpe.entity_id = cpet_desc.entity_id
    AND cpet_desc.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'description' AND entity_type_id = 4)
    AND cpet_desc.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS img
    ON cpe.entity_id = img.entity_id
    AND img.attribute_id = 74
    AND img.store_id = 0
LEFT JOIN catalog_product_entity_decimal AS cpd_price
    ON cpe.entity_id = cpd_price.entity_id
    AND cpd_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4)
    AND cpd_price.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_location
    ON cpe.entity_id = cpev_location.entity_id
    AND cpev_location.attribute_id = 578
    AND cpev_location.store_id = 0
INNER JOIN catalog_product_entity_varchar AS cpev_operator 
    ON cpe.entity_id = cpev_operator.entity_id 
    AND cpev_operator.attribute_id = 700
    AND cpev_operator.store_id = 0
INNER JOIN miomente_pdf_operator AS op
    ON cpev_operator.value = op.operator_id
WHERE op.customernumber = $1
  AND cpe.entity_id = $2
  AND cpe.type_id = 'configurable'
LIMIT 1;
```

**Parameters:**
- `$1` - customer_number (string)
- `$2` - course entity_id (int)

### Get All Course Events (Dates) for a Course

```sql
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
    op.customernumber AS 'customer_number',
    (
        SELECT GROUP_CONCAT(DISTINCT o2.operator_id ORDER BY o2.operator_id)
        FROM miomente_pdf_operator AS o2
        WHERE o2.customernumber = op.customernumber
    ) AS 'operator_ids'
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
INNER JOIN catalog_product_entity_varchar AS cpev_name 
    ON simple.entity_id = cpev_name.entity_id 
    AND cpev_name.attribute_id = 60
    AND cpev_name.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_begin
    ON simple.entity_id = cpev_begin.entity_id 
    AND cpev_begin.attribute_id = 717
    AND cpev_begin.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_end
    ON simple.entity_id = cpev_end.entity_id 
    AND cpev_end.attribute_id = 718
    AND cpev_end.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_seats
    ON simple.entity_id = cpev_seats.entity_id 
    AND cpev_seats.attribute_id = 720
    AND cpev_seats.store_id = 0
WHERE op.customernumber = $1
  AND link.parent_id = $2
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
) ASC;
```

**Parameters:**
- `$1` - customer_number (string)
- `$2` - parent course entity_id (int)

**Response Format:**
```json
{
  "id": 116143,
  "courseId": 116025,
  "dateTime": "2025-03-15T18:30:00Z",
  "capacity": 12,
  "booked": 0,
  "duration": 240,
  "customer_number": "543063",
  "operator_ids": "4527,4708"
}
```

### Get All Future Events for a Customer (All Courses)

```sql
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
    op.customernumber AS 'customer_number',
    (
        SELECT GROUP_CONCAT(DISTINCT o2.operator_id ORDER BY o2.operator_id)
        FROM miomente_pdf_operator AS o2
        WHERE o2.customernumber = op.customernumber
    ) AS 'operator_ids'
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
INNER JOIN catalog_product_entity_varchar AS cpev_name 
    ON simple.entity_id = cpev_name.entity_id 
    AND cpev_name.attribute_id = 60
    AND cpev_name.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_begin
    ON simple.entity_id = cpev_begin.entity_id 
    AND cpev_begin.attribute_id = 717
    AND cpev_begin.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_end
    ON simple.entity_id = cpev_end.entity_id 
    AND cpev_end.attribute_id = 718
    AND cpev_end.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_seats
    ON simple.entity_id = cpev_seats.entity_id 
    AND cpev_seats.attribute_id = 720
    AND cpev_seats.store_id = 0
WHERE op.customernumber = $1
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
) ASC;
```

**Parameters:**
- `$1` - customer_number (string)

---

## CREATE Operations

### Create New Course Event (Simple Product)

**Required Input:**
```typescript
interface CreateCourseEventInput {
  parentId: number;        // Configurable product entity_id
  date: string;            // Format: 'YYYY-MM-DD'
  beginTime: string;       // Format: 'HH:MM'
  endTime: string;         // Format: 'HH:MM'
  seats: number;           // Capacity
  price?: number;          // Optional, defaults to parent price
  operatorId?: string;     // Optional, defaults to parent operator
}
```

**SQL Script:**

```sql
-- Variables (replace with input values)
SET @parent_id = ?;                    -- parentId
SET @event_date = ?;                   -- date (YYYY-MM-DD)
SET @begin_time = ?;                   -- beginTime (HH:MM)
SET @end_time = ?;                     -- endTime (HH:MM)
SET @seats = ?;                        -- seats
SET @price = ?;                        -- price (or NULL for parent price)

-- Derive values from parent
SET @attribute_set_id = (SELECT attribute_set_id FROM catalog_product_entity WHERE entity_id = @parent_id);
SET @parent_sku = (SELECT sku FROM catalog_product_entity WHERE entity_id = @parent_id);
SET @parent_name = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 60 AND store_id = 0);
SET @operator_id = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 700 AND store_id = 0);
SET @location = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 578 AND store_id = 0);
SET @tax_class_id = (SELECT value FROM catalog_product_entity_int WHERE entity_id = @parent_id AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'tax_class_id' AND entity_type_id = 4) AND store_id = 0);

-- Use parent price if not provided
SET @final_price = IFNULL(@price, (SELECT value FROM catalog_product_entity_decimal WHERE entity_id = @parent_id AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4) AND store_id = 0));

-- Generate SKU and name
SET @sku = CONCAT(@parent_sku, '-', @begin_time, '-', @event_date);
SET @name = CONCAT(@parent_name, '-', @event_date);

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
    (4, 60, 0, @new_id, @name),           -- name
    (4, 700, 0, @new_id, @operator_id),   -- operator
    (4, 717, 0, @new_id, @begin_time),    -- begin
    (4, 718, 0, @new_id, @end_time),      -- end
    (4, 720, 0, @new_id, @seats),         -- seats
    (4, 578, 0, @new_id, @location);      -- location

-- 3. Insert INT attributes (status, visibility, tax_class_id)
INSERT INTO catalog_product_entity_int (entity_type_id, attribute_id, store_id, entity_id, value)
VALUES 
    (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4), 0, @new_id, 1),
    (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'visibility' AND entity_type_id = 4), 0, @new_id, 1),
    (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'tax_class_id' AND entity_type_id = 4), 0, @new_id, @tax_class_id);

-- 4. Insert DECIMAL attributes (price)
INSERT INTO catalog_product_entity_decimal (entity_type_id, attribute_id, store_id, entity_id, value)
VALUES (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4), 0, @new_id, @final_price);

-- 5. Link to parent configurable
INSERT INTO catalog_product_super_link (product_id, parent_id)
VALUES (@new_id, @parent_id);

-- 6. Insert stock item
INSERT INTO cataloginventory_stock_item (
    product_id, stock_id, qty, is_in_stock, manage_stock, use_config_manage_stock
) VALUES (
    @new_id, 1, @seats, 1, 1, 1
);

-- 7. Insert stock status
INSERT INTO cataloginventory_stock_status (
    product_id, website_id, stock_id, qty, stock_status
) VALUES (
    @new_id, 1, 1, @seats, 1
);

-- Return new product
SELECT @new_id AS 'id', @sku AS 'sku', @name AS 'name';
```

### Create New Course (Configurable Product)

**Required Input:**
```typescript
interface CreateCourseInput {
  customerNumber: string;  // Kundennummer
  operatorId: string;      // Operator ID
  title: string;           // Course name
  description: string;     // HTML description
  shortDescription: string;
  price: number;           // Base price in EUR
  location: string;        // e.g., 'Berlin-Schöneberg'
  image?: string;          // Image path (optional)
}
```

**SQL Script:**

```sql
-- Variables
SET @customer_number = ?;
SET @operator_id = ?;
SET @title = ?;
SET @description = ?;
SET @short_description = ?;
SET @price = ?;
SET @location = ?;
SET @image = ?;  -- Can be NULL

-- Generate SKU (format: X-XX-CUSTOMERNUMBER-XX)
SET @sku_suffix = (
    SELECT LPAD(IFNULL(MAX(CAST(SUBSTRING_INDEX(sku, '-', -1) AS UNSIGNED)), 0) + 1, 2, '0')
    FROM catalog_product_entity
    WHERE sku LIKE CONCAT('%-', @customer_number, '-%')
    AND type_id = 'configurable'
);
SET @sku = CONCAT('9-15-', @customer_number, '-', @sku_suffix);

-- Get attribute_set_id from existing configurable (Event = 11 typically)
SET @attribute_set_id = 11;  -- Verify this value

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
    'configurable',
    @sku,
    NOW(),
    NOW()
);

SET @new_id = LAST_INSERT_ID();

-- 2. Insert VARCHAR attributes
INSERT INTO catalog_product_entity_varchar (entity_type_id, attribute_id, store_id, entity_id, value)
VALUES 
    (4, 60, 0, @new_id, @title),          -- name
    (4, 700, 0, @new_id, @operator_id),   -- operator
    (4, 578, 0, @new_id, @location);      -- location

-- Insert image if provided
INSERT INTO catalog_product_entity_varchar (entity_type_id, attribute_id, store_id, entity_id, value)
SELECT 4, 74, 0, @new_id, @image WHERE @image IS NOT NULL;

-- 3. Insert TEXT attributes
INSERT INTO catalog_product_entity_text (entity_type_id, attribute_id, store_id, entity_id, value)
VALUES 
    (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'description' AND entity_type_id = 4), 0, @new_id, @description),
    (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'short_description' AND entity_type_id = 4), 0, @new_id, @short_description);

-- 4. Insert INT attributes
INSERT INTO catalog_product_entity_int (entity_type_id, attribute_id, store_id, entity_id, value)
VALUES 
    (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'status' AND entity_type_id = 4), 0, @new_id, 1),
    (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'visibility' AND entity_type_id = 4), 0, @new_id, 4),
    (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'tax_class_id' AND entity_type_id = 4), 0, @new_id, 5);

-- 5. Insert DECIMAL attributes
INSERT INTO catalog_product_entity_decimal (entity_type_id, attribute_id, store_id, entity_id, value)
VALUES (4, (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4), 0, @new_id, @price);

-- 6. Insert stock (configurable products need this too)
INSERT INTO cataloginventory_stock_item (
    product_id, stock_id, qty, is_in_stock, manage_stock, use_config_manage_stock
) VALUES (
    @new_id, 1, 0, 1, 0, 1
);

INSERT INTO cataloginventory_stock_status (
    product_id, website_id, stock_id, qty, stock_status
) VALUES (
    @new_id, 1, 1, 0, 1
);

-- Return new course
SELECT @new_id AS 'id', @sku AS 'sku', @title AS 'title';
```

---

## DELETE Operations

### Delete Course Event (Simple Product)

**Important:** Before deleting, verify the product belongs to the customer and has no orders.

```sql
-- Variables
SET @event_id = ?;         -- Simple product entity_id to delete
SET @customer_number = ?;  -- For authorization check

-- 1. Verify ownership
SELECT COUNT(*) INTO @authorized FROM catalog_product_entity AS cpe
INNER JOIN catalog_product_super_link AS link ON cpe.entity_id = link.product_id
INNER JOIN catalog_product_entity AS parent ON link.parent_id = parent.entity_id
INNER JOIN catalog_product_entity_varchar AS cpev_operator 
    ON parent.entity_id = cpev_operator.entity_id AND cpev_operator.attribute_id = 700
INNER JOIN miomente_pdf_operator AS op ON cpev_operator.value = op.operator_id
WHERE cpe.entity_id = @event_id AND op.customernumber = @customer_number;

-- Only proceed if authorized
-- 2. Delete from EAV tables
DELETE FROM catalog_product_entity_varchar WHERE entity_id = @event_id;
DELETE FROM catalog_product_entity_text WHERE entity_id = @event_id;
DELETE FROM catalog_product_entity_int WHERE entity_id = @event_id;
DELETE FROM catalog_product_entity_decimal WHERE entity_id = @event_id;
DELETE FROM catalog_product_entity_datetime WHERE entity_id = @event_id;

-- 3. Delete from link table
DELETE FROM catalog_product_super_link WHERE product_id = @event_id;

-- 4. Delete from stock tables
DELETE FROM cataloginventory_stock_item WHERE product_id = @event_id;
DELETE FROM cataloginventory_stock_status WHERE product_id = @event_id;

-- 5. Delete from main entity table
DELETE FROM catalog_product_entity WHERE entity_id = @event_id;

SELECT ROW_COUNT() AS 'deleted';
```

### Delete Course (Configurable Product)

**Warning:** This will also need to delete all associated simple products (events).

```sql
-- Variables
SET @course_id = ?;        -- Configurable product entity_id
SET @customer_number = ?;  -- For authorization check

-- 1. Verify ownership
SELECT COUNT(*) INTO @authorized FROM catalog_product_entity AS cpe
INNER JOIN catalog_product_entity_varchar AS cpev_operator 
    ON cpe.entity_id = cpev_operator.entity_id AND cpev_operator.attribute_id = 700
INNER JOIN miomente_pdf_operator AS op ON cpev_operator.value = op.operator_id
WHERE cpe.entity_id = @course_id 
  AND cpe.type_id = 'configurable'
  AND op.customernumber = @customer_number;

-- 2. Get all linked simple products
CREATE TEMPORARY TABLE temp_simple_ids AS
SELECT product_id FROM catalog_product_super_link WHERE parent_id = @course_id;

-- 3. Delete simple products (events)
DELETE FROM catalog_product_entity_varchar WHERE entity_id IN (SELECT product_id FROM temp_simple_ids);
DELETE FROM catalog_product_entity_text WHERE entity_id IN (SELECT product_id FROM temp_simple_ids);
DELETE FROM catalog_product_entity_int WHERE entity_id IN (SELECT product_id FROM temp_simple_ids);
DELETE FROM catalog_product_entity_decimal WHERE entity_id IN (SELECT product_id FROM temp_simple_ids);
DELETE FROM catalog_product_entity_datetime WHERE entity_id IN (SELECT product_id FROM temp_simple_ids);
DELETE FROM cataloginventory_stock_item WHERE product_id IN (SELECT product_id FROM temp_simple_ids);
DELETE FROM cataloginventory_stock_status WHERE product_id IN (SELECT product_id FROM temp_simple_ids);
DELETE FROM catalog_product_super_link WHERE parent_id = @course_id;
DELETE FROM catalog_product_entity WHERE entity_id IN (SELECT product_id FROM temp_simple_ids);

-- 4. Delete configurable product (course)
DELETE FROM catalog_product_entity_varchar WHERE entity_id = @course_id;
DELETE FROM catalog_product_entity_text WHERE entity_id = @course_id;
DELETE FROM catalog_product_entity_int WHERE entity_id = @course_id;
DELETE FROM catalog_product_entity_decimal WHERE entity_id = @course_id;
DELETE FROM catalog_product_entity_datetime WHERE entity_id = @course_id;
DELETE FROM cataloginventory_stock_item WHERE product_id = @course_id;
DELETE FROM cataloginventory_stock_status WHERE product_id = @course_id;
DELETE FROM catalog_product_entity WHERE entity_id = @course_id;

DROP TEMPORARY TABLE temp_simple_ids;

SELECT ROW_COUNT() AS 'deleted';
```

---

## Utility Queries

### Get Operators by Customer Number

```sql
SELECT operator_id, customernumber, partnername, name, city
FROM miomente_pdf_operator
WHERE customernumber = $1
ORDER BY operator_id;
```

### Get All Customer Numbers

```sql
SELECT DISTINCT 
    customernumber,
    GROUP_CONCAT(DISTINCT operator_id ORDER BY operator_id) AS operator_ids,
    GROUP_CONCAT(DISTINCT partnername ORDER BY partnername SEPARATOR ' | ') AS partner_names
FROM miomente_pdf_operator
WHERE customernumber IS NOT NULL
GROUP BY customernumber
ORDER BY customernumber;
```

### Check Product Ownership

```sql
SELECT 
    CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END AS 'authorized'
FROM catalog_product_entity AS cpe
INNER JOIN catalog_product_entity_varchar AS cpev_operator 
    ON cpe.entity_id = cpev_operator.entity_id 
    AND cpev_operator.attribute_id = 700
INNER JOIN miomente_pdf_operator AS op 
    ON cpev_operator.value = op.operator_id
WHERE cpe.entity_id = $1  -- product_id
  AND op.customernumber = $2;  -- customer_number
```

### Get All Attributes for a Product (Debug)

```sql
SELECT ea.attribute_code, ea.attribute_id, ea.backend_type,
    COALESCE(v.value, t.value, d.value, dt.value, i.value) AS 'value'
FROM eav_attribute AS ea
LEFT JOIN catalog_product_entity_varchar AS v 
    ON v.attribute_id = ea.attribute_id AND v.entity_id = $1 AND v.store_id = 0
LEFT JOIN catalog_product_entity_text AS t 
    ON t.attribute_id = ea.attribute_id AND t.entity_id = $1 AND t.store_id = 0
LEFT JOIN catalog_product_entity_decimal AS d 
    ON d.attribute_id = ea.attribute_id AND d.entity_id = $1 AND d.store_id = 0
LEFT JOIN catalog_product_entity_datetime AS dt 
    ON dt.attribute_id = ea.attribute_id AND dt.entity_id = $1 AND dt.store_id = 0
LEFT JOIN catalog_product_entity_int AS i 
    ON i.attribute_id = ea.attribute_id AND i.entity_id = $1 AND i.store_id = 0
WHERE ea.entity_type_id = 4
AND COALESCE(v.value, t.value, d.value, dt.value, i.value) IS NOT NULL
ORDER BY ea.attribute_code;
```

---

## Data Formats

### SKU Format

**Configurable (Course):** `X-XX-CUSTOMERNUMBER-XX`
- Example: `9-15-543063-01`

**Simple (Event):** `PARENT_SKU-HH:MM-YYYY-MM-DD`
- Example: `9-15-543063-01-18:30-2025-03-15`

### Name Format

**Configurable (Course):** `Course Title`
- Example: `Feine vegetarische Mittelmeerküche`

**Simple (Event):** `Course Title-YYYY-MM-DD`
- Example: `Feine vegetarische Mittelmeerküche-2025-03-15`

### DateTime Extraction

The date is extracted from the product name (last 3 segments):
```sql
SUBSTRING_INDEX(name, '-', -3)  -- Returns '2025-03-15'
```

Combined with begin time for full datetime:
```sql
CONCAT(
    SUBSTRING_INDEX(name, '-', -3), 
    'T', 
    begin_time, 
    ':00Z'
)  -- Returns '2025-03-15T18:30:00Z'
```

### Duration Calculation

Duration in minutes = end_time - begin_time:
```sql
TIMESTAMPDIFF(
    MINUTE,
    STR_TO_DATE(begin_time, '%H:%i'),
    STR_TO_DATE(end_time, '%H:%i')
)  -- e.g., 18:30 to 22:30 = 240 minutes
```

---

## API Route Suggestions

### Courses (Configurable Products)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/courses?customerNumber=X` | List all courses for customer |
| GET | `/api/courses/:id?customerNumber=X` | Get single course |
| POST | `/api/courses` | Create new course |
| PUT | `/api/courses/:id` | Update course |
| DELETE | `/api/courses/:id?customerNumber=X` | Delete course and all events |

### Events (Simple Products)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/courses/:courseId/events?customerNumber=X` | List all events for course |
| GET | `/api/events/:id?customerNumber=X` | Get single event |
| POST | `/api/courses/:courseId/events` | Create new event |
| PUT | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id?customerNumber=X` | Delete event |

---

## Important Notes

1. **Always verify ownership** before any write operation using `customernumber`
2. **entity_type_id = 4** for all product-related EAV queries
3. **store_id = 0** for default/global values
4. **Attribute IDs may vary** - always verify with `eav_attribute` table
5. **Date extraction from name** - relies on naming convention `Title-YYYY-MM-DD`
6. **Transactions recommended** for multi-table operations
7. **Magento indexing** - after direct DB changes, may need to reindex:
    - `php shell/indexer.php --reindexall`