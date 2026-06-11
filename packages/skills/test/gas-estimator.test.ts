import { gasEstimator } from "../src/skills/gas-estimator";
import { GasEstimatorInput } from "../src/skills/gas-estimator/types";

const TEST_WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

describe("gas_estimator skill", () => {
  describe("input validation", () => {
    it("should fail on invalid from address", async () => {
      const input: GasEstimatorInput = {
        transaction: { from: "not-an-address", to: DEAD_ADDRESS },
      };
      const result = await gasEstimator(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Invalid address");
      }
    });

    it("should fail on invalid to address", async () => {
      const input: GasEstimatorInput = {
        transaction: { from: TEST_WALLET, to: "bad" },
      };
      const result = await gasEstimator(input);
      expect(result.success).toBe(false);
    });
  });

  describe("native transfer estimation", () => {
    it("should estimate gas for a plain PHRS transfer", async () => {
      const input: GasEstimatorInput = {
        transaction: {
          from: TEST_WALLET,
          to: DEAD_ADDRESS,
          value: "0x0",
          data: "0x",
        },
        network: "testnet",
      };

      const result = await gasEstimator(input);

      if (result.success) {
        expect(Number(result.data.gasEstimate)).toBeGreaterThan(0);
        expect(Number(result.data.suggestedGasLimit)).toBeGreaterThan(
          Number(result.data.gasEstimate)
        );
        expect(result.data.chainId).toBe(688688);
        expect(result.data.gasCostPHRS).toBeTruthy();
      } else {
        // RPC unavailable in CI
        console.warn("RPC unavailable:", result.error.message);
      }
    });

    it("suggested gas limit should be ~20% above estimate", async () => {
      const input: GasEstimatorInput = {
        transaction: { from: TEST_WALLET, to: DEAD_ADDRESS, data: "0x" },
        network: "testnet",
      };

      const result = await gasEstimator(input);
      if (result.success) {
        const estimate = BigInt(result.data.gasEstimate);
        const limit = BigInt(result.data.suggestedGasLimit);
        const buffer = ((limit - estimate) * 100n) / estimate;
        expect(buffer).toBe(20n);
      }
    });
  });

  describe("affordability check", () => {
    it("should return affordability data when requested", async () => {
      const input: GasEstimatorInput = {
        transaction: { from: TEST_WALLET, to: DEAD_ADDRESS },
        checkAffordability: true,
        network: "testnet",
      };

      const result = await gasEstimator(input);
      if (result.success) {
        expect(result.data.affordability).toBeDefined();
        expect(typeof result.data.affordability!.canAfford).toBe("boolean");
        expect(result.data.affordability!.walletBalancePHRS).toBeTruthy();
        expect(result.data.affordability!.totalCostPHRS).toBeTruthy();
      }
    });

    it("should not return affordability data when not requested", async () => {
      const input: GasEstimatorInput = {
        transaction: { from: TEST_WALLET, to: DEAD_ADDRESS },
        checkAffordability: false,
        network: "testnet",
      };

      const result = await gasEstimator(input);
      if (result.success) {
        expect(result.data.affordability).toBeUndefined();
      }
    });
  });

  describe("custom gas price", () => {
    it("should use the provided gas price override", async () => {
      const input: GasEstimatorInput = {
        transaction: { from: TEST_WALLET, to: DEAD_ADDRESS },
        gasPriceGwei: 5,
        network: "testnet",
      };

      const result = await gasEstimator(input);
      if (result.success) {
        expect(parseFloat(result.data.gasPriceGwei)).toBeCloseTo(5, 1);
      }
    });
  });
});
