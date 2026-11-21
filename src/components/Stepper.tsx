// Step indicator across the top of the app.
export const STEPS = [
  "Welcome",
  "Create wallet",
  "Fund",
  "Set policy",
  "Grant session",
  "Agent tasks",
  "Dashboard",
];

export function Stepper({
  current,
  unlocked,
  onGo,
}: {
  current: number;
  unlocked: (step: number) => boolean;
  onGo: (step: number) => void;
}) {
  return (
    <ol className="stepper" aria-label="Demo steps">
      {STEPS.map((label, i) => {
        const active = i === current;
        const done = i < current;
        const canGo = unlocked(i);
        return (
          <li
            key={label}
            className={`step ${active ? "step-active" : ""} ${done ? "step-done" : ""} ${canGo ? "" : "step-locked"}`}
          >
            <button
              type="button"
              className="step-button"
              onClick={() => canGo && onGo(i)}
              disabled={!canGo}
              aria-current={active ? "step" : undefined}
              data-testid={`step-${i}`}
            >
              <span className="step-number">{done ? "✓" : i + 1}</span>
              <span className="step-label">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
