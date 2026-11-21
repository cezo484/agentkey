// Step 4: set the policy for the session key.
import { useState } from "react";
import { getAddress, isAddress } from "viem";
import type { Address } from "viem";
import { DEMO_RECIPIENT } from "../lib/altana";
import type { Policy } from "../lib/storage";
import { Button, Card, Field, InfoBox } from "./ui";

const MIN_CAP = 0.01;
const MAX_CAP = 10;

export function PolicyForm({
  initial,
  onSave,
}: {
  initial: Policy | null;
  onSave: (policy: Policy) => void;
}) {
  const [cap, setCap] = useState(initial?.capCelo ?? "0.05");
  const [allowed, setAllowed] = useState<Address[]>(
    initial?.allowed?.length ? initial.allowed : [DEMO_RECIPIENT],
  );
  const [expiryHours, setExpiryHours] = useState(
    String(initial?.expiryHours ?? 24),
  );
  const [newAddress, setNewAddress] = useState("");
  const [errors, setErrors] = useState<{
    cap?: string;
    allowed?: string;
    expiry?: string;
    custom?: string;
  }>({});

  const capNum = Number(cap);
  const expiryNum = Number(expiryHours);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!cap.trim() || Number.isNaN(capNum)) {
      next.cap = "Enter a number, for example 0.05.";
    } else if (capNum < MIN_CAP) {
      next.cap = `The cap must be at least ${MIN_CAP} CELO so the demo tasks can run.`;
    } else if (capNum > MAX_CAP) {
      next.cap = `The cap must be at most ${MAX_CAP} CELO for this demo.`;
    }
    if (allowed.length === 0) {
      next.allowed = "Allow at least one address, or the agent cannot do anything.";
    }
    if (!expiryHours.trim() || Number.isNaN(expiryNum)) {
      next.expiry = "Enter a number of hours, for example 24.";
    } else if (expiryNum < 1 || expiryNum > 168) {
      next.expiry = "Expiry must be between 1 and 168 hours (one week).";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const addAddress = () => {
    const trimmed = newAddress.trim();
    if (!trimmed) return;
    if (!isAddress(trimmed)) {
      setErrors((e) => ({
        ...e,
        custom: "That does not look like a valid address (it should start with 0x and be 42 characters).",
      }));
      return;
    }
    const checksummed = getAddress(trimmed);
    if (allowed.includes(checksummed)) {
      setErrors((e) => ({ ...e, custom: "That address is already on the list." }));
      return;
    }
    setAllowed((list) => [...list, checksummed]);
    setNewAddress("");
    setErrors((e) => ({ ...e, custom: undefined, allowed: undefined }));
  };

  const removeAddress = (address: Address) => {
    setAllowed((list) => list.filter((a) => a !== address));
  };

  const save = () => {
    if (!validate()) return;
    onSave({
      capCelo: String(capNum),
      allowed,
      expiryHours: Math.floor(expiryNum),
    });
  };

  const valid =
    !Number.isNaN(capNum) &&
    capNum >= MIN_CAP &&
    capNum <= MAX_CAP &&
    allowed.length > 0 &&
    !Number.isNaN(expiryNum) &&
    expiryNum >= 1 &&
    expiryNum <= 168;

  return (
    <Card testId="policy-form">
      <h2>Set the rules for the agent</h2>
      <p>
        These rules are enforced on chain by the wallet itself, not by the
        agent&apos;s good behavior. If the agent tries to spend more than the
        cap or touch a contract that is not listed, the call fails.
      </p>

      <Field
        label="Daily spend cap (CELO)"
        hint={`The most the agent may spend in one day, including relay fees. Between ${MIN_CAP} and ${MAX_CAP} CELO.`}
        error={errors.cap}
      >
        <input
          type="number"
          inputMode="decimal"
          min={MIN_CAP}
          max={MAX_CAP}
          step="0.01"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          data-testid="policy-cap"
        />
      </Field>

      <Field
        label="Allowed contracts and recipients"
        hint="The agent can only call addresses on this list. Everything else is blocked."
        error={errors.allowed}
      >
        <ul className="allow-list" data-testid="allow-list">
          {allowed.map((address) => (
            <li key={address} className="allow-item">
              <code className="mono">{address}</code>
              {address === DEMO_RECIPIENT ? (
                <span className="tag">Demo recipient</span>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => removeAddress(address)}
                aria-label={`Remove ${address}`}
              >
                Remove
              </button>
            </li>
          ))}
          {allowed.length === 0 ? (
            <li className="allow-empty">No addresses allowed yet.</li>
          ) : null}
        </ul>
        <div className="add-row">
          <input
            type="text"
            placeholder="0x... another address to allow"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            data-testid="policy-custom-address"
          />
          <Button
            variant="secondary"
            onClick={addAddress}
            testId="policy-add-address"
          >
            Add address
          </Button>
        </div>
        {errors.custom ? (
          <span className="field-error" role="alert">
            {errors.custom}
          </span>
        ) : null}
      </Field>

      <Field
        label="Session expiry (hours)"
        hint="After this time the key stops working on its own. Default 24 hours."
        error={errors.expiry}
      >
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={168}
          step={1}
          value={expiryHours}
          onChange={(e) => setExpiryHours(e.target.value)}
          data-testid="policy-expiry"
        />
      </Field>

      {valid ? (
        <InfoBox>
          <strong>Summary:</strong> the agent may spend up to {capNum} CELO
          per day, may only call {allowed.length}{" "}
          {allowed.length === 1 ? "address" : "addresses"} on the list above,
          and its key expires in {Math.floor(expiryNum)}{" "}
          {Math.floor(expiryNum) === 1 ? "hour" : "hours"}. You can revoke it
          sooner at any time.
        </InfoBox>
      ) : null}

      <div className="actions">
        <Button onClick={save} testId="policy-save">
          Save policy and continue
        </Button>
      </div>
    </Card>
  );
}
