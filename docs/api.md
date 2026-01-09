# API Documentation

## Overview

This application uses a proxy-based architecture where all API requests are routed through `/api/proxy` which forwards them to an n8n backend service. The proxy expects an `action` query parameter to determine which operation to perform.

All API requests use the `POST` method and send data in JSON format.

## Base URL

```
/api/proxy
```

## Authentication

Most endpoints (except `login` and `reset-password`) require Bearer token authentication.

**Header Format:**
```
Authorization: Bearer <token>
```

The token is returned from the login endpoint and should be included in all subsequent requests.

---

## Endpoints

### 1. Login

Authenticate a user with email and password.

**Action:** `login`

**URL:** `POST /api/proxy?action=login`

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "userpassword"
}
```

**Response:**
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "token": "jwt-token-string"
}
```

**Response Type:** `User`
```typescript
interface User {
  email: string;
  name: string;
  token?: string;
}
```

---

### 2. Get All Courses

Retrieve a list of all courses.

**Action:** `get-courses`

**URL:** `POST /api/proxy?action=get-courses`

**Authentication:** Required

**Request Body:**
```json
{}
```

**Response:**
```json
[
  {
    "id": 1,
    "title": "Course Title",
    "sku": "COURSE-SKU-001",
    "status": "active",
    "description": "Course description",
    "image": "https://example.com/image.jpg",
    "basePrice": 99.99,
    "available_dates": 5,
    "location": "Course Location"
  }
]
```

**Response Type:** `Course[]`
```typescript
interface Course {
  id: number;
  title: string;
  sku: string;
  status: 'active' | 'inactive';
  description: string;
  image: string;
  basePrice: number;
  available_dates?: number;
  location: string;
}
```

---

### 3. Get Single Course

Retrieve details of a specific course by ID.

**Action:** `get-course`

**URL:** `POST /api/proxy?action=get-course`

**Authentication:** Required

**Request Body:**
```json
{
  "course_id": 1
}
```

**Response:**
```json
{
  "id": 1,
  "title": "Course Title",
  "sku": "COURSE-SKU-001",
  "status": "active",
  "description": "Course description",
  "image": "https://example.com/image.jpg",
  "basePrice": 99.99,
  "available_dates": 5,
  "location": "Course Location"
}
```

**Response Type:** `Course`

---

### 4. Update Course

Create or update a course. If the course ID exists, it updates; otherwise, it creates a new course.

**Action:** `update-course`

**URL:** `POST /api/proxy?action=update-course`

**Authentication:** Required

**Request Body:**
```json
{
  "id": 1,
  "title": "Updated Course Title",
  "sku": "COURSE-SKU-001",
  "status": "active",
  "description": "Updated course description",
  "image": "https://example.com/new-image.jpg",
  "basePrice": 149.99,
  "location": "New Location"
}
```

**Response:**
```json
{
  "id": 1,
  "title": "Updated Course Title",
  "sku": "COURSE-SKU-001",
  "status": "active",
  "description": "Updated course description",
  "image": "https://example.com/new-image.jpg",
  "basePrice": 149.99,
  "location": "New Location"
}
```

**Response Type:** `Course`

**Notes:**
- All fields are required
- `sku`, `location`, and `description` are read-only when editing existing courses
- `status` must be either `'active'` or `'inactive'`
- `basePrice` must be a non-negative number

---

### 5. Get Course Dates

Retrieve all available dates/events for a specific course.

**Action:** `get-dates`

**URL:** `POST /api/proxy?action=get-dates`

**Authentication:** Required

**Request Body:**
```json
{
  "course_id": 1
}
```

**Response:**
```json
[
  {
    "id": 1,
    "courseId": 1,
    "dateTime": "2025-03-15T14:00:00.000Z",
    "capacity": 20,
    "booked": 5,
    "duration": 180
  },
  {
    "id": 2,
    "courseId": 1,
    "dateTime": "2025-03-22T14:00:00.000Z",
    "capacity": 20,
    "booked": 12,
    "duration": 180
  }
]
```

**Response Type:** `CourseDate[]`
```typescript
interface CourseDate {
  id: number;
  courseId: number;
  dateTime: string; // ISO 8601 format
  capacity: number;
  booked: number;
  duration?: number; // Duration in minutes
}
```

---

### 6. Save Course Dates

Create or update dates/events for a specific course. This replaces all existing dates with the new set.

**Action:** `save-dates`

**URL:** `POST /api/proxy?action=save-dates`

**Authentication:** Required

**Request Body:**
```json
{
  "course_id": 1,
  "dates": [
    {
      "id": 1,
      "courseId": 1,
      "dateTime": "2025-03-15T14:00:00.000Z",
      "capacity": 20,
      "booked": 5,
      "duration": 180
    },
    {
      "id": 2,
      "courseId": 1,
      "dateTime": "2025-03-22T14:00:00.000Z",
      "capacity": 25,
      "booked": 0,
      "duration": 180
    }
  ]
}
```

**Response:**
```json
[
  {
    "id": 1,
    "courseId": 1,
    "dateTime": "2025-03-15T14:00:00.000Z",
    "capacity": 20,
    "booked": 5,
    "duration": 180
  },
  {
    "id": 2,
    "courseId": 1,
    "dateTime": "2025-03-22T14:00:00.000Z",
    "capacity": 25,
    "booked": 0,
    "duration": 180
  }
]
```

**Response Type:** `CourseDate[]`

**Notes:**
- `dateTime` must be in ISO 8601 format
- `capacity` must be a positive integer
- `booked` represents the number of bookings already made
- `duration` is optional and represents duration in minutes (read-only when editing)

---

### 7. Change Password

Change the authenticated user's password.

**Action:** `change-password`

**URL:** `POST /api/proxy?action=change-password`

**Authentication:** Required

**Request Body:**
```json
{
  "password": "currentpassword",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

**Notes:**
- The response will include `success: false` if the current password is incorrect
- The new password should meet security requirements

---

### 8. Reset Password

Request a password reset email for a user account.

**Action:** `reset-password`

**URL:** `POST /api/proxy?action=reset-password`

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true
}
```

**Notes:**
- This endpoint sends a password reset email to the provided address
- The response is typically the same regardless of whether the email exists (for security)

---

### 9. Send Contact Message

Send a contact message from the authenticated user.

**Action:** `contact`

**URL:** `POST /api/proxy?action=contact`

**Authentication:** Required

**Request Body:**
```json
{
  "subject": "Support Request",
  "message": "I need help with my course access."
}
```

**Response:**
```json
{
  "success": true
}
```

**Notes:**
- Both `subject` and `message` are required
- The message will be associated with the authenticated user's account

---

## Error Handling

All endpoints may return errors in the following format:

**Client Errors (4xx):**
```json
{
  "error": "Error message describing the issue"
}
```

**Server Errors (5xx):**
```json
{
  "error": "Internal Proxy Error"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (invalid data)
- `401`: Unauthorized (missing or invalid token)
- `404`: Not Found
- `500`: Internal Server Error

---

## Data Types Reference

### User
```typescript
interface User {
  email: string;
  name: string;
  token?: string;
}
```

### Course
```typescript
interface Course {
  id: number;
  title: string;
  sku: string;
  status: 'active' | 'inactive';
  description: string;
  image: string;
  basePrice: number;
  available_dates?: number;
  location: string;
}
```

### CourseDate
```typescript
interface CourseDate {
  id: number;
  courseId: number;
  dateTime: string; // ISO 8601 format (e.g., "2025-03-15T14:00:00.000Z")
  capacity: number;
  booked: number;
  duration?: number; // Duration in minutes
}
```

---

## Mock Mode

The application includes a mock mode for development. When `NEXT_PUBLIC_N8N_API_URL` is not set, all API calls are simulated using local mock data instead of hitting the real backend.

To enable mock mode, simply don't set the `NEXT_PUBLIC_N8N_API_URL` environment variable.

---

## Examples

### Login Example
```javascript
const response = await fetch('/api/proxy?action=login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const user = await response.json();
console.log(user.token); // Use this token for authenticated requests
```

### Get Courses Example
```javascript
const response = await fetch('/api/proxy?action=get-courses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({})
});

const courses = await response.json();
```

### Update Course Example
```javascript
const response = await fetch('/api/proxy?action=update-course', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    id: 1,
    title: 'Updated Title',
    sku: 'COURSE-001',
    status: 'active',
    description: 'Updated description',
    image: 'https://example.com/image.jpg',
    basePrice: 99.99,
    location: 'Location'
  })
});

const updatedCourse = await response.json();
```
