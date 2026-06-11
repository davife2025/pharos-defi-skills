import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import { logger } from "./logger";
import { PortfolioSnapshotOutput } from "../skills/portfolio-snapshot/types";
import { TokenPriceFeedOutput } from "../skills/token-price-feed/types";

const log = logger.child("cache");

// Price cache TTL in seconds — Pharos has ~1s finality so 15s is reasonable
const PRICE_CACHE_TTL_SECONDS = 15;

// ─── Portfolio Snapshot Cache ──────────────────────────────────────────────────

/**
 * Attempts to read a cached portfolio snapshot for the given wallet + block.
 * Returns null on cache miss or if Supabase is not configured.
 */
export async function getCachedPortfolioSnapshot(
  walletAddress: string,
  network: string,
  blockNumber: number
): Promise<PortfolioSnapshotOutput | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("portfolio_snapshot_cache")
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .eq("network", network)
      .eq("block_number", blockNumber)
      .single();

    if (error || !data) return null;

    log.debug("Portfolio snapshot cache hit", { walletAddress, blockNumber });

    return {
      walletAddress: data.wallet_address,
      nativeBalance: data.native_balance,
      tokenBalances: data.token_balances,
      blockNumber: data.block_number,
      blockTimestamp: data.block_timestamp,
      chainId: data.chain_id,
      network: data.network,
      fetchedAt: data.fetched_at,
    } as PortfolioSnapshotOutput;
  } catch (err) {
    log.warn("Portfolio snapshot cache read failed", { err });
    return null;
  }
}

/**
 * Writes a portfolio snapshot to cache.
 * Upserts on (wallet_address, network, block_number) — safe to call multiple times.
 * Fire-and-forget — never throws, never blocks the skill response.
 */
export async function setCachedPortfolioSnapshot(
  data: PortfolioSnapshotOutput
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("portfolio_snapshot_cache").upsert(
      {
        wallet_address: data.walletAddress.toLowerCase(),
        network: data.network,
        block_number: data.blockNumber,
        block_timestamp: data.blockTimestamp,
        chain_id: data.chainId,
        native_balance: data.nativeBalance,
        token_balances: data.tokenBalances,
        fetched_at: data.fetchedAt,
      },
      { onConflict: "wallet_address,network,block_number" }
    );

    if (error) {
      log.warn("Portfolio snapshot cache write failed", { error: error.message });
    } else {
      log.debug("Portfolio snapshot cached", {
        walletAddress: data.walletAddress,
        blockNumber: data.blockNumber,
      });
    }
  } catch (err) {
    log.warn("Portfolio snapshot cache write exception", { err });
  }
}

// ─── Token Price Cache ─────────────────────────────────────────────────────────

/**
 * Attempts to read a non-expired cached token price.
 * Returns null on cache miss, expiry, or if Supabase is not configured.
 */
export async function getCachedTokenPrice(
  tokenAddress: string,
  quoteTokenAddress: string,
  network: string
): Promise<TokenPriceFeedOutput | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("token_price_cache")
      .select("*")
      .eq("token_address", tokenAddress.toLowerCase())
      .eq("quote_token_address", quoteTokenAddress.toLowerCase())
      .eq("network", network)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    log.debug("Token price cache hit", { tokenAddress, network });

    return {
      tokenAddress: data.token_address,
      tokenSymbol: data.token_symbol ?? "???",
      quoteTokenAddress: data.quote_token_address,
      quoteTokenSymbol: data.quote_token_symbol ?? "???",
      price: data.price,
      priceRaw: data.price_raw,
      pool: {
        pairAddress: data.pool_address,
        token0: data.token0 ?? data.token_address,
        token1: data.token1 ?? data.quote_token_address,
        reserve0: data.reserve0,
        reserve1: data.reserve1,
      },
      blockNumber: data.block_number,
      chainId: data.chain_id,
      network: data.network,
      fetchedAt: data.fetched_at,
    } as TokenPriceFeedOutput;
  } catch (err) {
    log.warn("Token price cache read failed", { err });
    return null;
  }
}

/**
 * Writes a token price to cache with a TTL.
 * Fire-and-forget — never throws, never blocks the skill response.
 */
export async function setCachedTokenPrice(
  data: TokenPriceFeedOutput,
  ttlSeconds: number = PRICE_CACHE_TTL_SECONDS
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = getSupabaseClient();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const { error } = await supabase.from("token_price_cache").insert({
      token_address: data.tokenAddress.toLowerCase(),
      token_symbol: data.tokenSymbol,
      quote_token_address: data.quoteTokenAddress.toLowerCase(),
      quote_token_symbol: data.quoteTokenSymbol,
      network: data.network,
      chain_id: data.chainId,
      price: data.price,
      price_raw: data.priceRaw,
      block_number: data.blockNumber,
      pool_address: data.pool.pairAddress,
      token0: data.pool.token0,
      token1: data.pool.token1,
      reserve0: data.pool.reserve0,
      reserve1: data.pool.reserve1,
      fetched_at: data.fetchedAt,
      expires_at: expiresAt,
    });

    if (error) {
      log.warn("Token price cache write failed", { error: error.message });
    } else {
      log.debug("Token price cached", {
        tokenAddress: data.tokenAddress,
        price: data.price,
        expiresAt,
      });
    }
  } catch (err) {
    log.warn("Token price cache write exception", { err });
  }
}

// ─── Skill Call Logger ─────────────────────────────────────────────────────────

/**
 * Logs a skill call to the skill_call_log table for analytics.
 * Fire-and-forget — never blocks the skill response.
 */
export async function logSkillCall(entry: {
  skill: string;
  requestId?: string;
  network?: string;
  success: boolean;
  durationMs: number;
  errorCode?: string;
  errorMsg?: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = getSupabaseClient();
    await supabase.from("skill_call_log").insert({
      skill: entry.skill,
      request_id: entry.requestId ?? null,
      network: entry.network ?? null,
      success: entry.success,
      duration_ms: entry.durationMs,
      error_code: entry.errorCode ?? null,
      error_msg: entry.errorMsg ?? null,
    });
  } catch {
    // Silently ignore — logging must never affect skill execution
  }
}
