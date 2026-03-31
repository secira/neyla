#!/bin/bash
WRANGLER_CMD="pages dev"
node --require ./polyfill-file.cjs node_modules/.pnpm/wrangler@4.44.0_@cloudflare+workers-types@4.20251014.0/node_modules/wrangler/wrangler-dist/cli.js $WRANGLER_CMD ./build/client --port 5000 &
WRANGLER_PID=$!

node server/index.js &
AUTH_PID=$!

wait $WRANGLER_PID $AUTH_PID
