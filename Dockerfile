# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json yarn.lock* ./
COPY packages/skills/package.json ./packages/skills/
COPY packages/agent-server/package.json ./packages/agent-server/

# Install all dependencies (including dev for build)
RUN yarn install --frozen-lockfile

# Copy source
COPY tsconfig.json ./
COPY packages/skills/ ./packages/skills/
COPY packages/agent-server/ ./packages/agent-server/

# Build both packages
RUN yarn build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace manifests
COPY package.json yarn.lock* ./
COPY packages/skills/package.json ./packages/skills/
COPY packages/agent-server/package.json ./packages/agent-server/

# Install production dependencies only
RUN yarn install --frozen-lockfile --production

# Copy compiled output from builder
COPY --from=builder /app/packages/skills/dist ./packages/skills/dist
COPY --from=builder /app/packages/agent-server/dist ./packages/agent-server/dist

# Non-root user for security
RUN addgroup -S pharos && adduser -S pharos -G pharos
USER pharos

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "packages/agent-server/dist/index.js"]
