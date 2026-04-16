-- ABOUTME: Database schema for per-user LLM token tracking and credit-based tier limits
-- ABOUTME: Adds tier to users, creates llm_usage_events and user_credits tables, and seeds admin_config pricing

-- Add tier column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
  CHECK (tier IN ('free', 'pro'));

-- LLM usage events table (append-only audit log of every LLM API call)
CREATE TABLE IF NOT EXISTS llm_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  service TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  input_cost_usd NUMERIC(10, 8) NOT NULL,
  output_cost_usd NUMERIC(10, 8) NOT NULL,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_events_user_id ON llm_usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_created_at ON llm_usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_user_created ON llm_usage_events(user_id, created_at DESC);

-- User credits table (running total of USD spent, one row per user)
CREATE TABLE IF NOT EXISTS user_credits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atomic upsert function to add LLM call cost to a user's running credit total
CREATE OR REPLACE FUNCTION increment_user_credits(
  p_user_id UUID,
  p_amount NUMERIC
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_credits (user_id, total_cost_usd, updated_at)
  VALUES (p_user_id, p_amount, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_cost_usd = user_credits.total_cost_usd + EXCLUDED.total_cost_usd,
    updated_at = NOW();
END;
$$;

-- Seed admin_config with LLM pricing, tier limits, and default model
INSERT INTO admin_config (id, key, value, updated_at) VALUES
  (
    gen_random_uuid(),
    'llm_pricing',
    '{
      "claude-sonnet-4-0": { "input_per_1m": 3.00, "output_per_1m": 15.00 },
      "claude-opus-4-6":   { "input_per_1m": 5.00, "output_per_1m": 25.00 },
      "claude-haiku-4-5":  { "input_per_1m": 1.00, "output_per_1m": 5.00 }
    }'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'tier_limits',
    '{ "free": 5.00, "pro": null }'::jsonb,
    NOW()
  ),
  (
    gen_random_uuid(),
    'llm_default_model',
    '"claude-sonnet-4-0"'::jsonb,
    NOW()
  )
ON CONFLICT (key) DO NOTHING;
