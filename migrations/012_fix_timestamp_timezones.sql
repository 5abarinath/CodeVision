-- ABOUTME: Fixes bare TIMESTAMP columns in migration 002 to TIMESTAMP WITH TIME ZONE
-- ABOUTME: Safe cast since Supabase runs in UTC so stored values are already effectively UTC

ALTER TABLE admin_config
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE;

ALTER TABLE waitlist_requests
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
  ALTER COLUMN approved_at TYPE TIMESTAMP WITH TIME ZONE;

ALTER TABLE feedback_submissions
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE;
