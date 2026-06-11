# Integration Guide: Connecting an AI Agent to Pharos DeFi Skills

This guide shows how to wire the Pharos DeFi Skills server into an AI Agent — whether you're using LangChain, a custom agent loop, or calling the HTTP API directly.

---

## Option A — Direct TypeScript Import (no server needed)

Best for Agents running in the same Node.js process.

```typescript
import { dispatch, dispatchMany, SKILL_REGISTRY } from "@pharos-defi-skills/skills";

// Discover what skills are available
console.log(SKILL_REGISTRY.skills.map(s => s.name));
// → ["portfolio_snapshot", "token_price_feed", "gas_estimator"]

// Execute a skill
const result = await dispatch({
  skill: "portfolio_snapshot",
  params: {
    walletAddress: "0xYourAgentWallet",
    network: "testnet",
  },
});

if (result.result.success) {
  const { nativeBalance, tokenBalances } = result.result.data;
  // Agent now knows the wallet state — proceed with decision logic
}
```

---

## Option B — HTTP API (language-agnostic)

Best for Agents in Python, Rust, or any non-Node runtime.

### Start the server

```bash
cd pharos-defi-skills
yarn install
cp .env.example .env   # add your ZAN API key
yarn dev:server
# → Listening on http://0.0.0.0:3000
```

### Discover skills

```bash
curl http://localhost:3000/skills
```

Returns the full registry with JSON schemas — your Agent can use this
to understand what skills exist and what parameters they accept.

### Invoke a skill

```bash
curl -X POST http://localhost:3000/skills/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "portfolio_snapshot",
    "params": {
      "walletAddress": "0xYourAgentWallet",
      "network": "testnet"
    },
    "requestId": "agent-turn-42"
  }'
```

Response:

```json
{
  "skill": "portfolio_snapshot",
  "requestId": "agent-turn-42",
  "durationMs": 312,
  "result": {
    "success": true,
    "data": {
      "walletAddress": "0xYourAgentWallet",
      "nativeBalance": {
        "symbol": "PHRS",
        "balance": "5.25",
        "raw": "5250000000000000000",
        "decimals": 18
      },
      "tokenBalances": [],
      "blockNumber": 1048576,
      "blockTimestamp": 1717891200,
      "chainId": 688688,
      "network": "Pharos Testnet",
      "fetchedAt": "2025-06-09T10:00:00.000Z"
    }
  }
}
```

---

## Option C — LangChain Tool Wrapper

Wraps each skill as a LangChain `DynamicTool` so an LLM Agent can call them.

```typescript
import { DynamicTool } from "langchain/tools";
import { dispatch } from "@pharos-defi-skills/skills";

const portfolioTool = new DynamicTool({
  name: "portfolio_snapshot",
  description:
    "Returns the PHRS and ERC-20 token balances of a wallet on Pharos. " +
    "Input must be a JSON string with walletAddress (required) and " +
    "optionally tokenAddresses (array) and network ('testnet'|'mainnet').",
  func: async (input: string) => {
    const params = JSON.parse(input);
    const response = await dispatch({
      skill: "portfolio_snapshot",
      params,
    });
    return JSON.stringify(response.result);
  },
});

const gasEstimatorTool = new DynamicTool({
  name: "gas_estimator",
  description:
    "Estimates gas cost for a transaction on Pharos and checks if the wallet " +
    "can afford it. Input must be JSON with a transaction object ({from, to, data?, value?}) " +
    "and optionally checkAffordability (boolean) and network.",
  func: async (input: string) => {
    const params = JSON.parse(input);
    const response = await dispatch({
      skill: "gas_estimator",
      params,
    });
    return JSON.stringify(response.result);
  },
});

// Pass these tools to your LangChain agent
const tools = [portfolioTool, gasEstimatorTool];
```

---

## Recommended Agent Decision Pattern

This is the flow a well-built DeFi Agent on Pharos should follow for an on-chain swap:

```
1. portfolio_snapshot   → know the wallet state (balances, tokens)
2. token_price_feed     → know the current price of the token to swap
3. gas_estimator        → estimate cost + check affordability
   └── if canAfford === false → abort, notify user
   └── if result === TRANSACTION_WOULD_REVERT → abort, log reason
4. token_swap           → execute the swap on-chain
5. portfolio_snapshot   → confirm new balances after swap
```

### Parallel pre-flight (batch call)

Steps 1, 2, and 3 can be dispatched simultaneously since they're all reads:

```typescript
const [snapshot, price, gas] = await dispatchMany([
  {
    skill: "portfolio_snapshot",
    params: { walletAddress: agentWallet, network: "testnet" },
  },
  {
    skill: "token_price_feed",
    params: { tokenAddress: targetToken, network: "testnet" },
  },
  {
    skill: "gas_estimator",
    params: {
      transaction: { from: agentWallet, to: routerContract, data: calldata },
      checkAffordability: true,
      network: "testnet",
    },
  },
]);

// All three results arrive together — Agent makes a fully-informed decision
// Then execute if pre-flight passed:
if (gas.result.success && gas.result.data.affordability?.canAfford) {
  const swap = await dispatch({
    skill: "token_swap",
    params: {
      privateKey: process.env.AGENT_PRIVATE_KEY!,
      tokenIn: "NATIVE",
      tokenOut: targetToken,
      amountIn: "1.0",
      slippagePct: 0.5,
      routerAddress: routerContract,
      network: "testnet",
    },
  });
}
```

---

## Error Handling

Every skill returns a `SkillResult<T>` envelope — never throws:

```typescript
const result = await dispatch({ skill: "portfolio_snapshot", params });

if (!result.result.success) {
  const { code, message } = result.result.error;

  switch (code) {
    case "SKILL_EXECUTION_FAILED":
      // RPC issue or invalid input — retry or notify user
      break;
    case "TRANSACTION_WOULD_REVERT":
      // gas_estimator: tx will fail on-chain — abort
      break;
    case "NO_POOL_FOUND":
      // token_price_feed: no DEX liquidity for this pair
      break;
    case "UNKNOWN_SKILL":
      // dispatcher: skill name typo — check SKILL_REGISTRY
      break;
  }
}
```

---

## Rate Limits

The agent-server applies a default rate limit of **100 requests per minute per IP**.
Batch calls count as 1 request regardless of how many skills are in the batch.
Adjust `windowMs` and `max` in `packages/agent-server/src/app.ts` for your needs.
