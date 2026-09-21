CREATE TABLE IF NOT EXISTS content_calendar_events (
  content_id TEXT PRIMARY KEY,
  study_program_id TEXT NOT NULL REFERENCES study_programs(id),
  calendar_id TEXT,
  google_event_id TEXT NOT NULL,
  desired_action TEXT NOT NULL CHECK (desired_action IN ('upsert','delete')),
  sync_status TEXT NOT NULL CHECK (sync_status IN ('pending','synced','failed')),
  last_error TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_calendar_sync_idx
  ON content_calendar_events(sync_status,updated_at,content_id);

INSERT INTO content_calendar_events
  (content_id,study_program_id,calendar_id,google_event_id,desired_action,sync_status)
SELECT c.id,c.study_program_id,NULL,
  'tajam' || regexp_replace(lower(c.id),'[^0-9a-v]','','g'),
  CASE WHEN c.payload->>'status'='Batal' THEN 'delete' ELSE 'upsert' END,
  'pending'
FROM content c
ON CONFLICT(content_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version)
VALUES ('003-google-calendar-sync.sql')
ON CONFLICT DO NOTHING;
