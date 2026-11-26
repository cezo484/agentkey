// CorridorDesk agent: payroll payouts in local stablecoins via Textile FX.
//
// Flow: read a payroll batch, fetch a live Textile FX preview quote for
// each payout, run the AgentKey policy checks (per-payment cap, corridor
// allowlist, minimum rate), and produce an approval plan. The plan is
// unsigned. Execution needs a firm quote (POST /v2/rfq/request) and the
// taker wallet signature; this demo never signs and never moves funds.
//
// Usage: node agent.mjs [payroll.json] [--out plan.json]

import { readFileSync, writeFileSync } from 'node:fs'

const API = 'https://api.textilecredit.com/v2'
const CHAIN_ID = 42220 // Celo mainnet

// Celo mainnet token addresses (Textile FX address book / Loops House page).
const TOKENS = {
  USDT: { address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6 },
  cNGN: { address: '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f', decimals: 6 },
  IDRX: { address: '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22', decimals: 2 },
  wARS: { address: '0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D', decimals: 18 },
  wBRL: { address: '0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0', decimals: 18 },
  wMXN: { address: '0x337E7456B420bD3481e7FA61fA9850343d610d34', decimals: 18 },
  wCOP: { address: '0x8a1D45e102e886510e891d2Ec656a708991e2D76', decimals: 18 },
}

// AgentKey policy the agent runs under. Mirrors the Altana session key:
// a spend cap, an allowlist, and an expiry, enforced before any signing.
const POLICY = {
  perPaymentCapUsdt: 250,
  batchCapUsdt: 1000,
  allowedCorridors: ['cNGN', 'IDRX', 'wARS', 'wBRL', 'wMXN', 'wCOP'],
  minRateFloor: {}, // per-token minimum local units per USDT, optional
}

function toAtomic(amount, decimals) {
  const [whole, frac = ''] = String(amount).split('.')
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || '0')).toString()
}

function fromAtomic(atomic, decimals) {
  const value = BigInt(atomic)
  const base = 10n ** BigInt(decimals)
  const whole = value / base
  const frac = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole.toString()
}

async function previewQuote(sellToken, buyToken, sellAmountAtomic) {
  const res = await fetch(`${API}/rfq/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chainId: CHAIN_ID,
      sellToken: TOKENS[sellToken].address,
      buyToken: TOKENS[buyToken].address,
      sellAmount: sellAmountAtomic,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`preview failed: ${res.status} ${JSON.stringify(body)}`)
  return body.data
}

function checkPolicy(payout, quote) {
  const checks = []
  const usdt = Number(payout.usdt)
  checks.push({
    name: 'per-payment cap',
    ok: usdt <= POLICY.perPaymentCapUsdt,
    detail: `${usdt} USDT vs cap ${POLICY.perPaymentCapUsdt}`,
  })
  checks.push({
    name: 'corridor allowlist',
    ok: POLICY.allowedCorridors.includes(payout.token),
    detail: payout.token,
  })
  checks.push({
    name: 'quote available',
    ok: quote.status === 'preview',
    detail: quote.status,
  })
  const floor = POLICY.minRateFloor[payout.token]
  if (floor && quote.status === 'preview') {
    const rate = Number(fromAtomic(quote.buyAmount, TOKENS[payout.token].decimals)) / usdt
    checks.push({ name: 'minimum rate', ok: rate >= floor, detail: `${rate} vs floor ${floor}` })
  }
  return checks
}

async function main() {
  const args = process.argv.slice(2)
  const inputPath = args.find((a) => !a.startsWith('--')) || 'payroll.example.json'
  const outIdx = args.indexOf('--out')
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null

  const batch = JSON.parse(readFileSync(inputPath, 'utf8'))
  const totalUsdt = batch.payouts.reduce((sum, p) => sum + Number(p.usdt), 0)

  const plan = {
    agent: 'CorridorDesk',
    erc8004AgentId: 10110,
    attributionTag: 'celo_584ed85bd399',
    chainId: CHAIN_ID,
    batchTotalUsdt: totalUsdt,
    batchWithinCap: totalUsdt <= POLICY.batchCapUsdt,
    generatedAt: new Date().toISOString(),
    payouts: [],
    execution: {
      status: 'awaiting human approval',
      note:
        'On approval, request a firm quote (POST /v2/rfq/request) with the taker wallet, ' +
        'append the ERC-8021 tag celo_584ed85bd399 to transactions.swap.data, approve takerPays ' +
        'to the Textile LimitOrderReactor, then sign and broadcast from the taker wallet. ' +
        'This demo does not sign.',
    },
  }

  for (const payout of batch.payouts) {
    const sellAtomic = toAtomic(payout.usdt, TOKENS.USDT.decimals)
    const quote = await previewQuote('USDT', payout.token, sellAtomic)
    const checks = checkPolicy(payout, quote)
    plan.payouts.push({
      recipient: payout.recipient,
      wallet: payout.wallet,
      usdt: payout.usdt,
      token: payout.token,
      quote:
        quote.status === 'preview'
          ? {
              buyAmount: fromAtomic(quote.buyAmount, TOKENS[payout.token].decimals),
              feeUsdt: fromAtomic(quote.feeAmount, TOKENS.USDT.decimals),
              takerPaysUsdt: fromAtomic(quote.takerPays, TOKENS.USDT.decimals),
              availableSellUsdt: fromAtomic(quote.availableSellAmount, TOKENS.USDT.decimals),
            }
          : { status: quote.status },
      policyChecks: checks,
      approved: checks.every((c) => c.ok) && plan.batchWithinCap,
    })
  }

  const json = JSON.stringify(plan, null, 2)
  if (outPath) writeFileSync(outPath, json + '\n')
  console.log(json)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
