// Step 7: dashboard. Live balance, policy, session status, history, revoke.
import { useCallback, useEffect, useState } from "react";
import { agentPageUrl, type Session, type Signer } from "@altananetwork/sdk";
import { formatEther } from "viem";
import type { Address } from "viem";
import {
  CHAIN_ID,
  friendlyError,
  getClient,
  keystoreUrl,
  readSessionValid,
  withRetry,
} from "../lib/altana";
import type { AppState, TxRecord } from "../lib/storage";
import {
  AddressLine,
  Button,
  Card,
  ErrorBox,
  InfoBox,
  Spinner,
  StatusPill,
  TxLink,
} from "./ui";

export function Dashboard({
  state,
  session,
  adminSigner,
  onRevoked,
  onNeedAdmin,
  onReset,
  onRegisterIdentity,
}: {
  state: AppState;
  session: Session | null;
  adminSigner: Signer | null;
  onRevoked: (txHash?: `0x${string}`) => void;
  onNeedAdmin: () => void;
  onReset: () => void;
  onRegisterIdentity: () => Promise<void>;
}) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [checkingSession, setCheckingSession] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const walletAddress = state.walletAddress as Address;
  const meta = state.sessionMeta;

  const refreshBalance = useCallback(async () => {
    setLoadingBalance(true);
    try {
      const result = await withRetry("balances", () =>
        getClient().balances({ wallet: walletAddress }),
      );
      setBalance(formatEther(result.native));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoadingBalance(false);
    }
  }, [walletAddress]);

  const checkSession = useCallback(async () => {
    if (!meta) return;
    setCheckingSession(true);
    try {
      const valid = await readSessionValid(walletAddress, meta.keyId);
      setSessionValid(valid);
    } catch {
      setSessionValid(null);
    } finally {
      setCheckingSession(false);
    }
  }, [walletAddress, meta]);

  useEffect(() => {
    refreshBalance();
    checkSession();
  }, [refreshBalance, checkSession]);

  const revoke = async () => {
    if (!session) return;
    if (!adminSigner) {
      onNeedAdmin();
      return;
    }
    setError("");
    setRevoking(true);
    try {
      const result = await withRetry(
        "revokeSession",
        () =>
          getClient().revokeSession({
            wallet: { address: walletAddress },
            signer: adminSigner,
            session,
          }),
        undefined,
        2,
      );
      if (result.status !== "revoked") {
        throw new Error(
          "The revoke did not complete. The relay returned status: " +
            result.status,
        );
      }
      onRevoked(result.transactionHash);
      setSessionValid(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRevoking(false);
    }
  };

  const registerIdentity = async () => {
    setError("");
    setInfo("");
    setRegistering(true);
    try {
      await onRegisterIdentity();
      setInfo("Agent identity registration was requested. It appears here once confirmed.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRegistering(false);
    }
  };

  const expired = meta ? Date.now() / 1000 > meta.expiry : false;
  const agentPage = state.agentIdentity
    ? agentPageUrl(CHAIN_ID, state.agentIdentity.agentId)
    : undefined;

  return (
    <div className="dashboard">
      <Card testId="dashboard">
        <h2>Dashboard</h2>
        <AddressLine address={walletAddress} label="Wallet" />

        <div className="dash-grid">
          <div className="dash-tile">
            <span className="field-label">Balance</span>
            <p className="balance-big" data-testid="dashboard-balance">
              {loadingBalance && balance === null ? (
                <Spinner label="Checking..." />
              ) : balance === null ? (
                "Unknown"
              ) : (
                `${balance} CELO`
              )}
            </p>
            <Button
              variant="ghost"
              onClick={refreshBalance}
              disabled={loadingBalance}
              testId="dashboard-refresh-balance"
            >
              Refresh
            </Button>
          </div>

          <div className="dash-tile">
            <span className="field-label">Session status</span>
            <p>
              {!meta ? (
                <StatusPill tone="neutral" testId="session-status">
                  No session granted
                </StatusPill>
              ) : state.revoked ? (
                <StatusPill tone="bad" testId="session-status">
                  Revoked
                </StatusPill>
              ) : expired ? (
                <StatusPill tone="warn" testId="session-status">
                  Expired
                </StatusPill>
              ) : checkingSession ? (
                <Spinner label="Checking the Keystore..." />
              ) : sessionValid === true ? (
                <StatusPill tone="ok" testId="session-status">
                  Valid
                </StatusPill>
              ) : sessionValid === false ? (
                <StatusPill tone="warn" testId="session-status">
                  Not valid in the Keystore
                </StatusPill>
              ) : (
                <StatusPill tone="neutral" testId="session-status">
                  Unknown
                </StatusPill>
              )}
            </p>
            {meta ? (
              <p className="field-hint">
                Expires {new Date(meta.expiry * 1000).toLocaleString()}
              </p>
            ) : null}
            <p>
              <a
                className="link"
                href={keystoreUrl(walletAddress)}
                target="_blank"
                rel="noreferrer"
              >
                View keys in the Keystore explorer
              </a>
            </p>
          </div>

          <div className="dash-tile">
            <span className="field-label">Active policy</span>
            {state.policy ? (
              <ul className="policy-list">
                <li>Daily cap: {state.policy.capCelo} CELO</li>
                <li>
                  Allowed addresses: {state.policy.allowed.length}
                </li>
                <li>Expiry: {state.policy.expiryHours} hours</li>
              </ul>
            ) : (
              <p className="field-hint">No policy set yet.</p>
            )}
          </div>

          <div className="dash-tile">
            <span className="field-label">ERC-8004 agent identity</span>
            {state.agentIdentity ? (
              <p>
                Agent #{state.agentIdentity.agentId} on Celo Sepolia.{" "}
                {agentPage ? (
                  <a
                    className="link"
                    href={agentPage}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="dashboard-agent-page-link"
                  >
                    View on 8004scan
                  </a>
                ) : null}
              </p>
            ) : (
              <p className="field-hint">
                The wallet gets its agent identity automatically with its
                first on-chain action.
              </p>
            )}
            {!state.agentIdentity && state.mode === "passkey" && meta ? (
              <Button
                variant="secondary"
                onClick={registerIdentity}
                disabled={registering}
                testId="register-identity"
              >
                {registering ? (
                  <Spinner label="Registering..." />
                ) : (
                  "Register agent identity"
                )}
              </Button>
            ) : null}
          </div>
        </div>

        {meta && !state.revoked ? (
          <div className="revoke-zone">
            <h3>Revoke the session</h3>
            <p>
              This takes the agent&apos;s key away immediately and permanently.
              A revoked key can never be used again; to run the agent again,
              grant a fresh session key.
            </p>
            <Button
              variant="danger"
              onClick={revoke}
              disabled={revoking}
              testId="revoke-button"
            >
              {revoking ? <Spinner label="Revoking..." /> : "Revoke session"}
            </Button>
          </div>
        ) : null}

        {state.revoked ? (
          <div className="revoke-zone revoked-note" data-testid="revoked-note">
            <StatusPill tone="bad">Session revoked</StatusPill>
            <p>
              The agent&apos;s key is revoked and can no longer act on this
              wallet. The agent tasks are disabled.
            </p>
            {state.revokeTxHash ? (
              <p>
                Revoke transaction: <TxLink hash={state.revokeTxHash} />
              </p>
            ) : null}
          </div>
        ) : null}

        {!meta ? (
          <div className="revoke-zone">
            <h3>Revoke the session</h3>
            <p>
              No session has been granted yet, so there is nothing to revoke.
            </p>
            <Button variant="danger" disabled testId="revoke-button">
              Revoke session
            </Button>
          </div>
        ) : null}

        {info ? <InfoBox>{info}</InfoBox> : null}
        {error ? <ErrorBox message={error} /> : null}
      </Card>

      <Card testId="history-card">
        <h2>Transaction history</h2>
        <p className="field-hint">
          Actions from this visit, stored in your browser only.
        </p>
        {state.history.length === 0 ? (
          <p>No actions yet. Grant a session and run the agent tasks to see them here.</p>
        ) : (
          <ul className="history-list">
            {[...state.history].reverse().map((record: TxRecord) => (
              <li key={record.id} className="history-item">
                <div>
                  <strong>{record.label}</strong>
                  <p className="field-hint">{record.detail}</p>
                  <p className="field-hint">
                    {new Date(record.at).toLocaleString()}
                  </p>
                </div>
                <div className="history-right">
                  <StatusPill
                    tone={
                      record.outcome === "success"
                        ? "ok"
                        : record.outcome === "blocked"
                          ? "info"
                          : "bad"
                    }
                  >
                    {record.outcome === "success"
                      ? "Confirmed"
                      : record.outcome === "blocked"
                        ? "Blocked by policy"
                        : "Failed"}
                  </StatusPill>
                  {record.txHash ? <TxLink hash={record.txHash} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="actions">
          <Button variant="secondary" onClick={onReset} testId="dashboard-reset">
            Reset the demo
          </Button>
        </div>
      </Card>
    </div>
  );
}
