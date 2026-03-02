-- Migration: Add shipping tracking fields to orders table
-- Date: 2026-03-02
-- Description: Adds fields for Envia.com integration and shipping tracking

-- Add shipping tracking columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(50),
ADD COLUMN IF NOT EXISTS shipping_service VARCHAR(100),
ADD COLUMN IF NOT EXISTS shipping_tracking_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS shipping_label_url TEXT,
ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS shipping_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);

-- Add index for tracking number lookups
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number 
ON orders(shipping_tracking_number);

-- Add index for payment intent lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent 
ON orders(stripe_payment_intent_id);

-- Create enum for shipping status if not exists
DO $$ BEGIN
    CREATE TYPE shipping_status_enum AS ENUM (
        'pending',
        'quote_requested',
        'quote_sent',
        'label_created',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'failed',
        'returned',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update shipping_status column to use enum (optional, can keep as VARCHAR)
-- ALTER TABLE orders ALTER COLUMN shipping_status TYPE shipping_status_enum USING shipping_status::shipping_status_enum;

COMMENT ON COLUMN orders.shipping_carrier IS 'Shipping carrier from Envia.com (fedex, dhl, estafeta, etc)';
COMMENT ON COLUMN orders.shipping_service IS 'Specific service type (express, standard, etc)';
COMMENT ON COLUMN orders.shipping_tracking_number IS 'Tracking number from carrier';
COMMENT ON COLUMN orders.shipping_label_url IS 'URL to download shipping label PDF';
COMMENT ON COLUMN orders.shipping_cost IS 'Actual shipping cost charged';
COMMENT ON COLUMN orders.shipping_status IS 'Current shipping status';
COMMENT ON COLUMN orders.stripe_payment_intent_id IS 'Stripe Payment Intent ID for tracking';
