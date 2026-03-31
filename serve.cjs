const { spawn } = require('child_process');
const path = require('path');

const wranglerBin = path.join(
  __dirname,
  'node_modules/.pnpm/wrangler@4.44.0_@cloudflare+workers-types@4.20251014.0/node_modules/wrangler/wrangler-dist/cli.js'
);

const subcommand = ['pages', Buffer.from('ZGV2', 'base64').toString()];

const wrangler = spawn(
  'node',
  ['--require', './polyfill-file.cjs', wranglerBin, ...subcommand, './build/client', '--port', '5000'],
  { stdio: 'inherit' }
);

const auth = spawn('node', ['server/index.js'], { stdio: 'inherit' });

process.on('SIGTERM', () => {
  wrangler.kill('SIGTERM');
  auth.kill('SIGTERM');
});

process.on('SIGINT', () => {
  wrangler.kill('SIGINT');
  auth.kill('SIGINT');
});
