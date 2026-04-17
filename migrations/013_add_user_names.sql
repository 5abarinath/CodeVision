-- ABOUTME: Adds first_name and last_name columns to the users table for personalization.
-- ABOUTME: first_name defaults to '' so existing users are not blocked; last_name is nullable.

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
