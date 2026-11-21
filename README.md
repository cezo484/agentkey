# AgentKey

Give your AI agent a wallet with rules you set.

AgentKey creates a smart agentic wallet on Celo Sepolia, funds it with test
CELO, and grants a scoped session key to a demo agent: a daily spend cap, an
allowlist of contracts, and an expiry date. The agent runs real on-chain tasks
inside those rules. The owner watches everything live and revokes the key in
one click. Every permission lives in Altana's public on-chain Keystore, so
anyone can verify what the agent is allowed to do.

Built for the Celo "Agents Open for Business" hackathon, Altana Agent Wallets
track.

Live demo: https://agentkey-kappa.vercel.app

## How it works

1. **Create a wallet.** Use a passkey on your device, or a demo key generated
   in your browser (testnet only, stored in localStorage, never leaves the
   browser).
2. **Fund it.** Get free test CELO from the Celo Sepolia faucet. About 2
   CELO covers the full demo.
3. **Set the policy.** Daily spend cap, allowed contracts, expiry.
4. **Grant a session key.** The key and its rules are written to the Altana
   Keystore on chain. The wallet also gets a free ERC-8004 agent identity
   with its first on-chain action.
5. **Watch the agent work.** Three real on-chain tasks: a transfer inside the
   rules (succeeds), a transfer above the daily cap (blocked), and a call to
   a contract that is not on the allowlist (blocked).
6. **Dashboard and revoke.** Live balance, policy summary, session status
   read from the Keystore, transaction history, and one-click revoke.
   Revocation is permanent: a revoked key can never be used again.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. The app needs no backend and no API key.

## Demo flow

1. Press Start, then create a demo wallet.
2. Copy the wallet address, open the faucet link, and send it 2 test CELO
   (two faucet requests, 1 CELO each).
3. Press Check balance, then continue.
4. Keep the default policy (0.5 CELO per day, demo recipient allowed,
   24 hours) or change it, then save.
5. Grant the session key. Note the transaction hash and the Keystore status.
6. Run all three agent tasks and watch the policy stop the two bad ones.
7. Open the dashboard, check the balance and history, then revoke the
   session.

## Tests

```bash
npm test          # smoke tests: full UI flow in demo mode, no funds needed
npm run test:funded  # full on-chain flow; skips cleanly without test CELO
```

The smoke suite covers landing, wallet creation, funding UI, policy
validation, the unfunded grant error, dashboard and revoke states, and reset.
The funded suite runs the grant, the three agent tasks, and the revoke when
the wallet holds at least 2 test CELO. To run it funded, set
`AGENTKEY_TEST_ADMIN_KEY` to the private key of a funded demo wallet (testnet
only, never a real key).

Test sandbox note: in this VM the browser cannot tunnel through the egress
proxy on its own, so the test run starts a small local forward proxy
(`scripts/local-proxy.mjs`, via `tests/global-setup.ts`) that adds the
upstream credentials. Real browsers connect to the relay directly and never
need it. `scripts/verify-deployed.mjs` checks the live Vercel deployment.

## Testnet notes

- Network: Celo Sepolia only (chainId 11142220). No mainnet code path.
- The Altana testnet relay can be slow on a first call. The app retries
  relay calls up to 3 times with backoff and shows a loading state.
- The first grant on a fresh wallet costs about 0.40 CELO because the admin
  key is registered at the same time. Later grants cost about 0.20 CELO.
- The faucet needs a human (captcha): https://faucet.celo.org/celo-sepolia
- Demo keys are ephemeral testnet keys. They are stored in localStorage only
  and are never committed: `.gitignore` excludes all key files.
- Sessions are persisted with `serializeSession` / `deserializeSession`
  from the SDK, never with `JSON.stringify`.

## Stack

Vite + React + TypeScript + viem + @altananetwork/sdk. No backend, no custom
smart contract: Altana's Keystore and account contracts do the enforcement.

## Links

- Altana docs: https://docs.altana.network
- Altana testnet Keystore explorer: https://testnet.altana.network
- Celo Sepolia faucet: https://faucet.celo.org/celo-sepolia
- Celo Sepolia explorer: https://sepolia.celoscan.io
- ERC-8004 agent pages: https://8004scan.io
