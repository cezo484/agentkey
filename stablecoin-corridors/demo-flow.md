# Demo flow

1. Open `index.html`. The page shows CorridorDesk with a payout form:
   recipient wallet, USD₮ amount, payout currency.
2. Click "Get Textile FX quote". The page calls the live Textile FX
   preview endpoint and shows the conversion, the fee, and the policy
   check (250 USD₮ per-payment cap).
3. Click "Approve payout". The page shows the unsigned execution plan:
   firm quote request, ERC-8021 tag appended to the swap calldata,
   approval to the Textile LimitOrderReactor, wallet signature, payout
   transfer. The demo stops before signing.
4. CLI equivalent: `node agent.mjs payroll.example.json` prints the full
   batch plan with live quotes for cNGN, IDRX, and wBRL.

Screenshots to capture for the submission: the quote card with the
policy check, and the approved execution plan. `sample-run.json` holds
the CLI output from the 25 Nov 2026 run.
