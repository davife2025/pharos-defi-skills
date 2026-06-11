import { Contract, JsonRpcProvider, getAddress } from "ethers";
import {
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
} from "../../abi/dex";
import { ERC20_BALANCE_ABI } from "../../abi/erc20";
import { PricePool } from "./types";
import { logger } from "../../lib/logger";

const log = logger.child("token-price-feed");

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Looks up a Uniswap V2 compatible pair address from a factory.
 * Returns null if the pair doesn't exist.
 */
export async function getPairAddress(
  provider: JsonRpcProvider,
  factoryAddress: string,
  tokenA: string,
  tokenB: string
): Promise<string | null> {
  const factory = new Contract(factoryAddress, UNISWAP_V2_FACTORY_ABI, provider);
  const pair: string = await factory.getPair(tokenA, tokenB);
  if (pair === ZERO_ADDRESS) return null;
  return getAddress(pair);
}

/**
 * Fetches reserves and token order from a V2 pair contract.
 */
export async function getPairData(
  provider: JsonRpcProvider,
  pairAddress: string
): Promise<PricePool & { reserve0Raw: bigint; reserve1Raw: bigint }> {
  const pair = new Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);
  const [token0, token1, reserves] = await Promise.all([
    pair.token0() as Promise<string>,
    pair.token1() as Promise<string>,
    pair.getReserves() as Promise<[bigint, bigint, number]>,
  ]);

  const [reserve0Raw, reserve1Raw] = reserves;

  return {
    pairAddress,
    token0: getAddress(token0),
    token1: getAddress(token1),
    reserve0: reserve0Raw.toString(),
    reserve1: reserve1Raw.toString(),
    reserve0Raw,
    reserve1Raw,
  };
}

/**
 * Gets decimals for a token — defaults to 18 on failure.
 */
export async function getTokenDecimals(
  provider: JsonRpcProvider,
  tokenAddress: string
): Promise<number> {
  try {
    const contract = new Contract(tokenAddress, ERC20_BALANCE_ABI, provider);
    return Number(await contract.decimals());
  } catch {
    log.warn("Failed to fetch decimals, defaulting to 18", { tokenAddress });
    return 18;
  }
}

/**
 * Gets symbol for a token — defaults to "???" on failure.
 */
export async function getTokenSymbol(
  provider: JsonRpcProvider,
  tokenAddress: string
): Promise<string> {
  try {
    const contract = new Contract(tokenAddress, ERC20_BALANCE_ABI, provider);
    return await contract.symbol();
  } catch {
    log.warn("Failed to fetch symbol", { tokenAddress });
    return "???";
  }
}

/**
 * Derives the price of tokenA in terms of tokenB from V2 reserves.
 *
 * price = (reserveB / 10^decimalsB) / (reserveA / 10^decimalsA)
 *
 * Returns price as a plain JS number for display, and a high-precision string.
 */
export function derivePrice(
  pairData: { token0: string; reserve0Raw: bigint; reserve1Raw: bigint },
  tokenAddress: string,
  tokenDecimals: number,
  quoteDecimals: number
): { price: number; priceRaw: string } {
  const { token0, reserve0Raw, reserve1Raw } = pairData;

  const isToken0 =
    getAddress(tokenAddress) === getAddress(token0);

  // reserveToken / reserveQuote — adjusted for decimals
  const reserveToken = isToken0 ? reserve0Raw : reserve1Raw;
  const reserveQuote = isToken0 ? reserve1Raw : reserve0Raw;

  if (reserveToken === 0n) {
    return { price: 0, priceRaw: "0" };
  }

  // Use BigInt arithmetic scaled to 18 decimal places for precision
  const PRECISION = 10n ** 18n;
  const decimalAdjustment =
    10n ** BigInt(Math.abs(quoteDecimals - tokenDecimals));

  let rawPrice: bigint;
  if (quoteDecimals >= tokenDecimals) {
    rawPrice = (reserveQuote * PRECISION) / reserveToken / decimalAdjustment;
  } else {
    rawPrice = (reserveQuote * PRECISION * decimalAdjustment) / reserveToken;
  }

  const priceRaw = rawPrice.toString();
  const price = Number(rawPrice) / Number(PRECISION);

  return { price, priceRaw };
}
