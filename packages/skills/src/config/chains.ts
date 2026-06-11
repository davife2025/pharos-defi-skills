import { JsonRpcProvider } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  fallbackRpcUrl?: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const PHAROS_TESTNET: ChainConfig = {
  chainId: 688688,
  name: "Pharos Testnet",
  rpcUrl:
    process.env.PHAROS_TESTNET_RPC ||
    process.env.PHAROS_FALLBACK_RPC ||
    "https://testnet.dplabs-internal.com",
  fallbackRpcUrl: "https://testnet.dplabs-internal.com",
  explorerUrl: "https://testnet.pharosscan.xyz",
  nativeCurrency: {
    name: "Pharos",
    symbol: "PHRS",
    decimals: 18,
  },
};

export const PHAROS_MAINNET: ChainConfig = {
  chainId: 1672,
  name: "Pharos Mainnet",
  rpcUrl:
    process.env.PHAROS_MAINNET_RPC || "https://rpc.pharosnetwork.xyz",
  explorerUrl: "https://pharosscan.xyz",
  nativeCurrency: {
    name: "Pharos",
    symbol: "PHRS",
    decimals: 18,
  },
};

export const CHAINS: Record<string, ChainConfig> = {
  testnet: PHAROS_TESTNET,
  mainnet: PHAROS_MAINNET,
};

/**
 * Returns an ethers JsonRpcProvider for the given chain.
 * Falls back to the fallback RPC if the primary fails.
 */
export function getProvider(chain: ChainConfig = PHAROS_TESTNET): JsonRpcProvider {
  return new JsonRpcProvider(chain.rpcUrl, {
    chainId: chain.chainId,
    name: chain.name,
  });
}

/**
 * Resolves a network name or chain ID to a ChainConfig.
 */
export function resolveChain(network: "testnet" | "mainnet" | number = "testnet"): ChainConfig {
  if (typeof network === "number") {
    const found = Object.values(CHAINS).find((c) => c.chainId === network);
    if (!found) throw new Error(`Unsupported chain ID: ${network}`);
    return found;
  }
  const found = CHAINS[network];
  if (!found) throw new Error(`Unsupported network: ${network}`);
  return found;
}
