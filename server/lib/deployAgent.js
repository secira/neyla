const AGENT_SCRIPT = `
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SKECH_SERVER_BASE;
const TOKEN = process.env.SKECH_AGENT_TOKEN;
const DEPLOYMENT_ID = process.env.SKECH_DEPLOYMENT_ID;
const APP_DIR = '/opt/neyla/app';
const POLL_INTERVAL = 10000;

let currentVersion = 0;
let child = null;
let deploying = false;

async function api(method, route, body) {
  const url = BASE + '/api/deployments/agent/' + DEPLOYMENT_ID + route;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error('agent api ' + route + ' -> ' + res.status);
  return res.json();
}

function report(status, extra) {
  return api('POST', '/status', { status, ...extra }).catch(() => {});
}

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: APP_DIR, stdio: 'inherit', ...opts });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(cmd + ' exited ' + code))));
    p.on('error', reject);
  });
}

function stopApp() {
  if (child) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    child = null;
  }
}

function startStaticServer(dir) {
  const types = { html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon', txt: 'text/plain', woff: 'font/woff', woff2: 'font/woff2' };
  const server = http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let filePath = path.normalize(path.join(dir, urlPath));
      if (!filePath.startsWith(dir)) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
      if (!fs.existsSync(filePath)) filePath = path.join(dir, 'index.html');
      if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
      const ext = filePath.split('.').pop().toLowerCase();
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } catch { res.writeHead(500); res.end(); }
  });
  server.listen(80, '0.0.0.0');
  return server;
}

let staticServer = null;

async function deploy(version) {
  deploying = true;
  try {
    await report('deploying', { detail: 'Downloading your app' });
    const bundle = await api('GET', '/bundle');

    stopApp();
    if (staticServer) { try { staticServer.close(); } catch {} staticServer = null; }
    fs.rmSync(APP_DIR, { recursive: true, force: true });
    fs.mkdirSync(APP_DIR, { recursive: true });

    for (const f of bundle.files) {
      const dest = path.normalize(path.join(APP_DIR, f.path));
      if (!dest.startsWith(APP_DIR)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, f.content);
    }

    let pkg = null;
    const pkgPath = path.join(APP_DIR, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); } catch {}
    }

    if (pkg) {
      await report('deploying', { detail: 'Installing dependencies' });
      await run('npm', ['install', '--no-audit', '--no-fund']);
      if (pkg.scripts && pkg.scripts.build) {
        await report('deploying', { detail: 'Building your app' });
        await run('npm', ['run', 'build']);
      }
    }

    await report('deploying', { detail: 'Starting your app' });

    const distDir = ['dist', 'build', 'out'].map((d) => path.join(APP_DIR, d)).find((d) => fs.existsSync(path.join(d, 'index.html')));

    let childExited = false;

    if (pkg && pkg.scripts && pkg.scripts.start && !distDir) {
      child = spawn('npm', ['start'], {
        cwd: APP_DIR,
        stdio: 'inherit',
        detached: true,
        env: { ...process.env, PORT: '80', HOST: '0.0.0.0', NODE_ENV: 'production' },
      });
      child.on('exit', () => { child = null; childExited = true; });
    } else {
      staticServer = startStaticServer(distDir || APP_DIR);
    }

    // Wait until the app actually answers on port 80 before reporting live
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      if (childExited) break;
      ready = await new Promise((resolve) => {
        const req = http.get({ host: '127.0.0.1', port: 80, path: '/', timeout: 3000 }, (res) => {
          res.resume();
          resolve(res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });
      if (ready) break;
    }

    if (!ready) {
      throw new Error(childExited ? 'The app crashed right after starting' : 'The app did not start listening on port 80');
    }

    currentVersion = version;
    await report('live', { version });
  } catch (err) {
    await report('error', { error: String(err && err.message ? err.message : err) });
  } finally {
    deploying = false;
  }
}

async function tick() {
  if (deploying) return;
  try {
    const info = await api('GET', '/poll');
    if (info.version > currentVersion) {
      await deploy(info.version);
    }
  } catch {}
}

tick();
setInterval(tick, POLL_INTERVAL);
`;

export function buildUserData({ serverBase, deploymentId, agentToken }) {
  const agentB64 = Buffer.from(AGENT_SCRIPT, 'utf8').toString('base64');

  return `#!/bin/bash
set -x
dnf install -y nodejs npm
mkdir -p /opt/neyla
echo '${agentB64}' | base64 -d > /opt/neyla/agent.mjs
cat > /etc/systemd/system/neyla-agent.service <<'UNIT'
[Unit]
Description=Neyla deploy agent
After=network-online.target
Wants=network-online.target

[Service]
Environment=SKECH_SERVER_BASE=${serverBase}
Environment=SKECH_AGENT_TOKEN=${agentToken}
Environment=SKECH_DEPLOYMENT_ID=${deploymentId}
ExecStart=/usr/bin/node /opt/neyla/agent.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now neyla-agent
`;
}
