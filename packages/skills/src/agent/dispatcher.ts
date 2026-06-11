import { portfolioSnapshot } from "../skills/portfolio-snapshot";
import { tokenPriceFeed } from "../skills/token-price-feed";
import { gasEstimator } from "../skills/gas-estimator";
import {
  AgentSkillCall,
  AgentSkillResponse,
  SkillName,
  SkillOutputMap,
} from "./types";
import { SkillResult } from "../skills/portfolio-snapshot/types";

/**
 * dispatch()
 *
 * The single entry point for all Agent skill calls.
 *
 * Accepts a standard { skill, params } envelope and routes it to the
 * correct skill implementation. Returns a typed { skill, result, durationMs }
 * response envelope.
 *
 * This is what Agent frameworks (LangChain, custom loops, HTTP servers)
 * call — they never import individual skills directly.
 *
 * @example
 * const response = await dispatch({
 *   skill: "portfolio_snapshot",
 *   params: { walletAddress: "0x...", network: "testnet" },
 *   requestId: "req_001",
 * });
 *
 * if (response.result.success) {
 *   console.log(response.result.data.nativeBalance);
 * }
 */
export async function dispatch<S extends SkillName>(
  call: AgentSkillCall<S>
): Promise<AgentSkillResponse<S>> {
  const start = Date.now();

  let result: SkillResult<SkillOutputMap[S]>;

  try {
    switch (call.skill) {
      case "portfolio_snapshot":
        result = (await portfolioSnapshot(
          call.params as Parameters<typeof portfolioSnapshot>[0]
        )) as SkillResult<SkillOutputMap[S]>;
        break;

      case "token_price_feed":
        result = (await tokenPriceFeed(
          call.params as Parameters<typeof tokenPriceFeed>[0]
        )) as SkillResult<SkillOutputMap[S]>;
        break;

      case "gas_estimator":
        result = (await gasEstimator(
          call.params as Parameters<typeof gasEstimator>[0]
        )) as SkillResult<SkillOutputMap[S]>;
        break;

      default:
        result = {
          success: false,
          error: {
            code: "UNKNOWN_SKILL",
            message: `Unknown skill: "${call.skill}". Available skills: portfolio_snapshot, token_price_feed, gas_estimator`,
          },
        } as SkillResult<SkillOutputMap[S]>;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Dispatcher error";
    result = {
      success: false,
      error: {
        code: "DISPATCHER_ERROR",
        message,
        details: err,
      },
    } as SkillResult<SkillOutputMap[S]>;
  }

  return {
    skill: call.skill,
    requestId: call.requestId,
    result,
    durationMs: Date.now() - start,
  };
}

/**
 * dispatchMany()
 *
 * Executes multiple skill calls in parallel and returns all results.
 * Useful for Agents that need to gather multiple data points simultaneously.
 *
 * @example
 * const [snapshot, price] = await dispatchMany([
 *   { skill: "portfolio_snapshot", params: { walletAddress: "0x..." } },
 *   { skill: "token_price_feed", params: { tokenAddress: "0x..." } },
 * ]);
 */
export async function dispatchMany(
  calls: AgentSkillCall[]
): Promise<AgentSkillResponse[]> {
  return Promise.all(calls.map((call) => dispatch(call)));
}
