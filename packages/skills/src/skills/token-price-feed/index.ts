import { getAddress } from "ethers";
import { getProvider, resolveChain } from "../../config/chains";
import { validateAddress } from "../portfolio-snapshot/helpers";
import {
  getPairAddress,
  getPairData,
  getTokenDecimals,
  getTokenSymbol,
  derivePrice,
  ZERO_ADDRESS,
} from "./helpers";
import { PHAROS_DEX_FACTORIES, STABLE_TOKENS } from "../../abi/dex";
import { getCachedTokenPrice, setCachedTokenPrice } from "../../lib/cache";
import { logger } from "../../lib/logger";
import {
  TokenPriceFeedInput,
  TokenPriceFeedOutput,
  SkillResult,
} from "./types";

const log = logger.child("token-price-feed");

/**
 * SKILL: token_price_feed
 *
 * Fetches the real-time on-chain price of a token from a Uniswap V2
 * compatible DEX pool on Pharos.
 *
 * Strategy:
 * 1. Find a live liquidity pool for tokenAddress/quoteToken on the DEX factory.
 * 2. Read reserves from the pair contract.
 * 3. Derive the spot price using reserve ratio + decimal adjustment.
 *
 * @param input - { tokenAddress, quoteTokenAddress?, factoryAddress?, network? }
 * @returns SkillResult<TokenPriceFeedOutput>
 */
export async function tokenPriceFeed(
  input: TokenPriceFeedInput
): Promise<SkillResult<TokenPriceFeedOutput>> {
  try {
    // --- Validate + setup ---
    const tokenAddress = validateAddress(input.tokenAddress);
    const chain = resolveChain(input.network ?? "testnet");
    const provider = getProvider(chain);
    const networkKey = input.network ?? "testnet";

    // Factory: use provided or fall back to PharosSwap
    const factoryAddress =
      input.factoryAddress ??
      PHAROS_DEX_FACTORIES["pharosswap"] ??
      ZERO_ADDRESS;

    if (factoryAddress === ZERO_ADDRESS) {
      return {
        success: false,
        error: {
          code: "NO_FACTORY_CONFIGURED",
          message:
            "No DEX factory address configured for this network. " +
            "Pass factoryAddress explicitly or update src/abi/dex.ts with the live Pharos DEX factory.",
        },
      };
    }

    // Quote token: use provided or try stables in order
    const stables = STABLE_TOKENS[networkKey] ?? [];
    const quoteTokenCandidates = input.quoteTokenAddress
      ? [validateAddress(input.quoteTokenAddress)]
      : stables.filter((s) => s !== ZERO_ADDRESS);

    if (quoteTokenCandidates.length === 0) {
      return {
        success: false,
        error: {
          code: "NO_QUOTE_TOKEN",
          message:
            "No quote token address provided and no stable tokens configured. " +
            "Pass quoteTokenAddress explicitly or update STABLE_TOKENS in src/abi/dex.ts.",
        },
      };
    }

    // --- Cache read ---
    const quoteForCache = quoteTokenCandidates[0];
    const cached = await getCachedTokenPrice(tokenAddress, quoteForCache, networkKey);
    if (cached) {
      log.debug("Cache hit", { tokenAddress, network: networkKey });
      return { success: true, data: cached };
    }

    // --- Find a valid pair ---
    let pairAddress: string | null = null;
    let quoteTokenAddress: string = quoteTokenCandidates[0];

    for (const candidate of quoteTokenCandidates) {
      const addr = await getPairAddress(
        provider,
        factoryAddress,
        tokenAddress,
        candidate
      );
      if (addr) {
        pairAddress = addr;
        quoteTokenAddress = candidate;
        break;
      }
    }

    if (!pairAddress) {
      return {
        success: false,
        error: {
          code: "NO_POOL_FOUND",
          message: `No liquidity pool found for token ${tokenAddress} against any configured quote token on ${chain.name}.`,
        },
      };
    }

    // --- Fetch pair data, decimals, symbols in parallel ---
    const [pairData, tokenDecimals, quoteDecimals, tokenSymbol, quoteSymbol, block] =
      await Promise.all([
        getPairData(provider, pairAddress),
        getTokenDecimals(provider, tokenAddress),
        getTokenDecimals(provider, quoteTokenAddress),
        getTokenSymbol(provider, tokenAddress),
        getTokenSymbol(provider, quoteTokenAddress),
        provider.getBlockNumber(),
      ]);

    // --- Derive spot price ---
    const { price, priceRaw } = derivePrice(
      pairData,
      tokenAddress,
      tokenDecimals,
      quoteDecimals
    );

    const output: TokenPriceFeedOutput = {
      tokenAddress: getAddress(tokenAddress),
      tokenSymbol,
      quoteTokenAddress: getAddress(quoteTokenAddress),
      quoteTokenSymbol: quoteSymbol,
      price: price.toFixed(8),
      priceRaw,
      pool: {
        pairAddress: pairData.pairAddress,
        token0: pairData.token0,
        token1: pairData.token1,
        reserve0: pairData.reserve0,
        reserve1: pairData.reserve1,
      },
      blockNumber: block,
      chainId: chain.chainId,
      network: chain.name,
      fetchedAt: new Date().toISOString(),
    };

    // --- Cache write (fire-and-forget) ---
    setCachedTokenPrice(output).catch(() => {});

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
