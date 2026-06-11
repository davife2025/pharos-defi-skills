/**
 * example-agent.ts
 *
 * A working end-to-end example showing a DeFi Agent on Pharos
 * using all four Skills in a coordinated workflow:
 *
 *   1. portfolio_snapshot  → know wallet state
 *   2. token_price_feed    → know token price
 *   3. gas_estimator       → pre-flight affordability check
 *   4. token_swap          → execute swap (if pre-flight passes)
 *   5. portfolio_snapshot  → confirm new balances
 *
 * Run:
 *   cd pharos-defi-skills
 *   yarn install
 *   cp .env.example .env   # add your PHAROS_TESTNET_RPC
 *   npx ts-node examples/example-agent.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import { dispatchMany, dispatch, SKILL_REGISTRY, logger } from "@pharos-defi-skills/skills";
import type { AgentSkillCall } from "@pharos-defi-skills/skills";

const log = logger.child("example-agent");

// ─── Config ───────────────────────────────────────────────────────────────────
// Replace with a real wallet on Pharos Testnet
const AGENT_WALLET  = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
// Replace with your wallet private key (use .env — never hardcode in production)
const PRIVATE_KEY   = process.env.AGENT_PRIVATE_KEY ?? "";
// Replace with a real ERC-20 on Pharos Testnet once tokens are deployed
const TARGET_TOKEN  = process.env.TARGET_TOKEN ?? "0x0000000000000000000000000000000000000000";
// Replace with live PharosSwap router address
const ROUTER        = process.env.PHAROS_ROUTER ?? "0x0000000000000000000000000000000000000000";
const SWAP_AMOUNT   = "0.001"; // PHRS to swap
const NETWORK       = "testnet" as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function divider(title: string) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${title}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

// ─── Main Agent Loop ──────────────────────────────────────────────────────────
async function runAgent() {
  log.info("Pharos DeFi Agent starting", {
    skills: SKILL_REGISTRY.skills.map((s) => s.name),
    network: SKILL_REGISTRY.chain[NETWORK],
  });

  // ── STEP 1–3: Parallel pre-flight ─────────────────────────────────────────
  divider("PRE-FLIGHT (parallel)");
  log.info("Dispatching snapshot + price + gas in parallel...");

  const preFlight: AgentSkillCall[] = [
    {
      skill: "portfolio_snapshot",
      params: { walletAddress: AGENT_WALLET, network: NETWORK },
      requestId: "preflight-snapshot",
    },
    {
      skill: "token_price_feed",
      params: { tokenAddress: TARGET_TOKEN, network: NETWORK },
      requestId: "preflight-price",
    },
    {
      skill: "gas_estimator",
      params: {
        transaction: {
          from: AGENT_WALLET,
          to: ROUTER,
          data: "0x",
          value: "0x0",
        },
        checkAffordability: true,
        network: NETWORK,
      },
      requestId: "preflight-gas",
    },
  ];

  const [snapshotRes, priceRes, gasRes] = await dispatchMany(preFlight);

  // ── Portfolio ──────────────────────────────────────────────────────────────
  divider("1. PORTFOLIO SNAPSHOT");
  if (snapshotRes.result.success) {
    const d = snapshotRes.result.data;
    console.log(`  Wallet   : ${d.walletAddress}`);
    console.log(`  Block    : #${d.blockNumber.toLocaleString()}`);
    console.log(`  PHRS     : ${d.nativeBalance.balance}`);
    console.log(`  Duration : ${snapshotRes.durationMs}ms`);
  } else {
    console.log(`  ✗ ${snapshotRes.result.error.message}`);
  }

  // ── Price ──────────────────────────────────────────────────────────────────
  divider("2. TOKEN PRICE FEED");
  if (priceRes.result.success) {
    const d = priceRes.result.data;
    console.log(`  Token    : ${d.tokenSymbol} (${d.tokenAddress})`);
    console.log(`  Price    : ${d.price} ${d.quoteTokenSymbol}`);
    console.log(`  Pool     : ${d.pool.pairAddress}`);
    console.log(`  Duration : ${priceRes.durationMs}ms`);
  } else {
    console.log(`  ✗ ${priceRes.result.error.code}: ${priceRes.result.error.message}`);
  }

  // ── Gas ────────────────────────────────────────────────────────────────────
  divider("3. GAS ESTIMATION");
  if (gasRes.result.success) {
    const d = gasRes.result.data;
    console.log(`  Gas Estimate  : ${Number(d.gasEstimate).toLocaleString()} units`);
    console.log(`  Gas Limit     : ${Number(d.suggestedGasLimit).toLocaleString()} (+20% buffer)`);
    console.log(`  Cost          : ${d.gasCostPHRS} PHRS`);
    if (d.affordability) {
      console.log(`  Wallet        : ${d.affordability.walletBalancePHRS} PHRS`);
      console.log(`  Can Afford    : ${d.affordability.canAfford ? "✓ YES" : "✗ NO"}`);
      if (d.affordability.shortfallPHRS) {
        console.log(`  Shortfall     : ${d.affordability.shortfallPHRS} PHRS`);
      }
    }
  } else {
    console.log(`  ✗ ${gasRes.result.error.code}: ${gasRes.result.error.message}`);
  }

  // ── STEP 4: Agent decision ─────────────────────────────────────────────────
  divider("4. AGENT DECISION");

  const gasOk =
    gasRes.result.success &&
    gasRes.result.data.affordability?.canAfford === true;

  const routerConfigured = ROUTER !== "0x0000000000000000000000000000000000000000";
  const tokenConfigured  = TARGET_TOKEN !== "0x0000000000000000000000000000000000000000";
  const keyConfigured    = PRIVATE_KEY.length >= 64;

  if (!gasOk) {
    log.warn("Pre-flight failed — aborting swap");
    console.log(`  ✗ ABORT — gas pre-flight did not pass`);
    if (gasRes.result.success && !gasRes.result.data.affordability?.canAfford) {
      console.log(`    Reason: insufficient PHRS (shortfall: ${gasRes.result.data.affordability?.shortfallPHRS})`);
    }
  } else if (!routerConfigured || !tokenConfigured || !keyConfigured) {
    console.log(`  ⚠  Pre-flight PASSED — swap skipped (placeholders not configured)`);
    console.log(`    Set AGENT_PRIVATE_KEY, TARGET_TOKEN, and PHAROS_ROUTER in .env to execute.`);
    log.info("Swap ready but config placeholders detected — skipping execution");
  } else {
    // ── STEP 4: Execute swap ───────────────────────────────────────────────
    divider("4. TOKEN SWAP");
    log.info("Pre-flight passed — executing swap", {
      amountIn: SWAP_AMOUNT,
      tokenOut: TARGET_TOKEN,
    });

    const swapRes = await dispatch({
      skill: "token_swap",
      params: {
        privateKey: PRIVATE_KEY,
        tokenIn: "NATIVE",
        tokenOut: TARGET_TOKEN,
        amountIn: SWAP_AMOUNT,
        slippagePct: 0.5,
        routerAddress: ROUTER,
        network: NETWORK,
      },
      requestId: "swap-execute",
    });

    if (swapRes.result.success) {
      const d = swapRes.result.data;
      console.log(`  ✓ SWAP CONFIRMED`);
      console.log(`  Tx Hash    : ${d.txHash}`);
      console.log(`  Sold       : ${d.amountIn} ${d.tokenInSymbol}`);
      console.log(`  Min Out    : ${d.amountOutMin} ${d.tokenOutSymbol}`);
      console.log(`  Gas Used   : ${d.gasUsed} units (${d.gasCostPHRS} PHRS)`);
      console.log(`  Block      : #${d.blockNumber}`);
      console.log(`  Explorer   : ${d.explorerUrl}`);

      // ── STEP 5: Confirm new balances ─────────────────────────────────────
      divider("5. POST-SWAP SNAPSHOT");
      const confirmRes = await dispatch({
        skill: "portfolio_snapshot",
        params: { walletAddress: AGENT_WALLET, network: NETWORK },
        requestId: "confirm-snapshot",
      });

      if (confirmRes.result.success) {
        const cd = confirmRes.result.data;
        console.log(`  New PHRS Balance : ${cd.nativeBalance.balance}`);
        for (const t of cd.tokenBalances) {
          console.log(`  ${t.symbol}              : ${t.balance}`);
        }
      }
    } else {
      log.error("Swap failed", {
        code: swapRes.result.error.code,
        message: swapRes.result.error.message,
      });
      console.log(`  ✗ SWAP FAILED: ${swapRes.result.error.code}`);
      console.log(`    ${swapRes.result.error.message}`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  log.info("Agent run complete");
}

// ─── Entry ────────────────────────────────────────────────────────────────────
runAgent().catch((err) => {
  log.error("Unhandled agent error", { message: err.message });
  process.exit(1);
});
