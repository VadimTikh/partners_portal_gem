-- Migration 004: Add filter_preferences column to user settings
-- This stores user's filter preferences (period, stages, AI filters) as JSON

ALTER TABLE miomente_partner_helpdesk_user_settings
ADD COLUMN IF NOT EXISTS filter_preferences JSONB DEFAULT '{}'::JSONB;

-- Add comment for documentation
COMMENT ON COLUMN miomente_partner_helpdesk_user_settings.filter_preferences IS 'Stores user filter preferences as JSON: period, customFrom, customTo, selectedStageIds, searchQuery, aiUrgency, aiCategory, aiSentiment, aiSatisfaction, aiIsResolved, awaitingAnswer';
