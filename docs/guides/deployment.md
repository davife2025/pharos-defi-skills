# Deployment Guide

## Local Development

```bash
# 1. Clone and install
git clone <your-repo>
cd pharos-defi-skills
yarn install

# 2. Configure environment
cp .env.example .env
# Edit .env — add PHAROS_TESTNET_RPC from https://zan.top

# 3. Run all tests
yarn test

# 4. Build all packages
yarn build

# 5. Start agent server
yarn dev:server     # development (ts-node, no build needed)
yarn start:server   # production (requires yarn build first)
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PHAROS_TESTNET_RPC` | Yes | ZAN RPC endpoint for Pharos Testnet |
| `PHAROS_FALLBACK_RPC` | No | Public fallback RPC (rate limited) |
| `PHAROS_MAINNET_RPC` | No | Mainnet RPC (when available) |
| `PORT` | No | Agent server port (default: 3000) |
| `HOST` | No | Agent server host (default: 0.0.0.0) |
| `NODE_ENV` | No | `development` or `production` |

---

## Getting a ZAN RPC Key

1. Visit [https://zan.top](https://zan.top)
2. Create a free account
3. Create a new project → select **Pharos Testnet**
4. Copy the RPC URL into `PHAROS_TESTNET_RPC` in your `.env`

The public fallback RPC (`https://testnet.dplabs-internal.com`) works without
a key but is rate-limited and not suitable for production.

---

## Setting Up Supabase (optional — enables caching + analytics)

1. Create a free project at [https://supabase.com](https://supabase.com)
2. Go to **SQL Editor** in the Supabase dashboard
3. Paste and run the contents of `packages/skills/src/lib/migrations/001_cache_schema.sql`
4. Copy your project URL and service key into `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

Once configured, the following are enabled automatically:
- `portfolio_snapshot` — cache hit on same block (instant repeat calls)
- `token_price_feed` — 15-second TTL cache (reduces DEX RPC load)
- `skill_call_log` — analytics table for every dispatch call

Without Supabase configured, all skills work normally with no caching.

---

## Configuring Live DEX Addresses

Once Pharos mainnet DEX contracts are live, update `src/abi/dex.ts`:

```typescript
export const PHAROS_DEX_FACTORIES: Record<string, string> = {
  pharosswap: "0xLIVE_FACTORY_ADDRESS_HERE",
};

export const STABLE_TOKENS: Record<string, string[]> = {
  testnet: ["0xUSDC_ON_TESTNET"],
  mainnet: ["0xUSDC_ON_MAINNET", "0xUSDT_ON_MAINNET"],
};
```

This unlocks `token_price_feed` for real token pricing.

---

## Production Deployment (Railway / Render / Fly.io)

The `agent-server` package is a standard Express app. Deploy it like any Node.js service:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN yarn install --frozen-lockfile
RUN yarn build
EXPOSE 3000
CMD ["yarn", "start:server"]
```

Set the environment variables in your platform's dashboard.

---

## Verifying Deployment

```bash
# Health check
curl https://your-deployed-url/health

# Skills discovery
curl https://your-deployed-url/skills

# Live skill test
curl -X POST https://your-deployed-url/skills/portfolio_snapshot \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","network":"testnet"}'
```
