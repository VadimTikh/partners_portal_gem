# API Documentation

This document describes the API routes and expected data structures for the Partner Portal.
All requests are made to `/api/proxy` with a specific `action` query parameter.

## Authentication

### Login
**Action:** `login`
**Method:** POST
**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response:** `User` object
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "token": "jwt-token"
}
```

### Password Reset
**Action:** `reset-password`
**Method:** POST
**Body:**
```json
{
  "email": "user@example.com"
}
```
**Response:** 200 OK

### Change Password
**Action:** `change-password`
**Method:** POST
**Body:**
```json
{
  "password": "currentPassword",
  "newPassword": "newPassword"
}
```
**Response:**
```json
{
  "success": true, // or false
  "message": "Success message or error description"
}
```

## Courses

### Get All Courses
**Action:** `get-courses`
**Method:** POST
**Body:** `{}`
**Response:** Array of `Course` objects

### Get Single Course
**Action:** `get-course`
**Method:** POST
**Body:**
```json
{
  "course_id": 123
}
```
**Response:** `Course` object

### Update Course
**Action:** `update-course`
**Method:** POST
**Body:** `Course` object
```json
{
  "id": 123,
  "title": "Course Title",
  "sku": "SKU-123",
  "status": "active", // or 'inactive'
  "description": "HTML description",
  "image": "url",
  "basePrice": 99.99,
  "location": "City Name"
}
```
**Response:** Updated `Course` object

### Get Course Dates
**Action:** `get-dates`
**Method:** POST
**Body:**
```json
{
  "course_id": 123
}
```
**Response:** Array of `CourseDate` objects

### Save Course Dates
**Action:** `save-dates`
**Method:** POST
**Body:**
```json
{
  "course_id": 123,
  "dates": [
    {
      "id": 1,
      "courseId": 123,
      "dateTime": "2024-01-01T10:00:00Z",
      "capacity": 10,
      "booked": 0,
      "duration": 180
    }
  ]
}
```
**Response:** Array of saved `CourseDate` objects

## Contact

### Send Message
**Action:** `contact`
**Method:** POST
**Body:**
```json
{
  "subject": "Subject text",
  "message": "Message body"
}
```
**Response:** 200 OK
