// Step 6: the demo agent runs three real on-chain tasks with the session key.
// One should succeed; the other two must be stopped by the policy.
import { useState } from "react";
import type { Session } from "@altananetwork/sdk";
import { formatEther, parseEther } from "viem";
import type { Address } from "viem";
import { DEMO_RECIPIENT, friendlyError, getClient } from "../lib/altana";
import type { Policy, TaskKind, TxRecord } from "../lib/storage";
import { Button, Card, ErrorBox, InfoBox, Spinner, StatusPill, TxLink } from "./ui";

type TaskStatus = "idle" | "running" | "done";

interface TaskResult {
  status: TaskStatus;
  /** What the run showed: "success" (confirmed), "blocked" (policy stopped
   *  it, expected for tasks 2 and 3), or "failed" (something went wrong). */
  outcome?: "success" | "blocked" | "failed";
  txHash?: string;
  detail?: string;
}

const TASK_DEFS: {
  kind: TaskKind;
  title: string;
  description: string;
  expect: "success" | "blocked";
}[] = [
  {
    kind: "transfer-in-cap",
    title: "Task 1: Send 0.001 CELO to the demo recipient",
    description:
      "A normal transfer inside the rules: the recipient is on the allowlist and the amount is under the daily cap. This should succeed.",
    expect: "success",
  },
  {
    kind: "transfer-over-cap",
    title: "Task 2: Send more than the daily cap",
    description:
      "The agent tries to send the full daily cap plus 0.01 CELO in one go. The cap must stop it, and the transfer must not happen.",
    expect: "blocked",
  },
  {
    kind: "blocked-target",
    title: "Task 3: Send to an address that is not allowed",
    description:
      "The agent tries to send 0.001 CELO to the wallet itself, which is not on the allowlist. The allowlist must stop it.",
    expect: "blocked",
  },
];

export function AgentTasks({
  session,
  policy,
  walletAddress,
  revoked,
  onTaskResult,
  onContinue,
}: {
  session: Session | null;
  policy: Policy;
  walletAddress: Address;
  revoked: boolean;
  onTaskResult: (record: TxRecord) => void;
  onContinue: () => void;
}) {
  const [results, setResults] = useState<Record<TaskKind, TaskResult>>({
    "transfer-in-cap": { status: "idle" },
    "transfer-over-cap": { status: "idle" },
    "blocked-target": { status: "idle" },
  });
  const [runningAll, setRunningAll] = useState(false);
  const [error, setError] = useState("");

  const overCapAmount = parseEther(policy.capCelo) + parseEther("0.01");

  const runTask = async (kind: TaskKind): Promise<void> => {
    if (!session || revoked) return;
    setError("");
    setResults((r) => ({ ...r, [kind]: { status: "running" } }));

    const def = TASK_DEFS.find((d) => d.kind === kind)!;
    const calls =
      kind === "transfer-in-cap"
        ? { to: DEMO_RECIPIENT, value: parseEther("0.001") }
        : kind === "transfer-over-cap"
          ? { to: DEMO_RECIPIENT, value: overCapAmount }
          : { to: walletAddress, value: parseEther("0.001") };

    let result: TaskResult;
    try {
      // Note: execute RETURNS status FAILED on a policy rejection; it does
      // not throw. An unfunded wallet is the case where it DOES throw.
      const res = await getClient().execute({ session, calls });
      if (res.status === "CONFIRMED") {
        result = {
          status: "done",
          outcome: def.expect === "success" ? "success" : "failed",
          txHash: res.transactionHash,
          detail:
            def.expect === "success"
              ? "Confirmed on chain."
              : "Unexpected: this call should have been blocked by the policy, but it confirmed. Please report this.",
        };
      } else if (res.status === "FAILED") {
        const code = res.statusCode
          ? ` (relay status ${res.statusCode})`
          : "";
        result = {
          status: "done",
          outcome: def.expect === "blocked" ? "blocked" : "failed",
          txHash: res.transactionHash,
          detail:
            def.expect === "blocked"
              ? `Blocked by the policy, as expected${code}. No funds moved.`
              : `The call failed${code}. The wallet may be out of test CELO, or the relay rejected the bundle.`,
        };
      } else {
        result = {
          status: "done",
          outcome: "failed",
          txHash: res.transactionHash,
          detail:
            "The relay accepted the call but it is still pending. Check the explorer link in a minute.",
        };
      }
    } catch (err) {
      const message = friendlyError(err);
      result = {
        status: "done",
        outcome: def.expect === "blocked" ? "blocked" : "failed",
        detail:
          def.expect === "blocked"
            ? `Rejected before inclusion, as expected. ${message}`
            : message,
      };
    }

    setResults((r) => ({ ...r, [kind]: result }));
    onTaskResult({
      id: `${kind}-${Date.now()}`,
      kind,
      label: def.title,
      outcome: result.outcome ?? "failed",
      txHash: result.txHash as `0x${string}` | undefined,
      detail: result.detail ?? "",
      at: Date.now(),
    });
  };

  const runAll = async () => {
    setRunningAll(true);
    for (const def of TASK_DEFS) {
      await runTask(def.kind);
    }
    setRunningAll(false);
  };

  const anyRunning =
    runningAll || Object.values(results).some((r) => r.status === "running");

  if (!session) {
    return (
      <Card testId="agent-tasks">
        <h2>Agent tasks</h2>
        <InfoBox>
          No session key has been granted yet. Go back to the Grant step and
          grant a session first.
        </InfoBox>
      </Card>
    );
  }

  return (
    <Card testId="agent-tasks">
      <h2>Agent tasks</h2>
      <p>
        The demo agent runs in this browser with the session key you granted.
        Each task is a real on-chain call. Watch the policy do its job: the
        first task should go through, the next two must be stopped.
      </p>

      {revoked ? (
        <InfoBox>
          The session has been revoked, so the agent tasks are disabled. Grant
          a fresh session key to run them again.
        </InfoBox>
      ) : null}

      <div className="actions">
        <Button
          onClick={runAll}
          disabled={anyRunning || revoked}
          testId="run-all-tasks"
        >
          {runningAll ? <Spinner label="Running tasks..." /> : "Run all three tasks"}
        </Button>
      </div>

      <div className="task-list">
        {TASK_DEFS.map((def) => {
          const result = results[def.kind];
          const amount =
            def.kind === "transfer-over-cap"
              ? `${formatEther(overCapAmount)} CELO`
              : "0.001 CELO";
          return (
            <div
              className="task-card"
              key={def.kind}
              data-testid={`task-${def.kind}`}
            >
              <h3>{def.title}</h3>
              <p>{def.description}</p>
              <p className="field-hint">Amount: {amount}</p>
              <div className="task-actions">
                <Button
                  variant="secondary"
                  onClick={() => runTask(def.kind)}
                  disabled={anyRunning || revoked}
                  testId={`run-task-${def.kind}`}
                >
                  {result.status === "running" ? (
                    <Spinner label="Running..." />
                  ) : (
                    "Run this task"
                  )}
                </Button>
                {result.status === "done" && result.outcome ? (
                  <StatusPill
                    tone={
                      result.outcome === "success"
                        ? "ok"
                        : result.outcome === "blocked"
                          ? "info"
                          : "bad"
                    }
                    testId={`task-outcome-${def.kind}`}
                  >
                    {result.outcome === "success"
                      ? "Confirmed"
                      : result.outcome === "blocked"
                        ? "Blocked by policy"
                        : "Failed"}
                  </StatusPill>
                ) : null}
              </div>
              {result.status === "done" ? (
                <div className="task-result">
                  <p>{result.detail}</p>
                  {result.txHash ? (
                    <p>
                      Transaction: <TxLink hash={result.txHash} />
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <ErrorBox message={error} /> : null}

      <div className="actions">
        <Button onClick={onContinue} testId="tasks-continue">
          Continue to the dashboard
        </Button>
      </div>
    </Card>
  );
}
