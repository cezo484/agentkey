// Shared UI pieces for AgentKey.
import { useState, type ReactNode } from "react";
import { addressUrl, shortenAddress, txUrl } from "../lib/altana";

export function Card({
  children,
  testId,
}: {
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className="card" data-testid={testId}>
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  testId,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  testId?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label ? <span className="spinner-label">{label}</span> : null}
    </span>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="error-box" role="alert" data-testid="error-box">
      {message}
    </div>
  );
}

export function InfoBox({ children }: { children: ReactNode }) {
  return <div className="info-box">{children}</div>;
}

export function AddressLine({
  address,
  label,
}: {
  address: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="address-line">
      {label ? <span className="address-label">{label}</span> : null}
      <code className="mono address-text" data-testid="wallet-address">
        {shortenAddress(address, 8)}
      </code>
      <button
        type="button"
        className="btn btn-ghost btn-small"
        onClick={copy}
        data-testid="copy-address"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <a
        className="link"
        href={addressUrl(address)}
        target="_blank"
        rel="noreferrer"
      >
        View on Celoscan
      </a>
    </div>
  );
}

export function TxLink({ hash }: { hash: string }) {
  return (
    <a
      className="link mono"
      href={txUrl(hash)}
      target="_blank"
      rel="noreferrer"
      data-testid="tx-link"
    >
      {shortenAddress(hash, 8)}
    </a>
  );
}

export type PillTone = "ok" | "warn" | "bad" | "neutral" | "info";

export function StatusPill({
  tone,
  children,
  testId,
}: {
  tone: PillTone;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <span className={`pill pill-${tone}`} data-testid={testId}>
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
