/**
 * Uniswap V2 compatible Factory + Pair ABIs.
 * Used to derive token prices from on-chain DEX liquidity pools on Pharos.
 */

export const UNISWAP_V2_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
  "function allPairs(uint256) view returns (address pair)",
  "function allPairsLength() view returns (uint256)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
] as const;

export const UNISWAP_V2_PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function totalSupply() view returns (uint256)",
  "function price0CumulativeLast() view returns (uint256)",
  "function price1CumulativeLast() view returns (uint256)",
] as const;

/**
 * Known DEX factory addresses on Pharos Testnet.
 * These will be updated as more DEXs deploy on Pharos mainnet.
 */
export const PHAROS_DEX_FACTORIES: Record<string, string> = {
  // PharosSwap (primary DEX on Pharos testnet — Uniswap V2 compatible)
  pharosswap: "0x0000000000000000000000000000000000000000", // placeholder — update with live address
};

/**
 * Stable reference tokens used as price denominators.
 * The price feed tries each in order until it finds a pool.
 */
export const STABLE_TOKENS: Record<string, string[]> = {
  testnet: [
    "0x0000000000000000000000000000000000000000", // USDC placeholder
    "0x0000000000000000000000000000000000000000", // USDT placeholder
  ],
  mainnet: [
    "0x0000000000000000000000000000000000000000", // USDC placeholder
  ],
};
