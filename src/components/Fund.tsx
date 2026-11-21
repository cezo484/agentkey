// Step 3: fund the wallet with test CELO from the faucet.
import { useCallback, useEffect, useState } from "react";
import { formatEther } from "viem";
import type { Address } from "viem";
import {
  FAUCET_URL,
  MIN_BALANCE_CELO,
  friendlyError,
  getClient,
  withRetry,
} from "../lib/altana";
import {
  AddressLine,
  Button,
  Card,
  ErrorBox,
  InfoBox,
  Spinner,
  StatusPill,
} from "./ui";

export function Fund({
  walletAddress,
  onContinue,
}: {
  walletAddress: Address;
  onContinue: () => void;
}) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const result = await withRetry("balances", () =>
        getClient().balances({ wallet: walletAddress }),
      );
      setBalance(formatEther(result.native));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const balanceNum = balance === null ? null : Number(balance);
  const funded =
    balanceNum !== null && balanceNum >= Number(MIN_BALANCE_CELO);

  return (
    <Card testId="fund-step">
      <h2>Fund the wallet</h2>
      <p>
        The wallet needs test CELO to pay for its first on-chain actions:
        registering its keys, granting the session, and running the agent
        tasks. About {MIN_BALANCE_CELO} CELO covers the full demo. Test CELO
        is free from the Celo faucet and has no real value.
      </p>

      <AddressLine address={walletAddress} label="Wallet address" />

      <div className="fund-row">
        <div>
          <span className="field-label">Current balance</span>
          <p className="balance-big" data-testid="balance-value">
            {loading && balance === null ? (
              <Spinner label="Checking balance..." />
            ) : balance === null ? (
              "Unknown"
            ) : (
              `${balance} CELO`
            )}
          </p>
        </div>
        {balanceNum !== null ? (
          funded ? (
            <StatusPill tone="ok" testId="funded-pill">
              Funded, ready for the demo
            </StatusPill>
          ) : (
            <StatusPill tone="warn" testId="unfunded-pill">
              Needs about {MIN_BALANCE_CELO} CELO
            </StatusPill>
          )
        ) : null}
      </div>

      <div className="actions">
        <a
          className="btn btn-primary"
          href={FAUCET_URL}
          target="_blank"
          rel="noreferrer"
          data-testid="faucet-link"
        >
          Open the Celo Sepolia faucet
        </a>
        <Button
          variant="secondary"
          onClick={refresh}
          disabled={loading}
          testId="refresh-balance"
        >
          {loading ? <Spinner label="Checking..." /> : "Check balance"}
        </Button>
      </div>

      <InfoBox>
        In the faucet, paste the wallet address above, complete the check, and
        submit. It sends 1 test CELO per request, and the demo needs about
        1.6 CELO, so request twice. Then come back here and press Check balance.
      </InfoBox>

      {error ? <ErrorBox message={error} /> : null}

      <div className="actions">
        <Button
          onClick={onContinue}
          disabled={!funded}
          testId="fund-continue"
        >
          Continue to set the policy
        </Button>
        {!funded ? (
          <span className="field-hint">
            Continue is available once the balance reaches {MIN_BALANCE_CELO}{" "}
            CELO. You can still set the policy first from the step list above.
          </span>
        ) : null}
      </div>
    </Card>
  );
}
