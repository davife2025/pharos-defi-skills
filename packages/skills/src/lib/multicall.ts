import {
  Contract,
  Interface,
  JsonRpcProvider,
  getAddress,
  formatUnits,
} from "ethers";
import {
  MULTICALL3_ADDRESS,
  MULTICALL3_ABI,
  Multicall3Result,
} from "../abi/multicall3";
import { ERC20_BALANCE_ABI } from "../abi/erc20";
import { TokenBalance } from "../skills/portfolio-snapshot/types";
import { logger } from "./logger";

const log = logger.child("multicall");

const ERC20_IFACE = new Interface(ERC20_BALANCE_ABI as unknown as string[]);

/**
 * Fetches native PHRS balance + all ERC-20 token balances for a wallet
 * in a single Multicall3 aggregate3 call.
 *
 * This replaces the individual Promise.allSettled approach from Session 1
 * with a single RPC round-trip, which is far more efficient.
 */
export async function multicallPortfolioFetch(
  provider: JsonRpcProvider,
  walletAddress: string,
  tokenAddresses: string[],
  nativeCurrency: { symbol: string; name: string; decimals: number }
): Promise<{
  nativeRaw: bigint;
  tokenBalances: TokenBalance[];
  blockNumber: number;
  blockTimestamp: number;
}> {
  const multicall = new Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

  // --- Build call list ---
  // Each token needs 3 calls: balanceOf, symbol, decimals, name
  // Plus 1 call for native ETH balance via getEthBalance
  // Plus 1 call for current block timestamp

  const calls: { target: string; allowFailure: boolean; callData: string }[] =
    [];

  // Call 0: native balance
  calls.push({
    target: MULTICALL3_ADDRESS,
    allowFailure: false,
    callData: multicall.interface.encodeFunctionData("getEthBalance", [
      walletAddress,
    ]),
  });

  // Call 1: block timestamp
  calls.push({
    target: MULTICALL3_ADDRESS,
    allowFailure: false,
    callData: multicall.interface.encodeFunctionData(
      "getCurrentBlockTimestamp",
      []
    ),
  });

  // Calls 2+N: for each token — balanceOf, symbol, decimals, name (4 calls each)
  for (const tokenAddr of tokenAddresses) {
    calls.push({
      target: tokenAddr,
      allowFailure: true,
      callData: ERC20_IFACE.encodeFunctionData("balanceOf", [walletAddress]),
    });
    calls.push({
      target: tokenAddr,
      allowFailure: true,
      callData: ERC20_IFACE.encodeFunctionData("symbol", []),
    });
    calls.push({
      target: tokenAddr,
      allowFailure: true,
      callData: ERC20_IFACE.encodeFunctionData("decimals", []),
    });
    calls.push({
      target: tokenAddr,
      allowFailure: true,
      callData: ERC20_IFACE.encodeFunctionData("name", []),
    });
  }

  // --- Execute single RPC call ---
  const [blockNumber, rawResults]: [bigint, Multicall3Result[]] =
    await multicall.aggregate3.staticCall(calls);

  // --- Decode native balance (call 0) ---
  const nativeRaw = multicall.interface.decodeFunctionResult(
    "getEthBalance",
    rawResults[0].returnData
  )[0] as bigint;

  // --- Decode block timestamp (call 1) ---
  const blockTimestamp = Number(
    multicall.interface.decodeFunctionResult(
      "getCurrentBlockTimestamp",
      rawResults[1].returnData
    )[0]
  );

  // --- Decode token results (calls 2+ in groups of 4) ---
  const tokenBalances: TokenBalance[] = [];

  for (let i = 0; i < tokenAddresses.length; i++) {
    const base = 2 + i * 4;
    const balResult = rawResults[base];
    const symResult = rawResults[base + 1];
    const decResult = rawResults[base + 2];
    const nameResult = rawResults[base + 3];

    // Skip entirely if the core balance call failed
    if (!balResult.success) {
      log.warn("balanceOf failed for token", { token: tokenAddresses[i] });
      continue;
    }

    try {
      const rawBalance = ERC20_IFACE.decodeFunctionResult(
        "balanceOf",
        balResult.returnData
      )[0] as bigint;

      const symbol = symResult.success
        ? (ERC20_IFACE.decodeFunctionResult(
            "symbol",
            symResult.returnData
          )[0] as string)
        : "UNKNOWN";

      const decimals = decResult.success
        ? Number(
            ERC20_IFACE.decodeFunctionResult(
              "decimals",
              decResult.returnData
            )[0]
          )
        : 18;

      const name = nameResult.success
        ? (ERC20_IFACE.decodeFunctionResult(
            "name",
            nameResult.returnData
          )[0] as string)
        : symbol;

      tokenBalances.push({
        address: getAddress(tokenAddresses[i]),
        name,
        symbol,
        decimals,
        balance: formatUnits(rawBalance, decimals),
        raw: rawBalance.toString(),
        isEmpty: rawBalance === 0n,
      });
    } catch (err) {
      log.warn("decode failed for token", { token: tokenAddresses[i], err });
    }
  }

  return {
    nativeRaw,
    tokenBalances,
    blockNumber: Number(blockNumber),
    blockTimestamp,
  };
}
