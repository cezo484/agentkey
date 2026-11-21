// Step 1: landing. Plain-English explanation of the product.
import { Button, Card } from "./ui";

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="landing">
      <Card testId="landing-card">
        <p className="eyebrow">Celo Sepolia testnet · Powered by Altana</p>
        <h1>Give your agent a wallet with rules you set.</h1>
        <p className="lead">
          AgentKey creates a smart wallet for an AI agent, then hands the agent
          a key that only works inside limits you choose: a daily spend cap,
          a list of allowed contracts, and an expiry date. You watch every
          move live, and you can take the key back in one click.
        </p>

        <div className="how-grid">
          <div className="how-item">
            <h3>1. Create the wallet</h3>
            <p>
              A smart agentic wallet on Celo Sepolia. Use a passkey on your
              device, or a demo key generated in your browser for this testnet
              walkthrough.
            </p>
          </div>
          <div className="how-item">
            <h3>2. Set the rules</h3>
            <p>
              Pick how much the agent may spend per day, which contracts it
              may touch, and when its key stops working.
            </p>
          </div>
          <div className="how-item">
            <h3>3. Grant a session key</h3>
            <p>
              The key and its rules are written to Altana&apos;s public
              on-chain Keystore, so anyone can verify what the agent is
              allowed to do.
            </p>
          </div>
          <div className="how-item">
            <h3>4. Watch and revoke</h3>
            <p>
              The demo agent runs real on-chain tasks inside your rules. If it
              steps outside them, the chain stops it. One click revokes the
              key for good.
            </p>
          </div>
        </div>

        <div className="callout">
          <strong>What is an agent wallet?</strong>
          <p>
            A normal wallet gives whoever holds the key full control. An agent
            wallet is a smart account whose keys carry permissions: each key
            can only do what its rules allow, and the rules live on chain, not
            in a company database. The agent never sees your main key.
          </p>
        </div>

        <p className="fine-print">
          This is a testnet demo. Everything runs on Celo Sepolia with free
          test CELO from the faucet. No real money is involved, and no key
          ever leaves your browser.
        </p>

        <div className="actions">
          <Button onClick={onStart} testId="start-button">
            Start the demo
          </Button>
        </div>
      </Card>
    </div>
  );
}
