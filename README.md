# Pharos DeFi Skills — Monorepo

> Reusable DeFi Skill modules for the Pharos AI Agent ecosystem.  
> Built for the **Skill-to-Agent Dual Cascade Hackathon** by Pharos × Anvita Flow.

---

## What Is This?

This monorepo contains a suite of **Skills** — modular, composable functions that AI Agents can call to interact with the Pharos blockchain. Each Skill has a clean typed interface (`input → SkillResult<output>`) so any Agent framework can integrate them without understanding the underlying chain mechanics.

---

## Monorepo Structure

```
pharos-defi-skills/
├── packages/
│   └── skills/               # Core Skill modules
│       ├── src/
│       │   ├── skills/
│       │   │   └── portfolio-snapshot/   # Session 1
│       │   ├── abi/                      # ERC-20 and other ABIs
│       │   ├── config/                   # Chain config + RPC providers
│       │   └── index.ts                  # Public exports
│       └── test/
├── docs/                     # Skill specs and integration guides
├── .env.example
└── package.json              # Yarn workspaces root
```

---

## Skills Included

| Session | Skill | Description |
|---------|-------|-------------|
| 1 | `portfolio_snapshot` | Fetch native + ERC-20 balances for any wallet |
| 2 | `portfolio_snapshot` (v2) | Multicall3 optimised batch fetching |
| 3 | `token_price_feed` | Real-time token prices from on-chain DEX pools |
| 3 | `gas_estimator` | Estimate gas cost + affordability check |
| 4 | Agent Interface Layer | JSON-RPC skill dispatcher for Agent frameworks |

---

## Quick Start

### 1. Install dependencies

```bash
yarn install
```

### 2. Configure environment

```bash
cp .env.example .env
# Add your PHAROS_TESTNET_RPC from https://zan.top
```

### 3. Run tests

```bash
yarn test
```

### 4. Build

```bash
yarn build
```

---

## Using a Skill

```typescript
import { portfolioSnapshot } from "@pharos-defi-skills/skills";

const result = await portfolioSnapshot({
  walletAddress: "0xYourWallet",
  tokenAddresses: ["0xTokenA", "0xTokenB"],
  network: "testnet",
});

if (result.success) {
  console.log(result.data.nativeBalance);   // PHRS balance
  console.log(result.data.tokenBalances);   // ERC-20 balances
  console.log(result.data.blockNumber);     // Snapshot block
} else {
  console.error(result.error.code, result.error.message);
}
```

---

## Pharos Network Details

| Property | Testnet | Mainnet |
|----------|---------|---------|
| Chain ID | 688688 | 1672 |
| Currency | PHRS | PHRS |
| RPC | ZAN (api.zan.top) | api.zan.top |
| Explorer | testnet.pharosscan.xyz | pharosscan.xyz |
| Finality | ~1 second | ~1 second |
| TPS | 30,000 | 30,000 |

---

## Architecture Principles

- **Single responsibility** — each Skill does one thing
- **Typed contracts** — every Skill uses `SkillResult<T>` envelope
- **Graceful failures** — partial failures never crash the whole skill
- **Agent-ready** — clean JSON in, JSON out; no side effects

---

## License

MIT
