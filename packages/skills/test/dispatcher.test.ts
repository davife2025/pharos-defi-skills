import { dispatch, dispatchMany } from "../src/agent/dispatcher";
import { SKILL_REGISTRY } from "../src/agent/registry";

describe("dispatch()", () => {
  it("should return UNKNOWN_SKILL for an unregistered skill", async () => {
    const response = await dispatch({
      skill: "nonexistent_skill" as never,
      params: {} as never,
      requestId: "test-001",
    });
    expect(response.result.success).toBe(false);
    if (!response.result.success) {
      expect(response.result.error.code).toBe("UNKNOWN_SKILL");
    }
    expect(response.requestId).toBe("test-001");
    expect(response.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should always return durationMs", async () => {
    const response = await dispatch({
      skill: "portfolio_snapshot",
      params: { walletAddress: "invalid" },
    });
    expect(typeof response.durationMs).toBe("number");
  });

  it("should route portfolio_snapshot correctly", async () => {
    const response = await dispatch({
      skill: "portfolio_snapshot",
      params: { walletAddress: "not-a-real-address" },
    });
    expect(response.skill).toBe("portfolio_snapshot");
    expect(response.result.success).toBe(false);
    if (!response.result.success) {
      expect(response.result.error.message).toContain("Invalid address");
    }
  });

  it("should route gas_estimator correctly", async () => {
    const response = await dispatch({
      skill: "gas_estimator",
      params: {
        transaction: { from: "bad-address", to: "bad-address" },
      },
    });
    expect(response.skill).toBe("gas_estimator");
    expect(response.result.success).toBe(false);
  });

  it("should route token_swap correctly", async () => {
    const response = await dispatch({
      skill: "token_swap",
      params: {
        privateKey: "",
        tokenIn: "NATIVE",
        tokenOut: "0x000000000000000000000000000000000000dEaD",
        amountIn: "1.0",
      },
    });
    expect(response.skill).toBe("token_swap");
    expect(response.result.success).toBe(false);
    if (!response.result.success) {
      expect(response.result.error.code).toBe("INVALID_PRIVATE_KEY");
    }
  });
});

describe("dispatchMany()", () => {
  it("should execute multiple calls in parallel and return all results", async () => {
    const responses = await dispatchMany([
      {
        skill: "portfolio_snapshot",
        params: { walletAddress: "invalid-1" },
        requestId: "batch-1",
      },
      {
        skill: "portfolio_snapshot",
        params: { walletAddress: "invalid-2" },
        requestId: "batch-2",
      },
    ]);

    expect(responses).toHaveLength(2);
    expect(responses[0].requestId).toBe("batch-1");
    expect(responses[1].requestId).toBe("batch-2");
    expect(responses[0].result.success).toBe(false);
    expect(responses[1].result.success).toBe(false);
  });
});

describe("SKILL_REGISTRY", () => {
  it("should contain all 4 registered skills", () => {
    expect(SKILL_REGISTRY.skills).toHaveLength(4);
  });

  it("should have valid chain config", () => {
    expect(SKILL_REGISTRY.chain.testnet.chainId).toBe(688688);
    expect(SKILL_REGISTRY.chain.mainnet.chainId).toBe(1672);
  });

  it("every skill should have name, description, version, inputSchema, outputSchema", () => {
    for (const skill of SKILL_REGISTRY.skills) {
      expect(skill.name).toBeTruthy();
      expect(skill.description).toBeTruthy();
      expect(skill.version).toBeTruthy();
      expect(skill.inputSchema).toBeDefined();
      expect(skill.outputSchema).toBeDefined();
    }
  });
});
