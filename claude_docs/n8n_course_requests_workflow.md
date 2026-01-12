# N8N Workflow Updates for Course Requests Feature

This document describes the changes needed in the n8n workflow to support the new course request feature for the Partners Portal.

## Overview

The new feature allows:
1. **Partners** to submit course requests (simplified form)
2. **Managers** to review, approve, or reject requests
3. **Managers** to create full courses from approved requests
4. Email notifications for status changes
5. Odoo ticket creation for new requests

## Database Schema for Course Requests

You'll need to create a new table in Supabase (or your preferred database) to store course requests:

```sql
CREATE TABLE course_requests (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER NOT NULL,
    partner_name VARCHAR(255) NOT NULL,
    partner_email VARCHAR(255) NOT NULL,

    -- Course info from partner
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    partner_description TEXT NOT NULL,
    requested_dates JSONB, -- Array of { dateTime, duration, capacity, customPrice? }

    -- Status and manager fields
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, in_moderation, approved, rejected
    rejection_reason TEXT,
    rejection_recommendations TEXT,
    manager_notes TEXT,
    created_course_id INTEGER,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_course_requests_partner_id ON course_requests(partner_id);
CREATE INDEX idx_course_requests_status ON course_requests(status);
```

## New API Endpoints

### 1. Create Course Request (Partner)

**Action:** `create-course-request`
**Method:** POST
**Auth:** Required (Bearer token)

**Request Body:**
```json
{
    "name": "Veganes Sushi Workshop",
    "location": "München",
    "basePrice": 79.00,
    "partnerDescription": "Ein Workshop für veganes Sushi...",
    "requestedDates": [
        {
            "dateTime": "2024-04-15T18:00:00Z",
            "duration": 180,
            "capacity": 10,
            "customPrice": 89.00
        }
    ]
}
```

**N8N Node Configuration:**

```javascript
// 1. Extract partner info from JWT token
const token = $input.first().headers.authorization?.replace('Bearer ', '');
const partnerInfo = await getPartnerFromToken(token); // Your existing logic

// 2. Insert into database
const insertQuery = `
    INSERT INTO course_requests (
        partner_id, partner_name, partner_email,
        name, location, base_price, partner_description, requested_dates,
        status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    RETURNING *
`;

const values = [
    partnerInfo.id,
    partnerInfo.name,
    partnerInfo.email,
    $input.first().json.name,
    $input.first().json.location,
    $input.first().json.basePrice,
    $input.first().json.partnerDescription,
    JSON.stringify($input.first().json.requestedDates || [])
];

// 3. Return created request
return {
    id: result.id,
    partnerId: result.partner_id,
    partnerName: result.partner_name,
    partnerEmail: result.partner_email,
    name: result.name,
    location: result.location,
    basePrice: result.base_price,
    partnerDescription: result.partner_description,
    requestedDates: result.requested_dates,
    status: result.status,
    createdAt: result.created_at,
    updatedAt: result.updated_at
};
```

**After Insert - Create Odoo Ticket:**

```javascript
// Create Odoo ticket for new course request
const odooPayload = {
    name: `Neue Kursanfrage: ${request.name}`,
    description: `
Partner: ${request.partnerName} (${request.partnerEmail})
Kursname: ${request.name}
Standort: ${request.location}
Preis: ${request.basePrice} €

Beschreibung:
${request.partnerDescription}

${request.requestedDates?.length ? `Gewünschte Termine: ${request.requestedDates.length}` : 'Keine Termine angegeben'}
    `,
    partner_id: request.partnerId,
    // Add your Odoo ticket fields here
};

// Call Odoo API to create ticket
```

---

### 2. Get Course Requests

**Action:** `get-course-requests`
**Method:** POST
**Auth:** Required

**Request Body:**
```json
{
    "partner_id": 123  // Optional - if not provided, returns all (for managers)
}
```

**N8N Logic:**
- If user is **partner**: Only return their own requests (filtered by partner_id from token)
- If user is **manager**: Return all requests or filter by partner_id if provided

```javascript
const userRole = getUserRoleFromToken(token);
const partnerId = $input.first().json.partner_id;

let query;
if (userRole === 'manager') {
    query = partnerId
        ? `SELECT * FROM course_requests WHERE partner_id = $1 ORDER BY created_at DESC`
        : `SELECT * FROM course_requests ORDER BY created_at DESC`;
} else {
    // Partner can only see their own requests
    const partnerIdFromToken = getPartnerIdFromToken(token);
    query = `SELECT * FROM course_requests WHERE partner_id = $1 ORDER BY created_at DESC`;
}

// Map database fields to camelCase for frontend
```

---

### 3. Get Single Course Request

**Action:** `get-course-request`
**Method:** POST
**Auth:** Required

**Request Body:**
```json
{
    "request_id": 123
}
```

**N8N Logic:**
- Partners can only access their own requests
- Managers can access any request

---

### 4. Update Course Request Status (Manager Only)

**Action:** `update-course-request-status`
**Method:** POST
**Auth:** Required (Manager role)

**Request Body:**
```json
{
    "request_id": 123,
    "status": "in_moderation",  // or "approved" or "rejected"
    "rejectionReason": "Equipment nicht verfügbar",
    "rejectionRecommendations": "Bitte prüfen Sie...",
    "managerNotes": "Internal note"
}
```

**N8N Node Configuration:**

```javascript
// 1. Verify manager role
const userRole = getUserRoleFromToken(token);
if (userRole !== 'manager') {
    throw new Error('Unauthorized: Manager role required');
}

// 2. Update database
const updateQuery = `
    UPDATE course_requests
    SET
        status = $1,
        rejection_reason = COALESCE($2, rejection_reason),
        rejection_recommendations = COALESCE($3, rejection_recommendations),
        manager_notes = COALESCE($4, manager_notes),
        updated_at = NOW()
    WHERE id = $5
    RETURNING *
`;

const values = [
    $input.first().json.status,
    $input.first().json.rejectionReason,
    $input.first().json.rejectionRecommendations,
    $input.first().json.managerNotes,
    $input.first().json.request_id
];

// 3. Send email notification to partner
```

**Email Notification Logic:**

```javascript
// For rejection
if (status === 'rejected') {
    await sendEmail({
        to: request.partner_email,
        subject: `Kursanfrage abgelehnt: ${request.name}`,
        template: 'course_request_rejected',
        data: {
            partnerName: request.partner_name,
            courseName: request.name,
            rejectionReason: request.rejection_reason,
            recommendations: request.rejection_recommendations
        }
    });
}

// For approval (when course is created)
if (status === 'approved') {
    await sendEmail({
        to: request.partner_email,
        subject: `Kursanfrage genehmigt: ${request.name}`,
        template: 'course_request_approved',
        data: {
            partnerName: request.partner_name,
            courseName: request.name,
            courseId: request.created_course_id
        }
    });
}
```

---

### 5. Create Course from Request (Manager Only)

**Action:** `create-course-from-request`
**Method:** POST
**Auth:** Required (Manager role)

**Request Body:**
```json
{
    "requestId": 123,
    "description": "<p>Full HTML description...</p>",
    "shortDescription": "<p>Short teaser...</p>",
    "subtitle": "Authentische japanische Küche",
    "beginTime": "18:00",
    "endTime": "21:00",
    "seats": "10",
    "participants": "2-10 Personen",
    "categoryIds": "3,20,69,95",
    "keyword": "sushi veganes",
    "metaTitle": "Veganes Sushi Workshop",
    "metaDescription": "Lernen Sie veganes Sushi...",
    "image": "/path/to/image.jpg"
}
```

**N8N Node Configuration:**

This is the most complex endpoint. It needs to:
1. Get the course request from database
2. Create the configurable product in Magento using the SQL from `magento_catalog_courses_database_structure_summary.md`
3. If the request has dates, create simple products for each date
4. Update the request status to 'approved' with the created course ID
5. Send email notification to partner

```javascript
// Step 1: Get the request
const request = await getRequestById($input.first().json.requestId);

// Step 2: Get operator info
const operatorId = await getOperatorIdForPartner(request.partner_id);

// Step 3: Create configurable product
const createCourseQuery = `
    -- Use the SQL from magento_catalog_courses_database_structure_summary.md
    -- Section: CREATE Course (Configurable)

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
    SET @category_ids = ?;
    -- ... rest of the query
`;

const courseParams = [
    operatorId,
    request.name,
    $input.first().json.subtitle,
    $input.first().json.description,
    $input.first().json.shortDescription,
    request.base_price,
    request.location,
    $input.first().json.beginTime,
    $input.first().json.endTime,
    $input.first().json.seats,
    $input.first().json.participants,
    $input.first().json.categoryIds
];

const newCourse = await executeMagentoQuery(createCourseQuery, courseParams);

// Step 4: Create dates if any were requested
if (request.requested_dates && request.requested_dates.length > 0) {
    for (const date of request.requested_dates) {
        // Use CREATE Course Event (Simple) SQL from the same doc
        await createCourseDate(newCourse.id, date);
    }
}

// Step 5: Update request status
await updateRequestStatus(request.id, 'approved', newCourse.id);

// Step 6: Send approval email
await sendApprovalEmail(request.partner_email, request.name, newCourse.id);

// Step 7: Return the created course
return {
    id: newCourse.id,
    title: request.name,
    sku: newCourse.sku,
    status: 'active',
    description: $input.first().json.description,
    basePrice: request.base_price,
    location: request.location,
    image: $input.first().json.image || 'no_selection'
};
```

---

### 6. Get Partners (Manager Only)

**Action:** `get-partners`
**Method:** POST
**Auth:** Required (Manager role)

**Response:**
```json
[
    {
        "id": 1,
        "name": "Hans Mueller",
        "email": "hans@example.com",
        "companyName": "Food Atlas GmbH",
        "coursesCount": 5,
        "pendingRequestsCount": 2
    }
]
```

**N8N Query:**
```sql
SELECT
    o.operator_id as id,
    o.partnername as name,
    o.contact_email as email,
    o.name as company_name,
    (SELECT COUNT(*) FROM catalog_product_entity cpe
     INNER JOIN catalog_product_entity_varchar cpev
     ON cpe.entity_id = cpev.entity_id AND cpev.attribute_id = 700
     WHERE cpev.value = CAST(o.operator_id AS CHAR) AND cpe.type_id = 'configurable'
    ) as courses_count,
    (SELECT COUNT(*) FROM course_requests cr
     WHERE cr.partner_id = o.operator_id AND cr.status = 'pending'
    ) as pending_requests_count
FROM miomente_pdf_operator o
WHERE o.status = 1
ORDER BY o.name;
```

---

### 7. Get Partner Courses (Manager Only)

**Action:** `get-partner-courses`
**Method:** POST
**Auth:** Required (Manager role)

**Request Body:**
```json
{
    "partner_id": 123
}
```

Uses the existing `get-courses` query but filtered by partner_id instead of customer_number from token.

---

## Login Endpoint Updates

The login endpoint needs to return the user role:

```javascript
// After successful authentication
return {
    email: user.email,
    name: user.name,
    token: generatedToken,
    role: user.is_manager ? 'manager' : 'partner',
    partnerId: user.partner_id,       // For partners
    partnerName: user.partner_name    // For partners
};
```

You'll need to add a `role` or `is_manager` field to your users table:

```sql
ALTER TABLE users ADD COLUMN is_manager BOOLEAN DEFAULT FALSE;
```

---

## Email Templates

### Course Request Rejected Template

**Subject:** `Kursanfrage abgelehnt: {{courseName}}`

```html
<h1>Ihre Kursanfrage wurde abgelehnt</h1>

<p>Sehr geehrte/r {{partnerName}},</p>

<p>leider müssen wir Ihnen mitteilen, dass Ihre Kursanfrage für
"<strong>{{courseName}}</strong>" nicht genehmigt werden konnte.</p>

<h3>Ablehnungsgrund:</h3>
<p>{{rejectionReason}}</p>

{{#if recommendations}}
<h3>Unsere Empfehlungen:</h3>
<p>{{recommendations}}</p>
{{/if}}

<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>

<p>Mit freundlichen Grüßen,<br>
Ihr Miomente Team</p>
```

### Course Request Approved Template

**Subject:** `Kursanfrage genehmigt: {{courseName}}`

```html
<h1>Ihre Kursanfrage wurde genehmigt!</h1>

<p>Sehr geehrte/r {{partnerName}},</p>

<p>wir freuen uns, Ihnen mitteilen zu können, dass Ihre Kursanfrage für
"<strong>{{courseName}}</strong>" genehmigt wurde!</p>

<p>Ihr Kurs ist jetzt im System angelegt und kann im Partner Portal
eingesehen und verwaltet werden.</p>

<p><a href="{{portalUrl}}/dashboard/editor/{{courseId}}">Kurs im Portal ansehen</a></p>

<p>Mit freundlichen Grüßen,<br>
Ihr Miomente Team</p>
```

---

## Webhook Router Update

Add the new actions to your webhook router node:

```javascript
const action = $input.first().query.action;

switch(action) {
    // Existing actions...
    case 'login':
    case 'get-courses':
    case 'get-course':
    case 'update-course':
    case 'create-course':
    case 'get-dates':
    case 'create-date':
    case 'delete-date':
    case 'update-date':
    case 'change-password':
    case 'reset-password':
    case 'verify-reset-token':
    case 'set-new-password':
    case 'contact':

    // NEW actions for course requests
    case 'create-course-request':
        return routeToNode('Create Course Request');
    case 'get-course-requests':
        return routeToNode('Get Course Requests');
    case 'get-course-request':
        return routeToNode('Get Single Course Request');
    case 'update-course-request-status':
        return routeToNode('Update Request Status');
    case 'create-course-from-request':
        return routeToNode('Create Course From Request');
    case 'get-partners':
        return routeToNode('Get Partners');
    case 'get-partner':
        return routeToNode('Get Single Partner');
    case 'get-partner-courses':
        return routeToNode('Get Partner Courses');

    default:
        throw new Error(`Unknown action: ${action}`);
}
```

---

## Security Considerations

1. **Role-based access control**: All manager-only endpoints should verify the user role from the JWT token
2. **Partner isolation**: Partners should only be able to access their own data
3. **Input validation**: Validate all input data before database operations
4. **Rate limiting**: Consider adding rate limits for course request creation

---

## Testing

### Test Partner Account
- Email: `demo@miomente.com`
- Password: `demo`
- Role: `partner`

### Test Manager Account
- Email: `manager@miomente.com`
- Password: `manager`
- Role: `manager`

In mock mode, these credentials work automatically. For production, you'll need to set up actual user accounts with the appropriate roles.
