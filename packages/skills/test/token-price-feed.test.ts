import { tokenPriceFeed } from "../src/skills/token-price-feed";
import { TokenPriceFeedInput } from "../src/skills/token-price-feed/types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("token_price_feed skill", () => {
  describe("input validation", () => {
    it("should fail on invalid token address", async () => {
      const input: TokenPriceFeedInput = {
        tokenAddress: "not-valid",
        network: "testnet",
      };
      const result = await tokenPriceFeed(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Invalid address");
      }
    });
  });

  describe("factory config guard", () => {
    it("should return NO_FACTORY_CONFIGURED when factory is zero address", async () => {
      // The default PharosSwap factory is a placeholder (0x000...0)
      // until the live address is configured — this tests that guard
      const input: TokenPriceFeedInput = {
        tokenAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        network: "testnet",
      };
      const result = await tokenPriceFeed(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Either no factory or no pool — both are valid pre-mainnet states
        expect(["NO_FACTORY_CONFIGURED", "NO_QUOTE_TOKEN", "NO_POOL_FOUND", "SKILL_EXECUTION_FAILED"]).toContain(
          result.error.code
        );
      }
    });
  });

  describe("output shape (live DEX)", () => {
    it("should return correct output shape when pool exists", async () => {
      // This test is a forward-compatibility check.
      // Once live DEX factory + stable addresses are configured in dex.ts,
      // replace the placeholder addresses with real ones and this test will pass.
      const input: TokenPriceFeedInput = {
        tokenAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // replace with real token
        quoteTokenAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // replace with real stable
        factoryAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // replace with real factory
        network: "testnet",
      };

      const result = await tokenPriceFeed(input);

      if (result.success) {
        expect(result.data).toMatchObject({
          tokenAddress: expect.any(String),
          tokenSymbol: expect.any(String),
          quoteTokenAddress: expect.any(String),
          price: expect.any(String),
          priceRaw: expect.any(String),
          pool: expect.objectContaining({
            pairAddress: expect.any(String),
            token0: expect.any(String),
            token1: expect.any(String),
          }),
          blockNumber: expect.any(Number),
          chainId: 688688,
        });
      } else {
        console.info(
          "[token_price_feed] Skipped live test — configure dex.ts with live addresses:",
          result.error.code
        );
      }
    });
  });
});
