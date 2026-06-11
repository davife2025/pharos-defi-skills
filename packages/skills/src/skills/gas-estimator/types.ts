import { SkillError, SkillResult } from "../portfolio-snapshot/types";

export { SkillError, SkillResult };

/**
 * A raw transaction object passed to the gas estimator.
 */
export interface TransactionRequest {
  from: string;
  to: string;
  /** Hex-encoded calldata, e.g. "0xa9059cbb..." */
  data?: string;
  /** Hex or decimal value in wei, e.g. "0x0" or "1000000000000000000" */
  value?: string;
}

/**
 * Input for the gas_estimator skill.
 */
export interface GasEstimatorInput {
  /** The transaction to estimate gas for */
  transaction: TransactionRequest;

  /**
   * Optional gas price override in gwei.
   * If omitted, the current network gas price is used.
   */
  gasPriceGwei?: number;

  /**
   * If true, also checks if the `from` wallet has enough PHRS
   * to cover gas cost + any ETH value being sent.
   */
  checkAffordability?: boolean;

  /** Target network. Defaults to "testnet". */
  network?: "testnet" | "mainnet";
}

/**
 * Affordability check result.
 */
export interface AffordabilityCheck {
  /** Wallet's current PHRS balance in wei */
  walletBalanceWei: string;
  /** Wallet's balance in PHRS (human-readable) */
  walletBalancePHRS: string;
  /** Total cost of the transaction (gas + value) in wei */
  totalCostWei: string;
  /** Total cost in PHRS (human-readable) */
  totalCostPHRS: string;
  /** Whether the wallet can afford this transaction */
  canAfford: boolean;
  /** Shortfall in PHRS if wallet can't afford */
  shortfallPHRS?: string;
}

/**
 * Output of the gas_estimator skill.
 */
export interface GasEstimatorOutput {
  /** Estimated gas units */
  gasEstimate: string;

  /** Gas price used (in gwei) */
  gasPriceGwei: string;

  /** Gas price in wei */
  gasPriceWei: string;

  /** Total gas cost in wei (gasEstimate × gasPrice) */
  gasCostWei: string;

  /** Total gas cost in PHRS (human-readable) */
  gasCostPHRS: string;

  /**
   * Suggested gas limit with 20% buffer applied.
   * Safe to use as gasLimit in a real transaction.
   */
  suggestedGasLimit: string;

  /** EIP-1559 base fee if available */
  baseFeeGwei?: string;

  /** Affordability check (only if checkAffordability was true) */
  affordability?: AffordabilityCheck;

  /** The transaction that was estimated */
  transaction: TransactionRequest;

  blockNumber: number;
  chainId: number;
  network: string;
  fetchedAt: string;
}
