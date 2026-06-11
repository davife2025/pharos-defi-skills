# Skill Spec: `token_swap`

**Version:** 1.0.0  
**Category:** DeFi / Execution  
**Chain:** Pharos (Testnet 688688 / Mainnet 1672)

---

## Overview

Executes a token swap on a Uniswap V2 compatible DEX on Pharos. Handles all swap directions — native PHRS to ERC-20, ERC-20 to native PHRS, and ERC-20 to ERC-20. Automatically handles token approval, slippage, and transaction deadline.

**This is an execution skill — it submits a real on-chain transaction.** Always call `gas_estimator` with `checkAffordability: true` before calling this skill.

---

## Input

```typescript
{
  privateKey: string;          // Required. Wallet private key — only used in-memory to sign
  tokenIn: string;             // Required. Token to sell. Use "NATIVE" for PHRS.
  tokenOut: string;            // Required. Token to buy. Use "NATIVE" for PHRS.
  amountIn: string;            // Required. Human-readable amount, e.g. "1.5"
  slippagePct?: number;        // Max slippage %. Default: 0.5
  routerAddress?: string;      // DEX router. Defaults to configured PharosSwap router.
  deadlineSeconds?: number;    // Tx deadline offset from now. Default: 300 (5 min)
  network?: "testnet" | "mainnet"; // Default: "testnet"
}
```

---

## Output

```typescript
{
  txHash: string;              // On-chain transaction hash
  tokenIn: string;             // Token sold (checksummed address or "NATIVE")
  tokenInSymbol: string;
  tokenOut: string;            // Token bought (checksummed address or "NATIVE")
  tokenOutSymbol: string;
  amountIn: string;            // Amount sold (human-readable)
  amountOutMin: string;        // Minimum received after slippage (human-readable)
  slippagePct: number;         // Slippage applied
  gasUsed: string;             // Gas units consumed
  gasCostPHRS: string;         // Total gas cost in PHRS
  blockNumber: number;         // Block the tx was included in
  explorerUrl: string;         // Link to transaction on pharosscan.xyz
  chainId: number;
  network: string;
  executedAt: string;          // ISO 8601
}
```

---

## Error Codes

| Code | Cause |
|------|-------|
| `INVALID_PRIVATE_KEY` | Private key missing or malformed |
| `NO_ROUTER_CONFIGURED` | Router address is zero — update `src/abi/router.ts` |
| `NO_LIQUIDITY` | No swap path found between the token pair |
| `TRANSACTION_REVERTED` | Tx reverted on-chain (slippage exceeded, deadline, or bad state) |
| `SKILL_EXECUTION_FAILED` | General RPC or execution error |

---

## Security

The `privateKey` field is used only in-memory to sign the transaction via `ethers.Wallet`. It is:
- Never logged (the logger never serialises skill input params)
- Never cached in Supabase
- Never persisted anywhere

For production Agent deployments, use environment variables or a secrets manager to supply the key — never hardcode it.

---

## Configuration

Update `src/abi/router.ts` with live router addresses once deployed on Pharos:

```typescript
export const PHAROS_ROUTER_ADDRESSES: Record<string, string> = {
  pharosswap_testnet: "0xLIVE_TESTNET_ROUTER",
  pharosswap_mainnet: "0xLIVE_MAINNET_ROUTER",
};
```

---

## Agent Usage Pattern

```
Agent receives task: "Swap 1 PHRS for USDC"
  1. gas_estimator (checkAffordability: true)   ← pre-flight
     └── canAfford === false → ABORT
     └── TRANSACTION_WOULD_REVERT → ABORT
  2. token_swap                                  ← this skill
     └── TRANSACTION_REVERTED → log + retry or abort
  3. portfolio_snapshot                          ← confirm new balances
```

---

## Notes

- ERC-20 token approval is handled automatically. If the router's allowance is insufficient, an approval transaction is submitted first before the swap.
- `amountOutMin` is derived as: `expectedOut × (1 - slippagePct / 100)`. If the actual output would be less than this, the swap reverts.
- The swap is routed through a two-token path `[tokenIn, tokenOut]`. Multi-hop routing (via an intermediate token) is not yet supported.
