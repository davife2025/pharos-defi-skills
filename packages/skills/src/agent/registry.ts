import { SkillMeta, SkillRegistry } from "./types";

const PORTFOLIO_SNAPSHOT_META: SkillMeta = {
  name: "portfolio_snapshot",
  version: "2.0.0",
  description:
    "Returns a complete DeFi portfolio snapshot for any wallet on Pharos. " +
    "Fetches native PHRS balance and any specified ERC-20 token balances in a " +
    "single Multicall3 round-trip. Use this before any Agent action that requires " +
    "knowledge of wallet state.",
  inputSchema: {
    type: "object",
    required: ["walletAddress"],
    properties: {
      walletAddress: {
        type: "string",
        description: "Wallet address to query (0x...)",
      },
      tokenAddresses: {
        type: "array",
        items: { type: "string" },
        description: "Optional ERC-20 contract addresses to include",
      },
      network: {
        type: "string",
        enum: ["testnet", "mainnet"],
        default: "testnet",
        description: "Target Pharos network",
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      walletAddress: { type: "string" },
      nativeBalance: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          balance: { type: "string" },
          raw: { type: "string" },
          decimals: { type: "number" },
        },
      },
      tokenBalances: {
        type: "array",
        items: {
          type: "object",
          properties: {
            address: { type: "string" },
            symbol: { type: "string" },
            balance: { type: "string" },
            decimals: { type: "number" },
            isEmpty: { type: "boolean" },
          },
        },
      },
      blockNumber: { type: "number" },
      blockTimestamp: { type: "number" },
      chainId: { type: "number" },
      fetchedAt: { type: "string", format: "date-time" },
    },
  },
};

const TOKEN_PRICE_FEED_META: SkillMeta = {
  name: "token_price_feed",
  version: "1.0.0",
  description:
    "Fetches the real-time spot price of an ERC-20 token from an on-chain " +
    "Uniswap V2 compatible DEX pool on Pharos. Price is derived directly from " +
    "pool reserves — no oracle dependency. Use before any swap or valuation decision.",
  inputSchema: {
    type: "object",
    required: ["tokenAddress"],
    properties: {
      tokenAddress: {
        type: "string",
        description: "Token to price (0x...)",
      },
      quoteTokenAddress: {
        type: "string",
        description: "Quote token address (e.g. USDC). Defaults to best stable.",
      },
      factoryAddress: {
        type: "string",
        description: "DEX factory address. Defaults to PharosSwap factory.",
      },
      network: {
        type: "string",
        enum: ["testnet", "mainnet"],
        default: "testnet",
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      tokenAddress: { type: "string" },
      tokenSymbol: { type: "string" },
      quoteTokenAddress: { type: "string" },
      quoteTokenSymbol: { type: "string" },
      price: { type: "string", description: "Price with 8 decimal places" },
      priceRaw: { type: "string", description: "18 decimal precision raw price" },
      pool: {
        type: "object",
        properties: {
          pairAddress: { type: "string" },
          reserve0: { type: "string" },
          reserve1: { type: "string" },
        },
      },
      blockNumber: { type: "number" },
    },
  },
};

const GAS_ESTIMATOR_META: SkillMeta = {
  name: "gas_estimator",
  version: "1.0.0",
  description:
    "Estimates gas cost for any transaction on Pharos and optionally checks " +
    "whether the sender wallet can afford to execute it. Always call this before " +
    "submitting any on-chain transaction. Returns TRANSACTION_WOULD_REVERT if the " +
    "tx will fail — the Agent should abort if this happens.",
  inputSchema: {
    type: "object",
    required: ["transaction"],
    properties: {
      transaction: {
        type: "object",
        required: ["from", "to"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          data: { type: "string", description: "Hex calldata" },
          value: { type: "string", description: "Value in wei" },
        },
      },
      gasPriceGwei: {
        type: "number",
        description: "Gas price override in gwei",
      },
      checkAffordability: {
        type: "boolean",
        default: false,
        description: "Also check wallet balance vs total cost",
      },
      network: {
        type: "string",
        enum: ["testnet", "mainnet"],
        default: "testnet",
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      gasEstimate: { type: "string" },
      gasPriceGwei: { type: "string" },
      gasCostPHRS: { type: "string" },
      suggestedGasLimit: { type: "string" },
      affordability: {
        type: "object",
        properties: {
          canAfford: { type: "boolean" },
          walletBalancePHRS: { type: "string" },
          totalCostPHRS: { type: "string" },
          shortfallPHRS: { type: "string" },
        },
      },
    },
  },
};

export const SKILL_REGISTRY: SkillRegistry = {
  version: "1.0.0",
  skills: [
    PORTFOLIO_SNAPSHOT_META,
    TOKEN_PRICE_FEED_META,
    GAS_ESTIMATOR_META,
    {
      name: "token_swap",
      version: "1.0.0",
      description:
        "Executes a token swap on a Uniswap V2 compatible DEX on Pharos. " +
        "Handles NATIVE (PHRS) ↔ ERC-20 and ERC-20 ↔ ERC-20 swaps. " +
        "Automatically handles token approval, slippage, and deadline. " +
        "Always call gas_estimator before this skill to verify affordability.",
      inputSchema: {
        type: "object",
        required: ["privateKey", "tokenIn", "tokenOut", "amountIn"],
        properties: {
          privateKey: {
            type: "string",
            description: "Wallet private key for signing. Never logged or stored.",
          },
          tokenIn: {
            type: "string",
            description: "Token to sell. Use 'NATIVE' for PHRS.",
          },
          tokenOut: {
            type: "string",
            description: "Token to buy. Use 'NATIVE' for PHRS.",
          },
          amountIn: {
            type: "string",
            description: "Human-readable amount to sell, e.g. '1.5'",
          },
          slippagePct: {
            type: "number",
            default: 0.5,
            description: "Max slippage %. Default 0.5.",
          },
          routerAddress: {
            type: "string",
            description: "DEX router address. Defaults to PharosSwap.",
          },
          deadlineSeconds: {
            type: "number",
            default: 300,
            description: "Tx deadline offset in seconds.",
          },
          network: {
            type: "string",
            enum: ["testnet", "mainnet"],
            default: "testnet",
          },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          txHash: { type: "string" },
          tokenInSymbol: { type: "string" },
          tokenOutSymbol: { type: "string" },
          amountIn: { type: "string" },
          amountOutMin: { type: "string" },
          slippagePct: { type: "number" },
          gasUsed: { type: "string" },
          gasCostPHRS: { type: "string" },
          blockNumber: { type: "number" },
          explorerUrl: { type: "string" },
        },
      },
    },
  ],
  chain: {
    testnet: { chainId: 688688, name: "Pharos Testnet" },
    mainnet: { chainId: 1672, name: "Pharos Mainnet" },
  },
};
