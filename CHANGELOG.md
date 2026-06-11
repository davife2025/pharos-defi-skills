# Changelog

All notable changes to this project are documented here.

---

## [1.3.0] — Session 8 · Audit Fixes

### Fixed
- `packages/skills/test/dispatcher.test.ts` — updated skill count from 3 → 4, added `token_swap` routing test
- `packages/agent-server/test/server.test.ts` — updated skill count from 3 → 4, added `token_swap` to names assertion, added 7 auth middleware tests (no key, missing key, wrong key, correct key via `x-api-key`, correct key via `Bearer`, public route bypass for `/health` and `/skills`)
- `packages/skills/src/index.ts` — added missing cache function exports (`getCachedPortfolioSnapshot`, `setCachedPortfolioSnapshot`, `getCachedTokenPrice`, `setCachedTokenPrice`, `logSkillCall`) and `TokenSwapInput`/`TokenSwapOutput` type exports

### Added
- `docs/skill-token-swap.md` — full skill spec for `token_swap` with input/output schema, error codes, security note, config guide, and Agent usage pattern

---

## [1.2.0] — Session 7 · Supabase Cache + token_swap + Auth

### Added
- `packages/skills/src/lib/supabase.ts` — singleton Supabase client, `isSupabaseConfigured()` guard
- `packages/skills/src/lib/cache.ts` — portfolio snapshot cache (block-keyed), token price cache (15s TTL), skill call analytics log. All operations fire-and-forget — never block skill execution
- `packages/skills/src/lib/migrations/001_cache_schema.sql` — full Supabase schema: `portfolio_snapshot_cache`, `token_price_cache`, `skill_call_log` tables with indexes, RLS policies, and `purge_expired_cache()` function
- `packages/skills/src/skills/token-swap/` — new skill: quote → slippage → auto-approval → submit → wait for receipt. All swap directions (PHRS↔ERC-20, ERC-20↔ERC-20)
- `packages/skills/src/abi/router.ts` — Uniswap V2 Router ABI + `PHAROS_ROUTER_ADDRESSES` config
- `packages/agent-server/src/middleware/auth.ts` — `apiKeyAuth` middleware: `x-api-key` header or `Authorization: Bearer`, public route bypass, disabled when `AGENT_SERVER_API_KEY` not set

### Changed
- `packages/skills/src/skills/portfolio-snapshot/index.ts` — cache read before RPC, cache write after fetch
- `packages/skills/src/skills/token-price-feed/index.ts` — cache read before RPC, cache write with 15s TTL
- `packages/skills/src/agent/dispatcher.ts` — routes `token_swap`, fires `logSkillCall` on every dispatch
- `packages/skills/src/agent/types.ts` — added `token_swap` to `SkillName`, `SkillInputMap`, `SkillOutputMap`
- `packages/skills/src/agent/registry.ts` — added `token_swap` to `SKILL_REGISTRY` with full JSON schema
- `packages/skills/package.json` — added `@supabase/supabase-js` dependency
- `packages/agent-server/src/app.ts` — auth middleware wired in
- `.env.example` — added `SUPABASE_*` and `AGENT_SERVER_API_KEY` vars

---

## [1.0.0] — Session 5 · Docs + Submission Polish

### Added
- `README.md` — full project overview, quick start, API reference, architecture principles
- `LICENSE` — MIT
- `docs/SUBMISSION.md` — hackathon submission document with judging criteria alignment
- `docs/guides/agent-integration.md` — how to connect any Agent framework (direct import, HTTP, LangChain)
- `docs/guides/deployment.md` — local dev, ZAN RPC setup, DEX config, production Docker deployment
- `CHANGELOG.md` — this file

---

## [0.4.0] — Session 4 · Agent Interface Layer

### Added
- `packages/skills/src/agent/types.ts` — `AgentSkillCall`, `AgentSkillResponse`, `SkillName`, full typed input/output maps
- `packages/skills/src/agent/registry.ts` — `SKILL_REGISTRY` manifest with full JSON schemas for all 3 skills
- `packages/skills/src/agent/dispatcher.ts` — `dispatch()` and `dispatchMany()` — single routing entry point
- `packages/skills/src/agent/index.ts` — agent module exports
- `packages/agent-server/` — new package: production Express HTTP server
  - `GET /health` — health check
  - `GET /skills` — skill registry discovery
  - `POST /skills/invoke` — single skill dispatch with envelope
  - `POST /skills/invoke/batch` — parallel multi-skill dispatch (max 10)
  - `POST /skills/:skillName` — shorthand invocation
  - Rate limiting (100 req/min), CORS, Helmet security headers, request ID injection
- `packages/skills/test/dispatcher.test.ts` — dispatcher + registry unit tests
- `packages/agent-server/test/server.test.ts` — full HTTP integration test suite

### Changed
- `packages/skills/src/index.ts` — exports `dispatch`, `dispatchMany`, `SKILL_REGISTRY`, all agent types
- `package.json` (root) — added `start:server` and `dev:server` scripts
- `.env.example` — added `PORT` and `HOST` variables

---

## [0.3.0] — Session 3 · token_price_feed + gas_estimator

### Added
- `packages/skills/src/skills/token-price-feed/` — new skill
  - Uniswap V2 reserve-based spot price derivation
  - Auto-discovers quote token from configured stables
  - Full decimal adjustment for cross-precision pairs
- `packages/skills/src/skills/gas-estimator/` — new skill
  - `estimateGas` + EIP-1559 fee data
  - 20% buffer on `suggestedGasLimit`
  - Optional affordability check: gas cost + value vs wallet balance
  - `TRANSACTION_WOULD_REVERT` error code for revert detection
- `packages/skills/src/abi/dex.ts` — Uniswap V2 Factory + Pair ABIs, DEX factory config, stable token config
- `packages/skills/test/token-price-feed.test.ts`
- `packages/skills/test/gas-estimator.test.ts`
- `docs/skill-token-price-feed.md`
- `docs/skill-gas-estimator.md`

### Changed
- `packages/skills/src/index.ts` — exports new skills and ABIs

---

## [0.2.0] — Session 2 · Multicall3 Optimisation

### Added
- `packages/skills/src/abi/multicall3.ts` — Multicall3 ABI + address constant
- `packages/skills/src/lib/multicall.ts` — `multicallPortfolioFetch()`: single-RPC batch for native + all ERC-20 balances

### Changed
- `packages/skills/src/skills/portfolio-snapshot/index.ts`
  - Path A (tokens provided): Multicall3 — one RPC call for everything
  - Path B (native only): direct `getBalance` call — no overhead

---

## [0.1.0] — Session 1 · Full Codebase Architecture

### Added
- Yarn workspaces monorepo scaffold
- `packages/skills/` — core skill library
- `packages/skills/src/config/chains.ts` — Pharos Testnet + Mainnet chain config, provider factory
- `packages/skills/src/abi/erc20.ts` — minimal ERC-20 ABI
- `packages/skills/src/skills/portfolio-snapshot/` — first skill
  - `types.ts` — `PortfolioSnapshotInput`, `PortfolioSnapshotOutput`, `SkillResult<T>`, `SkillError`
  - `helpers.ts` — address validation, parallel token fetching
  - `index.ts` — core skill implementation
- `packages/skills/test/portfolio-snapshot.test.ts`
- `docs/skill-portfolio-snapshot.md`
- `README.md` (v1)
- `.env.example`
- `.gitignore`
- `tsconfig.json`
