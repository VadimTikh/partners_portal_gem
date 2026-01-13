# Miomente Partner Portal - Feature Roadmap

## Overview
This document outlines planned features based on competitor analysis (Konfetti) and business requirements.

---

## Phase 1: Quick Wins (Menu & Placeholders)

### 1.1 Add Menu Items
- [ ] **Bestellungen** (Orders) - Add to sidebar
- [ ] **Buchhaltung** (Accounting) - Add to sidebar
- [ ] Display "In Entwicklung. Coming soon" placeholder pages

**Implementation:** Add new routes in `src/app/dashboard/`, create simple placeholder components with the message.

---

## Phase 2: Orders Management (Bestellungen)

### 2.1 Orders List View
- [ ] Display all bookings for partner's courses
- [ ] Show: Customer name, course, date, tickets count, status, total price
- [ ] Filter by: date range, course, status
- [ ] Pagination

**Implementation:**
- Create `/api/partner/orders` endpoint
- Query Magento `sales_order` + `sales_order_item` tables
- Join with course data via product SKU

### 2.2 Order Details
- [ ] View single order with all details
- [ ] Customer contact info
- [ ] Payment status
- [ ] Order history/timeline

**Implementation:** Create `/api/partner/orders/[id]` endpoint, new detail page.

### 2.3 Order Confirmation Flow
- [ ] Partner can confirm/reject bookings
- [ ] Send confirmation email to customer
- [ ] Update order status in Magento

**Implementation:** PATCH endpoint for status update, integrate with SendGrid templates.

---

## Phase 3: Accounting (Buchhaltung)

### 3.1 Revenue Dashboard
- [ ] Monthly/yearly revenue charts
- [ ] Revenue per course breakdown
- [ ] Comparison with previous periods

**Implementation:**
- Aggregate order data by period
- Use chart library (recharts already in project)
- Create `/api/partner/stats/revenue` endpoint

### 3.2 Invoices List
- [ ] View all invoices from Miomente
- [ ] Download PDF invoices
- [ ] Filter by date, status

**Implementation:**
- Store invoices in Supabase or fetch from accounting system
- PDF generation with partner payout details

### 3.3 Payout Reports
- [ ] Show commission calculations
- [ ] Expected payout dates
- [ ] Historical payouts

**Implementation:** Create payout calculation logic based on order commissions.

---

## Phase 4: Recurring Events (Wiederholende Termine)

### 4.1 Recurring Date Templates
- [ ] Create date template with recurrence pattern
- [ ] Options: Daily, Weekly, Monthly, Custom
- [ ] Set end date or number of occurrences
- [ ] Auto-generate dates based on pattern

**Implementation:**
- Add `recurring_pattern` table in Supabase
- Background job (cron) to generate dates
- Or generate on-demand when partner views calendar
- Store pattern: `{ frequency: 'monthly', day: 15, endDate: '2025-12-31' }`

### 4.2 Bulk Date Management
- [ ] Edit all future recurring dates at once
- [ ] Cancel entire series
- [ ] Exception handling (skip specific dates)

**Implementation:** Add `series_id` to dates, bulk update queries.

---

## Phase 5: Waitlist & Date Requests (Warteliste)

### 5.1 Waitlist View
- [ ] Show courses with people waiting
- [ ] Number of interested customers per course
- [ ] Quick action: "Add new date"

**Implementation:**
- Create waitlist table in Supabase
- API endpoint `/api/partner/waitlist`
- Notify customers when new dates added

### 5.2 Date Requests (Terminanfragen)
- [ ] Customers can request specific dates
- [ ] Partner sees requests with customer count
- [ ] Accept/Reject requests
- [ ] Auto-notify customers on decision

**Implementation:**
- New `date_requests` table
- Status workflow: pending → approved/rejected
- Email notifications via SendGrid

---

## Phase 6: Reviews Management (Bewertungen)

### 6.1 Reviews Dashboard
- [ ] View all customer reviews
- [ ] Average rating per course
- [ ] Overall partner rating

**Implementation:**
- Query Magento review tables or create own in Supabase
- Aggregate ratings API endpoint

### 6.2 Review Response
- [ ] Partner can respond to reviews
- [ ] Response displayed on website

**Implementation:** Add `partner_response` field, moderation workflow.

### 6.3 Review Collection
- [ ] Automated review request emails after event
- [ ] Reminder emails for non-responders

**Implementation:** Scheduled job to send review requests X days after event.

---

## Phase 7: Marketing Tools

### 7.1 SEO Recommendations
- [ ] Course content quality score
- [ ] Missing fields warnings
- [ ] Keyword suggestions

**Implementation:** Content analysis algorithm, checklist UI.

### 7.2 Best Practices Section
- [ ] Tips for successful courses
- [ ] Pricing recommendations
- [ ] Photo guidelines

**Implementation:** Static content pages with examples.

---

## Phase 8: Technical Integration

### 8.1 Booking Widget
- [ ] Embeddable widget for partner websites
- [ ] Shows available dates
- [ ] Direct booking flow

**Implementation:**
- Create standalone widget bundle
- iframe or JS embed code
- Public API endpoints for widget

### 8.2 API Access
- [ ] Partner API keys management
- [ ] Documentation for external integrations
- [ ] Webhook notifications

**Implementation:**
- API key generation in settings
- Rate limiting
- Webhook subscription system

---

## Phase 9: Communication

### 9.1 News/Updates Section
- [ ] Announcements from Miomente
- [ ] New features highlights
- [ ] Platform updates

**Implementation:** Simple CMS or markdown-based news in Supabase.

### 9.2 SMS Notifications (Future)
- [ ] SMS reminders to customers
- [ ] Partner notification preferences

**Implementation:** Integrate SMS provider (Twilio/MessageBird).

---

## Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Menu placeholders | Low | Low | P1 - Now |
| Orders list | High | Medium | P1 - Now |
| Revenue dashboard | High | Medium | P2 - Next |
| Recurring dates | High | High | P2 - Next |
| Waitlist | Medium | Medium | P3 - Later |
| Reviews | Medium | Medium | P3 - Later |
| Booking widget | High | High | P4 - Future |

---

## Database Schema Additions

```sql
-- Supabase additions

-- Waitlist
CREATE TABLE miomente_waitlist (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Date Requests
CREATE TABLE miomente_date_requests (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL,
  requested_date DATE NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recurring Patterns
CREATE TABLE miomente_recurring_patterns (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL,
  frequency VARCHAR(20) NOT NULL, -- daily, weekly, monthly
  interval INTEGER DEFAULT 1,
  day_of_week INTEGER, -- 0-6 for weekly
  day_of_month INTEGER, -- 1-31 for monthly
  start_date DATE NOT NULL,
  end_date DATE,
  occurrences INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- News/Announcements
CREATE TABLE miomente_announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Notes
- All new features should follow existing patterns (React Query, Zustand, shadcn/ui)
- German language support required for all user-facing text
- Mobile-responsive design mandatory
