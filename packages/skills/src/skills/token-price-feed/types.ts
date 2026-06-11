import { SkillError, SkillResult } from "../portfolio-snapshot/types";

export { SkillError, SkillResult };

/**
 * Input for the token_price_feed skill.
 */
export interface TokenPriceFeedInput {
  /**
   * Token contract address to price (0x...)
   */
  tokenAddress: string;

  /**
   * Optional: address of the quote token (defaults to best available stable).
   * e.g. USDC address on Pharos.
   */
  quoteTokenAddress?: string;

  /**
   * Optional: specific DEX factory address to use.
   * Defaults to PharosSwap factory.
   */
  factoryAddress?: string;

  /**
   * Target network. Defaults to "testnet".
   */
  network?: "testnet" | "mainnet";
}

/**
 * Pool / pair details used to derive the price.
 */
export interface PricePool {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
}

/**
 * Output of the token_price_feed skill.
 */
export interface TokenPriceFeedOutput {
  /** The token being priced */
  tokenAddress: string;
  tokenSymbol: string;

  /** The quote token (usually a stable) */
  quoteTokenAddress: string;
  quoteTokenSymbol: string;

  /**
   * Price of 1 unit of tokenAddress denominated in quoteToken.
   * e.g. if token=ETH, quote=USDC → price="3200.00"
   */
  price: string;

  /**
   * Raw price as a high-precision string (18 decimal places).
   */
  priceRaw: string;

  /** Pool used to derive the price */
  pool: PricePool;

  /** Block number of the snapshot */
  blockNumber: number;

  chainId: number;
  network: string;
  fetchedAt: string;
}
