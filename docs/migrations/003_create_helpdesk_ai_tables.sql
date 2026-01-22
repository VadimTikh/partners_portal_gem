-- Migration: 003_create_helpdesk_ai_tables
-- Description: Create tables for helpdesk AI analysis and user settings
-- Date: 2026-01-22

-- ============================================
-- User Settings Table
-- Stores user-specific helpdesk preferences
-- ============================================
CREATE TABLE IF NOT EXISTS miomente_partner_helpdesk_user_settings (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES miomente_partner_portal_users(id) ON DELETE CASCADE,
    in_progress_stage_ids JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_helpdesk_settings_user_id
ON miomente_partner_helpdesk_user_settings(user_id);

-- ============================================
-- AI Analysis Results Table
-- Stores AI analysis for tickets with staleness tracking
-- ============================================
CREATE TABLE IF NOT EXISTS miomente_partner_helpdesk_ai_analysis (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL UNIQUE,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ticket_write_date TIMESTAMP WITH TIME ZONE,  -- From Odoo at analysis time

    -- Phase 1 fields
    urgency VARCHAR(20) NOT NULL,
    urgency_reason TEXT,
    category VARCHAR(50) NOT NULL,
    category_confidence DECIMAL(3,2),
    extracted_data JSONB,
    language VARCHAR(10),

    -- Phase 2 fields
    summary TEXT,
    customer_intent VARCHAR(50),
    action_required TEXT,
    sentiment VARCHAR(20),

    -- Extended fields (new)
    satisfaction_level INTEGER CHECK (satisfaction_level BETWEEN 1 AND 5),
    ai_is_resolved BOOLEAN,
    last_message_author_type VARCHAR(20),  -- 'support_team' | 'customer' | 'partner'

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes for filtering
-- ============================================
CREATE INDEX IF NOT EXISTS idx_helpdesk_ai_ticket_id
ON miomente_partner_helpdesk_ai_analysis(ticket_id);

CREATE INDEX IF NOT EXISTS idx_helpdesk_ai_urgency
ON miomente_partner_helpdesk_ai_analysis(urgency);

CREATE INDEX IF NOT EXISTS idx_helpdesk_ai_category
ON miomente_partner_helpdesk_ai_analysis(category);

CREATE INDEX IF NOT EXISTS idx_helpdesk_ai_sentiment
ON miomente_partner_helpdesk_ai_analysis(sentiment);

CREATE INDEX IF NOT EXISTS idx_helpdesk_ai_author_type
ON miomente_partner_helpdesk_ai_analysis(last_message_author_type);

CREATE INDEX IF NOT EXISTS idx_helpdesk_ai_satisfaction
ON miomente_partner_helpdesk_ai_analysis(satisfaction_level);

CREATE INDEX IF NOT EXISTS idx_helpdesk_ai_resolved
ON miomente_partner_helpdesk_ai_analysis(ai_is_resolved);

-- ============================================
-- Trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_helpdesk_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- User settings updated_at trigger
DROP TRIGGER IF EXISTS update_helpdesk_settings_updated_at ON miomente_partner_helpdesk_user_settings;
CREATE TRIGGER update_helpdesk_settings_updated_at
    BEFORE UPDATE ON miomente_partner_helpdesk_user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_helpdesk_updated_at();

-- AI analysis updated_at trigger
DROP TRIGGER IF EXISTS update_helpdesk_ai_updated_at ON miomente_partner_helpdesk_ai_analysis;
CREATE TRIGGER update_helpdesk_ai_updated_at
    BEFORE UPDATE ON miomente_partner_helpdesk_ai_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_helpdesk_updated_at();
