import {
  Contract,
  Wallet,
  parseUnits,
  formatUnits,
  getAddress,
  MaxUint256,
} from "ethers";
import { getProvider, resolveChain } from "../../config/chains";
import { validateAddress } from "../portfolio-snapshot/helpers";
import { ERC20_ABI } from "../../abi/erc20";
import {
  UNISWAP_V2_ROUTER_ABI,
  PHAROS_ROUTER_ADDRESSES,
  NATIVE_TOKEN_SENTINEL,
} from "../../abi/router";
import { logger } from "../../lib/logger";
import { TokenSwapInput, TokenSwapOutput, SkillResult } from "./types";

const log = logger.child("token-swap");

const DEFAULT_SLIPPAGE_PCT = 0.5;
const DEFAULT_DEADLINE_SECONDS = 300;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * SKILL: token_swap
 *
 * Executes a token swap on a Uniswap V2 compatible DEX on Pharos.
 * Handles native PHRS ↔ ERC-20 and ERC-20 ↔ ERC-20 swaps.
 *
 * Flow:
 * 1. Validate inputs + resolve router address
 * 2. Get amountsOut quote from router
 * 3. Apply slippage to derive amountOutMin
 * 4. If selling ERC-20: check + request token approval if needed
 * 5. Submit swap transaction
 * 6. Wait for confirmation and return receipt
 *
 * SECURITY NOTE:
 * privateKey is used only in-memory to sign the transaction.
 * It is never logged, cached, or persisted anywhere.
 *
 * @param input - TokenSwapInput
 * @returns SkillResult<TokenSwapOutput>
 */
export async function tokenSwap(
  input: TokenSwapInput
): Promise<SkillResult<TokenSwapOutput>> {
  try {
    // ── Validate ──────────────────────────────────────────────────────────────
    if (!input.privateKey || input.privateKey.length < 64) {
      return {
        success: false,
        error: { code: "INVALID_PRIVATE_KEY", message: "A valid private key is required." },
      };
    }

    const chain = resolveChain(input.network ?? "testnet");
    const provider = getProvider(chain);
    const wallet = new Wallet(input.privateKey, provider);
    const networkKey = `pharosswap_${input.network ?? "testnet"}`;

    // ── Resolve router ────────────────────────────────────────────────────────
    const routerAddress =
      input.routerAddress ??
      PHAROS_ROUTER_ADDRESSES[networkKey] ??
      ZERO_ADDRESS;

    if (routerAddress === ZERO_ADDRESS) {
      return {
        success: false,
        error: {
          code: "NO_ROUTER_CONFIGURED",
          message:
            "No DEX router address configured. " +
            "Pass routerAddress explicitly or update src/abi/router.ts with the live Pharos router.",
        },
      };
    }

    const router = new Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, wallet);
    const isNativeIn = input.tokenIn === NATIVE_TOKEN_SENTINEL;
    const isNativeOut = input.tokenOut === NATIVE_TOKEN_SENTINEL;

    // ── Resolve WETH address for native routing ───────────────────────────────
    const wethAddress: string = await router.WETH();

    const tokenInAddress = isNativeIn
      ? wethAddress
      : validateAddress(input.tokenIn);
    const tokenOutAddress = isNativeOut
      ? wethAddress
      : validateAddress(input.tokenOut);

    // ── Resolve decimals + symbols ────────────────────────────────────────────
    let tokenInDecimals = 18;
    let tokenInSymbol = chain.nativeCurrency.symbol;
    let tokenOutDecimals = 18;
    let tokenOutSymbol = chain.nativeCurrency.symbol;

    if (!isNativeIn) {
      const tokenInContract = new Contract(tokenInAddress, ERC20_ABI, provider);
      [tokenInDecimals, tokenInSymbol] = await Promise.all([
        tokenInContract.decimals().then(Number),
        tokenInContract.symbol(),
      ]);
    }

    if (!isNativeOut) {
      const tokenOutContract = new Contract(tokenOutAddress, ERC20_ABI, provider);
      [tokenOutDecimals, tokenOutSymbol] = await Promise.all([
        tokenOutContract.decimals().then(Number),
        tokenOutContract.symbol(),
      ]);
    }

    const amountInWei = parseUnits(input.amountIn, tokenInDecimals);
    const slippage = input.slippagePct ?? DEFAULT_SLIPPAGE_PCT;
    const deadline = Math.floor(Date.now() / 1000) + (input.deadlineSeconds ?? DEFAULT_DEADLINE_SECONDS);
    const path = [tokenInAddress, tokenOutAddress];

    // ── Get quote from router ─────────────────────────────────────────────────
    let amounts: bigint[];
    try {
      amounts = await router.getAmountsOut(amountInWei, path);
    } catch {
      return {
        success: false,
        error: {
          code: "NO_LIQUIDITY",
          message: `No liquidity path found between ${tokenInSymbol} and ${tokenOutSymbol} on ${chain.name}.`,
        },
      };
    }

    const expectedOut = amounts[amounts.length - 1];
    const slippageFactor = BigInt(Math.floor((1 - slippage / 100) * 10000));
    const amountOutMin = (expectedOut * slippageFactor) / 10000n;

    log.info("Swap quote", {
      tokenIn: tokenInSymbol,
      tokenOut: tokenOutSymbol,
      amountIn: input.amountIn,
      expectedOut: formatUnits(expectedOut, tokenOutDecimals),
      amountOutMin: formatUnits(amountOutMin, tokenOutDecimals),
      slippagePct: slippage,
    });

    // ── ERC-20 approval (if selling a token, not native) ──────────────────────
    if (!isNativeIn) {
      const tokenInContract = new Contract(tokenInAddress, ERC20_ABI, wallet);
      const allowance: bigint = await tokenInContract.allowance(
        wallet.address,
        routerAddress
      );

      if (allowance < amountInWei) {
        log.info("Requesting token approval", { token: tokenInSymbol });
        const approveTx = await tokenInContract.approve(routerAddress, MaxUint256);
        await approveTx.wait();
        log.info("Token approval confirmed", { token: tokenInSymbol });
      }
    }

    // ── Execute swap ──────────────────────────────────────────────────────────
    let tx;

    if (isNativeIn) {
      // PHRS → Token
      tx = await router.swapExactETHForTokens(
        amountOutMin,
        path,
        wallet.address,
        deadline,
        { value: amountInWei }
      );
    } else if (isNativeOut) {
      // Token → PHRS
      tx = await router.swapExactTokensForETH(
        amountInWei,
        amountOutMin,
        path,
        wallet.address,
        deadline
      );
    } else {
      // Token → Token
      tx = await router.swapExactTokensForTokens(
        amountInWei,
        amountOutMin,
        path,
        wallet.address,
        deadline
      );
    }

    log.info("Swap tx submitted", { txHash: tx.hash });

    // ── Wait for confirmation ─────────────────────────────────────────────────
    const receipt = await tx.wait();

    if (!receipt || receipt.status === 0) {
      return {
        success: false,
        error: {
          code: "TRANSACTION_REVERTED",
          message: `Swap transaction reverted on-chain. Hash: ${tx.hash}`,
        },
      };
    }

    const gasCostWei = receipt.gasUsed * receipt.gasPrice;

    log.info("Swap confirmed", {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    });

    const output: TokenSwapOutput = {
      txHash: receipt.hash,
      tokenIn: isNativeIn ? NATIVE_TOKEN_SENTINEL : getAddress(tokenInAddress),
      tokenInSymbol,
      tokenOut: isNativeOut ? NATIVE_TOKEN_SENTINEL : getAddress(tokenOutAddress),
      tokenOutSymbol,
      amountIn: input.amountIn,
      amountOutMin: formatUnits(amountOutMin, tokenOutDecimals),
      slippagePct: slippage,
      gasUsed: receipt.gasUsed.toString(),
      gasCostPHRS: formatUnits(gasCostWei, chain.nativeCurrency.decimals),
      blockNumber: receipt.blockNumber,
      explorerUrl: `${chain.explorerUrl}/tx/${receipt.hash}`,
      chainId: chain.chainId,
      network: chain.name,
      executedAt: new Date().toISOString(),
    };

    return { success: true, data: output };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isRevert =
      message.includes("execution reverted") ||
      message.includes("CALL_EXCEPTION");

    return {
      success: false,
      error: {
        code: isRevert ? "TRANSACTION_REVERTED" : "SKILL_EXECUTION_FAILED",
        message,
        details: err,
      },
    };
  }
}
