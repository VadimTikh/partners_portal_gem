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

This application is designed to connect to an n8n backend via Webhooks. To enable this connection, you must provide the corresponding Webhook URLs in your `.env` file (see `.env.example`).

### Authentication & Account

#### 1. Login
*   **Env Variable**: `NEXT_PUBLIC_N8N_LOGIN_WEBHOOK`
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
*   **Env Variable**: `NEXT_PUBLIC_N8N_CHANGE_PASSWORD_WEBHOOK`
*   **Method**: `POST`
*   **Payload**:
    ```json
    {
      "password": "currentPassword",
      "newPassword": "newSecurePassword"
    }
    ```
*   **Expected Response**: `200 OK` (Empty body or success message)

#### 3. Reset Password
*   **Env Variable**: `NEXT_PUBLIC_N8N_RESET_PASSWORD_WEBHOOK`
*   **Method**: `POST`
*   **Payload**:
    ```json
    {
      "email": "user@example.com"
    }
    ```
*   **Expected Response**: `200 OK` (Empty body or success message)

### Course Management

#### 4. Get All Courses
*   **Env Variable**: `NEXT_PUBLIC_N8N_COURSES_WEBHOOK`
*   **Method**: `GET`
*   **Payload**: None
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
*   **Env Variable**: `NEXT_PUBLIC_N8N_COURSE_WEBHOOK`
*   **Method**: `GET`
*   **Query Params**: `?id=course_id`
*   **Expected Response**: `200 OK`
    ```json
    {
      "id": "1",
      "title": "Course Title",
      "sku": "SKU-123",
      "status": "active",
      "description": "...",
      "image": "...",
      "basePrice": 99.00
    }
    ```

#### 6. Update/Create Course
*   **Env Variable**: `NEXT_PUBLIC_N8N_UPDATE_COURSE_WEBHOOK`
*   **Method**: `POST`
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
*   **Expected Response**: `200 OK` (Returns the updated course object)

### Inventory (Dates)

#### 7. Get Course Dates
*   **Env Variable**: `NEXT_PUBLIC_N8N_DATES_WEBHOOK`
*   **Method**: `GET`
*   **Query Params**: `?courseId=course_id`
*   **Expected Response**: `200 OK`
    ```json
    [
      {
        "id": "date_1",
        "courseId": "1",
        "dateTime": "2024-03-20T18:00:00.000Z",
        "capacity": 10,
        "booked": 2,
        "duration": 180
      }
    ]
    ```

#### 8. Save Course Dates
*   **Env Variable**: `NEXT_PUBLIC_N8N_SAVE_DATES_WEBHOOK`
*   **Method**: `POST`
*   **Payload**:
    ```json
    {
      "courseId": "1",
      "dates": [
        {
           "id": "date_1",
           "courseId": "1",
           "dateTime": "2024-03-20T18:00:00.000Z",
           "capacity": 10,
           "booked": 2,
           "duration": 180
        }
      ]
    }
    ```
*   **Expected Response**: `200 OK` (Returns the saved array of dates)

### Support

#### 9. Contact Support
*   **Env Variable**: `NEXT_PUBLIC_N8N_CONTACT_WEBHOOK`
*   **Method**: `POST`
*   **Payload**:
    ```json
    {
      "subject": "Help needed",
      "message": "I cannot access my course..."
    }
    ```
*   **Expected Response**: `200 OK`