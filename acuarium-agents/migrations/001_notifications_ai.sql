-- Run this in Supabase SQL Editor (project juknambxnuuovycjqlrf)

-- Add notification fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_pref text NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS product_interests text[];

-- Add AI toggle to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;
