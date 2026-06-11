import { formatUnits, parseUnits, JsonRpcProvider } from "ethers";
import { getProvider, resolveChain } from "../../config/chains";
import { validateAddress } from "../portfolio-snapshot/helpers";
import { logger } from "../../lib/logger";
import {
  GasEstimatorInput,
  GasEstimatorOutput,
  AffordabilityCheck,
  SkillResult,
} from "./types";

const log = logger.child("gas-estimator");

const GAS_BUFFER_PERCENT = 20n; // 20% buffer on gas estimate

/**
 * SKILL: gas_estimator
 *
 * Estimates the gas cost of a transaction on Pharos and optionally
 * checks whether the sender wallet can afford to execute it.
 *
 * This is a critical pre-flight check for any AI Agent before
 * submitting a transaction on-chain.
 *
 * @param input - { transaction, gasPriceGwei?, checkAffordability?, network? }
 * @returns SkillResult<GasEstimatorOutput>
 */
export async function gasEstimator(
  input: GasEstimatorInput
): Promise<SkillResult<GasEstimatorOutput>> {
  try {
    // --- Validate ---
    const fromAddress = validateAddress(input.transaction.from);
    const toAddress = validateAddress(input.transaction.to);
    const chain = resolveChain(input.network ?? "testnet");
    const provider = getProvider(chain);

    const tx = {
      from: fromAddress,
      to: toAddress,
      data: input.transaction.data ?? "0x",
      value: input.transaction.value ?? "0x0",
    };

    // --- Fetch gas estimate + fee data + block number in parallel ---
    const [gasEstimateBig, feeData, blockNumber] = await Promise.all([
      provider.estimateGas(tx),
      provider.getFeeData(),
      provider.getBlockNumber(),
    ]);

    // --- Resolve gas price ---
    let gasPriceWei: bigint;

    if (input.gasPriceGwei !== undefined) {
      gasPriceWei = parseUnits(input.gasPriceGwei.toString(), "gwei");
    } else if (feeData.gasPrice) {
      gasPriceWei = feeData.gasPrice;
    } else {
      gasPriceWei = parseUnits("1", "gwei");
    }

    log.debug("Gas estimate resolved", {
      gasEstimate: gasEstimateBig.toString(),
      gasPriceGwei: formatUnits(gasPriceWei, "gwei"),
      network: chain.name,
    });

    // --- Calculate costs ---
    const gasCostWei = gasEstimateBig * gasPriceWei;

    // Suggested gas limit = estimate + 20% buffer
    const suggestedGasLimit =
      gasEstimateBig + (gasEstimateBig * GAS_BUFFER_PERCENT) / 100n;

    // Base fee (EIP-1559)
    const baseFeeGwei = feeData.lastBaseFeePerGas
      ? formatUnits(feeData.lastBaseFeePerGas, "gwei")
      : undefined;

    // --- Affordability check ---
    let affordability: AffordabilityCheck | undefined;

    if (input.checkAffordability) {
      affordability = await checkAffordability(
        provider,
        fromAddress,
        gasCostWei,
        tx.value,
        chain.nativeCurrency.decimals
      );
    }

    // --- Assemble output ---
    const output: GasEstimatorOutput = {
      gasEstimate: gasEstimateBig.toString(),
      gasPriceGwei: formatUnits(gasPriceWei, "gwei"),
      gasPriceWei: gasPriceWei.toString(),
      gasCostWei: gasCostWei.toString(),
      gasCostPHRS: formatUnits(gasCostWei, chain.nativeCurrency.decimals),
      suggestedGasLimit: suggestedGasLimit.toString(),
      baseFeeGwei,
      affordability,
      transaction: input.transaction,
      blockNumber,
      chainId: chain.chainId,
      network: chain.name,
      fetchedAt: new Date().toISOString(),
    };

    return { success: true, data: output };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";

    const isRevert =
      message.includes("execution reverted") ||
      message.includes("revert") ||
      message.includes("CALL_EXCEPTION");

    if (isRevert) {
      log.warn("Transaction would revert", { message });
    } else {
      log.error("Gas estimation failed", { message });
    }

    return {
      success: false,
      error: {
        code: isRevert ? "TRANSACTION_WOULD_REVERT" : "SKILL_EXECUTION_FAILED",
        message,
        details: err,
      },
    };
  }
}

/**
 * Checks whether a wallet has enough PHRS to cover gas + tx value.
 */
async function checkAffordability(
  provider: JsonRpcProvider,
  fromAddress: string,
  gasCostWei: bigint,
  valueHex: string,
  nativeDecimals: number
): Promise<AffordabilityCheck> {
  const walletBalanceWei = await provider.getBalance(fromAddress);

  // Parse value — handle both hex and decimal strings
  let valueWei: bigint;
  try {
    valueWei = BigInt(valueHex);
  } catch {
    valueWei = 0n;
  }

  const totalCostWei = gasCostWei + valueWei;
  const canAfford = walletBalanceWei >= totalCostWei;
  const shortfallWei = canAfford ? undefined : totalCostWei - walletBalanceWei;

  return {
    walletBalanceWei: walletBalanceWei.toString(),
    walletBalancePHRS: formatUnits(walletBalanceWei, nativeDecimals),
    totalCostWei: totalCostWei.toString(),
    totalCostPHRS: formatUnits(totalCostWei, nativeDecimals),
    canAfford,
    shortfallPHRS: shortfallWei
      ? formatUnits(shortfallWei, nativeDecimals)
      : undefined,
  };
}
