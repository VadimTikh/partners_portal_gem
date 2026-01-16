-- Migration: Create app logs table for tracking API operations
-- Run this on your PostgreSQL database before using the App Logs feature

CREATE TABLE IF NOT EXISTS miomente_partner_app_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    action VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'validation_error')),
    status_code INTEGER NOT NULL,
    error_message TEXT,
    error_code VARCHAR(100),
    error_stack TEXT,
    user_id UUID,
    user_email VARCHAR(255),
    user_role VARCHAR(20),
    request_body JSONB,
    response_summary JSONB,
    duration_ms INTEGER NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON miomente_partner_app_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_status ON miomente_partner_app_logs(status);
CREATE INDEX IF NOT EXISTS idx_app_logs_action ON miomente_partner_app_logs(action);
CREATE INDEX IF NOT EXISTS idx_app_logs_user_id ON miomente_partner_app_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_status_timestamp ON miomente_partner_app_logs(status, timestamp DESC);

-- Comment on table
COMMENT ON TABLE miomente_partner_app_logs IS 'Stores all API operation logs for monitoring and debugging';
