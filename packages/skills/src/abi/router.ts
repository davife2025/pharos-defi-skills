/**
 * Uniswap V2 Router02 ABI — subset needed for swap execution.
 * Compatible with any V2 fork (PharosSwap, etc.)
 */
export const UNISWAP_V2_ROUTER_ABI = [
  // Swap exact tokens for tokens
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",

  // Swap exact ETH/native for tokens
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)",

  // Swap exact tokens for ETH/native
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",

  // Quote helpers
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
  "function getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[] amounts)",

  // WETH address (used to route native ↔ token swaps)
  "function WETH() view returns (address)",
] as const;

/**
 * Known router addresses on Pharos.
 * Update with live addresses once DEX deploys on mainnet.
 */
export const PHAROS_ROUTER_ADDRESSES: Record<string, string> = {
  pharosswap_testnet: "0x0000000000000000000000000000000000000000", // placeholder
  pharosswap_mainnet: "0x0000000000000000000000000000000000000000", // placeholder
};

export const NATIVE_TOKEN_SENTINEL = "NATIVE";
