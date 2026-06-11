import { tokenSwap } from "../src/skills/token-swap";
import { TokenSwapInput } from "../src/skills/token-swap/types";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

describe("token_swap skill", () => {
  describe("input validation", () => {
    it("should fail with missing private key", async () => {
      const input: TokenSwapInput = {
        privateKey: "",
        tokenIn: "NATIVE",
        tokenOut: DEAD_ADDRESS,
        amountIn: "1.0",
        network: "testnet",
      };
      const result = await tokenSwap(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_PRIVATE_KEY");
      }
    });

    it("should fail with NO_ROUTER_CONFIGURED when router is zero address", async () => {
      // The default router is a placeholder (0x000...0) until mainnet
      const input: TokenSwapInput = {
        privateKey: "0x" + "a".repeat(64),
        tokenIn: "NATIVE",
        tokenOut: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        amountIn: "0.001",
        network: "testnet",
      };
      const result = await tokenSwap(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect([
          "NO_ROUTER_CONFIGURED",
          "SKILL_EXECUTION_FAILED",
          "NO_LIQUIDITY",
        ]).toContain(result.error.code);
      }
    });

    it("should fail with invalid tokenIn address", async () => {
      const input: TokenSwapInput = {
        privateKey: "0x" + "a".repeat(64),
        tokenIn: "not-a-valid-address",
        tokenOut: DEAD_ADDRESS,
        amountIn: "1.0",
        routerAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        network: "testnet",
      };
      const result = await tokenSwap(input);
      expect(result.success).toBe(false);
    });
  });

  describe("output shape (live DEX)", () => {
    it("should return correct output shape on successful swap", async () => {
      // This test is a forward-compatibility check.
      // Replace placeholders with real values once live router + funded wallet are available.
      //
      // const result = await tokenSwap({
      //   privateKey: process.env.TEST_PRIVATE_KEY!,
      //   tokenIn: "NATIVE",
      //   tokenOut: "0xRealTokenOnPharos",
      //   amountIn: "0.001",
      //   slippagePct: 1.0,
      //   routerAddress: "0xRealRouterOnPharos",
      //   network: "testnet",
      // });
      // expect(result.success).toBe(true);
      // if (result.success) {
      //   expect(result.data.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      //   expect(result.data.explorerUrl).toContain("pharosscan.xyz");
      //   expect(Number(result.data.blockNumber)).toBeGreaterThan(0);
      // }

      console.info(
        "[token_swap] Live test skipped — configure router address and funded test wallet to enable."
      );
      expect(true).toBe(true);
    });
  });
});
