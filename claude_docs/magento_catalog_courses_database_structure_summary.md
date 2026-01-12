# Miomente Magento Course Database Structure

> Complete technical reference for AI agents working with Miomente's Magento 1.x course system.

## Table of Contents

1. [Overview](#overview)
2. [Product Types](#product-types)
3. [Database Tables](#database-tables)
4. [Attribute Reference](#attribute-reference)
5. [Operator/Customer Structure](#operatorcustomer-structure)
6. [READ Operations](#read-operations)
7. [CREATE Course (Configurable)](#create-course-configurable)
8. [CREATE Course Event (Simple)](#create-course-event-simple)
9. [DELETE Operations](#delete-operations)
10. [Critical Tables for Visibility](#critical-tables-for-visibility)
11. [Data Formats](#data-formats)
12. [API Reference](#api-reference)

---

## Overview

Miomente uses Magento 1.x with a custom EAV (Entity-Attribute-Value) architecture for managing cooking courses. The system uses:

- **Configurable Products** = Base courses (abstract definition)
- **Simple Products** = Scheduled events/dates (concrete instances)

A course becomes bookable only when it has at least one simple product (date) linked to it.

### Key Concept: The "dates" Attribute

The configurable product is made configurable by the `dates` attribute (attribute_id = 525). Each simple product has a specific date option selected from `eav_attribute_option`, linking it to the parent configurable.

---

## Product Types

### Configurable Products (Base Courses)

| Property | Value |
|----------|-------|
| type_id | `configurable` |
| attribute_set_id | `26` (Event) |
| Purpose | Abstract course definition |
| Contains | Title, description, base price, location, operator, images |
| Example | "Veganes Korea", "Sushi Masterclass" |

### Simple Products (Course Events/Dates)

| Property | Value |
|----------|-------|
| type_id | `simple` |
| attribute_set_id | `26` (Event) |
| Purpose | Specific scheduled instance with date/time |
| Contains | Date, start/end time, capacity, price (can override parent) |
| Example | "Veganes Korea-2026-03-15" |

### Relationship

```
Configurable Product (Course)
    ├── catalog_product_super_attribute (attribute_id = 525 "dates")
    │
    ├── Simple Product (Event 1) ─── dates option_id = 5387 (2026-03-15)
    ├── Simple Product (Event 2) ─── dates option_id = 5388 (2026-03-22)
    └── Simple Product (Event 3) ─── dates option_id = 5389 (2026-03-29)
```

---

## Database Tables

### Tables Required for Course Creation (13 total)

| # | Table | Purpose | Required For |
|---|-------|---------|--------------|
| 1 | `catalog_product_entity` | Main product record | Both |
| 2 | `catalog_product_entity_varchar` | Text attributes (name, location, etc.) | Both |
| 3 | `catalog_product_entity_text` | Long text (description, etc.) | Both |
| 4 | `catalog_product_entity_int` | Integer attributes (status, visibility) | Both |
| 5 | `catalog_product_entity_decimal` | Decimal attributes (price, cost) | Both |
| 6 | `catalog_product_super_attribute` | Makes product configurable | Configurable only |
| 7 | `catalog_product_super_attribute_label` | Label for configurable attribute | Configurable only |
| 8 | `catalog_product_super_link` | Links simple to configurable | Simple only |
| 9 | `catalog_product_relation` | Parent-child relationship | Simple only |
| 10 | `catalog_category_product` | Category assignments | Configurable only |
| 11 | `catalog_product_website` | Website assignment | Both |
| 12 | `cataloginventory_stock_item` | Stock/inventory | Both |
| 13 | `cataloginventory_stock_status` | Stock status | Both |
| 14 | `catalog_product_index_price` | Price index (all customer groups) | Both |
| 15 | `core_url_rewrite` | URL rewrites | Both |
| 16 | `miomente_wishdatefinder_index` | **CRITICAL** Custom index for frontend | Simple only |
| 17 | `eav_attribute_option` | Date options for dropdown | Simple only |
| 18 | `eav_attribute_option_value` | Date option values | Simple only |

### Table Relationships Diagram

```
catalog_product_entity (configurable)
    │
    ├──► catalog_product_super_attribute ──► catalog_product_super_attribute_label
    │         (attribute_id = 525)
    │
    ├──► catalog_product_entity_varchar (multiple rows)
    ├──► catalog_product_entity_text (multiple rows)
    ├──► catalog_product_entity_int (multiple rows)
    ├──► catalog_product_entity_decimal (multiple rows)
    │
    ├──► catalog_category_product (multiple categories)
    ├──► catalog_product_website
    ├──► cataloginventory_stock_item
    ├──► cataloginventory_stock_status
    ├──► catalog_product_index_price (9 customer groups)
    └──► core_url_rewrite (stores 4 and 6)

catalog_product_entity (simple)
    │
    ├──► catalog_product_super_link ──► parent configurable
    ├──► catalog_product_relation ──► parent configurable
    │
    ├──► catalog_product_entity_varchar
    │         └── dates (attribute_id = 525) ──► eav_attribute_option
    ├──► catalog_product_entity_text
    ├──► catalog_product_entity_int
    ├──► catalog_product_entity_decimal
    │
    ├──► catalog_product_website
    ├──► cataloginventory_stock_item
    ├──► cataloginventory_stock_status
    ├──► catalog_product_index_price (9 customer groups)
    └──► miomente_wishdatefinder_index (stores 4 and 6) **CRITICAL**
```

---

## Attribute Reference

### VARCHAR Attributes (catalog_product_entity_varchar)

| attribute_code | attribute_id | Description | Used In |
|----------------|--------------|-------------|---------|
| name | 60 | Product name | Both |
| meta_title | 71 | SEO title | Both |
| meta_description | 73 | SEO description | Both |
| image | 74 | Main image path | Both |
| small_image | 75 | Small image path | Configurable |
| thumbnail | 76 | Thumbnail path | Configurable |
| url_key | 86 | URL key | Both |
| url_path | 87 | Full URL path | Both |
| options_container | 96 | Options container | Both |
| image_label | 99 | Image alt text | Configurable |
| small_image_label | 100 | Small image alt | Configurable |
| thumbnail_label | 101 | Thumbnail alt | Configurable |
| subtitle | 548 | Course subtitle/tagline | Both |
| event_person_photo | 554 | Event photo | Configurable |
| msrp_enabled | 564 | MSRP enabled (value: "2") | Both |
| msrp_display_actual_price_type | 565 | MSRP display (value: "4") | Both |
| location | 578 | Course location | Both |
| title_image | 587 | Title image | Configurable |
| participants | 588 | Participants text | Both |
| keyword | 590 | SEO keyword | Both |
| operator | 700 | Operator ID | Both |
| begin | 717 | Start time (HH:MM) | Both |
| end | 718 | End time (HH:MM) | Both |
| orginalname | 719 | Original/internal name | Both |
| seats | 720 | Capacity | Both |
| default_category | 768 | Default category ID | Configurable |

### TEXT Attributes (catalog_product_entity_text)

| attribute_code | attribute_id | Description |
|----------------|--------------|-------------|
| description | 61 | Full HTML description |
| short_description | 62 | Short HTML description |
| miomente_business | 584 | Business event text |
| miomente_gift_recommendation | 585 | Gift recommendation |
| miomente_inclusive | 586 | What's included |
| contents_and_course | 589 | Course agenda/contents |
| meta_robots | 707 | Robots directive ("INDEX, FOLLOW") |
| searchtag | 709 | Search tags |

### INT Attributes (catalog_product_entity_int)

| attribute_code | attribute_id | Default | Description |
|----------------|--------------|---------|-------------|
| status | 84 | 1 | 1=enabled, 2=disabled |
| tax_class_id | 85 | 5 | Tax class |
| visibility | 89 | 1 | 1=not visible individually, 4=catalog/search |
| dates | 525 | NULL | Date dropdown (option_id) - **Simple only** |
| is_imported | 568 | 0 | Import flag |
| price_unit | 580 | 426 | "pro Person" |
| exclude_from_sitemap | 712 | 0 | Sitemap exclusion |
| disabledatebox | 725 | 0 | Disable date box |
| teilnehmercheck | 746 | 0 | Participant check |
| sammelevent | 747 | 0 | Collection event |
| amgiftwrap_blacklisted | 749 | 0 | Gift wrap blacklist |
| showonlisttop | 750 | 0 | Show on list top |
| odoo_product_type | 751 | 2879 | Odoo product type |
| topseller | 761 | 0 | Topseller flag |
| fakedates | 766 | 0 | Fake dates flag |
| specialonline | 769 | 0 | Special online |

### DECIMAL Attributes (catalog_product_entity_decimal)

| attribute_code | attribute_id | Description |
|----------------|--------------|-------------|
| price | 64 | Product price |
| special_price | 65 | Special price |
| cost | 68 | Partner cost |

---

## Operator/Customer Structure

### miomente_pdf_operator Table

| Field | Type | Description |
|-------|------|-------------|
| operator_id | int (PK) | Unique operator identifier |
| customernumber | varchar | Kundennummer - groups operators by client |
| partnername | varchar | Partner/operator name |
| name | varchar | Display name |
| street | varchar | Address street |
| zip | varchar | Postal code |
| city | varchar | City |
| contact_email | varchar | Contact email |
| phone | varchar | Phone number |
| status | int | Active status |

### Key Concept: Customer Number (Kundennummer)

- Multiple operators can share the same `customernumber`
- Products are filtered by `customernumber`, not individual `operator_id`
- This allows one client to have multiple operator locations

### Relationship

```
Customer (customernumber: "126734")
    │
    ├── Operator 4489 (Food Atlas Hamburg)
    ├── Operator 4490 (Food Atlas Berlin)
    └── Operator 4491 (Food Atlas München)
         │
         └── Products assigned via operator attribute (700)
```

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
        INNER JOIN catalog_product_super_link AS sl ON s.entity_id = sl.product_id
        INNER JOIN catalog_product_entity_varchar AS sn
            ON s.entity_id = sn.entity_id AND sn.attribute_id = 60 AND sn.store_id = 0
        INNER JOIN catalog_product_entity_varchar AS sb
            ON s.entity_id = sb.entity_id AND sb.attribute_id = 717 AND sb.store_id = 0
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
    ON cpe.entity_id = cpev_name.entity_id AND cpev_name.attribute_id = 60 AND cpev_name.store_id = 0
LEFT JOIN catalog_product_entity_int AS cpei_status
    ON cpe.entity_id = cpei_status.entity_id AND cpei_status.attribute_id = 84 AND cpei_status.store_id = 0
LEFT JOIN catalog_product_entity_text AS cpet_desc
    ON cpe.entity_id = cpet_desc.entity_id AND cpet_desc.attribute_id = 61 AND cpet_desc.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS img
    ON cpe.entity_id = img.entity_id AND img.attribute_id = 74 AND img.store_id = 0
LEFT JOIN catalog_product_entity_decimal AS cpd_price
    ON cpe.entity_id = cpd_price.entity_id AND cpd_price.attribute_id = 64 AND cpd_price.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_location
    ON cpe.entity_id = cpev_location.entity_id AND cpev_location.attribute_id = 578 AND cpev_location.store_id = 0
INNER JOIN catalog_product_entity_varchar AS cpev_operator 
    ON cpe.entity_id = cpev_operator.entity_id AND cpev_operator.attribute_id = 700 AND cpev_operator.store_id = 0
INNER JOIN miomente_pdf_operator AS op
    ON cpev_operator.value = op.operator_id
WHERE op.customernumber = $1
  AND cpe.type_id = 'configurable'
GROUP BY cpe.entity_id;
```

**Parameters:** `$1` = customer_number (string)

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
    ROUND(cpd_price.value, 2) AS 'price',
    op.customernumber AS 'customer_number'
FROM catalog_product_entity AS simple
INNER JOIN catalog_product_super_link AS link ON simple.entity_id = link.product_id
INNER JOIN catalog_product_entity AS parent ON link.parent_id = parent.entity_id
INNER JOIN catalog_product_entity_varchar AS cpev_operator 
    ON parent.entity_id = cpev_operator.entity_id AND cpev_operator.attribute_id = 700 AND cpev_operator.store_id = 0
INNER JOIN miomente_pdf_operator AS op ON cpev_operator.value = op.operator_id
INNER JOIN catalog_product_entity_varchar AS cpev_name 
    ON simple.entity_id = cpev_name.entity_id AND cpev_name.attribute_id = 60 AND cpev_name.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_begin
    ON simple.entity_id = cpev_begin.entity_id AND cpev_begin.attribute_id = 717 AND cpev_begin.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_end
    ON simple.entity_id = cpev_end.entity_id AND cpev_end.attribute_id = 718 AND cpev_end.store_id = 0
LEFT JOIN catalog_product_entity_varchar AS cpev_seats
    ON simple.entity_id = cpev_seats.entity_id AND cpev_seats.attribute_id = 720 AND cpev_seats.store_id = 0
LEFT JOIN catalog_product_entity_decimal AS cpd_price
    ON simple.entity_id = cpd_price.entity_id AND cpd_price.attribute_id = 64 AND cpd_price.store_id = 0
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

**Parameters:** `$1` = customer_number, `$2` = courseId (configurable entity_id)

---

## CREATE Course (Configurable)

### Required Input Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operatorId | string | ✅ | Operator ID |
| name | string | ✅ | Course name |
| subtitle | string | ✅ | Short headline |
| description | HTML | ✅ | Full description |
| shortDescription | HTML | ✅ | Short teaser |
| price | decimal | ✅ | Price in EUR |
| location | string | ✅ | Location name |
| beginTime | string | ✅ | Default start time (HH:MM) |
| endTime | string | ✅ | Default end time (HH:MM) |
| seats | string | ✅ | Default capacity |
| participants | string | ✅ | Display text |
| categoryIds | string | ✅ | Comma-separated category IDs |

### Optional Input Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| keyword | string | = name | SEO keyword |
| metaTitle | string | = subtitle | SEO title |
| metaDescription | string | "" | SEO description |
| cost | decimal | price * 0.9 | Partner cost |
| image | string | "no_selection" | Image path |
| contentsAndCourse | HTML | NULL | Course agenda |
| miomenteInclusive | text | NULL | What's included |
| miomenteGiftRecommendation | text | NULL | Gift text |
| miomonteBusiness | text | NULL | Business text |
| searchtag | text | NULL | Search tags |

### SQL Query

```sql
-- INPUT VARIABLES
SET @operator_id = ?;
SET @name = ?;
SET @subtitle = ?;
SET @description = ?;
SET @short_description = ?;
SET @price = ?;
SET @location = ?;
SET @begin_time = ?;
SET @end_time = ?;
SET @seats = ?;
SET @participants = ?;
SET @category_ids = ?;  -- comma-separated: "3,20,69,95"

-- OPTIONAL (with defaults)
SET @keyword = IFNULL(?, @name);
SET @meta_title = IFNULL(?, @subtitle);
SET @meta_description = IFNULL(?, '');
SET @cost = IFNULL(?, ROUND(@price * 0.9, 2));
SET @image = IFNULL(?, 'no_selection');

-- DERIVED VALUES
SET @customernumber = (SELECT customernumber FROM miomente_pdf_operator WHERE operator_id = @operator_id LIMIT 1);
SET @sku_prefix = CONCAT('9-3-', @customernumber, '-');
SET @next_sku_num = (
    SELECT LPAD(IFNULL(MAX(CAST(SUBSTRING_INDEX(sku, '-', -1) AS UNSIGNED)), 0) + 1, 2, '0')
    FROM catalog_product_entity
    WHERE sku LIKE CONCAT(@sku_prefix, '%') AND type_id = 'configurable'
);
SET @sku = CONCAT(@sku_prefix, @next_sku_num);
SET @url_key = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    CONCAT(@keyword, '-', @name), ' ', '-'), 'ü', 'ue'), 'ö', 'oe'), 'ä', 'ae'), 'ß', 'ss'));
SET @url_path = CONCAT(@url_key, '/');

-- CONSTANTS
SET @attribute_set_id = 26;
SET @website_id = 1;
SET @tax_class_id = 5;

START TRANSACTION;

-- 1. Main entity
INSERT INTO catalog_product_entity (entity_type_id, attribute_set_id, type_id, sku, created_at, updated_at)
VALUES (4, @attribute_set_id, 'configurable', @sku, NOW(), NOW());
SET @new_id = LAST_INSERT_ID();

-- 2. VARCHAR attributes
INSERT INTO catalog_product_entity_varchar (entity_type_id, attribute_id, store_id, entity_id, value) VALUES
    (4, 60, 0, @new_id, @name),
    (4, 548, 0, @new_id, @subtitle),
    (4, 700, 0, @new_id, @operator_id),
    (4, 578, 0, @new_id, @location),
    (4, 717, 0, @new_id, @begin_time),
    (4, 718, 0, @new_id, @end_time),
    (4, 720, 0, @new_id, @seats),
    (4, 588, 0, @new_id, @participants),
    (4, 590, 0, @new_id, @keyword),
    (4, 71, 0, @new_id, @meta_title),
    (4, 73, 0, @new_id, @meta_description),
    (4, 86, 0, @new_id, @url_key),
    (4, 87, 0, @new_id, @url_path),
    (4, 74, 0, @new_id, @image),
    (4, 75, 0, @new_id, @image),
    (4, 76, 0, @new_id, @image),
    (4, 564, 0, @new_id, '2'),
    (4, 565, 0, @new_id, '4'),
    (4, 96, 0, @new_id, 'container2');

-- 3. TEXT attributes
INSERT INTO catalog_product_entity_text (entity_type_id, attribute_id, store_id, entity_id, value) VALUES
    (4, 61, 0, @new_id, @description),
    (4, 62, 0, @new_id, @short_description),
    (4, 707, 0, @new_id, 'INDEX, FOLLOW');

-- 4. INT attributes
INSERT INTO catalog_product_entity_int (entity_type_id, attribute_id, store_id, entity_id, value) VALUES
    (4, 84, 0, @new_id, 1),          -- status
    (4, 89, 0, @new_id, 1),          -- visibility
    (4, 85, 0, @new_id, @tax_class_id),
    (4, 580, 0, @new_id, 426),       -- price_unit
    (4, 751, 0, @new_id, 2879),      -- odoo_product_type
    (4, 568, 0, @new_id, 0);         -- is_imported

-- 5. DECIMAL attributes
INSERT INTO catalog_product_entity_decimal (entity_type_id, attribute_id, store_id, entity_id, value) VALUES
    (4, 64, 0, @new_id, @price),
    (4, 68, 0, @new_id, @cost);

-- 6. SUPER ATTRIBUTE (MAKES IT CONFIGURABLE!)
INSERT INTO catalog_product_super_attribute (product_id, attribute_id, position) VALUES (@new_id, 525, 0);
SET @super_attr_id = LAST_INSERT_ID();

-- 7. Super attribute labels
INSERT INTO catalog_product_super_attribute_label (product_super_attribute_id, store_id, use_default, value) VALUES
    (@super_attr_id, 0, 0, 'Date'),
    (@super_attr_id, 4, 0, 'Date'),
    (@super_attr_id, 6, 0, 'Date');

-- 8. Category assignments (parse comma-separated)
INSERT INTO catalog_category_product (category_id, product_id, position)
SELECT TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(@category_ids, ',', n.n), ',', -1)), @new_id, 1
FROM (SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
      UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10) n
WHERE n.n <= 1 + LENGTH(@category_ids) - LENGTH(REPLACE(@category_ids, ',', ''));

-- 9. Website
INSERT INTO catalog_product_website (product_id, website_id) VALUES (@new_id, @website_id);

-- 10. Stock
INSERT INTO cataloginventory_stock_item (product_id, stock_id, qty, is_in_stock, manage_stock, use_config_manage_stock)
VALUES (@new_id, 1, 0, 1, 0, 1);

-- 11. Stock status
INSERT INTO cataloginventory_stock_status (product_id, website_id, stock_id, qty, stock_status)
VALUES (@new_id, @website_id, 1, 0, 1);

-- 12. Price index
INSERT INTO catalog_product_index_price (entity_id, customer_group_id, website_id, tax_class_id, price, final_price, min_price, max_price) VALUES 
    (@new_id, 0, 1, @tax_class_id, @price, @price, @price, @price),
    (@new_id, 1, 1, @tax_class_id, @price, @price, @price, @price),
    (@new_id, 2, 1, @tax_class_id, @price, @price, @price, @price),
    (@new_id, 4, 1, @tax_class_id, @price, @price, @price, @price),
    (@new_id, 5, 1, @tax_class_id, @price, @price, @price, @price),
    (@new_id, 6, 1, @tax_class_id, @price, @price, @price, @price),
    (@new_id, 7, 1, @tax_class_id, @price, @price, @price, @price),
    (@new_id, 8, 1, @tax_class_id, @price, @price, @price, @price),
    (@new_id, 9, 1, @tax_class_id, @price, @price, @price, @price);

-- 13. URL rewrites
INSERT INTO core_url_rewrite (store_id, category_id, product_id, id_path, request_path, target_path, is_system) VALUES
    (4, NULL, @new_id, CONCAT('product/', @new_id), @url_path, CONCAT('catalog/product/view/id/', @new_id), 1),
    (6, NULL, @new_id, CONCAT('product/', @new_id, '/6'), @url_path, CONCAT('catalog/product/view/id/', @new_id), 1);

COMMIT;

SELECT @new_id AS 'id', @sku AS 'sku', @name AS 'name';
```

---

## CREATE Course Event (Simple)

### Required Input Fields

| Field | Type | Description |
|-------|------|-------------|
| courseId | int | Parent configurable entity_id |
| dateTime | string | ISO datetime (2026-03-15T18:00:00) |
| capacity | int | Number of seats |

### Optional Input Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| duration | int | 180 | Duration in minutes |
| price | decimal | parent price | Override price |

### SQL Query

```sql
-- INPUT
SET @parent_id = ?;
SET @date_time = ?;        -- '2026-03-15T18:00:00'
SET @capacity = ?;
SET @duration = IFNULL(?, 180);
SET @input_price = ?;      -- NULL = use parent price

-- EXTRACT DATE/TIME
SET @event_date = DATE_FORMAT(STR_TO_DATE(@date_time, '%Y-%m-%dT%H:%i:%s'), '%Y-%m-%d');
SET @begin_time = DATE_FORMAT(STR_TO_DATE(@date_time, '%Y-%m-%dT%H:%i:%s'), '%H:%i');
SET @end_time = DATE_FORMAT(DATE_ADD(STR_TO_DATE(@date_time, '%Y-%m-%dT%H:%i:%s'), INTERVAL @duration MINUTE), '%H:%i');

-- GET PARENT DATA
SET @attribute_set_id = (SELECT attribute_set_id FROM catalog_product_entity WHERE entity_id = @parent_id);
SET @parent_sku = (SELECT sku FROM catalog_product_entity WHERE entity_id = @parent_id);
SET @parent_name = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 60 AND store_id = 0);
SET @operator_id = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 700 AND store_id = 0);
SET @location = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 578 AND store_id = 0);
SET @tax_class_id = (SELECT value FROM catalog_product_entity_int WHERE entity_id = @parent_id AND attribute_id = 85 AND store_id = 0);
SET @parent_price = (SELECT value FROM catalog_product_entity_decimal WHERE entity_id = @parent_id AND attribute_id = 64 AND store_id = 0);
SET @price = IFNULL(@input_price, @parent_price);

-- Additional parent attributes
SET @keyword = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 590 AND store_id = 0);
SET @subtitle = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 548 AND store_id = 0);
SET @description = (SELECT value FROM catalog_product_entity_text WHERE entity_id = @parent_id AND attribute_id = 61 AND store_id = 0);
SET @short_description = (SELECT value FROM catalog_product_entity_text WHERE entity_id = @parent_id AND attribute_id = 62 AND store_id = 0);
SET @parent_urlpath = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 87 AND store_id = 0);
SET @parent_image = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 74 AND store_id = 0);
SET @parent_image_label = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 99 AND store_id = 0);
SET @participants = (SELECT value FROM catalog_product_entity_varchar WHERE entity_id = @parent_id AND attribute_id = 588 AND store_id = 0);

SET @parent_cat_ids = (SELECT GROUP_CONCAT(category_id ORDER BY category_id) FROM catalog_category_product WHERE product_id = @parent_id);
SET @website_id = (SELECT website_id FROM catalog_product_website WHERE product_id = @parent_id LIMIT 1);

-- Find or create date option
SET @date_formatted = @event_date;
SET @existing_date_option = (
    SELECT ao.option_id FROM eav_attribute_option ao
    JOIN eav_attribute_option_value aov ON ao.option_id = aov.option_id
    WHERE ao.attribute_id = 525 AND aov.value = @date_formatted LIMIT 1
);

SET @is_weekend = (DAYOFWEEK(STR_TO_DATE(@event_date, '%Y-%m-%d')) IN (1, 7));

-- Generate SKU and name
SET @sku = CONCAT(@parent_sku, '-', @begin_time, '-', @event_date);
SET @name = CONCAT(@parent_name, '-', @event_date);
SET @url_key = LOWER(REPLACE(REPLACE(@name, ' ', '-'), 'ü', 'ue'));
SET @url_path = CONCAT(@url_key, '/');
SET @image_url = CONCAT('https://www.miomente.de/media/catalog/product/cache/0/small_image/848x/040ec09b1e35df139433887a97daa66f', @parent_image);

START TRANSACTION;

-- Create date option if not exists
SET @date_option_id = @existing_date_option;
IF @date_option_id IS NULL THEN
    INSERT INTO eav_attribute_option (attribute_id, sort_order) VALUES (525, 0);
    SET @date_option_id = LAST_INSERT_ID();
    INSERT INTO eav_attribute_option_value (option_id, store_id, value) VALUES (@date_option_id, 0, @date_formatted);
END IF;

-- 1. Main entity
INSERT INTO catalog_product_entity (entity_type_id, attribute_set_id, type_id, sku, created_at, updated_at)
VALUES (4, @attribute_set_id, 'simple', @sku, NOW(), NOW());
SET @new_id = LAST_INSERT_ID();

-- 2. VARCHAR attributes
INSERT INTO catalog_product_entity_varchar (entity_type_id, attribute_id, store_id, entity_id, value) VALUES
    (4, 60, 0, @new_id, @name),
    (4, 700, 0, @new_id, @operator_id),
    (4, 717, 0, @new_id, @begin_time),
    (4, 718, 0, @new_id, @end_time),
    (4, 720, 0, @new_id, @capacity),
    (4, 578, 0, @new_id, @location),
    (4, 590, 0, @new_id, @keyword),
    (4, 548, 0, @new_id, @subtitle),
    (4, 588, 0, @new_id, @participants),
    (4, 86, 0, @new_id, @url_key),
    (4, 87, 0, @new_id, @url_path),
    (4, 564, 0, @new_id, '2'),
    (4, 565, 0, @new_id, '4'),
    (4, 96, 0, @new_id, 'container2');

-- 3. TEXT attributes
INSERT INTO catalog_product_entity_text (entity_type_id, attribute_id, store_id, entity_id, value) VALUES
    (4, 61, 0, @new_id, @description),
    (4, 62, 0, @new_id, @short_description);

-- 4. INT attributes (including dates!)
INSERT INTO catalog_product_entity_int (entity_type_id, attribute_id, store_id, entity_id, value) VALUES
    (4, 525, 0, @new_id, @date_option_id),  -- dates dropdown!
    (4, 84, 0, @new_id, 1),
    (4, 89, 0, @new_id, 1),
    (4, 85, 0, @new_id, @tax_class_id),
    (4, 568, 0, @new_id, 0);

-- 5. DECIMAL attributes
INSERT INTO catalog_product_entity_decimal (entity_type_id, attribute_id, store_id, entity_id, value)
VALUES (4, 64, 0, @new_id, @price);

-- 6. Link to parent
INSERT INTO catalog_product_super_link (product_id, parent_id) VALUES (@new_id, @parent_id);

-- 7. Product relation
INSERT INTO catalog_product_relation (parent_id, child_id) VALUES (@parent_id, @new_id);

-- 8. Website
INSERT INTO catalog_product_website (product_id, website_id) VALUES (@new_id, @website_id);

-- 9. Stock
INSERT INTO cataloginventory_stock_item (product_id, stock_id, qty, is_in_stock, manage_stock, use_config_manage_stock)
VALUES (@new_id, 1, @capacity, 1, 0, 1);

-- 10. Stock status
INSERT INTO cataloginventory_stock_status (product_id, website_id, stock_id, qty, stock_status)
VALUES (@new_id, @website_id, 1, @capacity, 1);

-- 11. WISHDATEFINDER INDEX (CRITICAL FOR VISIBILITY!)
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

-- 12. Price index
INSERT INTO catalog_product_index_price (entity_id, customer_group_id, website_id, tax_class_id, price, final_price, min_price, max_price) VALUES 
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

SELECT @new_id AS 'id', @parent_id AS 'courseId', @date_time AS 'dateTime', @capacity AS 'capacity', @price AS 'price';
```

---

## DELETE Operations

### Delete Course Event (Simple Product)

```sql
SET @event_id = ?;
SET @customer_number = ?;

-- Verify ownership first!
SELECT COUNT(*) INTO @authorized
FROM catalog_product_entity AS cpe
INNER JOIN catalog_product_super_link AS link ON cpe.entity_id = link.product_id
INNER JOIN catalog_product_entity AS parent ON link.parent_id = parent.entity_id
INNER JOIN catalog_product_entity_varchar AS cpev_operator 
    ON parent.entity_id = cpev_operator.entity_id AND cpev_operator.attribute_id = 700
INNER JOIN miomente_pdf_operator AS op ON cpev_operator.value = op.operator_id
WHERE cpe.entity_id = @event_id AND op.customernumber = @customer_number;

-- Only if @authorized > 0:
DELETE FROM catalog_product_entity_varchar WHERE entity_id = @event_id;
DELETE FROM catalog_product_entity_text WHERE entity_id = @event_id;
DELETE FROM catalog_product_entity_int WHERE entity_id = @event_id;
DELETE FROM catalog_product_entity_decimal WHERE entity_id = @event_id;
DELETE FROM catalog_product_super_link WHERE product_id = @event_id;
DELETE FROM catalog_product_relation WHERE child_id = @event_id;
DELETE FROM catalog_product_website WHERE product_id = @event_id;
DELETE FROM cataloginventory_stock_item WHERE product_id = @event_id;
DELETE FROM cataloginventory_stock_status WHERE product_id = @event_id;
DELETE FROM catalog_product_index_price WHERE entity_id = @event_id;
DELETE FROM miomente_wishdatefinder_index WHERE simple_product_id = @event_id;
DELETE FROM core_url_rewrite WHERE product_id = @event_id;
DELETE FROM catalog_product_entity WHERE entity_id = @event_id;
```

---

## Critical Tables for Visibility

### Why Products Don't Appear on Frontend

If a product exists in the database but doesn't show on the website, check these tables:

| Table | Issue | Solution |
|-------|-------|----------|
| `miomente_wishdatefinder_index` | Missing entries | Insert for store_id 4 AND 6 |
| `catalog_product_index_price` | No price index | Insert for all 9 customer groups |
| `catalog_product_entity_int` (dates=525) | No date option selected | Insert with valid option_id |
| `catalog_product_super_link` | Not linked to parent | Insert link |
| `catalog_product_website` | Not assigned to website | Insert website_id=1 |

### miomente_wishdatefinder_index Structure

This custom table is **CRITICAL** for course dates to appear on the frontend:

| Field | Type | Description |
|-------|------|-------------|
| id | int | Auto-increment |
| simple_product_id | int | Simple product entity_id |
| simple_product_date | date | Event date |
| simple_product_price | float | Price |
| simple_product_seats | int | Capacity |
| configurable_product_id | int | Parent course entity_id |
| configurable_product_name | varchar(100) | Course name |
| configurable_product_subtitle | varchar(255) | Subtitle |
| configurable_product_cat_ids | varchar(100) | Category IDs |
| configurable_product_urlpath | varchar(100) | URL path |
| configurable_product_image | varchar(255) | Full image URL |
| configurable_product_imagelabel | varchar(100) | Image alt |
| configurable_product_operator_id | int | Operator ID |
| configurable_product_location | varchar(255) | Location |
| store_id | int | Store ID (4 or 6) |
| we | int | Weekend flag (1=Sat/Sun) |
| updated | datetime | Last update |

**Important:** Insert TWO rows per simple product (store_id 4 AND 6)!

---

## Data Formats

### SKU Formats

| Type | Format | Example |
|------|--------|---------|
| Configurable | `9-3-{customernumber}-{XX}` | `9-3-126734-31` |
| Simple | `{parent_sku}-{HH:MM}-{YYYY-MM-DD}` | `9-3-126734-31-18:00-2026-03-15` |

### Name Formats

| Type | Format | Example |
|------|--------|---------|
| Configurable | `{Course Title}` | `Veganes Korea` |
| Simple | `{Course Title}-{YYYY-MM-DD}` | `Veganes Korea-2026-03-15` |

### DateTime Extraction from Simple Product Name

```sql
-- Extract date from name: "Veganes Korea-2026-03-15"
SUBSTRING_INDEX(name, '-', -3)  -- Returns: "2026-03-15"

-- Combine with begin time for full datetime:
CONCAT(SUBSTRING_INDEX(name, '-', -3), 'T', begin_time, ':00Z')
-- Returns: "2026-03-15T18:00:00Z"
```

---

## API Reference

### Courses (Configurable Products)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses?customerNumber=X` | List all courses |
| GET | `/courses/:id?customerNumber=X` | Get single course |
| POST | `/courses` | Create new course |
| DELETE | `/courses/:id?customerNumber=X` | Delete course + all events |

### Events (Simple Products)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:courseId/events?customerNumber=X` | List events for course |
| GET | `/events/:id?customerNumber=X` | Get single event |
| POST | `/courses/:courseId/events` | Create new event |
| DELETE | `/events/:id?customerNumber=X` | Delete event |

---

## Important Notes

1. **Always verify ownership** via `customernumber` before write operations
2. **entity_type_id = 4** for all product EAV queries
3. **store_id = 0** for default/global attribute values
4. **Two wishdatefinder entries** required per simple product (store 4 and 6)
5. **Nine price index entries** required per product (customer groups 0,1,2,4,5,6,7,8,9)
6. **Super attribute (525)** makes configurable products work
7. **Date option must exist** in `eav_attribute_option` before assigning to simple product
8. **Transactions recommended** for multi-table INSERT operations