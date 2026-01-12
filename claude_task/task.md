# Fix: Add `name` column to course_requests table

The course requests API is returning data without the `name` field.

## Problem
The response doesn't include `name`:
```json
{
  "id": 10,
  "location": "Odessa",
  "basePrice": 59,
  "partnerDescription": "desc...",
  "status": "pending",
  // missing: "name": "Course Title"
}
```

## Solution

### 1. Check if column exists in PostgreSQL/Supabase:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'course_requests' AND column_name = 'name';
```

### 2. If missing, add the column:
```sql
ALTER TABLE course_requests ADD COLUMN name VARCHAR(255);
```

### 3. Update existing records:
```sql
UPDATE course_requests SET name = 'Untitled Course' WHERE name IS NULL;
```

### 4. Verify n8n SELECT query includes all columns:
The query should be `SELECT *` or explicitly include `name`:
```sql
SELECT
    id,
    customer_number as "partnerId",
    partner_name as "partnerName",
    partner_email as "partnerEmail",
    name,  -- Make sure this is included!
    location,
    base_price as "basePrice",
    partner_description as "partnerDescription",
    requested_dates as "requestedDates",
    status,
    rejection_reason as "rejectionReason",
    rejection_recommendations as "rejectionRecommendations",
    manager_notes as "managerNotes",
    created_course_id as "createdCourseId",
    created_at as "createdAt",
    updated_at as "updatedAt"
FROM course_requests
ORDER BY created_at DESC;
```

### 5. Check n8n JSON transformation
If there's a Code node that transforms the response, make sure it includes `name`:
```javascript
return items.map(item => ({
  ...item.json,
  name: item.json.name,  // Include this!
}));
```
