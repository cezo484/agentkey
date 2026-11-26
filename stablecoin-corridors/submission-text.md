# Loops House submission text — Stablecoin Corridors track

Form: https://www.loops.house/agents-open-for-business/playground/submit
Status: prepared, NOT submitted. Submission needs the user's approval.

The form is the same one used for the Altana entry. Text fields wipe on
navigation, so re-fill from `../submission-form-values.md` in one session
and add the Stablecoin Corridors details below. One project can enter all
four tracks and win in up to two, so CorridorDesk can be added to the
existing AgentKey entry or submitted as its own entry.

## Project name

CorridorDesk

## Tagline

Payroll payouts in local stablecoins, converted on Textile FX.

## Description

CorridorDesk is a payroll agent for businesses that hold USD₮ and owe
people in other currencies. It takes a payroll batch, gets live Textile
FX quotes for each corridor (USD₮ to cNGN, IDRX, wBRL, wARS, wMXN, wCOP
on Celo), checks every payout against the policy a person granted the
agent (per-payment cap, batch cap, corridor allowlist), and prepares the
conversions for one human approval. The payer wallet signs; the agent
never holds keys or funds. Built on AgentKey, the session-key wallet
where a person grants an agent a spend cap, an allowlist, and an expiry
enforced onchain.

## Stablecoin Corridors track details (form field)

CorridorDesk converts USD₮ to local stablecoins on Textile FX (RFQ API
v2) for named payroll recipients: cNGN for a Lagos contractor, IDRX for
a Jakarta freelancer, wBRL for a São Paulo designer. The agent fetches
live quotes, enforces a 250 USD₮ per-payment cap and a corridor
allowlist, and prepares unsigned execution plans; a person approves
before any wallet signs. ERC-8004 agent ID 10110. Attribution tag
celo_584ed85bd399 on every conversion. Agent wallet
0xb48c59869227638743Acae4D2A2A441d98E43f83.

## Named user

mehmet484, the solo builder, runs CorridorDesk for his own contractor
payouts: USD₮ in, local stablecoins out, each conversion quoted on
Textile FX and checked against the cap before approval.

## What still has to happen before judging

1. One tagged Textile FX conversion on Celo mainnet inside the product
   flow (firm quote, tag appended to transactions.swap.data, signed by
   the payer wallet).
2. The converted local stablecoin reaches a recipient outside the team.
3. Repo updated with this folder and pushed public.
4. Form filled and submitted before 7 Dec 2026, 09:00 GMT.
