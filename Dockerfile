# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# CI-friendly env
ENV HUSKY=0
ENV CI=true

# Use pnpm (match version used to generate lockfile)
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

# Ensure git is available for build and runtime scripts
RUN apt-get update && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*

# Accept (optional) build-time public URL for Remix/Vite
ARG VITE_PUBLIC_APP_URL
ENV VITE_PUBLIC_APP_URL=${VITE_PUBLIC_APP_URL}

# Copy source and install dependencies
COPY package.json pnpm-lock.yaml* ./
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build the Remix app (SSR + client)
RUN NODE_OPTIONS=--max-old-space-size=4096 pnpm run build

# ---- production dependencies stage ----
FROM build AS prod-deps

# Keep only production deps for runtime
RUN pnpm prune --prod --ignore-scripts


# ---- production stage ----
FROM node:22-bookworm-slim AS bolt-ai-production
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Non-sensitive build arguments
ARG VITE_LOG_LEVEL=debug
ARG DEFAULT_NUM_CTX

ENV VITE_LOG_LEVEL=${VITE_LOG_LEVEL} \
    DEFAULT_NUM_CTX=${DEFAULT_NUM_CTX} \
    RUNNING_IN_DOCKER=true

# Install curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# Copy built app, production deps, and server files
COPY --from=prod-deps /app/build /app/build
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/package.json /app/package.json
COPY --from=prod-deps /app/serve.cjs /app/serve.cjs

EXPOSE 5000

# Healthcheck — uses $PORT set by Railway (defaults to 5000)
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD curl -fsS http://localhost:${PORT:-5000}/health || exit 1

# Start production server
CMD ["node", "serve.cjs"]


# ---- development stage ----
FROM build AS development

ARG VITE_LOG_LEVEL=debug
ARG DEFAULT_NUM_CTX

ENV VITE_LOG_LEVEL=${VITE_LOG_LEVEL} \
    DEFAULT_NUM_CTX=${DEFAULT_NUM_CTX} \
    RUNNING_IN_DOCKER=true

RUN mkdir -p /app/run
CMD ["pnpm", "run", "start:replit", "--host"]
