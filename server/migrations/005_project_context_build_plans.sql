-- Store Neyla's structured project context and the human-approved plans that guide generation.
CREATE TABLE IF NOT EXISTS project_context (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  application_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_build_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  request TEXT NOT NULL DEFAULT '',
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  specification JSONB NOT NULL DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  CONSTRAINT project_build_plans_status_check CHECK (status IN ('draft', 'approved', 'cancelled')),
  UNIQUE (project_id, version)
);

CREATE INDEX IF NOT EXISTS idx_project_build_plans_project_updated
  ON project_build_plans(project_id, updated_at DESC);

INSERT INTO project_context (project_id)
SELECT id FROM projects
ON CONFLICT (project_id) DO NOTHING;