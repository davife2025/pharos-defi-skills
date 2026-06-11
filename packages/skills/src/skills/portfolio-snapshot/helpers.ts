import { Contract, formatUnits, getAddress, JsonRpcProvider } from "ethers";
import { ERC20_BALANCE_ABI } from "../../abi/erc20";
import { TokenBalance } from "./types";

/**
 * Validates and checksums an Ethereum address.
 * Throws a clean error if invalid.
 */
export function validateAddress(address: string): string {
  try {
    return getAddress(address);
  } catch {
    throw new Error(`Invalid address: "${address}"`);
  }
}

/**
 * Fetches ERC-20 token metadata and balance for a single token.
 */
export async function fetchTokenBalance(
  provider: JsonRpcProvider,
  walletAddress: string,
  tokenAddress: string
): Promise<TokenBalance> {
  const contract = new Contract(tokenAddress, ERC20_BALANCE_ABI, provider);

  const [rawBalance, symbol, decimals, name] = await Promise.all([
    contract.balanceOf(walletAddress) as Promise<bigint>,
    contract.symbol() as Promise<string>,
    contract.decimals() as Promise<bigint>,
    contract.name() as Promise<string>,
  ]);

  const decimalsNum = Number(decimals);
  const balance = formatUnits(rawBalance, decimalsNum);

  return {
    address: getAddress(tokenAddress),
    name,
    symbol,
    decimals: decimalsNum,
    balance,
    raw: rawBalance.toString(),
    isEmpty: rawBalance === 0n,
  };
}

/**
 * Fetches balances for multiple ERC-20 tokens in parallel.
 * Individual token failures are caught and logged without failing the whole batch.
 */
export async function fetchTokenBalances(
  provider: JsonRpcProvider,
  walletAddress: string,
  tokenAddresses: string[]
): Promise<TokenBalance[]> {
  const results = await Promise.allSettled(
    tokenAddresses.map((addr) =>
      fetchTokenBalance(provider, walletAddress, addr)
    )
  );

  return results
    .map((result, i) => {
      if (result.status === "fulfilled") return result.value;
      console.warn(
        `[portfolio-snapshot] Failed to fetch token ${tokenAddresses[i]}: ${result.reason}`
      );
      return null;
    })
    .filter((r): r is TokenBalance => r !== null);
}

/**
 * Formats a bigint balance to a human-readable string with given decimals.
 */
export function formatBalance(raw: bigint, decimals: number): string {
  return formatUnits(raw, decimals);
}
