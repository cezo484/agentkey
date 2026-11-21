// Local persistence for AgentKey (testnet demo only).
//
// What is stored in localStorage:
// - demo admin key and session key: ephemeral testnet keys, generated in the
//   browser for the demo wallet. Never mainnet keys, never shared anywhere.
// - the serialized session (serializeSession output: JSON-safe, no secret).
// - the policy, the session metadata and the transaction history of this visit.
//
// Passkey wallets store no key at all: the credential lives in the device,
// and the wallet is recovered with recoverFromPasskey.

import type { SerializedSession } from "@altananetwork/sdk";
import type { Address, Hex } from "viem";

export type WalletMode = "demo" | "passkey";

export interface Policy {
  /** Daily spend cap in CELO, as typed by the user. */
  capCelo: string;
  /** Allowed contract/recipient addresses. */
  allowed: Address[];
  /** Session lifetime in hours. */
  expiryHours: number;
}

export interface SessionMeta {
  keyId: Hex;
  keyHash: Hex;
  transactionHash?: Hex;
  expiry: number;
  status: "granted" | "failed";
}

export interface AgentIdentityInfo {
  agentId: string;
  chainId: number;
  transactionHash?: Hex;
}

export type TaskKind = "transfer-in-cap" | "transfer-over-cap" | "blocked-target";

export interface TxRecord {
  id: string;
  kind: TaskKind | "grant" | "revoke" | "identity";
  label: string;
  /** "success" means the on-chain call confirmed; "blocked" means the policy
   *  correctly stopped it; "failed" means something went wrong. */
  outcome: "success" | "blocked" | "failed";
  txHash?: Hex;
  detail: string;
  at: number;
}

export interface AppState {
  version: 1;
  step: number;
  mode: WalletMode | null;
  walletAddress: Address | null;
  /** Demo mode only: ephemeral testnet admin key. */
  adminKey: Hex | null;
  /** Ephemeral testnet session key (both modes). */
  sessionKey: Hex | null;
  serializedSession: SerializedSession | null;
  sessionMeta: SessionMeta | null;
  policy: Policy | null;
  agentIdentity: AgentIdentityInfo | null;
  revoked: boolean;
  revokeTxHash: Hex | null;
  history: TxRecord[];
}

export const STORAGE_KEY = "agentkey:v1";

export const DEFAULT_POLICY: Policy = {
  capCelo: "0.05",
  allowed: [],
  expiryHours: 24,
};

export function emptyState(): AppState {
  return {
    version: 1,
    step: 0,
    mode: null,
    walletAddress: null,
    adminKey: null,
    sessionKey: null,
    serializedSession: null,
    sessionMeta: null,
    policy: null,
    agentIdentity: null,
    revoked: false,
    revokeTxHash: null,
    history: [],
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== 1) return emptyState();
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable: the app still works for this visit.
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
