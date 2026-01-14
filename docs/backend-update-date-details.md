# Backend Implementation: Update Date Details

## Overview

This document describes the backend implementation required for the **inline editing of date, time, and duration** feature in the course editor.

---

## API Endpoint

### Action: `update-date-details`

**Route:** `POST /api/proxy?action=update-date-details`

**Purpose:** Update the date/time and/or duration of an existing course date.

---

## Request

### Headers

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer <token>` | Yes |
| `Content-Type` | `application/json` | Yes |

### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_id` | `number` | Yes | The ID of the course date to update |
| `dateTime` | `string` | No | New date/time in ISO format (e.g., `2024-03-15T10:00:00`) |
| `duration` | `number` | No | Duration in minutes |

**Note:** At least one of `dateTime` or `duration` should be provided.

### Example Request

```json
{
  "date_id": 123,
  "dateTime": "2024-03-15T14:30:00",
  "duration": 120
}
```

---

## Response

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true
}
```

### Error Responses

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "date_id is required"
}
```

**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Date not found"
}
```

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

## n8n Webhook Implementation

### Workflow Steps

1. **Receive Webhook**
   - Method: POST
   - Authentication: Bearer token validation

2. **Extract Parameters**
   ```javascript
   const date_id = $json.body.date_id;
   const dateTime = $json.body.dateTime;  // optional
   const duration = $json.body.duration;  // optional
   ```

3. **Validate Input**
   - Check `date_id` is provided and is a valid number
   - Check at least one of `dateTime` or `duration` is provided

4. **Build Update Query**
   - Only update fields that are provided
   - Example SQL:
   ```sql
   UPDATE course_dates
   SET
     date_time = COALESCE(:dateTime, date_time),
     duration = COALESCE(:duration, duration),
     updated_at = NOW()
   WHERE id = :date_id
   ```

5. **Return Response**
   - Success: `{ "success": true }`
   - Error: `{ "success": false, "message": "Error description" }`

---

## Database Schema Reference

The `course_dates` table should have (at minimum):

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Primary key |
| `course_id` | INT | Foreign key to courses table |
| `date_time` | DATETIME | The date and start time of the course |
| `duration` | INT | Duration in minutes |
| `capacity` | INT | Maximum number of participants |
| `price` | DECIMAL | Price for this specific date |
| `booked` | INT | Number of booked seats |

---

## Security Considerations

1. **Authentication**: Verify the Bearer token is valid
2. **Authorization**: Ensure the user has permission to edit this date (e.g., partner owns the course)
3. **Validation**:
   - `date_id` must be a positive integer
   - `dateTime` must be a valid ISO date string
   - `duration` must be a positive integer (minutes)

---

## Frontend Integration

The frontend sends requests from:
- **File:** `src/lib/api.ts`
- **Function:** `updateDateDetails(dateId, data)`

```typescript
updateDateDetails: async (dateId: number, data: { dateTime?: string; duration?: number }): Promise<void> => {
  await axios.post(API_URL, { date_id: dateId, ...data }, {
    ...getAuthConfig(),
    params: { action: 'update-date-details' }
  });
}
```

---

## Testing Checklist

- [ ] Update only `dateTime` - verify date changes, duration unchanged
- [ ] Update only `duration` - verify duration changes, date unchanged
- [ ] Update both `dateTime` and `duration` together
- [ ] Invalid `date_id` returns 404
- [ ] Missing `date_id` returns 400
- [ ] Unauthorized request returns 401
- [ ] Partner can only update their own course dates
