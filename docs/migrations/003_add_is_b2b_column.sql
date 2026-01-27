-- Migration: Add is_b2b column to AI analysis table
-- This column tracks whether a ticket is from a B2B (business-to-business) customer

ALTER TABLE miomente_partner_helpdesk_ai_analysis
ADD COLUMN IF NOT EXISTS is_b2b BOOLEAN DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN miomente_partner_helpdesk_ai_analysis.is_b2b IS 'Whether the ticket is from a B2B customer (company, corporate order, bulk purchase)';
