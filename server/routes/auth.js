import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { signToken, JWT_SECRET } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { ensurePersonalOrganization } from '../lib/projectFoundation.js';
import { decryptCredential, encryptCredential } from '../lib/credentialVault.js';
import { encryptManagedSecret, secretMetadata } from '../lib/managedSecrets.js';
import { recordSecurityEvent } from '../lib/securityAudit.js';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

function safeErrorLabel(error) {
  return error?.code || error?.name || 'unknown';
}

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userResult = await pool.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id, email, name, avatar_url, created_at',
      [email.toLowerCase(), name || email.split('@')[0]],
    );

    const user = userResult.rows[0];

    await pool.query('INSERT INTO user_passwords (user_id, password_hash) VALUES ($1, $2)', [
      user.id,
      passwordHash,
    ]);
    await ensurePersonalOrganization(user.id, user.name);

    const token = signToken(user);

    res.cookie('neyla_token', token, COOKIE_OPTIONS);
    return res.status(201).json({ user });
  } catch (err) {
    console.error('Signup error:', safeErrorLabel(err));
    return res.status(500).json({ error: 'Failed to create account' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userResult = await pool.query(
      'SELECT u.id, u.email, u.name, u.avatar_url, u.created_at, p.password_hash FROM users u LEFT JOIN user_passwords p ON p.user_id = u.id WHERE u.email = $1',
      [email.toLowerCase()],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses social login. Please sign in with GitHub or Google.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { password_hash: _ph, ...safeUser } = user;
    await ensurePersonalOrganization(safeUser.id, safeUser.name);
    const token = signToken(safeUser);

    res.cookie('neyla_token', token, COOKIE_OPTIONS);
    return res.json({ user: safeUser });
  } catch (err) {
    console.error('Login error:', safeErrorLabel(err));
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('neyla_token', { path: '/' });
  return res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Me error:', safeErrorLabel(err));
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

function getAppUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${host}`;
}

router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const state = uuidv4();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${getAppUrl(req)}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 10 * 60 * 1000, path: '/' });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies?.oauth_state;

    if (!state || state !== storedState) {
      return res.redirect('/auth/popup-success?auth_error=invalid_state');
    }

    res.clearCookie('oauth_state', { path: '/' });

    const redirectUri = `${getAppUrl(req)}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('Google token exchange failed:', safeErrorLabel(tokenData.error));
      return res.redirect('/auth/popup-success?auth_error=google_token_failed');
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userInfoRes.json();

    if (!googleUser.sub) {
      return res.redirect('/auth/popup-success?auth_error=google_failed');
    }

    const existingProvider = await pool.query(
      'SELECT user_id FROM user_auth_providers WHERE provider = $1 AND provider_id = $2',
      ['google', String(googleUser.sub)],
    );

    let userId;

    if (existingProvider.rows.length > 0) {
      userId = existingProvider.rows[0].user_id;

      await pool.query(
        'UPDATE user_auth_providers SET access_token = NULL, access_token_ciphertext = $1, updated_at = NOW() WHERE provider = $2 AND provider_id = $3',
        [encryptCredential(tokenData.access_token), 'google', String(googleUser.sub)],
      );

      if (googleUser.picture) {
        await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2 AND (avatar_url IS NULL OR avatar_url = $3)', [
          googleUser.picture,
          userId,
          googleUser.picture,
        ]);
      }
    } else {
      let existingUser = null;

      if (googleUser.email) {
        const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [googleUser.email]);
        if (emailCheck.rows.length > 0) existingUser = emailCheck.rows[0];
      }

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const newUser = await pool.query(
          'INSERT INTO users (email, name, avatar_url) VALUES ($1, $2, $3) RETURNING id',
          [googleUser.email || null, googleUser.name || googleUser.email?.split('@')[0] || 'User', googleUser.picture || null],
        );
        userId = newUser.rows[0].id;
      }

      await pool.query(
        'INSERT INTO user_auth_providers (user_id, provider, provider_id, access_token_ciphertext) VALUES ($1, $2, $3, $4)',
        [userId, 'google', String(googleUser.sub), encryptCredential(tokenData.access_token)],
      );
    }

    const userResult = await pool.query('SELECT id, email, name, avatar_url FROM users WHERE id = $1', [userId]);

    const user = userResult.rows[0];
    await ensurePersonalOrganization(user.id, user.name);
    const token = signToken(user);

    res.cookie('neyla_token', token, COOKIE_OPTIONS);
    return res.redirect('/auth/popup-success');
  } catch (err) {
    console.error('Google OAuth error:', err?.code || err?.name || 'unknown');
    return res.redirect('/auth/popup-success?auth_error=google_failed');
  }
});

router.get('/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }

  const state = uuidv4();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${getAppUrl(req)}/api/auth/github/callback`,
    scope: 'read:user user:email repo',
    state,
  });

  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 10 * 60 * 1000, path: '/' });
  return res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/github/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies?.oauth_state;

    if (!state || state !== storedState) {
      return res.redirect('/auth/popup-success?auth_error=invalid_state');
    }

    res.clearCookie('oauth_state', { path: '/' });

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.redirect('/auth/popup-success?auth_error=github_token_failed');
    }

    const ghUserRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const ghUser = await ghUserRes.json();

    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const emails = await emailRes.json();
    const primaryEmail = emails.find((e) => e.primary && e.verified)?.email || emails[0]?.email;

    // If the user is already logged in (Google/email account), link GitHub to
    // their existing account instead of creating/logging into a separate one.
    let linkedUserId = null;

    const existingSession = req.cookies?.neyla_token;

    if (existingSession) {
      try {
        const payload = jwt.verify(existingSession, JWT_SECRET);
        linkedUserId = payload.id;
      } catch {
        linkedUserId = null;
      }
    }

    const existingProvider = await pool.query(
      'SELECT user_id FROM user_auth_providers WHERE provider = $1 AND provider_id = $2',
      ['github', String(ghUser.id)],
    );

    if (linkedUserId) {
      if (existingProvider.rows.length > 0 && existingProvider.rows[0].user_id !== linkedUserId) {
        return res.redirect('/auth/popup-success?auth_error=github_already_linked');
      }

      if (existingProvider.rows.length > 0) {
        await pool.query(
          'UPDATE user_auth_providers SET access_token = NULL, access_token_ciphertext = $1, updated_at = NOW() WHERE provider = $2 AND provider_id = $3',
          [encryptCredential(tokenData.access_token), 'github', String(ghUser.id)],
        );
      } else {
        await pool.query(
          'INSERT INTO user_auth_providers (user_id, provider, provider_id, access_token_ciphertext) VALUES ($1, $2, $3, $4)',
          [linkedUserId, 'github', String(ghUser.id), encryptCredential(tokenData.access_token)],
        );
      }

      await ensurePersonalOrganization(linkedUserId);
      return res.redirect('/auth/popup-success');
    }

    let userId;

    if (existingProvider.rows.length > 0) {
      userId = existingProvider.rows[0].user_id;

      await pool.query(
        'UPDATE user_auth_providers SET access_token = NULL, access_token_ciphertext = $1, updated_at = NOW() WHERE provider = $2 AND provider_id = $3',
        [encryptCredential(tokenData.access_token), 'github', String(ghUser.id)],
      );
    } else {
      let existingUser = null;

      if (primaryEmail) {
        const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [primaryEmail]);
        if (emailCheck.rows.length > 0) existingUser = emailCheck.rows[0];
      }

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const newUser = await pool.query(
          'INSERT INTO users (email, name, avatar_url) VALUES ($1, $2, $3) RETURNING id',
          [primaryEmail || null, ghUser.name || ghUser.login, ghUser.avatar_url],
        );
        userId = newUser.rows[0].id;
      }

      await pool.query(
        'INSERT INTO user_auth_providers (user_id, provider, provider_id, access_token_ciphertext) VALUES ($1, $2, $3, $4)',
        [userId, 'github', String(ghUser.id), encryptCredential(tokenData.access_token)],
      );
    }

    const userResult = await pool.query(
      'SELECT id, email, name, avatar_url FROM users WHERE id = $1',
      [userId],
    );

    const user = userResult.rows[0];
    await ensurePersonalOrganization(user.id, user.name);
    const token = signToken(user);

    res.cookie('neyla_token', token, COOKIE_OPTIONS);
    return res.redirect('/auth/popup-success');
  } catch (err) {
    console.error('GitHub OAuth error:', err?.code || err?.name || 'unknown');
    return res.redirect('/auth/popup-success?auth_error=github_failed');
  }
});

router.get('/settings', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT settings FROM users WHERE id = $1', [req.user.id]);

    if (result.rows.length === 0) {
      return res.json({ settings: {} });
    }

    return res.json({ settings: result.rows[0].settings || {} });
  } catch (err) {
    console.error('Get settings error:', safeErrorLabel(err));
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', requireAuth, async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings must be an object' });
    }

    await pool.query(
      'UPDATE users SET settings = $1 WHERE id = $2',
      [JSON.stringify(settings), req.user.id],
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Update settings error:', safeErrorLabel(err));
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.delete('/providers/:provider', requireAuth, async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();

  if (!['github', 'google'].includes(provider)) {
    return res.status(400).json({ error: 'Unsupported provider' });
  }

  try {
    const providerResult = await pool.query(
      'SELECT id FROM user_auth_providers WHERE user_id = $1 AND provider = $2',
      [req.user.id, provider],
    );

    if (providerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Provider is not connected' });
    }

    const [passwordResult, providerCountResult] = await Promise.all([
      pool.query('SELECT 1 FROM user_passwords WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT COUNT(*)::int AS count FROM user_auth_providers WHERE user_id = $1', [req.user.id]),
    ]);

    if (!passwordResult.rows.length && providerCountResult.rows[0].count <= 1) {
      return res.status(409).json({
        error: 'Connect another sign-in method before disconnecting your only account login.',
      });
    }

    await pool.query('DELETE FROM user_auth_providers WHERE user_id = $1 AND provider = $2', [
      req.user.id,
      provider,
    ]);
    await recordSecurityEvent({
      userId: req.user.id,
      action: 'provider_disconnected',
      provider,
    });

    return res.json({ success: true, provider, connected: false });
  } catch (err) {
    console.error('Provider disconnect error:', err?.code || err?.name || 'unknown');
    return res.status(500).json({ error: 'Failed to disconnect provider' });
  }
});

router.get('/secrets', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, provider, key_name, hint, enabled, created_at, updated_at FROM user_secrets WHERE user_id = $1 ORDER BY provider, key_name',
      [req.user.id],
    );
    return res.json({ secrets: result.rows.map(secretMetadata) });
  } catch (err) {
    console.error('List user secrets error:', safeErrorLabel(err));
    return res.status(500).json({ error: 'Failed to fetch secrets' });
  }
});

router.post('/secrets', requireAuth, async (req, res) => {
  const { provider, key_name: keyName, value } = req.body || {};
  if (!provider || !keyName || !value) return res.status(400).json({ error: 'Provider, key name, and value are required' });
  try {
    const encrypted = encryptManagedSecret(value);
    const result = await pool.query(
      `INSERT INTO user_secrets (user_id, provider, key_name, ciphertext, hint)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, provider, key_name) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, hint = EXCLUDED.hint, enabled = TRUE, updated_at = NOW()
       RETURNING id, provider, key_name, hint, enabled, created_at, updated_at`,
      [req.user.id, provider, keyName, encrypted.ciphertext, encrypted.hint],
    );
    return res.status(201).json({ secret: secretMetadata(result.rows[0]) });
  } catch (err) {
    console.error('Save user secret error:', safeErrorLabel(err));
    return res.status(500).json({ error: 'Failed to save secret' });
  }
});

router.put('/secrets/:id', requireAuth, async (req, res) => {
  const { value, enabled, provider, key_name: keyName } = req.body || {};
  try {
    const fields = [], params = [];
    if (value) { const encrypted = encryptManagedSecret(value); fields.push(`ciphertext = $${params.push(encrypted.ciphertext)}`, `hint = $${params.push(encrypted.hint)}`); }
    if (typeof enabled === 'boolean') fields.push(`enabled = $${params.push(enabled)}`);
    if (provider) fields.push(`provider = $${params.push(provider)}`);
    if (keyName) fields.push(`key_name = $${params.push(keyName)}`);
    if (!fields.length) return res.status(400).json({ error: 'No changes supplied' });
    fields.push('updated_at = NOW()');
    params.push(req.user.id, req.params.id);
    const result = await pool.query(`UPDATE user_secrets SET ${fields.join(', ')} WHERE user_id = $${params.length - 1} AND id = $${params.length} RETURNING id, provider, key_name, hint, enabled, created_at, updated_at`, params);
    if (!result.rows.length) return res.status(404).json({ error: 'Secret not found' });
    return res.json({ secret: secretMetadata(result.rows[0]) });
  } catch (err) {
    console.error('Update user secret error:', safeErrorLabel(err));
    return res.status(500).json({ error: 'Failed to update secret' });
  }
});

router.delete('/secrets/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM user_secrets WHERE user_id = $1 AND id = $2 RETURNING id', [req.user.id, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Secret not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete user secret error:', safeErrorLabel(err));
    return res.status(500).json({ error: 'Failed to delete secret' });
  }
});

router.get('/github/status', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT access_token_ciphertext FROM user_auth_providers WHERE user_id = $1 AND provider = 'github'",
      [req.user.id],
    );

    const accessToken = decryptCredential(result.rows[0]?.access_token_ciphertext);

    if (!accessToken) {
      return res.json({ connected: false });
    }

    const ghRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!ghRes.ok) {
      return res.json({ connected: false, needsReauth: true });
    }

    const scopes = (ghRes.headers.get('x-oauth-scopes') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const ghUser = await ghRes.json();

    return res.json({
      connected: true,
      username: ghUser.login,
      hasRepoScope: scopes.includes('repo'),
    });
  } catch (err) {
    console.error('GitHub status error:', safeErrorLabel(err));
    return res.status(500).json({ error: 'Failed to check GitHub connection' });
  }
});

export default router;
