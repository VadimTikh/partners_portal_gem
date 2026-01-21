-- Migration: Create booking confirmations table for partner booking management
-- Run this on your PostgreSQL database before using the Booking Confirmation feature

-- Main booking confirmations table
CREATE TABLE IF NOT EXISTS miomente_partner_portal_booking_confirmations (
    id SERIAL PRIMARY KEY,

    -- Magento order reference
    magento_order_id INTEGER NOT NULL,
    magento_order_item_id INTEGER NOT NULL,
    magento_order_increment_id VARCHAR(50),

    -- Partner reference (links to miomente_partner_portal_users via customer_number)
    customer_number VARCHAR(50) NOT NULL,

    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),

    -- Token-based authentication for email links
    confirmation_token VARCHAR(64) UNIQUE NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Confirmation details
    confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmed_by VARCHAR(50), -- 'email_token' or 'portal'

    -- Decline details
    declined_at TIMESTAMP WITH TIME ZONE,
    declined_by VARCHAR(50), -- 'email_token' or 'portal'
    decline_reason VARCHAR(100),
    decline_notes TEXT,

    -- Reminder tracking
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMP WITH TIME ZONE,
    escalated_at TIMESTAMP WITH TIME ZONE,
    odoo_ticket_id VARCHAR(50),

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_conf_customer
    ON miomente_partner_portal_booking_confirmations(customer_number);

CREATE INDEX IF NOT EXISTS idx_booking_conf_status
    ON miomente_partner_portal_booking_confirmations(status);

CREATE INDEX IF NOT EXISTS idx_booking_conf_token
    ON miomente_partner_portal_booking_confirmations(confirmation_token);

CREATE INDEX IF NOT EXISTS idx_booking_conf_magento_order
    ON miomente_partner_portal_booking_confirmations(magento_order_id);

CREATE INDEX IF NOT EXISTS idx_booking_conf_magento_order_item
    ON miomente_partner_portal_booking_confirmations(magento_order_item_id);

-- Partial index for pending bookings needing reminders
CREATE INDEX IF NOT EXISTS idx_booking_conf_pending_reminders
    ON miomente_partner_portal_booking_confirmations(status, reminder_count, created_at)
    WHERE status = 'pending';

-- Index for finding bookings by order increment ID (human-readable order number)
CREATE INDEX IF NOT EXISTS idx_booking_conf_increment_id
    ON miomente_partner_portal_booking_confirmations(magento_order_increment_id);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_booking_confirmation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS booking_confirmation_updated ON miomente_partner_portal_booking_confirmations;
CREATE TRIGGER booking_confirmation_updated
    BEFORE UPDATE ON miomente_partner_portal_booking_confirmations
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_confirmation_timestamp();

-- Comment on table
COMMENT ON TABLE miomente_partner_portal_booking_confirmations IS 'Tracks partner confirmations/declines for customer bookings from Magento orders';

-- Decline reasons reference table (optional, can also be hardcoded in code)
CREATE TABLE IF NOT EXISTS miomente_partner_portal_decline_reasons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    label_de VARCHAR(255) NOT NULL,
    label_en VARCHAR(255) NOT NULL,
    label_uk VARCHAR(255),
    requires_notes BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed decline reasons
INSERT INTO miomente_partner_portal_decline_reasons (code, label_de, label_en, label_uk, sort_order) VALUES
    ('date_unavailable', 'Termin nicht mehr verfügbar', 'Date no longer available', 'Дата більше недоступна', 1),
    ('capacity_full', 'Kapazität erschöpft', 'Capacity full', 'Місткість вичерпана', 2),
    ('equipment_issue', 'Ausstattungsproblem', 'Equipment issue', 'Проблема з обладнанням', 3),
    ('personal_reason', 'Persönlicher Grund', 'Personal reason', 'Особиста причина', 4),
    ('other', 'Sonstiges', 'Other', 'Інше', 99)
ON CONFLICT (code) DO NOTHING;

-- Comment on decline reasons table
COMMENT ON TABLE miomente_partner_portal_decline_reasons IS 'Reference table for standardized decline reasons';

-- Unique constraint to prevent duplicate confirmations for same order item
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_conf_unique_order_item
    ON miomente_partner_portal_booking_confirmations(magento_order_id, magento_order_item_id);
