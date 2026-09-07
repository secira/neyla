#!/usr/bin/env bash
set -euo pipefail

pnpm install --frozen-lockfile

node --input-type=module <<'NODE'
import { runMigrations } from './server/migrations/run.js';
import { migrateStoredCredentials } from './server/lib/credentialVault.js';

await runMigrations();
await migrateStoredCredentials();
NODE

# The production bundle is built by the deployment pipeline. This workspace's
# 5,000+ module Remix bundle exceeds the post-merge worker memory limit.