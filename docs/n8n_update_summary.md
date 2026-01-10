# n8n Backend Process Update Summary

## File Location
- Input: D:Projectsmiomente_partners_portal_gemdocs
8n_backend_process.json
- Output: D:Projectsmiomente_partners_portal_gemdocs
8n_backend_process_updated.json

## Changes Applied

### 1. Modified SQL Query in "get events by base course" Node
**Node ID:** 771a8eed-a9ef-453a-b035-1aeca9460c85

**Added JOIN clause:**
```sql
-- Price for this simple product (date)
LEFT JOIN catalog_product_entity_decimal AS cpd_simple_price
    ON simple.entity_id = cpd_simple_price.entity_id
    AND cpd_simple_price.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4)
    AND cpd_simple_price.store_id = 0
```

**Added SELECT field:**
```sql
ROUND(cpd_simple_price.value, 2) AS 'price',
```
(Added after the duration field)

### 2. Added "update-date" Route to "Route by Action" Switch
- Position: After "delete-date", before "contact"
- Total routes: 11
- Route matches: `body.action === 'update-date'`

### 3. Added "update-date" Route to "Protected Route Switch"
- Position: After "delete-date", before "contact"
- Total routes: 9
- Route matches: `body.action === 'update-date'`

### 4. Created "Update Date SQL" MySQL Node
**Node Name:** Update Date SQL
**Node ID:** update-date-sql-node-001
**Type:** n8n-nodes-base.mySql v2.4

**SQL Query:**
```sql
UPDATE catalog_product_entity_decimal 
SET value = {{ $('Webhook').item.json.body.price }}
WHERE entity_id = {{ $('Webhook').item.json.body.date_id }}
  AND attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4)
  AND store_id = 0;
```

### 5. Created "Update Date Response" Node
**Node Name:** Update Date Response
**Node ID:** update-date-response-node-001
**Type:** n8n-nodes-base.respondToWebhook v1.1

**Response:**
```json
{
  "success": true,
  "message": "Date updated successfully"
}
```

### 6. Node Connections
- Protected Route Switch (update-date output) → Update Date SQL
- Update Date SQL → Update Date Response

## Statistics
- Total nodes: 48
- File size: 67.53 KB

## Usage
The update-date endpoint can now be called with:
```json
{
  "action": "update-date",
  "date_id": 12345,
  "price": 99.99
}
```

This will:
1. Route through Protected Route Switch to update-date branch
2. Execute SQL to update the price for the specified date_id
3. Return success response
