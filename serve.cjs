const express = require('express');
const path = require('path');
const { createRequestHandler } = require('@remix-run/node');

const BUILD_DIR = path.join(__dirname, 'build');
const PORT = 5000;

console.log('Starting production server...');
console.log('Build directory:', BUILD_DIR);
console.log('Port:', PORT);

const fs = require('fs');
const serverEntry = path.join(BUILD_DIR, 'server', 'index.js');
const clientDir = path.join(BUILD_DIR, 'client');

if (!fs.existsSync(serverEntry)) {
  console.error('ERROR: Server build not found at', serverEntry);
  process.exit(1);
}

if (!fs.existsSync(clientDir)) {
  console.error('ERROR: Client build not found at', clientDir);
  process.exit(1);
}

console.log('Build files verified successfully');

const app = express();

app.use(
  '/assets',
  express.static(path.join(clientDir, 'assets'), {
    immutable: true,
    maxAge: '1y',
  })
);

app.use(
  express.static(clientDir, {
    maxAge: '1h',
  })
);

let buildModule;

async function loadBuild() {
  if (!buildModule) {
    console.log('Loading server build module...');
    buildModule = await import('./build/server/index.js');
    console.log('Server build module loaded successfully');
  }
  return buildModule;
}

loadBuild().catch((err) => {
  console.error('Failed to preload server build:', err);
});

app.all('{*path}', async (req, res, next) => {
  try {
    const build = await loadBuild();
    const handler = createRequestHandler({ build, mode: 'production' });
    return handler(req, res, next);
  } catch (error) {
    console.error('SSR Error:', error);
    next(error);
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server listening on http://0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});
