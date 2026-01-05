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

## API Documentation (n8n Webhooks)

This application is designed to connect to an n8n backend via a **single Webhook endpoint**. To enable this connection, you must provide the corresponding Webhook URL in your `.env` file (see `.env.example`).

**Main Entry Point:** `NEXT_PUBLIC_N8N_API_URL`
**Method:** `POST` (for all actions)

The application distinguishes between operations using the `action` query parameter.

### Authentication & Account

#### 1. Login
*   **Query Param**: `?action=login`
*   **Method**: `POST`
*   **Payload**:
    ```json
    {
      "email": "user@example.com",
      "password": "secretpassword"
    }
    ```
*   **Expected Response**: `200 OK`
    ```json
    {
      "email": "user@example.com",
      "name": "Partner Name",
      "token": "jwt-token-string"
    }
    ```

#### 2. Change Password
*   **Query Param**: `?action=change-password`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Payload**:
    ```json
    {
      "password": "currentPassword",
      "newPassword": "newSecurePassword"
    }
    ```

#### 3. Reset Password
*   **Query Param**: `?action=reset-password`
*   **Method**: `POST`
*   **Payload**:
    ```json
    {
      "email": "user@example.com"
    }
    ```

### Course Management

#### 4. Get All Courses
*   **Query Param**: `?action=get-courses`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Payload**: `{}` (Empty JSON object)
*   **Expected Response**: `200 OK`
    ```json
    [
      {
        "id": "1",
        "title": "Course Title",
        "sku": "SKU-123",
        "status": "active",
        "description": "...",
        "image": "...",
        "basePrice": 99.00
      }
    ]
    ```

#### 5. Get Single Course
*   **Query Param**: `?action=get-course`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Payload**:
    ```json
    {
      "id": "course_id"
    }
    ```

#### 6. Update/Create Course
*   **Query Param**: `?action=update-course`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Payload**: `Course` object
    ```json
    {
      "id": "1",
      "title": "Updated Title",
      "sku": "SKU-123",
      "status": "active",
      "description": "...",
      "image": "...",
      "basePrice": 99.00
    }
    ```

### Inventory (Dates)

#### 7. Get Course Dates
*   **Query Param**: `?action=get-dates`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Payload**:
    ```json
    {
      "courseId": "course_id"
    }
    ```

#### 8. Save Course Dates
*   **Query Param**: `?action=save-dates`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Payload**:
    ```json
    {
      "courseId": "1",
      "dates": [ ... ]
    }
    ```

### Support

#### 9. Contact Support
*   **Query Param**: `?action=contact`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Payload**:
    ```json
    {
      "subject": "Help needed",
      "message": "I cannot access my course..."
    }
    ```
