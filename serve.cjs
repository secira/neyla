const express = require('express');
const path = require('path');
const { createRequestHandler } = require('@remix-run/node');

const BUILD_DIR = path.join(__dirname, 'build');
const PORT = process.env.PORT || 5000;

const app = express();

app.use(
  '/assets',
  express.static(path.join(BUILD_DIR, 'client', 'assets'), {
    immutable: true,
    maxAge: '1y',
  })
);

app.use(
  express.static(path.join(BUILD_DIR, 'client'), {
    maxAge: '1h',
  })
);

app.all('{*path}', async (req, res, next) => {
  try {
    const build = await import('./build/server/index.js');
    const handler = createRequestHandler({ build, mode: 'production' });
    return handler(req, res, next);
  } catch (error) {
    console.error('SSR Error:', error);
    next(error);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running on port ${PORT}`);
});
