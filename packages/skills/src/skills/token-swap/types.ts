import { SkillError, SkillResult } from "../portfolio-snapshot/types";

export { SkillError, SkillResult };

/**
 * Input for the token_swap skill.
 */
export interface TokenSwapInput {
  /** Wallet private key — used to sign the transaction */
  privateKey: string;

  /** Token to sell (use "NATIVE" for PHRS) */
  tokenIn: string;

  /** Token to buy (use "NATIVE" for PHRS) */
  tokenOut: string;

  /**
   * Amount to swap in human-readable units.
   * e.g. "1.5" for 1.5 PHRS or 1.5 USDC
   */
  amountIn: string;

  /**
   * Maximum slippage tolerance as a percentage.
   * e.g. 0.5 = 0.5%. Defaults to 0.5%.
   */
  slippagePct?: number;

  /**
   * DEX router address on Pharos.
   * Defaults to the configured PharosSwap router.
   */
  routerAddress?: string;

  /**
   * Deadline offset in seconds from now.
   * Defaults to 300 (5 minutes).
   */
  deadlineSeconds?: number;

  /** Target network. Defaults to "testnet". */
  network?: "testnet" | "mainnet";
}

/**
 * Output of the token_swap skill.
 */
export interface TokenSwapOutput {
  /** Transaction hash */
  txHash: string;

  /** Token sold */
  tokenIn: string;
  tokenInSymbol: string;

  /** Token bought */
  tokenOut: string;
  tokenOutSymbol: string;

  /** Amount of tokenIn sold (human-readable) */
  amountIn: string;

  /** Minimum amount of tokenOut expected (after slippage) */
  amountOutMin: string;

  /** Slippage tolerance applied */
  slippagePct: number;

  /** Gas used */
  gasUsed: string;

  /** Gas cost in PHRS */
  gasCostPHRS: string;

  /** Block the tx was included in */
  blockNumber: number;

  /** Transaction explorer URL */
  explorerUrl: string;

  chainId: number;
  network: string;
  executedAt: string;
}
