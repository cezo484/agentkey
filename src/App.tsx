// AgentKey: give your AI agent a wallet with rules you set.
// Single-page app: landing, create wallet, fund, set policy, grant session,
// agent tasks, dashboard. Celo Sepolia testnet only. No backend.
import { useCallback, useEffect, useState } from "react";
import {
  deserializeSession,
  serializeSession,
  signerFromPrivateKey,
  type Session,
  type Signer,
} from "@altananetwork/sdk";
import type { Hex } from "viem";
import { getClient, shortenAddress } from "./lib/altana";
import {
  clearState,
  emptyState,
  loadState,
  saveState,
  type AppState,
  type Policy,
  type TxRecord,
} from "./lib/storage";
import { AgentTasks } from "./components/AgentTasks";
import { CreateWallet, type WalletCreated } from "./components/CreateWallet";
import { Dashboard } from "./components/Dashboard";
import { Fund } from "./components/Fund";
import { GrantSession, type GrantedSession } from "./components/GrantSession";
import { Landing } from "./components/Landing";
import { PolicyForm } from "./components/PolicyForm";
import { Stepper } from "./components/Stepper";

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [adminSigner, setAdminSigner] = useState<Signer | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  // Rebuild in-memory signers from localStorage on load. Demo admin keys and
  // session keys are ephemeral testnet keys stored only in this browser.
  // Passkey wallets keep no key here; the user reconnects with biometrics.
  useEffect(() => {
    const initial = loadState();
    if (initial.mode === "demo" && initial.adminKey) {
      try {
        setAdminSigner(signerFromPrivateKey(initial.adminKey));
      } catch {
        setAdminSigner(null);
      }
    }
    if (initial.serializedSession && initial.sessionKey) {
      try {
        setSession(
          deserializeSession(
            initial.serializedSession,
            signerFromPrivateKey(initial.sessionKey),
          ),
        );
      } catch {
        setSession(null);
      }
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const goTo = useCallback(
    (step: number) => {
      setState((s) => ({ ...s, step }));
    },
    [],
  );

  const unlocked = useCallback(
    (step: number): boolean => {
      if (step <= 1) return true;
      if (!state.walletAddress) return false;
      if (step === 2 || step === 3 || step === 6) return true;
      if (step === 4) return state.policy !== null;
      if (step === 5) return state.sessionMeta !== null;
      return false;
    },
    [state.walletAddress, state.policy, state.sessionMeta],
  );

  const addHistory = useCallback((record: TxRecord) => {
    setState((s) => ({ ...s, history: [...s.history, record] }));
  }, []);

  const handleWalletCreated = useCallback(
    (result: WalletCreated) => {
      setAdminSigner(result.adminSigner);
      update({
        mode: result.mode,
        walletAddress: result.walletAddress,
        adminKey: result.adminKey,
        step: 2,
      });
    },
    [update],
  );

  const handlePolicySaved = useCallback(
    (policy: Policy) => {
      update({ policy, step: 4 });
    },
    [update],
  );

  const handleGranted = useCallback(
    (result: GrantedSession) => {
      setSession(result.session);
      update({
        sessionKey: result.sessionKey,
        serializedSession: serializeSession(result.session),
        sessionMeta: result.meta,
        agentIdentity: result.agentIdentity ?? state.agentIdentity,
        revoked: false,
        revokeTxHash: null,
        step: 5,
      });
      addHistory({
        id: `grant-${Date.now()}`,
        kind: "grant",
        label: "Session key granted",
        outcome: "success",
        txHash: result.meta.transactionHash,
        detail: `Cap ${state.policy?.capCelo ?? "?"} CELO/day, ${state.policy?.allowed.length ?? 0} allowed addresses, expires ${new Date(result.meta.expiry * 1000).toLocaleString()}.`,
        at: Date.now(),
      });
      if (result.agentIdentity) {
        addHistory({
          id: `identity-${Date.now()}`,
          kind: "identity",
          label: `ERC-8004 agent identity registered (#${result.agentIdentity.agentId})`,
          outcome: "success",
          txHash: result.agentIdentity.transactionHash,
          detail: "The wallet now has a public agent identity on Celo Sepolia.",
          at: Date.now(),
        });
      }
    },
    [update, addHistory, state.agentIdentity, state.policy],
  );

  const handleRevoked = useCallback(
    (txHash?: Hex) => {
      update({ revoked: true, revokeTxHash: txHash ?? null });
      addHistory({
        id: `revoke-${Date.now()}`,
        kind: "revoke",
        label: "Session key revoked",
        outcome: "success",
        txHash,
        detail: "The agent key was revoked. It can never be used again.",
        at: Date.now(),
      });
    },
    [update, addHistory],
  );

  const handleRegisterIdentity = useCallback(async () => {
    if (!state.walletAddress) throw new Error("No wallet yet.");
    if (!adminSigner) {
      throw new Error(
        "Please reconnect your passkey on the Create wallet step first.",
      );
    }
    const outcome = await getClient().registerAgentIdentity({
      wallet: { address: state.walletAddress },
      signer: adminSigner,
    });
    if (outcome.status === "registered") {
      update({
        agentIdentity: {
          agentId: outcome.agentId,
          chainId: outcome.chainId,
          transactionHash: outcome.transactionHash,
        },
      });
      addHistory({
        id: `identity-${Date.now()}`,
        kind: "identity",
        label: `ERC-8004 agent identity registered (#${outcome.agentId})`,
        outcome: "success",
        txHash: outcome.transactionHash,
        detail: "The wallet now has a public agent identity on Celo Sepolia.",
        at: Date.now(),
      });
    } else if (outcome.status === "failed") {
      throw new Error(`Identity registration failed: ${outcome.reason}`);
    }
  }, [state.walletAddress, adminSigner, update, addHistory]);

  const handleReset = useCallback(() => {
    clearState();
    setAdminSigner(null);
    setSession(null);
    setState(emptyState());
  }, []);

  const needAdmin = useCallback(() => goTo(1), [goTo]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <span className="brand-name">AgentKey</span>
        </div>
        <div className="header-right">
          <span className="network-badge">Celo Sepolia testnet</span>
          {state.walletAddress ? (
            <span className="header-wallet mono" data-testid="header-wallet">
              {shortenAddress(state.walletAddress, 6)}
            </span>
          ) : null}
        </div>
      </header>

      <Stepper current={state.step} unlocked={unlocked} onGo={goTo} />

      <main className="app-main">
        {state.step === 0 && <Landing onStart={() => goTo(1)} />}

        {state.step === 1 && (
          <CreateWallet
            existingAddress={state.walletAddress}
            existingMode={state.mode}
            adminConnected={adminSigner !== null}
            onCreated={handleWalletCreated}
            onContinue={() => goTo(2)}
            onReset={handleReset}
          />
        )}

        {state.step === 2 && state.walletAddress && (
          <Fund walletAddress={state.walletAddress} onContinue={() => goTo(3)} />
        )}

        {state.step === 3 && (
          <PolicyForm initial={state.policy} onSave={handlePolicySaved} />
        )}

        {state.step === 4 && state.walletAddress && state.policy && (
          <GrantSession
            walletAddress={state.walletAddress}
            adminSigner={adminSigner}
            policy={state.policy}
            existingMeta={state.sessionMeta}
            existingIdentity={state.agentIdentity}
            onGranted={handleGranted}
            onContinue={() => goTo(5)}
            onNeedAdmin={needAdmin}
          />
        )}

        {state.step === 5 && state.walletAddress && state.policy && (
          <AgentTasks
            session={session}
            policy={state.policy}
            walletAddress={state.walletAddress}
            revoked={state.revoked}
            onTaskResult={addHistory}
            onContinue={() => goTo(6)}
          />
        )}

        {state.step === 6 && state.walletAddress && (
          <Dashboard
            state={state}
            session={session}
            adminSigner={adminSigner}
            onRevoked={handleRevoked}
            onNeedAdmin={needAdmin}
            onReset={handleReset}
            onRegisterIdentity={handleRegisterIdentity}
          />
        )}
      </main>

      <footer className="app-footer">
        <a href="https://docs.altana.network" target="_blank" rel="noreferrer">
          Altana docs
        </a>
        <a href="https://faucet.celo.org/celo-sepolia" target="_blank" rel="noreferrer">
          Celo Sepolia faucet
        </a>
        <a href="https://sepolia.celoscan.io" target="_blank" rel="noreferrer">
          Celoscan
        </a>
        <a href="https://testnet.altana.network" target="_blank" rel="noreferrer">
          Altana Keystore explorer
        </a>
        <span className="footer-note">
          Testnet demo. Demo keys live only in this browser.
        </span>
      </footer>
    </div>
  );
}
