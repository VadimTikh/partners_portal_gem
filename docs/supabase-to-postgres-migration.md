# Supabase to PostgreSQL Migration Guide

This guide explains how to migrate the partner portal database from Supabase to a self-hosted PostgreSQL server.

## Overview

The application uses PostgreSQL for storing:
- **Users** (`miomente_partner_portal_users`) - Partner and manager accounts
- **Sessions** (`miomente_partner_portal_sessions`) - Authentication sessions
- **Course Requests** (`miomente_course_requests`) - Partner course requests awaiting approval

## Prerequisites

- PostgreSQL 14+ installed on your Ubuntu server
- Access to your Supabase project dashboard
- `psql` command-line tool installed

## Step 1: Create Database and User on PostgreSQL Server

Connect to your PostgreSQL server:

```bash
sudo -u postgres psql
```

Create the database and user:

```sql
-- Create database
CREATE DATABASE miomente_portal;

-- Create user with password
CREATE USER miomente_app WITH ENCRYPTED PASSWORD 'your-secure-password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE miomente_portal TO miomente_app;

-- Connect to the new database
\c miomente_portal

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO miomente_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO miomente_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO miomente_app;

\q
```

## Step 2: Create Tables

Connect to your new database:

```bash
psql -h localhost -U miomente_app -d miomente_portal
```

Run the following SQL to create all tables:

```sql
-- =============================================
-- Table: miomente_partner_portal_users
-- =============================================
CREATE TABLE miomente_partner_portal_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    customer_number VARCHAR(50),
    is_manager BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE
);

-- Index for email lookups (login)
CREATE INDEX idx_users_email ON miomente_partner_portal_users(email);

-- Index for reset token lookups
CREATE INDEX idx_users_reset_token ON miomente_partner_portal_users(reset_token);

-- =============================================
-- Table: miomente_partner_portal_sessions
-- =============================================
CREATE TABLE miomente_partner_portal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES miomente_partner_portal_users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Index for token lookups (auth middleware)
CREATE INDEX idx_sessions_token ON miomente_partner_portal_sessions(token);

-- Index for user session cleanup
CREATE INDEX idx_sessions_user_id ON miomente_partner_portal_sessions(user_id);

-- Index for expired session cleanup
CREATE INDEX idx_sessions_expires_at ON miomente_partner_portal_sessions(expires_at);

-- =============================================
-- Table: miomente_course_requests
-- =============================================
CREATE TABLE miomente_course_requests (
    id SERIAL PRIMARY KEY,
    customer_number VARCHAR(50) NOT NULL,
    partner_name VARCHAR(255) NOT NULL,
    partner_email VARCHAR(255) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    partner_description TEXT,
    requested_dates JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_moderation', 'approved', 'rejected')),
    rejection_reason TEXT,
    rejection_recommendations TEXT,
    manager_notes TEXT,
    created_course_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for partner lookups
CREATE INDEX idx_course_requests_customer_number ON miomente_course_requests(customer_number);

-- Index for status filtering (manager dashboard)
CREATE INDEX idx_course_requests_status ON miomente_course_requests(status);
```

## Step 3: Export Data from Supabase

### Option A: Using Supabase Dashboard (Recommended for small datasets)

1. Go to your Supabase project dashboard
2. Navigate to **Table Editor**
3. For each table, click on the table name
4. Click **Export** (top right) and choose **CSV**
5. Save each file:
   - `users.csv`
   - `sessions.csv`
   - `course_requests.csv`

### Option B: Using psql (For larger datasets)

Connect to your Supabase database (find connection string in Supabase dashboard > Settings > Database):

```bash
# Export users
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres" \
  -c "\copy miomente_partner_portal_users TO 'users.csv' WITH CSV HEADER"

# Export sessions
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres" \
  -c "\copy miomente_partner_portal_sessions TO 'sessions.csv' WITH CSV HEADER"

# Export course requests
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres" \
  -c "\copy miomente_course_requests TO 'course_requests.csv' WITH CSV HEADER"
```

## Step 4: Import Data to New PostgreSQL

Transfer the CSV files to your server, then import:

```bash
# Connect to your new database
psql -h localhost -U miomente_app -d miomente_portal

# Import users (must be first due to foreign key)
\copy miomente_partner_portal_users FROM 'users.csv' WITH CSV HEADER

# Import sessions
\copy miomente_partner_portal_sessions FROM 'sessions.csv' WITH CSV HEADER

# Import course requests
\copy miomente_course_requests FROM 'course_requests.csv' WITH CSV HEADER

# Reset the sequence for course_requests id
SELECT setval('miomente_course_requests_id_seq', (SELECT MAX(id) FROM miomente_course_requests));
```

## Step 5: Update Environment Variables

Update your `.env.local` (or production environment) with the new PostgreSQL connection:

```env
# PostgreSQL (Application Database)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=miomente_app
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DATABASE=miomente_portal
```

If your PostgreSQL is on a different server, replace `localhost` with the server IP/hostname.

## Step 6: Verify Migration

1. **Test the connection:**
   ```bash
   npm run build
   npm run start
   ```

2. **Verify data:**
   - Login with an existing user account
   - Check the dashboard shows correct data
   - Verify course requests are visible in manager dashboard

3. **Check row counts match:**
   ```sql
   -- Run on both Supabase and new PostgreSQL, compare results
   SELECT 'users' as table_name, COUNT(*) FROM miomente_partner_portal_users
   UNION ALL
   SELECT 'sessions', COUNT(*) FROM miomente_partner_portal_sessions
   UNION ALL
   SELECT 'course_requests', COUNT(*) FROM miomente_course_requests;
   ```

## Step 7: Cleanup (After Verification)

Once you've verified everything works:

1. **Clear old sessions** (optional, forces re-login):
   ```sql
   DELETE FROM miomente_partner_portal_sessions WHERE expires_at < NOW();
   ```

2. **Remove Supabase from your project** (optional):
   - Remove `DATABASE_URL` from environment if not needed as fallback
   - Cancel Supabase subscription if no longer needed

## Troubleshooting

### Connection refused
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Check PostgreSQL is listening: `sudo ss -tlnp | grep 5432`
- Check `pg_hba.conf` allows connections from your app server

### Permission denied
- Ensure user has privileges: Run Step 1 commands again
- Check database ownership: `\l` in psql to list databases

### Data import errors
- **UUID errors**: Ensure `gen_random_uuid()` is available (PostgreSQL 13+)
- **Foreign key errors**: Import users table before sessions
- **Encoding errors**: Add `ENCODING 'UTF8'` to COPY command

## Rollback

If you need to rollback to Supabase:

1. Update environment to use `DATABASE_URL` with Supabase connection string
2. Restart the application
3. The code supports both connection methods, so rollback is instant
