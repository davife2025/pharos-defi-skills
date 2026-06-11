/**
 * Multicall3 ABI — deployed at 0xcA11bde05977b3631167028862bE2a173976CA11
 * on virtually every EVM chain including Pharos.
 *
 * Docs: https://github.com/mds1/multicall
 */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

export const MULTICALL3_ABI = [
  // Aggregate: legacy, reverts on any failure
  "function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)",

  // Aggregate3: preferred — per-call allowFailure flag
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)",

  // Aggregate3Value: like aggregate3 but with ETH value per call
  "function aggregate3Value(tuple(address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)",

  // Block info helpers
  "function getBlockNumber() view returns (uint256 blockNumber)",
  "function getBlockHash(uint256 blockNumber) view returns (bytes32 blockHash)",
  "function getCurrentBlockTimestamp() view returns (uint256 timestamp)",
  "function getEthBalance(address addr) view returns (uint256 balance)",
  "function getLastBlockHash() view returns (bytes32 blockHash)",
  "function getBasefee() view returns (uint256 basefee)",
  "function getChainId() view returns (uint256 chainid)",
] as const;

export interface Multicall3Call {
  target: string;
  allowFailure: boolean;
  callData: string;
}

export interface Multicall3Result {
  success: boolean;
  returnData: string;
}
