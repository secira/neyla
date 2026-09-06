-- Additive Neyla ownership model. Workspaces remain the Studio compatibility layer.
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_personal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_personal_owner
  ON organizations(owner_user_id)
  WHERE is_personal = TRUE;

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
  ON organization_members(user_id);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  legacy_workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL DEFAULT 'Untitled project',
  description TEXT NOT NULL DEFAULT '',
  url_id VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- Backfill one personal organization and membership for every existing user.
INSERT INTO organizations (name, slug, owner_user_id, is_personal)
SELECT
  COALESCE(NULLIF(TRIM(u.name), ''), NULLIF(split_part(u.email, '@', 1), ''), 'Personal') || '''s workspace',
  'personal-' || replace(u.id::text, '-', ''),
  u.id,
  TRUE
FROM users u
ON CONFLICT DO NOTHING;

INSERT INTO organization_members (organization_id, user_id, role)
SELECT id, owner_user_id, 'owner'
FROM organizations
WHERE is_personal = TRUE AND owner_user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Preserve every workspace's URL and data while exposing it as a project.
INSERT INTO projects (organization_id, legacy_workspace_id, title, description, url_id, created_at, updated_at)
SELECT
  o.id,
  w.id,
  COALESCE(w.title, 'Untitled project'),
  COALESCE(w.description, ''),
  COALESCE(w.url_id, w.id::text),
  w.created_at,
  w.updated_at
FROM workspaces w
JOIN organizations o ON o.owner_user_id = w.user_id AND o.is_personal = TRUE
ON CONFLICT (legacy_workspace_id) DO NOTHING;