<div align="center">

# Pharos DeFi Skills

**Reusable DeFi Skill modules for the Pharos AI Agent ecosystem**

[![Pharos Testnet](https://img.shields.io/badge/Pharos-Testnet%20688688-6C5CE7)](https://testnet.pharosscan.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)
[![Node ≥18](https://img.shields.io/badge/Node-%3E%3D18-blue)](https://nodejs.org)
[![Built for Hackathon](https://img.shields.io/badge/Built%20for-Skill--to--Agent%20Hackathon-orange)](https://dorahacks.io)

> Submitted to the **Skill-to-Agent Dual Cascade Hackathon** — Phase 1  
> Pharos × Anvita Flow · Pharos 1st Anniversary

</div>

---

## What Is This?

This monorepo delivers a suite of **Skills** — narrowly scoped, fully typed, composable functions that AI Agents call to interact with the Pharos blockchain. Each Skill follows a strict `input → SkillResult<output>` contract so any Agent framework can integrate them without understanding the underlying chain mechanics.

Three Skills ship in Phase 1, plus a complete Agent Interface Layer (HTTP server + dispatcher) so Agents can invoke Skills over REST or directly in code.

---

## Skills

| Skill | Description | Session |
|-------|-------------|---------|
| [`portfolio_snapshot`](docs/skill-portfolio-snapshot.md) | Native PHRS + ERC-20 balances for any wallet via Multicall3 | 1 + 2 |
| [`token_price_feed`](docs/skill-token-price-feed.md) | Real-time spot price from on-chain DEX pool reserves | 3 |
| [`gas_estimator`](docs/skill-gas-estimator.md) | Gas cost estimation + wallet affordability pre-flight check | 3 |
| [`token_swap`](docs/skill-token-swap.md) | Execute token swaps on Pharos DEX — PHRS ↔ ERC-20 and ERC-20 ↔ ERC-20 | 7 |

---

## Monorepo Structure

```
pharos-defi-skills/
├── packages/
│   ├── skills/                         # Core Skill library
│   │   └── src/
│   │       ├── skills/
│   │       │   ├── portfolio-snapshot/ # Skill: portfolio_snapshot
│   │       │   ├── token-price-feed/   # Skill: token_price_feed
│   │       │   └── gas-estimator/      # Skill: gas_estimator
│   │       ├── agent/
│   │       │   ├── dispatcher.ts       # dispatch() + dispatchMany()
│   │       │   ├── registry.ts         # Skill manifest with JSON schemas
│   │       │   └── types.ts            # AgentSkillCall / AgentSkillResponse
│   │       ├── lib/
│   │       │   └── multicall.ts        # Multicall3 batch executor
│   │       ├── abi/                    # ERC-20, Multicall3, DEX ABIs
│   │       └── config/
│   │           └── chains.ts           # Pharos Testnet + Mainnet config
│   └── agent-server/                   # HTTP server exposing Skills over REST
│       └── src/
│           ├── app.ts                  # Express routes + middleware
│           └── index.ts               # Server entry point
├── docs/                               # Skill specs + integration guides
├── .env.example
└── package.json
```

---

## Quick Start

### 1. Install

```bash
yarn install
```

### 2. Configure

```bash
cp .env.example .env
# Add your PHAROS_TESTNET_RPC from https://zan.top
```

### 3. Run tests

```bash
yarn test
```

### 4. Start the Agent server

```bash
yarn dev:server
# → http://localhost:3000
```

---

## Using Skills in Code

```typescript
import { portfolioSnapshot, gasEstimator, dispatch } from "@pharos-defi-skills/skills";

// ── Direct skill call ──────────────────────────────────────────────────────────
const snapshot = await portfolioSnapshot({
  walletAddress: "0xYourWallet",
  tokenAddresses: ["0xTokenA", "0xTokenB"],
  network: "testnet",
});

if (snapshot.success) {
  console.log(snapshot.data.nativeBalance.balance); // "5.25" PHRS
  console.log(snapshot.data.tokenBalances);
}

// ── Via dispatcher (Agent-style) ───────────────────────────────────────────────
const response = await dispatch({
  skill: "gas_estimator",
  params: {
    transaction: { from: "0xSender", to: "0xRecipient" },
    checkAffordability: true,
    network: "testnet",
  },
  requestId: "agent-req-001",
});

if (response.result.success) {
  const { canAfford, shortfallPHRS } = response.result.data.affordability!;
  console.log(canAfford ? "Proceed" : `Need ${shortfallPHRS} more PHRS`);
}
```

---

## Agent Server API

```bash
# Discover all skills + their schemas
GET  /health
GET  /skills

# Invoke a single skill
POST /skills/invoke
Body: { "skill": "portfolio_snapshot", "params": { "walletAddress": "0x..." } }

# Invoke multiple skills in parallel (max 10)
POST /skills/invoke/batch
Body: { "calls": [ { "skill": "...", "params": {...} }, ... ] }

# Shorthand — params directly, no envelope
POST /skills/:skillName
Body: { "walletAddress": "0x..." }
```

### Example — batch pre-flight check

```bash
curl -X POST http://localhost:3000/skills/invoke/batch \
  -H "Content-Type: application/json" \
  -d '{
    "calls": [
      {
        "skill": "portfolio_snapshot",
        "params": { "walletAddress": "0xYourWallet", "network": "testnet" }
      },
      {
        "skill": "gas_estimator",
        "params": {
          "transaction": { "from": "0xYourWallet", "to": "0xContract" },
          "checkAffordability": true,
          "network": "testnet"
        }
      }
    ]
  }'
```

---

## Pharos Network

| Property | Testnet | Mainnet |
|----------|---------|---------|
| Chain ID | 688688 | 1672 |
| Currency | PHRS | PHRS |
| Finality | ~1 second | ~1 second |
| TPS | 30,000 | 30,000 |
| Explorer | [testnet.pharosscan.xyz](https://testnet.pharosscan.xyz) | [pharosscan.xyz](https://pharosscan.xyz) |
| RPC | ZAN (api.zan.top) | ZAN (api.zan.top) |

---

## Architecture Principles

- **Single responsibility** — each Skill does exactly one thing
- **Typed contracts** — `SkillResult<T>` envelope on every skill; no naked throws
- **Graceful failures** — partial token failures never crash the whole skill
- **Agent-ready** — clean JSON in, JSON out; no side effects; stateless
- **Multicall3 efficiency** — all on-chain reads batched in a single RPC call
- **Composable** — Skills chain naturally: snapshot → price → gas → act

---

## License

MIT
