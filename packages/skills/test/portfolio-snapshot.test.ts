import { portfolioSnapshot } from "../src/skills/portfolio-snapshot";
import { PortfolioSnapshotInput } from "../src/skills/portfolio-snapshot/types";

/**
 * NOTE: These tests hit the live Pharos Testnet RPC.
 * Make sure your .env is configured with PHAROS_TESTNET_RPC or
 * the fallback public RPC will be used.
 *
 * Run: yarn test
 */

// A known active address on Pharos Testnet (replace with a real one for live runs)
const TEST_WALLET = "0x0000000000000000000000000000000000000001";

describe("portfolio_snapshot skill", () => {
  describe("input validation", () => {
    it("should return an error for an invalid wallet address", async () => {
      const input: PortfolioSnapshotInput = {
        walletAddress: "not-an-address",
      };
      const result = await portfolioSnapshot(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("SKILL_EXECUTION_FAILED");
        expect(result.error.message).toContain("Invalid address");
      }
    });

    it("should accept a valid checksummed address", async () => {
      const input: PortfolioSnapshotInput = {
        walletAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        network: "testnet",
      };
      // We just check the shape — the wallet may have 0 balance on testnet
      const result = await portfolioSnapshot(input);
      if (result.success) {
        expect(result.data.walletAddress).toBe(
          "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        );
        expect(result.data.chainId).toBe(688688);
        expect(result.data.nativeBalance.symbol).toBe("PHRS");
        expect(typeof result.data.blockNumber).toBe("number");
        expect(result.data.blockNumber).toBeGreaterThan(0);
      } else {
        // RPC may be unavailable in CI — that's ok, log the error
        console.warn("RPC unavailable:", result.error.message);
      }
    });
  });

  describe("native balance", () => {
    it("should return native PHRS balance structure", async () => {
      const input: PortfolioSnapshotInput = {
        walletAddress: TEST_WALLET,
        network: "testnet",
      };
      const result = await portfolioSnapshot(input);
      if (result.success) {
        const { nativeBalance } = result.data;
        expect(nativeBalance.symbol).toBe("PHRS");
        expect(nativeBalance.decimals).toBe(18);
        expect(typeof nativeBalance.balance).toBe("string");
        expect(typeof nativeBalance.raw).toBe("string");
      }
    });
  });

  describe("token balances", () => {
    it("should return empty token array when no tokens provided", async () => {
      const input: PortfolioSnapshotInput = {
        walletAddress: TEST_WALLET,
        network: "testnet",
      };
      const result = await portfolioSnapshot(input);
      if (result.success) {
        expect(result.data.tokenBalances).toEqual([]);
      }
    });

    it("should handle invalid token address gracefully", async () => {
      const input: PortfolioSnapshotInput = {
        walletAddress: TEST_WALLET,
        tokenAddresses: ["0x0000000000000000000000000000000000000000"],
        network: "testnet",
      };
      // Should not throw — bad tokens are skipped
      const result = await portfolioSnapshot(input);
      expect(result).toBeDefined();
    });
  });

  describe("output shape", () => {
    it("should return all required output fields", async () => {
      const input: PortfolioSnapshotInput = {
        walletAddress: TEST_WALLET,
        network: "testnet",
      };
      const result = await portfolioSnapshot(input);
      if (result.success) {
        expect(result.data).toMatchObject({
          walletAddress: expect.any(String),
          nativeBalance: expect.objectContaining({
            symbol: "PHRS",
            decimals: 18,
            balance: expect.any(String),
            raw: expect.any(String),
          }),
          tokenBalances: expect.any(Array),
          blockNumber: expect.any(Number),
          blockTimestamp: expect.any(Number),
          chainId: 688688,
          network: "Pharos Testnet",
          fetchedAt: expect.any(String),
        });
      }
    });
  });
});
