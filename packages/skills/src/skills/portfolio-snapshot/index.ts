import { formatUnits } from "ethers";
import { getProvider, resolveChain } from "../../config/chains";
import { validateAddress, fetchTokenBalances } from "./helpers";
import { multicallPortfolioFetch } from "../../lib/multicall";
import {
  getCachedPortfolioSnapshot,
  setCachedPortfolioSnapshot,
} from "../../lib/cache";
import { logger } from "../../lib/logger";
import {
  PortfolioSnapshotInput,
  PortfolioSnapshotOutput,
  SkillResult,
} from "./types";

const log = logger.child("portfolio-snapshot");

/**
 * SKILL: portfolio_snapshot (v3 — Multicall3 + Supabase cache)
 *
 * Cache strategy:
 * - Check cache for (wallet, network, currentBlock) before any RPC call.
 * - On miss: fetch via Multicall3, write to cache asynchronously.
 * - Same block = instant cache hit. New block = fresh fetch.
 *
 * @param input - { walletAddress, tokenAddresses?, network? }
 * @returns SkillResult<PortfolioSnapshotOutput>
 */
export async function portfolioSnapshot(
  input: PortfolioSnapshotInput
): Promise<SkillResult<PortfolioSnapshotOutput>> {
  try {
    const walletAddress = validateAddress(input.walletAddress);
    const chain = resolveChain(input.network ?? "testnet");
    const provider = getProvider(chain);
    const networkKey = input.network ?? "testnet";
    const hasTokens = input.tokenAddresses && input.tokenAddresses.length > 0;

    // --- Get current block number for cache key ---
    const currentBlock = await provider.getBlockNumber();

    // --- Cache read ---
    const cached = await getCachedPortfolioSnapshot(
      walletAddress,
      networkKey,
      currentBlock
    );
    if (cached) {
      log.debug("Cache hit", { walletAddress, blockNumber: currentBlock });
      return { success: true, data: cached };
    }

    let nativeRaw: bigint;
    let tokenBalances: Awaited<ReturnType<typeof fetchTokenBalances>> = [];
    let blockNumber: number;
    let blockTimestamp: number;

    if (hasTokens) {
      const result = await multicallPortfolioFetch(
        provider,
        walletAddress,
        input.tokenAddresses!,
        chain.nativeCurrency
      );
      nativeRaw = result.nativeRaw;
      tokenBalances = result.tokenBalances;
      blockNumber = result.blockNumber;
      blockTimestamp = result.blockTimestamp;
    } else {
      const [rawBal, block] = await Promise.all([
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

      nativeRaw = rawBal;
      blockNumber = block.number;
      blockTimestamp = block.timestamp;
    }

    const nativeDecimals = chain.nativeCurrency.decimals;

    const output: PortfolioSnapshotOutput = {
      walletAddress,
      nativeBalance: {
        symbol: chain.nativeCurrency.symbol,
        name: chain.nativeCurrency.name,
        decimals: nativeDecimals,
        balance: formatUnits(nativeRaw, nativeDecimals),
        raw: nativeRaw.toString(),
      },
      tokenBalances,
      blockNumber,
      blockTimestamp,
      chainId: chain.chainId,
      network: chain.name,
      fetchedAt: new Date().toISOString(),
    };

    // --- Cache write (fire-and-forget) ---
    setCachedPortfolioSnapshot(output).catch(() => {});

    return { success: true, data: output };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error occurred";
    return {
      success: false,
      error: { code: "SKILL_EXECUTION_FAILED", message, details: err },
    };
  }
}
