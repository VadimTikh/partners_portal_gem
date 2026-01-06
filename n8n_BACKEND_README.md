# n8n Backend Requirements for Partner Portal

This document outlines the backend requirements for the Partner Portal application, designed to be implemented using [n8n](https://n8n.io/).

## Architecture Overview

The frontend communicates with the backend via a **single HTTP entry point** (Webhook). All operations are distinguished by an `action` query parameter.

*   **Method:** `POST`
*   **URL:** Defined by `NEXT_PUBLIC_N8N_API_URL` environment variable.
*   **Routing:** The n8n workflow should use a `Switch` node (or similar) to route execution based on the `?action=...` query parameter.

## Authentication

*   **Mechanism:** Stored Session Token (Opaque Bearer Token).
*   **Header:** `Authorization: Bearer <token>`
*   **Strategy:**
    1.  On `login`, generate a random string (e.g., UUID).
    2.  Store this string in the User's record in the database.
    3.  Return this string to the frontend.
    4.  For protected actions, take the token from the header and perform a **Database Lookup** to find the user associated with that token.
*   **Validation:** All protected actions (everything except `login` and `reset-password`) must validate the token by checking if it exists in the database.

## Data Structures

### User
```json
{
  "email": "string",
  "name": "string",
  "token": "string" // Random session string
}
```

### Course
```json
{
  "id": "string",
  "title": "string",
  "sku": "string",
  "status": "active" | "inactive",
  "description": "string",
  "image": "string", // URL
  "basePrice": number
}
```

### CourseDate
```json
{
  "id": "string",
  "courseId": "string",
  "dateTime": "string", // ISO 8601
  "capacity": number,
  "booked": number,
  "duration": number // Optional, in minutes
}
```

---

## API Actions (Endpoints)

### 1. Login
*   **Action:** `login`
*   **Auth Required:** No
*   **Input (Body):**
    ```json
    {
      "email": "user@example.com",
      "password": "plain_text_password"
    }
    ```
*   **Output:** `User` object
    ```json
    {
      "email": "user@example.com",
      "name": "John Doe",
      "token": "random_session_token"
    }
    ```

### 2. Get Courses
*   **Action:** `get-courses`
*   **Auth Required:** Yes
*   **Input:** `{}` (Empty body)
*   **Output:** Array of `Course`
    ```json
    [
      { "id": "1", "title": "Pasta Masterclass", ... }
    ]
    ```

### 3. Get Single Course
*   **Action:** `get-course`
*   **Auth Required:** Yes
*   **Input (Body):**
    ```json
    { "id": "course_id_123" }
    ```
*   **Output:** `Course` object

### 4. Update Course
*   **Action:** `update-course`
*   **Auth Required:** Yes
*   **Input (Body):** `Course` object (including `id`)
*   **Output:** `Course` object (the updated version)

### 5. Get Course Dates
*   **Action:** `get-dates`
*   **Auth Required:** Yes
*   **Input (Body):**
    ```json
    { "courseId": "course_id_123" }
    ```
*   **Output:** Array of `CourseDate`

### 6. Save Course Dates
Replaces or updates the dates for a specific course.
*   **Action:** `save-dates`
*   **Auth Required:** Yes
*   **Input (Body):**
    ```json
    {
      "courseId": "course_id_123",
      "dates": [ ...Array of CourseDate objects... ]
    }
    ```
*   **Output:** Array of `CourseDate` (the saved list)

### 7. Change Password
*   **Action:** `change-password`
*   **Auth Required:** Yes
*   **Input (Body):**
    ```json
    {
      "password": "current_password",
      "newPassword": "new_secure_password"
    }
    ```
*   **Output:** Success status (HTTP 200) or Error.

### 8. Reset Password
Trigger a password reset email flow.
*   **Action:** `reset-password`
*   **Auth Required:** No
*   **Input (Body):**
    ```json
    { "email": "user@example.com" }
    ```
*   **Output:** Success status (HTTP 200).

### 9. Contact Support
*   **Action:** `contact`
*   **Auth Required:** Yes
*   **Input (Body):**
    ```json
    {
      "subject": "Help needed",
      "message": "I cannot access..."
    }
    ```
*   **Output:** Success status (HTTP 200).

## Implementation Tips for n8n

1.  **Webhook Node:** Start with a `Webhook` node set to `POST`.
2.  **Router:** Use a `Switch` node checking `{{ $json.query.action }}`.
3.  **Auth Sub-workflow:** Create a reusable workflow that takes the `Authorization` header, strips "Bearer ", and queries the database. If found, it returns the User ID; if not, it returns an error.
4.  **Database:** Use n8n nodes for your preferred database (Postgres, MySQL, Airtable, Baserow, etc.) to store Users (with their current session token), Courses, and Dates.
5.  **Response:** Ensure the `Respond to Webhook` node returns the data in the exact JSON structure defined above.
