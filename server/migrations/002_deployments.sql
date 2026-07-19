-- Deployment tables: EC2 instance tracking and file bundles
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id TEXT,
  public_ip TEXT,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  status_detail TEXT,
  error TEXT,
  bundle_version INTEGER NOT NULL DEFAULT 0,
  deployed_version INTEGER NOT NULL DEFAULT 0,
  agent_token TEXT NOT NULL,
  last_agent_poll TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deployment_bundles (
  deployment_id UUID PRIMARY KEY REFERENCES deployments(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  files JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
