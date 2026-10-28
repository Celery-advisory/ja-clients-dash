-- Report publishing: reports start as drafts, a wealth manager publishes them,
-- and the portal records when the client first and last opened each one.

ALTER TABLE wealth.reports
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE wealth.reports
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS summary jsonb,
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Everything already in the portal was published when it was generated.
UPDATE wealth.reports
SET published_at = COALESCE(sent_at, generated_at)
WHERE status = 'published' AND published_at IS NULL;

CREATE INDEX IF NOT EXISTS reports_client_status_idx
  ON wealth.reports (client_id, status, generated_at DESC);
