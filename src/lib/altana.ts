// Altana client, chain constants, retry logic and Keystore reads for AgentKey.
// Network: Celo Sepolia only (chainId 11142220). Testnet only.

import {
  CELO_SEPOLIA,
  createClient,
  type Client,
} from "@altananetwork/sdk";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { celoSepolia } from "viem/chains";

export const CHAIN_ID = 11142220;
export const CHAIN_NAME = "Celo Sepolia";
export const EXPLORER = "https://sepolia.celoscan.io";
export const FAUCET_URL = "https://faucet.celo.org/celo-sepolia";
export const KEYSTORE_ADDRESS: Address =
  "0xCC3df52B6aD826781AAD86EcEB1459ed0b1Ae3F6";
export const ALTANA_TESTNET_EXPLORER = "https://testnet.altana.network";

// Demo recipient for the agent's transfer task. A throwaway testnet address
// used only as a transfer target; it holds no funds and no key is stored.
export const DEMO_RECIPIENT: Address =
  "0xaa6A5B2704aC6A92efeEA262326e2ED3CA5E3640";

// Rough budget for the full demo flow (activation + grant + tasks + revoke).
export const MIN_BALANCE_CELO = "0.6";

// The Altana client. agentIdentity stays ON (the default) so each new wallet
// gets a free ERC-8004 agent identity after its first on-chain action. The
// record is customized for AgentKey; passing a record keeps it enabled.
let cachedClient: Client | null = null;

export function getClient(): Client {
  if (!cachedClient) {
    cachedClient = createClient({
      chains: [CELO_SEPOLIA],
      agentIdentity: {
        name: "AgentKey Agent",
        description:
          "A smart agentic wallet on Celo Sepolia. Its keys and permissions are public in the Altana KeyStore.",
      },
    });
  }
  return cachedClient;
}

export const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: http(CELO_SEPOLIA.publicRpcUrl),
});

const KEYSTORE_ABI = [
  {
    name: "isValidKey",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "keyId", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "getKeys",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "bytes32[]" }],
  },
] as const;

/** Read the Keystore: is this session key still valid (exists, not revoked, not expired)? */
export async function readSessionValid(
  walletAddress: Address,
  keyId: Hex,
): Promise<boolean> {
  return publicClient.readContract({
    address: KEYSTORE_ADDRESS,
    abi: KEYSTORE_ABI,
    functionName: "isValidKey",
    args: [walletAddress, keyId],
  });
}

/** Read the Keystore: all registered, not-revoked keys for a wallet. */
export async function readWalletKeys(
  walletAddress: Address,
): Promise<readonly Hex[]> {
  return publicClient.readContract({
    address: KEYSTORE_ADDRESS,
    abi: KEYSTORE_ABI,
    functionName: "getKeys",
    args: [walletAddress],
  });
}

// ---------------------------------------------------------------------------
// Retry logic. The Altana testnet relay can time out for minutes on a first
// call, then answer in seconds on retry. Retry transient failures up to 3
// times with backoff. Funding shortfalls fail fast: retrying cannot fix them.
// ---------------------------------------------------------------------------

const NON_RETRYABLE = [
  "not enough",
  "insufficient",
  "fund",
  "balance",
  "invalid address",
  "invalid private key",
  "rejected",
  "denied",
];

export function isRetryableError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (NON_RETRYABLE.some((needle) => msg.includes(needle))) return false;
  return true;
}

export type RetryStatus = (attempt: number, total: number) => void;

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  onRetry?: RetryStatus,
  maxAttempts = 3,
): Promise<T> {
  const delaysMs = [3000, 8000, 15000];
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !isRetryableError(err)) {
        throw err;
      }
      onRetry?.(attempt + 1, maxAttempts);
      const delay = delaysMs[Math.min(attempt - 1, delaysMs.length - 1)];
      console.warn(
        `[AgentKey] ${label} attempt ${attempt} failed, retrying in ${delay}ms`,
        err,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Plain-English error messages. SDK errors are technical; the UI shows these.
// ---------------------------------------------------------------------------

export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("not enough")) {
    const match = raw.match(/needs about ([0-9.]+).*you have ([0-9.]+)/i);
    if (match) {
      return `Your wallet does not have enough test CELO. This step needs about ${match[1]} CELO and the wallet has ${match[2]} CELO. Use the faucet link on the Fund step to top it up, then try again.`;
    }
    return "Your wallet does not have enough test CELO for this step. Use the faucet link on the Fund step to top it up, then try again.";
  }
  if (lower.includes("insufficient funds") || lower.includes("insufficient balance")) {
    return "Your wallet does not have enough test CELO for this step. Use the faucet link on the Fund step to top it up, then try again.";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("network")) {
    return "The Altana testnet relay did not answer in time. This happens on testnet; please try again in a moment.";
  }
  if (lower.includes("not allowed") || lower.includes("user cancelled") || lower.includes("notallowederror")) {
    return "The passkey prompt was dismissed. Please try again and approve the prompt on your device.";
  }
  if (lower.includes("secure context") || lower.includes("webauthn")) {
    return "Passkeys need a secure page (HTTPS or localhost) and a browser with biometric support. Please use the demo wallet mode instead, or open this page over HTTPS.";
  }
  if (lower.includes("fetch failed") || lower.includes("failed to fetch")) {
    return "Could not reach the Altana relay or the Celo RPC. Please check your connection and try again.";
  }
  // Fall back to the raw message, trimmed, so nothing is ever hidden.
  return raw.length > 400 ? `${raw.slice(0, 400)}...` : raw;
}

// ---------------------------------------------------------------------------
// Small formatting helpers
// ---------------------------------------------------------------------------

export function shortenAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

export function keystoreUrl(walletAddress: string): string {
  return `${ALTANA_TESTNET_EXPLORER}/wallet/${walletAddress}`;
}
