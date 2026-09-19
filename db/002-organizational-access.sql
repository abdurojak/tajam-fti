CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS departments_name_ci_idx
  ON departments (lower(name));

CREATE TABLE IF NOT EXISTS study_programs (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS study_programs_department_name_ci_idx
  ON study_programs (department_id, lower(name));

INSERT INTO departments (id, name) VALUES
  ('teknik-informatika', 'Jurusan Teknik Informatika'),
  ('teknik-elektro', 'Jurusan Teknik Elektro'),
  ('teknik-industri', 'Jurusan Teknik Industri'),
  ('teknik-mesin', 'Jurusan Teknik Mesin'),
  ('program-profesi-insinyur', 'Jurusan Program Profesi Insinyur')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, updated_at=now();

INSERT INTO study_programs (id, department_id, name) VALUES
  ('teknik-informatika', 'teknik-informatika', 'Teknik Informatika'),
  ('sistem-informasi', 'teknik-informatika', 'Sistem Informasi'),
  ('teknik-elektro', 'teknik-elektro', 'Teknik Elektro'),
  ('magister-teknik-elektro', 'teknik-elektro', 'Magister Teknik Elektro'),
  ('teknik-industri', 'teknik-industri', 'Teknik Industri'),
  ('magister-teknik-industri', 'teknik-industri', 'Magister Teknik Industri'),
  ('doktor-teknik-industri', 'teknik-industri', 'Doktor Teknik Industri'),
  ('teknik-mesin', 'teknik-mesin', 'Teknik Mesin'),
  ('magister-teknik-mesin', 'teknik-mesin', 'Magister Teknik Mesin'),
  ('program-profesi-insinyur', 'program-profesi-insinyur', 'Program Profesi Insinyur')
ON CONFLICT (id) DO UPDATE SET
  department_id=EXCLUDED.department_id, name=EXCLUDED.name, updated_at=now();

CREATE TABLE IF NOT EXISTS team_members (
  email TEXT PRIMARY KEY CHECK (email = lower(email)),
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'department', 'study_program')),
  department_id TEXT REFERENCES departments(id),
  study_program_id TEXT REFERENCES study_programs(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (role='admin' AND scope_type='global' AND department_id IS NULL AND study_program_id IS NULL)
    OR (role<>'admin' AND scope_type='department' AND department_id IS NOT NULL AND study_program_id IS NULL)
    OR (role<>'admin' AND scope_type='study_program' AND department_id IS NULL AND study_program_id IS NOT NULL)
  )
);

INSERT INTO team_members
  (email, role, scope_type, department_id, study_program_id, active)
VALUES
  ('labtif.fti@trisakti.ac.id', 'admin', 'global', NULL, NULL, true),
  ('iwan.purwanto@trisakti.ac.id', 'admin', 'global', NULL, NULL, true),
  ('abdurojak@trisakti.ac.id', 'editor', 'department', 'teknik-informatika', NULL, true),
  ('ricardo.dharma@trisakti.ac.id', 'editor', 'department', 'teknik-informatika', NULL, true),
  ('aszani@trisakti.ac.id', 'editor', 'study_program', NULL, 'sistem-informasi', true),
  ('rifdah.amelia@trisakti.ac.id', 'editor', 'study_program', NULL, 'sistem-informasi', true),
  ('tri.swasono@trisakti.ac.id', 'editor', 'department', 'teknik-elektro', NULL, true),
  ('thalia.pk@trisakti.ac.id', 'editor', 'department', 'teknik-industri', NULL, true),
  ('agus.dwicahyo@trisakti.ac.id', 'editor', 'department', 'teknik-mesin', NULL, true)
ON CONFLICT (email) DO UPDATE SET
  role=EXCLUDED.role,
  scope_type=EXCLUDED.scope_type,
  department_id=EXCLUDED.department_id,
  study_program_id=EXCLUDED.study_program_id,
  active=EXCLUDED.active,
  updated_at=now();

CREATE TABLE IF NOT EXISTS access_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_value JSONB,
  after_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_audit_created_idx
  ON access_audit_log (created_at DESC, id DESC);

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS study_program_id TEXT REFERENCES study_programs(id);

UPDATE content AS c
SET study_program_id = p.id
FROM study_programs AS p
WHERE c.study_program_id IS NULL
  AND lower(trim(c.payload->>'prodi')) = lower(p.name);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM content WHERE study_program_id IS NULL) THEN
    RAISE EXCEPTION 'Migrasi dibatalkan: terdapat nama prodi lama yang tidak dikenal atau ambigu.';
  END IF;
END $$;

ALTER TABLE content ALTER COLUMN study_program_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS content_study_program_idx
  ON content (study_program_id, created_at DESC, id);
