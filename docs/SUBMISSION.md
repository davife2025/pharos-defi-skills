# Hackathon Submission — Pharos DeFi Skills

**Event:** Skill-to-Agent Dual Cascade Hackathon  
**Phase:** Phase 1 — Skills  
**Track:** DeFi / On-Chain Finance  
**Submitted to:** DoraHacks  

---

## Project Summary

**Pharos DeFi Skills** is a monorepo of four production-ready, composable Skill modules for the Pharos AI Agent ecosystem, plus a complete Agent Interface Layer that makes them instantly callable by any Agent framework.

The Skills focus on the foundational **read layer** of DeFi: knowing wallet state, knowing token prices, and knowing whether a transaction is affordable before it's ever submitted. These are the primitives every future DeFi Agent on Pharos will need, making this submission maximally reusable and composable.

---

## Skills Submitted

### 1. `portfolio_snapshot` (v2 — Multicall3)

Returns a complete portfolio snapshot for any wallet on Pharos in a **single RPC call** using Multicall3. Fetches native PHRS balance and any number of ERC-20 token balances atomically at the same block.

**Why it matters:** Every DeFi Agent on Pharos needs to know wallet state before acting. This is the foundational read primitive — swap Agents, yield Agents, and payment Agents all call this first.

**Key design decisions:**
- Multicall3 batching — 1 RPC call regardless of how many tokens are queried
- Non-fatal token failures — partial results returned if individual tokens fail
- `SkillResult<T>` envelope — typed success/error, never throws

### 2. `token_price_feed`

Fetches real-time spot prices from on-chain Uniswap V2 compatible DEX pool reserves on Pharos. Pure on-chain — no oracle dependency, no off-chain APIs.

**Why it matters:** Before any swap or valuation decision, an Agent needs to know the current price. This Skill gives Agents on-chain price truth derived directly from pool reserves.

**Key design decisions:**
- Reserve ratio price derivation with full decimal adjustment
- Auto-discovers best quote token from configured stables
- Designed for plug-and-play once live DEX factory addresses are published

### 3. `gas_estimator`

Estimates gas cost for any transaction on Pharos and optionally checks whether the sender wallet can afford to execute it. Returns `TRANSACTION_WOULD_REVERT` if simulation fails — Agents should abort on this signal.

**Why it matters:** An Agent that blindly submits transactions is dangerous. This Skill gives Agents a safe pre-flight check — know the cost, verify affordability, get a buffered gas limit — before any on-chain action.

**Key design decisions:**
- 20% gas buffer automatically applied to `suggestedGasLimit`
- Separate affordability check: gas cost + tx value vs wallet balance
- `TRANSACTION_WOULD_REVERT` error code makes Agent abort logic trivial

### 4. `token_swap`

Executes a token swap on a Uniswap V2 compatible DEX on Pharos. Handles all swap directions — PHRS ↔ ERC-20 and ERC-20 ↔ ERC-20. Automatically handles token approval, slippage tolerance, and transaction deadline.

**Why it matters:** This is the execution primitive — the skill that actually moves value on-chain. Combined with the three read Skills above, an Agent has everything it needs to autonomously manage a DeFi portfolio: know state → check price → verify affordability → execute.

**Key design decisions:**
- Auto-approval: checks and requests ERC-20 allowance before swapping if needed
- Slippage-protected: `amountOutMin` derived from live quote × (1 - slippage)
- Private key used only in-memory to sign — never logged, cached, or persisted
- `TRANSACTION_REVERTED` error code distinct from execution errors

---

## Agent Interface Layer

Beyond the four Skills, this submission includes a complete Agent Interface Layer:

**Dispatcher (`dispatch` / `dispatchMany`)**  
A typed routing function that accepts a `{ skill, params }` envelope and routes to the correct implementation. Agent frameworks never import skills directly — they call the dispatcher.

**Skill Registry (`SKILL_REGISTRY`)**  
A manifest of all Skills with name, description, version, and full JSON input/output schemas. Agent frameworks call `GET /skills` to discover capabilities before acting.

**HTTP Agent Server**  
A production-ready Express server exposing all Skills over REST:
- `GET /skills` — skill discovery
- `POST /skills/invoke` — single skill dispatch
- `POST /skills/invoke/batch` — parallel multi-skill dispatch (max 10)
- `POST /skills/:skillName` — shorthand invocation

---

## Judging Criteria Alignment

| Criterion | How this submission addresses it |
|-----------|----------------------------------|
| **Originality** | Focus on the read/intelligence layer — most submissions will be action Skills (swap, transfer). Portfolio snapshot + price feed + pre-flight gas check is a cohesive, original set. |
| **Technical quality** | TypeScript strict mode, full typed contracts, Multicall3 optimisation, 404/error handling, rate limiting, test suites with Jest + Supertest |
| **Practical use case** | Every DeFi Agent on Pharos needs these Skills before and during any action — read state, check price, estimate gas, execute swap |
| **Reusability** | `SkillResult<T>` envelope + dispatcher pattern means any Agent framework integrates in minutes |
| **Composability** | Skills chain naturally: snapshot → price → gas → act. `dispatchMany` supports parallel pre-flight |
| **Pharos integration** | Chain ID 688688, native PHRS currency, Multicall3 on Pharos, ZAN RPC, testnet.pharosscan.xyz |
| **Documentation** | Skill specs, integration guide, deployment guide, inline code comments throughout |

---

## Repository Structure

```
pharos-defi-skills/
├── packages/
│   ├── skills/          # Core skill library (@pharos-defi-skills/skills)
│   └── agent-server/    # HTTP server (@pharos-defi-skills/agent-server)
├── docs/
│   ├── skill-portfolio-snapshot.md
│   ├── skill-token-price-feed.md
│   ├── skill-gas-estimator.md
│   └── guides/
│       ├── agent-integration.md
│       └── deployment.md
└── README.md
```

---

## Running the Project

```bash
yarn install
cp .env.example .env    # add PHAROS_TESTNET_RPC from zan.top
yarn test               # run all test suites
yarn dev:server         # start Agent HTTP server on :3000
```

---

## What's Next (Phase 2)

The four Phase 1 Skills form a complete foundation for a full **DeFi Portfolio Agent** in Phase 2. The execution primitive (`token_swap`) is already built — Phase 2 adds the Agent reasoning layer on top:

1. Accepts natural language goals ("rebalance my portfolio to 50% PHRS, 50% USDC")
2. Calls `portfolio_snapshot` to know current state
3. Calls `token_price_feed` to value current holdings and plan swap amounts
4. Calls `gas_estimator` for each planned transaction — aborts if unaffordable
5. Calls `token_swap` to execute each swap on-chain via Pharos
6. Calls `portfolio_snapshot` again to confirm the rebalance succeeded

The Agent Interface Layer built in Phase 1 — the dispatcher, registry, and HTTP server — is exactly what Phase 2 needs. No new infrastructure required.
