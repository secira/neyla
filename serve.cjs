const express = require('express');
const path = require('path');
const fs = require('fs');
const { createRequestHandler } = require('@remix-run/node');

const BUILD_DIR = path.join(__dirname, 'build');
const PORT = process.env.PORT || 5000;
const clientDir = path.join(BUILD_DIR, 'client');
const serverEntry = path.join(BUILD_DIR, 'server', 'index.js');

if (!fs.existsSync(serverEntry) || !fs.existsSync(clientDir)) {
  console.error('Build files missing. Run npm run build first.');
  process.exit(1);
}

const app = express();

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

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

async function getBuild() {
  if (!buildModule) {
    buildModule = await import('./build/server/index.js');
  }
  return buildModule;
}

getBuild().catch((err) => console.error('Build preload error:', err));

app.all('{*path}', async (req, res, next) => {
  try {
    const build = await getBuild();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          headers.append(key, v);
        }
      }
    }

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    const webRequest = new Request(url.href, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
      duplex: 'half',
      signal: controller.signal,
    });

    const handler = createRequestHandler(build, 'production');
    const webResponse = await handler(webRequest);

    res.status(webResponse.status);

    for (const [key, value] of webResponse.headers.entries()) {
      res.setHeader(key, value);
    }

    if (webResponse.body) {
      const reader = webResponse.body.getReader();

      async function pump() {
        const { done, value } = await reader.read();

        if (done) {
          res.end();
          return;
        }

        res.write(Buffer.from(value));
        await pump();
      }

      await pump();
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Request error:', error);
    next(error);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
