# Task: Multiple Customer Numbers per Partner

**Status:** Planned
**Created:** 2026-01-13
**Priority:** TBD

## Overview

Allow a single partner user to have multiple customer numbers (partner IDs), so they can see and manage courses for several partner accounts from one login.

## Current Architecture

### Database
- `miomente_partner_portal_users` table has single `partner_id` column
- `miomente_pdf_operator` table links `customernumber` to `operator_id`
- Courses linked via product attribute `operator_id` (attribute_id = 700)

### Frontend (src/lib/types.ts)
```typescript
interface User {
  partnerId?: number;      // Single value
  partnerName?: string;
}
```

### n8n Workflow (docs/n8n.json)
All SQL queries filter by single customer number:
```sql
WHERE op.customernumber = {{ $json.customer_number }}
```

Key queries affected:
- `get base courses` (line ~1558)
- `get base course` (line ~1594)
- `get-dates` query (line ~1643)
- Token validation queries

---

## Implementation Plan

### 1. Database Changes

Create new junction table:
```sql
CREATE TABLE miomente_partner_portal_user_customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  customer_number VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES miomente_partner_portal_users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_customer (user_id, customer_number)
);

-- Migrate existing data
INSERT INTO miomente_partner_portal_user_customers (user_id, customer_number)
SELECT id, partner_id FROM miomente_partner_portal_users WHERE partner_id IS NOT NULL;
```

### 2. n8n Backend Changes

#### Login Response
Change from:
```json
{
  "partnerId": 123,
  "partnerName": "Company"
}
```
To:
```json
{
  "partnerIds": [123, 456],
  "partnerNames": ["Company A", "Company B"]
}
```

#### SQL Query Updates

All queries filtering by customer_number need modification:

**Before:**
```sql
WHERE op.customernumber = {{ $json.customer_number }}
```

**After:**
```sql
WHERE op.customernumber IN ({{ $json.customer_numbers.map(c => `'${c}'`).join(',') }})
```

#### Affected n8n Nodes (approximate line numbers in n8n.json):
- [ ] Login flow - return array of customer numbers
- [ ] Token validation - store array in token/session
- [ ] `get base courses` (~line 1558)
- [ ] `get base course` (~line 1594)
- [ ] `get-dates` (~line 1643)
- [ ] `create-date` - validate against any customer number
- [ ] `update-date` - validate against any customer number
- [ ] `delete-date` - validate against any customer number
- [ ] `get-course-requests` - filter by multiple partner IDs

### 3. Frontend Changes

#### src/lib/types.ts
```typescript
interface User {
  email: string;
  name: string;
  token?: string;
  role: UserRole;
  partnerIds?: number[];      // Changed: array
  partnerNames?: string[];    // Changed: array
}
```

#### src/lib/auth.ts
Update AuthState interface to handle arrays.

#### UI Considerations (Optional)
- Option A: Show all courses from all partners combined (simplest)
- Option B: Add dropdown to filter by specific partner
- Option C: Group courses by partner in the dashboard

---

## Complexity Assessment

| Component | Complexity | Estimated Effort |
|-----------|------------|------------------|
| Database schema | Low | 1-2 hours |
| n8n login flow | Low | 1 hour |
| n8n SQL queries | Medium | 4-6 hours |
| Frontend types | Low | 30 min |
| Frontend UI | Low-Medium | 1-3 hours |
| Testing | Medium | 2-3 hours |
| **Total** | **Medium** | **10-16 hours** |

---

## Testing Checklist

- [ ] Partner with single customer number still works
- [ ] Partner with multiple customer numbers sees all courses
- [ ] Course creation works for multi-partner user
- [ ] Date management works for multi-partner user
- [ ] Course requests work for multi-partner user
- [ ] Manager view unaffected
- [ ] Token validation works with multiple customer numbers

---

## Notes

- The `miomente_pdf_operator` table uses `customernumber` field (string)
- Products link to operators via `operator_id` attribute (attribute_id = 700)
- Consider backward compatibility - existing single partnerId users should continue working
