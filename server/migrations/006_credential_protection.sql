-- Keep provider OAuth tokens and deployment-agent credentials out of plaintext
-- database columns. Legacy values are encrypted and cleared at server startup.
ALTER TABLE user_auth_providers
  ADD COLUMN IF NOT EXISTS access_token_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_ciphertext TEXT;

ALTER TABLE deployments
  ADD COLUMN IF NOT EXISTS agent_token_ciphertext TEXT;

ALTER TABLE deployments
  ALTER COLUMN agent_token DROP NOT NULL;