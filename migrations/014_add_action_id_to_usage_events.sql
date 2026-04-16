-- ABOUTME: Adds action_id to llm_usage_events to group multiple API calls belonging to one user action.
-- ABOUTME: Nullable so existing rows are unaffected; indexed for efficient grouping queries.

ALTER TABLE llm_usage_events ADD COLUMN IF NOT EXISTS action_id UUID;

CREATE INDEX IF NOT EXISTS idx_llm_usage_events_action_id ON llm_usage_events(action_id)
  WHERE action_id IS NOT NULL;
