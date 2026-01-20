# Miomente Partners Portal - Feature Overview

This document provides an overview of planned features for the Partners Portal. Each feature has a dedicated specification document with detailed implementation plans.

---

## Table of Contents

| # | Feature | Priority | Status | Document |
|---|---------|----------|--------|----------|
| 1 | [Booking Confirmation System](#1-booking-confirmation-system) | HIGH | Planned | [01-booking-confirmation.md](./01-booking-confirmation.md) |
| 2 | [Rebooking System](#2-rebooking-system) | Medium | Planned | [02-rebooking-system.md](./02-rebooking-system.md) |
| 3 | [Course Date Parsing](#3-course-date-parsing) | Medium | Planned | [03-course-parsing.md](./03-course-parsing.md) |
| 4 | [QR Code Event Verification](#4-qr-code-event-verification) | Low | Planned | [04-qr-verification.md](./04-qr-verification.md) |
| 5 | [Enhanced Decline with Alternatives](#5-enhanced-decline-with-alternatives) | Low | Planned | [05-alternative-dates.md](./05-alternative-dates.md) |
| 6 | [Help Center / FAQ](#6-help-center) | Low | Planned | [06-help-center.md](./06-help-center.md) |

---

## Feature Summaries

### 1. Booking Confirmation System
**Priority: HIGH**

Partners must confirm or decline customer bookings before the event date. This ensures event capacity management and customer satisfaction.

**Key Capabilities:**
- View all bookings for partner's courses
- Confirm bookings with one-click email links
- Decline bookings with automatic Odoo ticket creation
- Automated reminder emails (24h, 48h)
- Token-based authentication for email actions

**Related:** Extends ROADMAP.md Phase 2 (Orders Management)

---

### 2. Rebooking System
**Priority: Medium**

When a booking is declined or a date changes, customers can easily select an alternative date.

**Key Capabilities:**
- Generate unique rebooking links for customers
- Customer-facing date selection (no login required)
- Integration with booking confirmation workflow
- Support ticket auto-response integration

---

### 3. Course Date Parsing
**Priority: Medium**

Automatically discover course dates from partner websites using AI-powered parsing.

**Key Capabilities:**
- Manager page to add partner website URLs
- AI-powered date extraction from web pages
- Partner approval workflow for parsed dates
- Email notifications for new discoveries

---

### 4. QR Code Event Verification
**Priority: Low**

Partners verify customer attendance by scanning QR codes at the event.

**Key Capabilities:**
- Generate unique QR codes per booking
- QR codes sent to customers in confirmation emails
- Scanner page with camera access in portal
- Attendance tracking and reporting

---

### 5. Enhanced Decline with Alternatives
**Priority: Low**

When a partner declines a booking, automatically offer customers alternative dates.

**Key Capabilities:**
- Auto-find available dates for same course
- Customer email with alternative options
- Trigger website parsing if no dates available
- "Change" button for partner-proposed alternatives

---

### 6. Help Center
**Priority: Low**

FAQ and documentation center for partners.

**Key Capabilities:**
- Searchable FAQ articles
- Category organization
- Multi-language support (DE/EN)
- Manager-editable content
- Reference: partner.gokonfetti.com

---

## Technical Stack

All features will be built using the existing stack:

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), TypeScript, shadcn/ui |
| State Management | Zustand (auth), React Query (server data) |
| Database (Users) | PostgreSQL |
| Database (Orders) | MySQL (Magento) |
| Email | SendGrid |
| Support Tickets | Odoo |
| Hosting | Google Cloud Run |

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Partner Portal                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │   Bookings   │    │   Courses    │    │   Settings   │     │
│   │     Page     │    │    Page      │    │     Page     │     │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘     │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │    API Routes     │                        │
│                    │  /api/partner/*   │                        │
│                    └─────────┬─────────┘                        │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│   PostgreSQL   │   │     MySQL      │   │    SendGrid    │
│  (Portal Data) │   │   (Magento)    │   │    (Email)     │
└────────────────┘   └────────────────┘   └────────────────┘
         │                     │
         │                     │
         ▼                     ▼
┌────────────────┐   ┌────────────────┐
│ - Users        │   │ - Orders       │
│ - Partners     │   │ - Products     │
│ - Confirmations│   │ - Customers    │
│ - Tokens       │   │ - Attributes   │
└────────────────┘   └────────────────┘
```

---

## Implementation Order

### Phase 1: Booking Confirmation (Current Focus)
1. Database schema and migrations
2. Magento order queries
3. API endpoints
4. Bookings page UI
5. Email templates
6. Token-based confirmation links
7. Decline workflow with Odoo integration
8. Reminder system

### Phase 2: Rebooking System
1. Rebooking tokens and links
2. Customer date selection page
3. Integration with confirmation workflow

### Phase 3: Course Parsing
1. Manager URL management page
2. Parsing service
3. Partner approval workflow

### Phase 4: QR Verification
1. QR code generation
2. Scanner page
3. Attendance tracking

### Phase 5: Enhanced Decline & Help Center
1. Alternative date suggestions
2. Help center content management
3. FAQ articles

---

## Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Booking data source | Magento orders | Single source of truth for orders |
| Confirmation storage | PostgreSQL | Portal-specific data, joins with users |
| Email auth method | Token-based links | One-click convenience, no login needed |
| Decline handling | Hold for rebooking | Customer retention, better UX |
| Reminder timing | 24h first, 48h second | Balance urgency with partner convenience |
| Email language | Partner's portal setting | Consistent experience |
| Order-Partner mapping | Order Item → Product → partner_id → customer_number | Follows existing Magento structure |

---

## Related Documentation

- [ROADMAP.md](../ROADMAP.md) - Overall product roadmap
- [api.md](../api.md) - API documentation
- [Database Schema](../magento_catalog_courses_database_structure_summary.md) - Magento schema reference

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-21 | Initial feature planning documentation created |
