import { formatUnits } from "ethers";
import { getProvider, resolveChain } from "../../config/chains";
import { validateAddress, fetchTokenBalances } from "./helpers";
import {
  PortfolioSnapshotInput,
  PortfolioSnapshotOutput,
  SkillResult,
} from "./types";

/**
 * SKILL: portfolio_snapshot
 *
 * Returns a complete DeFi portfolio snapshot for a wallet on Pharos.
 * Fetches native PHRS balance + any specified ERC-20 token balances
 * at the current block.
 *
 * @param input - { walletAddress, tokenAddresses?, network? }
 * @returns SkillResult<PortfolioSnapshotOutput>
 */
export async function portfolioSnapshot(
  input: PortfolioSnapshotInput
): Promise<SkillResult<PortfolioSnapshotOutput>> {
  try {
    // --- Validate inputs ---
    const walletAddress = validateAddress(input.walletAddress);
    const chain = resolveChain(input.network ?? "testnet");
    const provider = getProvider(chain);

    // --- Fetch native balance + block in parallel ---
    const [rawNativeBalance, block] = await Promise.all([
      provider.getBalance(walletAddress),
      provider.getBlock("latest"),
    ]);

    if (!block) {
      return {
        success: false,
        error: {
          code: "BLOCK_FETCH_FAILED",
          message: "Could not fetch the latest block from Pharos RPC.",
        },
      };
    }

    const nativeDecimals = chain.nativeCurrency.decimals;
    const nativeBalance = {
      symbol: chain.nativeCurrency.symbol,
      name: chain.nativeCurrency.name,
      decimals: nativeDecimals,
      balance: formatUnits(rawNativeBalance, nativeDecimals),
      raw: rawNativeBalance.toString(),
    };

    // --- Fetch ERC-20 token balances ---
    const tokenBalances =
      input.tokenAddresses && input.tokenAddresses.length > 0
        ? await fetchTokenBalances(
            provider,
            walletAddress,
            input.tokenAddresses
          )
        : [];

    // --- Assemble output ---
    const output: PortfolioSnapshotOutput = {
      walletAddress,
      nativeBalance,
      tokenBalances,
      blockNumber: block.number,
      blockTimestamp: block.timestamp,
      chainId: chain.chainId,
      network: chain.name,
      fetchedAt: new Date().toISOString(),
    };

    return { success: true, data: output };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";

    return {
      success: false,
      error: {
        code: "SKILL_EXECUTION_FAILED",
        message,
        details: err,
      },
    };
  }
}
