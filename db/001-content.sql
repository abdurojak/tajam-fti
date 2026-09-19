CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_fingerprint_idx ON content (fingerprint);
CREATE INDEX IF NOT EXISTS content_created_idx ON content (created_at DESC, id);
