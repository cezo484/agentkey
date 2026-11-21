// Step 5: grant the session key to the demo agent.
import { useEffect, useState } from "react";
import {
  agentPageUrl,
  signerFromPrivateKey,
  type AgentIdentityOutcome,
  type Session,
  type Signer,
} from "@altananetwork/sdk";
import { generatePrivateKey } from "viem/accounts";
import { parseEther } from "viem";
import type { Address, Hex } from "viem";
import {
  CHAIN_ID,
  friendlyError,
  getClient,
  keystoreUrl,
  readSessionValid,
  shortenAddress,
  withRetry,
} from "../lib/altana";
import type {
  AgentIdentityInfo,
  Policy,
  SessionMeta,
} from "../lib/storage";
import {
  Button,
  Card,
  ErrorBox,
  InfoBox,
  Spinner,
  StatusPill,
  TxLink,
} from "./ui";

export interface GrantedSession {
  session: Session;
  sessionKey: Hex;
  meta: SessionMeta;
  agentIdentity: AgentIdentityInfo | null;
}

export function GrantSession({
  walletAddress,
  adminSigner,
  policy,
  existingMeta,
  existingIdentity,
  onGranted,
  onContinue,
  onNeedAdmin,
}: {
  walletAddress: Address;
  adminSigner: Signer | null;
  policy: Policy;
  existingMeta: SessionMeta | null;
  existingIdentity: AgentIdentityInfo | null;
  onGranted: (result: GrantedSession) => void;
  onContinue: () => void;
  /** Passkey mode after a reload: recover the admin signer first. */
  onNeedAdmin: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [keystoreValid, setKeystoreValid] = useState<boolean | null>(null);
  const [checkingKeystore, setCheckingKeystore] = useState(false);

  const checkKeystore = async (keyId: Hex) => {
    setCheckingKeystore(true);
    try {
      // The Keystore write can land a moment after the grant returns.
      for (let i = 0; i < 5; i++) {
        const valid = await readSessionValid(walletAddress, keyId);
        if (valid) {
          setKeystoreValid(true);
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      setKeystoreValid(false);
    } catch {
      setKeystoreValid(null);
    } finally {
      setCheckingKeystore(false);
    }
  };

  useEffect(() => {
    if (existingMeta) {
      checkKeystore(existingMeta.keyId);
    }
    // Only on mount / when the granted session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingMeta?.keyId]);

  const grant = async () => {
    if (!adminSigner) {
      onNeedAdmin();
      return;
    }
    setError("");
    setBusy(true);
    setStatus("Generating a fresh session key for the agent...");
    try {
      const sessionKey = generatePrivateKey();
      const sessionSigner = signerFromPrivateKey(sessionKey);
      const expiry =
        Math.floor(Date.now() / 1000) + policy.expiryHours * 3600;
      setStatus(
        "Granting the session key on chain. This writes the key and its rules to the Keystore...",
      );
      const result = await withRetry(
        "grantSession",
        () =>
          getClient().grantSession({
            wallet: { address: walletAddress },
            signer: adminSigner,
            sessionSigner,
            permissions: {
              calls: policy.allowed.map((to) => ({ to })),
              spend: [
                {
                  limit: parseEther(policy.capCelo),
                  period: "day",
                },
              ],
            },
            expiry,
          }),
        (attempt, total) =>
          setStatus(`The relay is slow, retrying (${attempt} of ${total})...`),
      );

      if (result.status !== "granted") {
        throw new Error(
          "The grant did not complete. The relay returned status: " +
            result.status,
        );
      }

      // The session is persisted by the app via serializeSession (never
      // JSON.stringify a Session); the session key stays in localStorage only.

      let identity: AgentIdentityInfo | null = null;
      const registered = (result.agentIdentities ?? []).find(
        (o: AgentIdentityOutcome): o is Extract<AgentIdentityOutcome, { status: "registered" }> =>
          o.status === "registered",
      );
      if (registered) {
        identity = {
          agentId: registered.agentId,
          chainId: registered.chainId,
          transactionHash: registered.transactionHash,
        };
      }

      const meta: SessionMeta = {
        keyId: result.keyId,
        keyHash: result.keyHash,
        transactionHash: result.transactionHash,
        expiry: result.expiry,
        status: result.status,
      };
      onGranted({ session: result, sessionKey, meta, agentIdentity: identity });
      checkKeystore(result.keyId);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const agentPage =
    existingIdentity != null
      ? agentPageUrl(CHAIN_ID, existingIdentity.agentId)
      : undefined;

  return (
    <Card testId="grant-step">
      <h2>Grant the session key</h2>
      <p>
        This hands the demo agent its own key, limited by the policy you set.
        The key and its rules are written to Altana&apos;s public on-chain
        Keystore. The agent never sees your admin key.
      </p>

      <div className="policy-summary" data-testid="grant-policy-summary">
        <div>
          <span className="field-label">Daily spend cap</span>
          <strong>{policy.capCelo} CELO</strong>
        </div>
        <div>
          <span className="field-label">Allowed addresses</span>
          <strong>{policy.allowed.length}</strong>
        </div>
        <div>
          <span className="field-label">Expires in</span>
          <strong>
            {policy.expiryHours}{" "}
            {policy.expiryHours === 1 ? "hour" : "hours"}
          </strong>
        </div>
      </div>

      {existingMeta ? (
        <div className="result-block" data-testid="grant-result">
          <StatusPill tone="ok" testId="session-granted-pill">
            Session granted
          </StatusPill>
          <dl className="kv">
            <div>
              <dt>Session key id</dt>
              <dd className="mono">{shortenAddress(existingMeta.keyId, 10)}</dd>
            </div>
            <div>
              <dt>Grant transaction</dt>
              <dd>
                {existingMeta.transactionHash ? (
                  <TxLink hash={existingMeta.transactionHash} />
                ) : (
                  "Not reported by the relay"
                )}
              </dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>
                {new Date(existingMeta.expiry * 1000).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt>Keystore status</dt>
              <dd>
                {checkingKeystore ? (
                  <Spinner label="Reading the Keystore..." />
                ) : keystoreValid === true ? (
                  <StatusPill tone="ok">Valid in the Keystore</StatusPill>
                ) : keystoreValid === false ? (
                  <StatusPill tone="warn">
                    Not visible in the Keystore yet
                  </StatusPill>
                ) : (
                  <span>Unknown</span>
                )}{" "}
                <a
                  className="link"
                  href={keystoreUrl(walletAddress)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Keystore explorer
                </a>
              </dd>
            </div>
            {existingIdentity ? (
              <div>
                <dt>ERC-8004 agent identity</dt>
                <dd>
                  Agent #{existingIdentity.agentId} on Celo Sepolia.{" "}
                  {agentPage ? (
                    <a
                      className="link"
                      href={agentPage}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="agent-page-link"
                    >
                      View the agent page on 8004scan
                    </a>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="actions">
            <Button onClick={onContinue} testId="grant-continue">
              Continue to the agent tasks
            </Button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <Button
            onClick={grant}
            disabled={busy}
            testId="grant-session-button"
          >
            {busy ? <Spinner label="Granting..." /> : "Grant session key"}
          </Button>
        </div>
      )}

      {status ? <InfoBox>{status}</InfoBox> : null}
      {error ? <ErrorBox message={error} /> : null}
    </Card>
  );
}
