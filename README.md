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

## API Documentation

This application uses a proxy-based architecture where all API requests are routed through `/api/proxy` with an `action` query parameter to determine the operation.

### Architecture Overview

- **Base URL:** `/api/proxy`
- **Method:** All requests use `POST`
- **Authentication:** Bearer token authentication (except `login` and `reset-password`)
- **Header Format:** `Authorization: Bearer <token>`

### Quick API Reference

#### Public Endpoints (No Authentication)
- **Login:** `POST /api/proxy?action=login`
- **Reset Password:** `POST /api/proxy?action=reset-password`

#### Protected Endpoints (Require Authentication)
- **Get All Courses:** `POST /api/proxy?action=get-courses`
- **Get Single Course:** `POST /api/proxy?action=get-course`
- **Create Course:** `POST /api/proxy?action=create-course`
- **Update Course:** `POST /api/proxy?action=update-course`
- **Get Course Dates:** `POST /api/proxy?action=get-dates`
- **Create Course Date:** `POST /api/proxy?action=create-date`
- **Delete Course Date:** `POST /api/proxy?action=delete-date`
- **Change Password:** `POST /api/proxy?action=change-password`
- **Send Contact Message:** `POST /api/proxy?action=contact`

### Data Models

**Course:**
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

**CourseDate:**
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

### Mock Mode

The application includes mock mode for development. When `NEXT_PUBLIC_N8N_API_URL` is not set, all API calls use local mock data instead of the backend.

### Full API Documentation

For complete API documentation including detailed request/response examples, error handling, and usage examples, see [docs/api.md](docs/api.md).