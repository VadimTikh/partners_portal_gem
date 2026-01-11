# Supabase Setup for Forgot Password Feature

## Required Database Changes

Add the following columns to your `miomente_partner_portal_users` table in Supabase:

### SQL Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Add reset token columns to users table
ALTER TABLE miomente_partner_portal_users
ADD COLUMN IF NOT EXISTS reset_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token
ON miomente_partner_portal_users(reset_token)
WHERE reset_token IS NOT NULL;
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| `reset_token` | TEXT | Unique token generated when user requests password reset. Cleared after successful reset. |
| `reset_token_expires` | TIMESTAMP WITH TIME ZONE | Token expiration time (1 hour from generation). Token is invalid after this time. |

## Table Structure After Migration

Your `miomente_partner_portal_users` table should have these columns:

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | UUID/INT | Yes | Primary key |
| `email` | TEXT | Yes | User's email address |
| `name` | TEXT | Yes | User's display name |
| `password` | TEXT | Yes | User's password |
| `token` | TEXT | No | Auth session token |
| `created_at` | TIMESTAMP | No | Account creation date |
| `miomente_id` | ARRAY | No | Miomente IDs |
| `customer_number` | INTEGER | No | Customer number |
| `reset_token` | TEXT | No | **NEW** - Password reset token |
| `reset_token_expires` | TIMESTAMP | No | **NEW** - Token expiry time |

## Security Considerations

1. Reset tokens are single-use and expire after 1 hour
2. Token is cleared after successful password reset
3. Generic error messages prevent email enumeration attacks
4. Rate limiting should be implemented at the n8n level if needed

## Testing the Migration

After running the migration, verify with:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'miomente_partner_portal_users'
ORDER BY ordinal_position;
```

You should see `reset_token` and `reset_token_expires` in the results.
