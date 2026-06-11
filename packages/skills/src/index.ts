// ─── Skills ───────────────────────────────────────────────────────────────────
export { portfolioSnapshot } from "./skills/portfolio-snapshot";
export { tokenPriceFeed } from "./skills/token-price-feed";
export { gasEstimator } from "./skills/gas-estimator";
export { tokenSwap } from "./skills/token-swap";

// ─── Agent Interface Layer ────────────────────────────────────────────────────
export { dispatch, dispatchMany } from "./agent/dispatcher";
export { SKILL_REGISTRY } from "./agent/registry";
export type {
  AgentSkillCall,
  AgentSkillResponse,
  SkillName,
  SkillMeta,
  SkillRegistry,
  SkillInputMap,
  SkillOutputMap,
} from "./agent/types";

// ─── Utilities ────────────────────────────────────────────────────────────────
export { logger } from "./lib/logger";
export type { LogLevel } from "./lib/logger";

// ─── Cache / Supabase ─────────────────────────────────────────────────────────
export { isSupabaseConfigured } from "./lib/supabase";
export {
  getCachedPortfolioSnapshot,
  setCachedPortfolioSnapshot,
  getCachedTokenPrice,
  setCachedTokenPrice,
  logSkillCall,
} from "./lib/cache";

// ─── Types: portfolio-snapshot ────────────────────────────────────────────────
export type {
  PortfolioSnapshotInput,
  PortfolioSnapshotOutput,
  NativeBalance,
  TokenBalance,
  SkillResult,
  SkillError,
} from "./skills/portfolio-snapshot/types";

// ─── Types: token-price-feed ──────────────────────────────────────────────────
export type {
  TokenPriceFeedInput,
  TokenPriceFeedOutput,
  PricePool,
} from "./skills/token-price-feed/types";

// ─── Types: gas-estimator ─────────────────────────────────────────────────────
export type {
  GasEstimatorInput,
  GasEstimatorOutput,
  TransactionRequest,
  AffordabilityCheck,
} from "./skills/gas-estimator/types";

// ─── Types: token-swap ────────────────────────────────────────────────────────
export type {
  TokenSwapInput,
  TokenSwapOutput,
} from "./skills/token-swap/types";

// ─── Config ───────────────────────────────────────────────────────────────────
export {
  PHAROS_TESTNET,
  PHAROS_MAINNET,
  getProvider,
  resolveChain,
} from "./config/chains";
export type { ChainConfig } from "./config/chains";

// ─── ABIs ─────────────────────────────────────────────────────────────────────
export { ERC20_ABI, ERC20_BALANCE_ABI } from "./abi/erc20";
export { MULTICALL3_ADDRESS, MULTICALL3_ABI } from "./abi/multicall3";
export {
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  PHAROS_DEX_FACTORIES,
  STABLE_TOKENS,
} from "./abi/dex";
