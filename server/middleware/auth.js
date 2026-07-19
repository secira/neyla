import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'neyla-dev-secret-change-in-production';

export function requireAuth(req, res, next) {
  const token = req.cookies?.neyla_token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
}

export { JWT_SECRET };
