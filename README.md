# Miomente Partners Portal

A modern partner portal for managing courses, dates, and account settings. Built with Next.js 15, Tailwind CSS, and shadcn/ui.

## Features

- **Authentication**: Secure login and session management.
- **Dashboard**: Overview of your courses.
- **Course Editor**: Create and edit course details.
- **Inventory Management**: Manage dates, times, and capacity for each course.
- **Contact Support**: Direct line to support team.
- **Settings**: Manage account settings including password changes.
- **Internationalization**: Full support for German (de) and English (en).

## Getting Started

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd miomente_partners_portal_gem
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the development server**:
    ```bash
    npm run dev
    ```

4.  **Open in browser**:
    Navigate to [http://localhost:3000](http://localhost:3000).

---

## Backend Implementation Guide & API Specification

This section is designed for backend developers (or n8n workflow designers) to understand exactly how to handle requests from this frontend application.

### 1. Architecture Overview

The application uses a **Single Endpoint Architecture**.
*   **Method:** Always `POST`.
*   **Routing:** The frontend sends a query parameter `?action=...` to indicate the intent (e.g., `action=login`, `action=get-courses`).
*   **Payload:** Data is always sent in the JSON body.
*   **Authentication:** Protected routes send a `Authorization: Bearer <token>` header.

**Your Backend Logic (n8n Switch Node):**
1.  Receive Webhook (POST).
2.  Switch based on `query.action`.
3.  If action is protected, Validate JWT from `headers.authorization`.
4.  Execute Logic (Database query, etc.).
5.  Return JSON response.

### 2. Authentication & JWT Structure

The frontend expects a **JWT (JSON Web Token)** upon successful login. It stores this token and sends it back with every subsequent request.

**Recommended JWT Payload:**
When generating the token in your backend, include at least these fields to securely identify the partner:
```json
{
  "sub": "partner_123",       // (Subject) Unique User ID in your DB
  "email": "user@example.com", // User's email
  "role": "partner",           // Role for permission checks
  "iat": 1710000000,           // Issued At timestamp
  "exp": 1710086400            // Expiration timestamp (e.g., 24h)
}
```

**Verification Logic:**
For every protected action (everything except `login` and `reset-password`):
1.  Extract token from header: `Authorization: Bearer <token>`.
2.  Verify signature using your secret key.
3.  Decode payload to get the `sub` (User ID).
4.  Use this User ID to filter database queries (e.g., `SELECT * FROM courses WHERE partner_id = 'partner_123'`).

### 3. API Action Reference

#### A. Public Actions (No Auth Header)

**1. Login**
*   **Action:** `login`
*   **Input Body:**
    ```json
    {
      "email": "partner@example.com",
      "password": "plain_text_password"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      "email": "partner@example.com",
      "name": "Partner Name", // Displayed in UI
      "token": "eyJhbGciOiJIUz..." // The JWT string
    }
    ```
*   **Error Response (401/400):** `{ "error": "Invalid credentials" }`

**2. Reset Password (Forgot Password)**
*   **Action:** `reset-password`
*   **Input Body:**
    ```json
    {
      "email": "partner@example.com"
    }
    ```
*   **Logic:** Trigger an email workflow to send a reset link.
*   **Success Response (200 OK):** `{ "success": true }`

#### B. Protected Actions (Require Valid JWT)

**3. Change Password**
*   **Action:** `change-password`
*   **Input Body:**
    ```json
    {
      "password": "old_password",
      "newPassword": "new_password"
    }
    ```
*   **Logic:** Verify `password` matches current DB hash, then hash and save `newPassword`.
*   **Success Response (200 OK):** `{ "success": true }`

**4. Get All Courses**
*   **Action:** `get-courses`
*   **Input Body:** `{}` (Empty)
*   **Logic:** Fetch all courses belonging to the User ID from the JWT.
*   **Success Response (200 OK):**
    ```json
    [
      {
        "id": "c1",
        "title": "Italian Cooking Class",
        "sku": "SKU-001",
        "status": "active", // or "inactive"
        "description": "Learn to cook pasta...",
        "image": "https://example.com/image.jpg",
        "basePrice": 89.00
      }
    ]
    ```

**5. Get Single Course**
*   **Action:** `get-course`
*   **Input Body:**
    ```json
    {
      "id": "c1"
    }
    ```
*   **Logic:** Fetch specific course. **Security Check:** Ensure course belongs to the requesting User ID.
*   **Success Response (200 OK):** Returns single Course object (same structure as above).

**6. Update or Create Course**
*   **Action:** `update-course`
*   **Input Body:** Course object.
*   **Logic:**
    *   If `id` exists in DB: Update the record.
    *   If `id` is new/missing: Create new record.
    *   **Always** associate with the User ID from JWT.
*   **Success Response (200 OK):** Returns the updated/created Course object.

**7. Get Course Dates (Inventory)**
*   **Action:** `get-dates`
*   **Input Body:**
    ```json
    {
      "courseId": "c1"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    [
      {
        "id": "d1",
        "courseId": "c1",
        "dateTime": "2024-12-05T18:00:00.000Z", // ISO 8601
        "capacity": 15,
        "booked": 5,
        "duration": 180 // Minutes
      }
    ]
    ```

**8. Save Course Dates**
*   **Action:** `save-dates`
*   **Input Body:**
    ```json
    {
      "courseId": "c1",
      "dates": [ /* Array of CourseDate objects */ ]
    }
    ```
*   **Logic:** Replace all dates for this course with the new list, or perform a smart merge/diff.
*   **Success Response (200 OK):** Returns the saved array of dates.

**9. Contact Support**
*   **Action:** `contact`
*   **Input Body:**
    ```json
    {
      "subject": "Question about payments",
      "message": "Hi, when will I receive..."
    }
    ```
*   **Logic:** Send email to support team including the User's email from JWT.
*   **Success Response (200 OK):** `{ "success": true }`