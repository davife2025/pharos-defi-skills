/**
 * example-http-client.ts
 *
 * Shows how to call the Pharos DeFi Skills agent-server over HTTP —
 * useful for Python/Rust/Go agents or any non-Node runtime.
 *
 * Requires the agent server to be running:
 *   yarn dev:server
 *
 * Run:
 *   npx ts-node examples/example-http-client.ts
 */

const SERVER = process.env.AGENT_SERVER_URL ?? "http://localhost:3000";
const WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${SERVER}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${SERVER}${path}`);
  return res.json();
}

async function main() {
  console.log(`\nConnecting to agent server: ${SERVER}\n`);

  // ── 1. Health check ──────────────────────────────────────────────────────
  const health = await get("/health");
  console.log("Health:", JSON.stringify(health, null, 2));

  // ── 2. Discover skills ───────────────────────────────────────────────────
  const registry = await get("/skills") as { data: { skills: Array<{ name: string; description: string }> } };
  console.log("\nAvailable skills:");
  for (const skill of registry.data.skills) {
    console.log(`  • ${skill.name}`);
  }

  // ── 3. Single skill invoke ────────────────────────────────────────────────
  console.log("\n── Single invoke: portfolio_snapshot ──");
  const invokeResult = await post("/skills/invoke", {
    skill: "portfolio_snapshot",
    params: { walletAddress: WALLET, network: "testnet" },
    requestId: "http-example-001",
  });
  console.log(JSON.stringify(invokeResult, null, 2));

  // ── 4. Shorthand route ────────────────────────────────────────────────────
  console.log("\n── Shorthand: POST /skills/gas_estimator ──");
  const shorthand = await post("/skills/gas_estimator", {
    transaction: {
      from: WALLET,
      to: "0x000000000000000000000000000000000000dEaD",
    },
    checkAffordability: true,
    network: "testnet",
  });
  console.log(JSON.stringify(shorthand, null, 2));

  // ── 5. Batch invoke ───────────────────────────────────────────────────────
  console.log("\n── Batch invoke: snapshot + gas in one call ──");
  const batch = await post("/skills/invoke/batch", {
    calls: [
      {
        skill: "portfolio_snapshot",
        params: { walletAddress: WALLET, network: "testnet" },
        requestId: "batch-snap",
      },
      {
        skill: "gas_estimator",
        params: {
          transaction: {
            from: WALLET,
            to: "0x000000000000000000000000000000000000dEaD",
          },
          checkAffordability: true,
          network: "testnet",
        },
        requestId: "batch-gas",
      },
    ],
  });
  console.log(JSON.stringify(batch, null, 2));
}

main().catch(console.error);
