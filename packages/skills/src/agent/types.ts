/**
 * Skill Registry — maps skill names to their input/output types.
 * Every skill exposed to Agents is registered here.
 */

import {
  PortfolioSnapshotInput,
  PortfolioSnapshotOutput,
} from "../skills/portfolio-snapshot/types";
import {
  TokenPriceFeedInput,
  TokenPriceFeedOutput,
} from "../skills/token-price-feed/types";
import {
  GasEstimatorInput,
  GasEstimatorOutput,
} from "../skills/gas-estimator/types";
import {
  TokenSwapInput,
  TokenSwapOutput,
} from "../skills/token-swap/types";
import { SkillResult } from "../skills/portfolio-snapshot/types";

export { SkillResult };

/**
 * All available skill names — used as discriminated union keys.
 */
export type SkillName =
  | "portfolio_snapshot"
  | "token_price_feed"
  | "gas_estimator"
  | "token_swap";

/**
 * Maps each skill name to its input type.
 */
export type SkillInputMap = {
  portfolio_snapshot: PortfolioSnapshotInput;
  token_price_feed: TokenPriceFeedInput;
  gas_estimator: GasEstimatorInput;
  token_swap: TokenSwapInput;
};

/**
 * Maps each skill name to its output type.
 */
export type SkillOutputMap = {
  portfolio_snapshot: PortfolioSnapshotOutput;
  token_price_feed: TokenPriceFeedOutput;
  gas_estimator: GasEstimatorOutput;
  token_swap: TokenSwapOutput;
};

/**
 * The standard Agent skill call envelope.
 */
export interface AgentSkillCall<S extends SkillName = SkillName> {
  skill: S;
  params: SkillInputMap[S];
  requestId?: string;
}

/**
 * The standard Agent skill response envelope.
 */
export interface AgentSkillResponse<S extends SkillName = SkillName> {
  skill: S;
  requestId?: string;
  result: SkillResult<SkillOutputMap[S]>;
  durationMs: number;
}

/**
 * Skill metadata — describes a skill to an Agent discovering capabilities.
 */
export interface SkillMeta {
  name: SkillName;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  version: string;
}

/**
 * The full skill registry manifest — returned by the /skills endpoint.
 */
export interface SkillRegistry {
  skills: SkillMeta[];
  version: string;
  chain: {
    testnet: { chainId: number; name: string };
    mainnet: { chainId: number; name: string };
  };
}
