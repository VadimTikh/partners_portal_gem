# Miomente Partner Portal - AI Agent Context

## 1. Project Overview
**Name:** `miomente_partners_portal_gem`
**Purpose:** A partner portal application for Miomente partners to manage their courses, scheduling (dates/capacity), and account settings.
**Type:** Web Application (Next.js)

## 2. Tech Stack
- **Framework:** Next.js 16.1.1 (App Router)
- **Language:** TypeScript
- **UI Library:** React 19.2.3, shadcn/ui (Radix UI primitives)
- **Styling:** Tailwind CSS 4, `clsx`, `tailwind-merge`
- **State Management:** 
  - `zustand` (Global auth state with persistence)
  - `@tanstack/react-query` (Server state/API caching)
- **Form Handling:** `react-hook-form` + `zod` validation
- **HTTP Client:** `axios`
- **Utilities:** `date-fns`, `lucide-react` (Icons)
- **Testing/Dev:** `mock-data` logic for local development

## 3. Architecture

### Frontend Structure (`src/`)
- **`app/`**: Next.js App Router pages and layouts.
  - `dashboard/`: Protected routes (Course list, Editor, Settings).
  - `login/`: Authentication page.
  - `api/proxy/`: Next.js Route Handler acting as an API proxy.
- **`components/`**:
  - `ui/`: Reusable UI components (shadcn/ui).
  - `providers.tsx`: Global providers (QueryClient, I18n).
- **`lib/`**: Core utilities.
  - `api.ts`: Centralized API client methods.
  - `auth.ts`: Zustand store for authentication.
  - `types.ts`: TypeScript interfaces for domain entities.
  - `mock-data.ts`: Mock data for local development without backend.

### Backend / API Strategy
- **Proxy Pattern:** The frontend does not connect directly to the backend services.
- **Route:** All API requests go to `/api/proxy`.
- **Forwarding:** The internal proxy forwards requests to an n8n webhook URL defined in `NEXT_PUBLIC_N8N_API_URL`.
- **Action Dispatch:** An `action` query parameter (e.g., `?action=get-courses`) tells the backend which operation to perform.
- **Authentication:** Bearer tokens are passed from the client, through the proxy, to the n8n backend.

## 4. Key Features & Domain Models

### features
- **Authentication:** Login with email/password. Token-based session management.
- **Dashboard:** List view of courses with status indicators.
- **Course Editor:** Interface to create and update course details (Title, Price, Description, etc.).
- **Inventory Management:** Manage specific dates, times, and capacity for courses.
- **Settings:** User account management (Password reset).
- **Localization:** Support for English (en) and German (de).

### Core Entities (`src/lib/types.ts`)
- **Course:** `id`, `title`, `status` ('active'|'inactive'), `basePrice`, `location`, etc.
- **CourseDate:** `id`, `courseId`, `dateTime`, `capacity`, `booked`.
- **User:** `email`, `name`, `token`.

## 5. Data Flow
1.  **User Action:** User interacts with UI (e.g., "Save Course").
2.  **API Client (`src/lib/api.ts`):** 
    - Checks if `NEXT_PUBLIC_N8N_API_URL` is set.
    - If NOT set -> returns Mock Data.
    - If SET -> calls `axios.post('/api/proxy?action=create-course', payload)`.
3.  **Next.js Proxy (`src/app/api/proxy/route.ts`):**
    - Receives request.
    - Extracts `Authorization` header.
    - Forwards payload and headers to external n8n URL.
4.  **Response:** n8n response is piped back to the client.

## 6. Development Workflow
- **Mock Mode:** If `NEXT_PUBLIC_N8N_API_URL` is missing from `.env`, the app runs in Mock Mode using `src/lib/mock-data.ts`.
- **Environment Variables:**
  - `NEXT_PUBLIC_N8N_API_URL`: URL of the n8n webhook (Backend).

## 7. Conventions
- **Styling:** Use Tailwind utility classes.
- **Components:** Prefer `shadcn/ui` components in `components/ui`.
- **Async Data:** Use `useQuery` / `useMutation` for data fetching where possible.
- **Forms:** Use `react-hook-form` with `zod` schemas.
- **Type Safety:** All API responses and props must be typed.
