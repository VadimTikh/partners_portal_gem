# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start Next.js dev server on localhost:3000
npm run build    # Build production bundle
npm run lint     # Run ESLint
npm start        # Start production server
```

No testing framework is currently configured.

## Environment Setup

Set `NEXT_PUBLIC_N8N_API_URL` to the n8n webhook URL. If not set, the app runs in mock mode using local mock data from `src/lib/mock-data.ts`.

## Architecture Overview

This is a Next.js 16 (App Router) partner portal for managing courses and dates. It uses TypeScript throughout.

### API Proxy Pattern

All API calls route through a single proxy endpoint:
- **Endpoint**: `/api/proxy?action=<action_name>`
- **Handler**: `src/app/api/proxy/route.ts`
- **Backend**: n8n webhook (configured via env var)
- **Auth**: Bearer token forwarded in Authorization header

Actions: `login`, `reset-password`, `get-courses`, `get-course`, `create-course`, `update-course`, `get-dates`, `create-date`, `update-date`, `delete-date`, `change-password`, `contact`

### State Management

- **Auth state**: Zustand store with localStorage persistence (`src/lib/auth.ts`)
- **Server data**: React Query for courses and dates caching
- **Forms**: React Hook Form + Zod validation

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
- `src/app/dashboard/editor/[id]/` - Course creation/editing (most complex page)
- `src/lib/api.ts` - All API client functions
- `src/lib/auth.ts` - Zustand auth store
- `src/lib/types.ts` - TypeScript interfaces (Course, CourseDate, User)
- `src/lib/dictionaries.ts` - i18n translations (de/en)
- `src/components/ui/` - shadcn/ui components

### Data Flow

```
React Component → api.ts function → /api/proxy → n8n webhook → response
```

Forms use React Hook Form with Zod schemas. Mutations use React Query with cache invalidation.

## Key Patterns

- **i18n**: Custom React Context (`src/lib/i18n.tsx`), not next-intl. Supports German (de) and English (en).
- **UI Components**: shadcn/ui (Radix primitives + Tailwind). Add new components via `npx shadcn@latest add <component>`.
- **Path aliases**: `@/*` maps to `./src/*`
- **Date validation**: Course dates must be at least 2 days in the future (enforced in editor)
- **Individual date pricing**: Each CourseDate has its own price field

## Deployment

Docker standalone build deploys to Google Cloud Run (europe-central2). See `cloudbuild.yaml` and `Dockerfile`.

## Documentation

Detailed API docs in `docs/api.md`. Database schema in `docs/magento_catalog_courses_database_structure_summary.md`.
