# Skill Spec: `portfolio_snapshot`

**Version:** 1.0.0  
**Category:** DeFi / Portfolio  
**Chain:** Pharos (Testnet 688688 / Mainnet 1672)

---

## Overview

Returns a complete portfolio snapshot for any wallet on Pharos — native PHRS balance plus any specified ERC-20 tokens — all captured at the same block for consistency.

This is the foundational "read" primitive for DeFi Agents. Any Agent that needs to know wallet state before executing a swap, transfer, or yield strategy calls this first.

---

## Input

```typescript
{
  walletAddress: string;       // Required. 0x... address
  tokenAddresses?: string[];   // Optional. ERC-20 contract addresses
  network?: "testnet" | "mainnet"; // Default: "testnet"
}
```

---

## Output

```typescript
{
  walletAddress: string;        // Checksummed wallet address
  nativeBalance: {
    symbol: "PHRS";
    name: "Pharos";
    decimals: 18;
    balance: string;            // e.g. "12.345678"
    raw: string;                // e.g. "12345678000000000000"
  };
  tokenBalances: Array<{
    address: string;            // Checksummed token address
    name: string;
    symbol: string;
    decimals: number;
    balance: string;
    raw: string;
    isEmpty: boolean;
  }>;
  blockNumber: number;
  blockTimestamp: number;       // Unix seconds
  chainId: number;
  network: string;
  fetchedAt: string;            // ISO 8601
}
```

---

## Error Codes

| Code | Cause |
|------|-------|
| `SKILL_EXECUTION_FAILED` | General execution error (invalid address, RPC down) |
| `BLOCK_FETCH_FAILED` | Could not retrieve the latest block from RPC |

---

## Example

```typescript
const result = await portfolioSnapshot({
  walletAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  tokenAddresses: ["0xSomeERC20OnPharos"],
  network: "testnet",
});

// result.data example:
{
  walletAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  nativeBalance: {
    symbol: "PHRS",
    name: "Pharos",
    decimals: 18,
    balance: "5.25",
    raw: "5250000000000000000"
  },
  tokenBalances: [
    {
      address: "0xSomeERC20OnPharos",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      balance: "100.0",
      raw: "100000000",
      isEmpty: false
    }
  ],
  blockNumber: 1048576,
  blockTimestamp: 1717891200,
  chainId: 688688,
  network: "Pharos Testnet",
  fetchedAt: "2025-06-09T10:00:00.000Z"
}
```

---

## Agent Usage Pattern

```
Agent receives task: "Check if user can afford a swap"
  → calls portfolio_snapshot      (this skill)
  → calls gas_estimator           (Session 3)
  → decides: proceed or abort
```

---

## Notes

- Token failures are non-fatal — if one ERC-20 call fails, the rest still return
- All balances are captured at the same `latest` block
- Session 2 upgrades this skill to use Multicall3 for batched efficiency
