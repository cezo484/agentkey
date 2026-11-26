# CorridorDesk — Stablecoin Corridors track entry

Payroll payouts in local stablecoins, converted on Textile FX, run by an
agent under an AgentKey policy.

## What it does

A business holds USD₮ and owes people in Lagos, Jakarta, and São Paulo.
CorridorDesk takes the payroll batch, asks Textile FX makers for a firm
price on each corridor (USD₮ → cNGN, IDRX, wBRL, wARS, wMXN, wCOP on Celo
mainnet), checks every payout against the policy a person granted the
agent (per-payment cap, batch cap, corridor allowlist, optional minimum
rate), and prepares an unsigned execution plan. A person approves the
batch; only then does the payer wallet request a firm quote, sign the
swap, and pay each recipient in their own stablecoin.

## Why AgentKey

The agent never holds keys or funds. It works inside limits a person set:
a spend cap, an allowlist, and an expiry, the same session-key model
AgentKey enforces onchain with Altana. The agent proposes; the wallet
signs. Every conversion carries the ERC-8021 attribution tag
`celo_584ed85bd399`.

## Run the demo

CLI (live Textile FX preview quotes, no key needed):

```bash
node agent.mjs payroll.example.json --out plan.json
```

Web UI: open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

Both paths stop at the approval plan. Execution needs a firm quote
(`POST /v2/rfq/request`) and the taker wallet's signature, so the demo
never signs and never moves funds.

## Sample run (25 Nov 2026, live preview)

- 120 USD₮ → 173,276.070988 cNGN (fee 0.023995 USD₮)
- 80 USD₮ → 1,470,240.13 IDRX (fee 0.015996 USD₮)
- 150 USD₮ → 872.683608 wBRL (fee 0.029994 USD₮)

Full output: `sample-run.json`.

## Track requirements status

- ERC-8004 identity: agent #10110 (registered).
- Textile FX conversion in the product flow: live preview integration
  done; the tagged mainnet conversion is the remaining step and needs
  the payer wallet signature plus a recipient outside the team.
- Local-stablecoin payment to an outside recipient: pending the same
  mainnet run.
- No arbitrage, self-trading, or maker activity: the agent only converts
  for named payroll recipients.

## Addresses (Celo mainnet)

- USD₮ `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`
- cNGN `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f`
- IDRX `0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22`
- wARS `0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D`
- wBRL `0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0`
- wMXN `0x337E7456B420bD3481e7FA61fA9850343d610d34`
- wCOP `0x8a1D45e102e886510e891d2Ec656a708991e2D76`
- Textile LimitOrderReactor `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`
