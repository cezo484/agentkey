// Step 2: create the wallet. Two modes: passkey (real users) or demo key
// (ephemeral key generated in the browser, testnet only).
import { useState } from "react";
import {
  signerFromPrivateKey,
  type Signer,
} from "@altananetwork/sdk";
import { generatePrivateKey } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  friendlyError,
  getClient,
  withRetry,
} from "../lib/altana";
import { AddressLine, Button, Card, ErrorBox, InfoBox, Spinner } from "./ui";

export interface WalletCreated {
  mode: "demo" | "passkey";
  walletAddress: Address;
  /** Demo mode only: the ephemeral testnet admin key. */
  adminKey: Hex | null;
  adminSigner: Signer;
}

export function CreateWallet({
  existingAddress,
  existingMode,
  adminConnected,
  onCreated,
  onContinue,
  onReset,
}: {
  existingAddress: Address | null;
  existingMode: "demo" | "passkey" | null;
  adminConnected: boolean;
  onCreated: (result: WalletCreated) => void;
  onContinue: () => void;
  onReset: () => void;
}) {
  const [busy, setBusy] = useState<"demo" | "passkey" | "recover" | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const createDemo = async () => {
    setError("");
    setBusy("demo");
    setStatus("Generating a demo key in your browser...");
    try {
      const adminKey = generatePrivateKey();
      const admin = signerFromPrivateKey(adminKey);
      setStatus("Registering the wallet with the Altana relay...");
      const wallet = await withRetry(
        "createWallet",
        () => getClient().createWallet({ signer: admin }),
        (attempt, total) =>
          setStatus(`The relay is slow, retrying (${attempt} of ${total})...`),
      );
      onCreated({
        mode: "demo",
        walletAddress: wallet.address,
        adminKey,
        adminSigner: admin,
      });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
      setStatus("");
    }
  };

  const createPasskey = async () => {
    setError("");
    setBusy("passkey");
    setStatus("Waiting for your device to create a passkey...");
    try {
      const rpId = window.location.hostname;
      const wallet = await withRetry(
        "createPasskeyWallet",
        () =>
          getClient().createPasskeyWallet({ name: "AgentKey", rpId }),
        (attempt, total) =>
          setStatus(`The relay is slow, retrying (${attempt} of ${total})...`),
      );
      onCreated({
        mode: "passkey",
        walletAddress: wallet.address,
        adminKey: null,
        adminSigner: wallet.signer,
      });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
      setStatus("");
    }
  };

  const recoverPasskey = async () => {
    setError("");
    setBusy("recover");
    setStatus("Waiting for your device to confirm your passkey...");
    try {
      const rpId = window.location.hostname;
      const wallet = await withRetry(
        "recoverFromPasskey",
        () => getClient().recoverFromPasskey({ rpId }),
        (attempt, total) =>
          setStatus(`The relay is slow, retrying (${attempt} of ${total})...`),
      );
      onCreated({
        mode: "passkey",
        walletAddress: wallet.address,
        adminKey: null,
        adminSigner: wallet.signer,
      });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
      setStatus("");
    }
  };

  if (existingAddress) {
    const needsReconnect = existingMode === "passkey" && !adminConnected;
    return (
      <Card testId="create-wallet">
        <h2>Your wallet is ready</h2>
        <p>
          This wallet is already created on Celo Sepolia. Continue to fund it,
          or start over with a fresh wallet.
        </p>
        <AddressLine address={existingAddress} label="Wallet address" />
        {needsReconnect ? (
          <InfoBox>
            This is a passkey wallet, so your admin key is not stored in the
            browser. Reconnect your passkey to grant sessions or revoke them.
            The agent tasks keep working with the session key.
          </InfoBox>
        ) : null}
        <div className="actions">
          {needsReconnect ? (
            <Button
              onClick={recoverPasskey}
              disabled={busy !== null}
              testId="reconnect-passkey"
            >
              {busy === "recover" ? (
                <Spinner label="Recovering..." />
              ) : (
                "Reconnect passkey"
              )}
            </Button>
          ) : null}
          <Button onClick={onContinue} testId="continue-button">
            Continue to funding
          </Button>
          <Button variant="secondary" onClick={onReset} testId="reset-button">
            Start over with a new wallet
          </Button>
        </div>
        {status ? <InfoBox>{status}</InfoBox> : null}
        {error ? <ErrorBox message={error} /> : null}
      </Card>
    );
  }

  return (
    <Card testId="create-wallet">
      <h2>Create your agent wallet</h2>
      <p>
        The wallet is a smart account on Celo Sepolia. It starts out
        counterfactual: nothing exists on chain until the first funded action,
        so creating it is free.
      </p>

      <div className="mode-grid">
        <div className="mode-card">
          <h3>Demo wallet</h3>
          <p>
            A throwaway key is generated in your browser and kept in this
            browser only. Best for the walkthrough and the recorded demo.
          </p>
          <p className="warning-text">
            Testnet only. Never use a demo key with real funds.
          </p>
          <Button
            onClick={createDemo}
            disabled={busy !== null}
            testId="create-demo-wallet"
          >
            {busy === "demo" ? (
              <Spinner label="Creating..." />
            ) : (
              "Create demo wallet"
            )}
          </Button>
        </div>

        <div className="mode-card">
          <h3>Passkey wallet</h3>
          <p>
            Your device creates a passkey (Face ID, fingerprint, or security
            key). Nothing is stored in the browser, and each admin action asks
            for your biometric approval.
          </p>
          <p className="warning-text">
            Needs HTTPS (or localhost) and a browser with passkey support.
          </p>
          <Button
            onClick={createPasskey}
            disabled={busy !== null}
            testId="create-passkey-wallet"
          >
            {busy === "passkey" ? (
              <Spinner label="Waiting for passkey..." />
            ) : (
              "Create passkey wallet"
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={recoverPasskey}
            disabled={busy !== null}
            testId="recover-passkey-wallet"
          >
            {busy === "recover" ? (
              <Spinner label="Recovering..." />
            ) : (
              "I already have a passkey wallet"
            )}
          </Button>
        </div>
      </div>

      {status ? <InfoBox>{status}</InfoBox> : null}
      {error ? <ErrorBox message={error} /> : null}
    </Card>
  );
}
