# Skill Spec: `token_price_feed`

**Version:** 1.0.0  
**Category:** DeFi / Pricing  
**Chain:** Pharos (Testnet 688688 / Mainnet 1672)

---

## Overview

Fetches the real-time spot price of any ERC-20 token from an on-chain Uniswap V2 compatible DEX pool on Pharos. Price is derived directly from pool reserves — no oracle dependency, no off-chain APIs.

---

## Input

```typescript
{
  tokenAddress: string;         // Required. Token to price (0x...)
  quoteTokenAddress?: string;   // Optional. Quote token (e.g. USDC). Defaults to best stable.
  factoryAddress?: string;      // Optional. DEX factory. Defaults to PharosSwap.
  network?: "testnet" | "mainnet"; // Default: "testnet"
}
```

---

## Output

```typescript
{
  tokenAddress: string;
  tokenSymbol: string;
  quoteTokenAddress: string;
  quoteTokenSymbol: string;
  price: string;           // e.g. "3200.00000000" (8 decimal places)
  priceRaw: string;        // High-precision 18 decimal string
  pool: {
    pairAddress: string;
    token0: string;
    token1: string;
    reserve0: string;
    reserve1: string;
  };
  blockNumber: number;
  chainId: number;
  network: string;
  fetchedAt: string;
}
```

---

## Error Codes

| Code | Cause |
|------|-------|
| `NO_FACTORY_CONFIGURED` | DEX factory address is zero — update `src/abi/dex.ts` |
| `NO_QUOTE_TOKEN` | No quote token provided and no stables configured |
| `NO_POOL_FOUND` | No liquidity pool exists for this token pair |
| `SKILL_EXECUTION_FAILED` | General RPC / execution error |

---

## Configuration

Update `src/abi/dex.ts` with live Pharos DEX factory and stable token addresses once available on mainnet.

---

## Agent Usage Pattern

```
Agent receives task: "Should I buy token X?"
  → calls token_price_feed        (this skill)
  → calls portfolio_snapshot      (Session 1)
  → compares price vs holdings
  → decides action
```
