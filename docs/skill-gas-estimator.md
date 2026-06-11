# Skill Spec: `gas_estimator`

**Version:** 1.0.0  
**Category:** DeFi / Transaction  
**Chain:** Pharos (Testnet 688688 / Mainnet 1672)

---

## Overview

Estimates the gas cost of any transaction on Pharos and optionally checks whether the sending wallet can afford to execute it. This is the essential pre-flight check every AI Agent should run before submitting a transaction on-chain.

---

## Input

```typescript
{
  transaction: {
    from: string;      // Sender address (0x...)
    to: string;        // Recipient or contract address (0x...)
    data?: string;     // Hex calldata, e.g. "0xa9059cbb..."
    value?: string;    // Value in wei (hex or decimal string)
  };
  gasPriceGwei?: number;       // Override gas price. Defaults to network price.
  checkAffordability?: boolean; // Also check wallet balance. Default: false.
  network?: "testnet" | "mainnet"; // Default: "testnet"
}
```

---

## Output

```typescript
{
  gasEstimate: string;       // Raw gas units e.g. "21000"
  gasPriceGwei: string;      // Gas price used e.g. "1.5"
  gasPriceWei: string;       // Gas price in wei
  gasCostWei: string;        // Total gas cost in wei
  gasCostPHRS: string;       // Total gas cost in PHRS e.g. "0.0000315"
  suggestedGasLimit: string; // Estimate + 20% buffer — safe to use as gasLimit
  baseFeeGwei?: string;      // EIP-1559 base fee if available
  affordability?: {
    walletBalancePHRS: string;
    totalCostPHRS: string;
    canAfford: boolean;
    shortfallPHRS?: string;  // Only present if canAfford is false
  };
  transaction: TransactionRequest;
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
| `TRANSACTION_WOULD_REVERT` | The transaction simulation reverted on-chain |
| `SKILL_EXECUTION_FAILED` | Invalid address, RPC error, or other failure |

---

## Agent Usage Pattern

```
Agent wants to execute a swap:
  1. calls gas_estimator (checkAffordability: true)   ← this skill
  2. if canAfford === false → abort, notify user
  3. if canAfford === true  → proceed with suggestedGasLimit
  4. calls swap execution skill (Session 4+)
```

---

## Notes

- `suggestedGasLimit` adds 20% buffer over the raw estimate — always use this, not `gasEstimate`, as your transaction `gasLimit`.
- If the skill returns `TRANSACTION_WOULD_REVERT`, the transaction will fail on-chain. The Agent should not proceed.
- Gas prices on Pharos are very low — typical transfers cost fractions of a PHRS.
