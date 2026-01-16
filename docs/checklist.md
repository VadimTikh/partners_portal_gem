# Miomente Partners Portal - Testing Checklist

## PARTNER ROLE - Test These

### 1. Authentication
- [ ] Login with correct credentials
- [ ] Login with wrong password → error message
- [ ] Forgot password → sends email
- [ ] Reset password link → works
- [ ] Change password in Settings → works
- [ ] Logout → redirects to login

### 2. Dashboard (Course List)
- [ ] Courses load correctly
- [ ] Search by title/SKU works
- [ ] Filter by status (All/Active/Inactive)
- [ ] Filter by dates (With/Without dates)
- [ ] Course cards show correct info (image, title, price, dates count)

### 3. Course Editor
- [ ] Click course → opens editor
- [ ] Edit title, location, description → save works
- [ ] Edit base price → save works
- [ ] Toggle Active/Inactive status

### 4. Date Management (HIGH PRIORITY - recent changes)
- [ ] View dates for a course
- [ ] **Add date** (must be 2+ days in future)
- [ ] Add date less than 2 days → should show error
- [ ] **Edit price** (click pencil icon)
- [ ] **Edit seats/capacity**
- [ ] **Edit date/time**
- [ ] **Edit duration** → check if end time updates
- [ ] **Delete date**

### 5. Course Requests
- [ ] View my requests list
- [ ] Create new request with:
  - Name, location, price, description
  - Add requested dates (optional)
- [ ] Submit → success message
- [ ] View request status (pending/approved/rejected)
- [ ] Rejected request shows reason

### 6. Contact Form
- [ ] Send message → success toast

---

## MANAGER ROLE - Test These

### 7. Partners List
- [ ] Partners load (should show portal users only)
- [ ] Search by name/email
- [ ] **Add Partner** button → dialog opens
  - [ ] Enter name, email, customer number(s)
  - [ ] Submit → password dialog appears
  - [ ] Copy password works
  - [ ] Duplicate email → shows error
- [ ] Click "View Partner" → opens detail page

### 8. Partner Detail
- [ ] View partner's courses
- [ ] View customer numbers
- [ ] Add/remove customer numbers

### 9. Course Requests (Manager)
- [ ] View all requests
- [ ] Filter by status
- [ ] Search by name/partner/location
- [ ] Click request → view details
- [ ] Change status: pending → in_moderation
- [ ] Reject with reason
- [ ] Approve request
- [ ] Create course from approved request

### 10. Activity Logs
- [ ] Logs load with pagination
- [ ] Filter by partner
- [ ] Filter by action type
- [ ] Filter by date range
- [ ] Next/Previous page works

---

## EDGE CASES (Likely Bug Areas)

### Multi-Customer Number (Recent Feature)
- [ ] Partner with 1 customer number → sees courses
- [ ] Partner with multiple customer numbers → sees ALL courses
- [ ] Partner with no customer numbers → gets "not configured" error

### Date Validation
- [ ] Date exactly 2 days from now → should work
- [ ] Date tomorrow → should fail
- [ ] Price = 0 → should fail
- [ ] Capacity = 0 → should fail

### Permissions
- [ ] Partner cannot access `/manager/*` URLs
- [ ] Partner cannot see other partners' courses (try changing course ID in URL)

---

## Quick UI Checks
- [ ] Language switcher (DE/EN) works
- [ ] Tooltips show (e.g., customer number info icon in Add Partner)
- [ ] Loading spinners appear during API calls
- [ ] Error toasts show when something fails
- [ ] Forms clear after successful submission

---

## How to Report Issues

Format: Just note which item failed and any error message.

Examples:
- "Edit duration - fails with 'Failed to update duration'"
- "Add Partner - duplicate email doesn't show error"
- "Filter by status - doesn't filter correctly"
