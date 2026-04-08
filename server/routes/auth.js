import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { signToken } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

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

    const token = signToken(user);

    res.cookie('skech_token', token, COOKIE_OPTIONS);
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error('Signup error:', err);
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
    const token = signToken(safeUser);

    res.cookie('skech_token', token, COOKIE_OPTIONS);
    return res.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('skech_token', { path: '/' });
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
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const state = uuidv4();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/google/callback`,
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
      return res.redirect('/login?auth_error=invalid_state');
    }

    res.clearCookie('oauth_state', { path: '/' });

    const redirectUri = `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/google/callback`;

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
      console.error('Google token error:', tokenData);
      return res.redirect('/login?auth_error=google_token_failed');
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userInfoRes.json();

    if (!googleUser.sub) {
      return res.redirect('/login?auth_error=google_failed');
    }

    const existingProvider = await pool.query(
      'SELECT user_id FROM user_auth_providers WHERE provider = $1 AND provider_id = $2',
      ['google', String(googleUser.sub)],
    );

    let userId;

    if (existingProvider.rows.length > 0) {
      userId = existingProvider.rows[0].user_id;

      await pool.query(
        'UPDATE user_auth_providers SET access_token = $1, updated_at = NOW() WHERE provider = $2 AND provider_id = $3',
        [tokenData.access_token, 'google', String(googleUser.sub)],
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
        'INSERT INTO user_auth_providers (user_id, provider, provider_id, access_token) VALUES ($1, $2, $3, $4)',
        [userId, 'google', String(googleUser.sub), tokenData.access_token],
      );
    }

    const userResult = await pool.query('SELECT id, email, name, avatar_url FROM users WHERE id = $1', [userId]);

    const user = userResult.rows[0];
    const token = signToken(user);

    res.cookie('skech_token', token, COOKIE_OPTIONS);
    return res.redirect('/');
  } catch (err) {
    console.error('Google OAuth error:', err);
    return res.redirect('/login?auth_error=google_failed');
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
    redirect_uri: `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/github/callback`,
    scope: 'read:user user:email',
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
      return res.redirect('/?auth_error=invalid_state');
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
      return res.redirect('/?auth_error=github_token_failed');
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

    const existingProvider = await pool.query(
      'SELECT user_id FROM user_auth_providers WHERE provider = $1 AND provider_id = $2',
      ['github', String(ghUser.id)],
    );

    let userId;

    if (existingProvider.rows.length > 0) {
      userId = existingProvider.rows[0].user_id;

      await pool.query(
        'UPDATE user_auth_providers SET access_token = $1, updated_at = NOW() WHERE provider = $2 AND provider_id = $3',
        [tokenData.access_token, 'github', String(ghUser.id)],
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
        'INSERT INTO user_auth_providers (user_id, provider, provider_id, access_token) VALUES ($1, $2, $3, $4)',
        [userId, 'github', String(ghUser.id), tokenData.access_token],
      );
    }

    const userResult = await pool.query(
      'SELECT id, email, name, avatar_url FROM users WHERE id = $1',
      [userId],
    );

    const user = userResult.rows[0];
    const token = signToken(user);

    res.cookie('skech_token', token, COOKIE_OPTIONS);
    return res.redirect('/');
  } catch (err) {
    console.error('GitHub OAuth error:', err);
    return res.redirect('/?auth_error=github_failed');
  }
});

export default router;
