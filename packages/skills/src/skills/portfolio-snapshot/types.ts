/**
 * Input parameters for the portfolio_snapshot skill.
 */
export interface PortfolioSnapshotInput {
  /** Wallet address to query (0x...) */
  walletAddress: string;

  /**
   * Optional list of ERC-20 token contract addresses to include.
   * If omitted, only the native PHRS balance is returned.
   */
  tokenAddresses?: string[];

  /**
   * Target network. Defaults to "testnet".
   */
  network?: "testnet" | "mainnet";
}

/**
 * Native currency balance detail.
 */
export interface NativeBalance {
  symbol: string;
  name: string;
  decimals: number;
  /** Human-readable balance (e.g. "12.345") */
  balance: string;
  /** Raw balance as a string bigint */
  raw: string;
}

/**
 * ERC-20 token balance detail.
 */
export interface TokenBalance {
  /** Contract address */
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  /** Human-readable balance */
  balance: string;
  /** Raw balance as a string bigint */
  raw: string;
  /** True if the balance is zero */
  isEmpty: boolean;
}

/**
 * Full output of the portfolio_snapshot skill.
 */
export interface PortfolioSnapshotOutput {
  /** The queried wallet address (checksummed) */
  walletAddress: string;

  /** Native PHRS balance */
  nativeBalance: NativeBalance;

  /** ERC-20 token balances (only tokens that were queried) */
  tokenBalances: TokenBalance[];

  /** Block number at which this snapshot was taken */
  blockNumber: number;

  /** Unix timestamp (seconds) of the snapshot block */
  blockTimestamp: number;

  /** Chain ID */
  chainId: number;

  /** Network name */
  network: string;

  /** ISO timestamp of when this skill ran */
  fetchedAt: string;
}

/**
 * Standardised Skill error.
 */
export interface SkillError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Standardised Skill result envelope — every Skill returns this.
 */
export type SkillResult<T> =
  | { success: true; data: T }
  | { success: false; error: SkillError };
