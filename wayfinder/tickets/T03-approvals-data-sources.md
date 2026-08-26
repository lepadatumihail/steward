---
id: T03
title: Approvals and token-risk data sources
type: research
status: closed
assignee: claude (research agent) — resolved 2026-08-26
blocked-by: []
---

## Question

Which data stack should power `list_token_approvals` and `assess_token` on Ethereum mainnet + Base? Live-probe candidates (docs lag reality — never trust docs alone):

- Moralis: does a wallet-approvals endpoint exist and work post-deprecations? Portfolio/token endpoints status. (API key may be read from the unhosted project's local env for probes; **redact from findings**.)
- Etherscan v2 / Basescan: Approval-event queries, contract-verification lookup for spender risk.
- Alchemy or public RPC + viem `getLogs` scan of `Approval` events: feasibility, latency, block-range limits on free tiers.
- Token safety signals for `assess_token`: liquidity, holder concentration, honeypot heuristics — free/probe-able options (Codex? GoPlus? DexScreener?).
- Transaction simulation options for a possible `simulate_transaction` (Alchemy simulate endpoints, Tenderly free tier, `eth_call` fallbacks) — feasibility only.

Deliverable: recommended primary + fallback per tool with measured probe results (response shapes, latencies), so [Final tool surface and schemas](T07-final-tool-surface.md) can lock schemas against real payloads.

Findings → `wayfinder/assets/T03-findings.md`.

## Resolution (2026-08-26)

Full probe logs (endpoints, statuses, latencies, trimmed real samples; probe set incl. vitalik.eth, machibigbrother.eth, jesse.base.eth, PEPE/BRETT/spam tokens) in [T03-findings.md](../assets/T03-findings.md). Recommended stack:

- **`list_token_approvals` — keyless 3-stage pipeline**: Blockscout logs scan (full history, `timeStamp` included) → dedupe per (token, spender) → live `allowance()` via Multicall3 on free RPCs (50 calls in 0.27s, probed on both chains). Mainnet solid even worst-case (vitalik's 4,608 approval logs = 6.7s). Fallbacks: Routescan (keyless, mainnet-only), Etherscan v2 with a free key.
- **Base is the weak link**: Blockscout Base 500s/429s with a sticky ~5–15min IP throttle on event-spammed wallets, and Base logs are **paid-tier-only on Etherscan v2** (verified in live docs today). Mitigations all need human account creation → spun out as [Harden the Base data lane](T14-harden-base-lane.md). Raw RPC scans are a non-starter (base.org caps `getLogs` at 100 blocks ≈ 505k calls).
- **`assess_token` — fully keyless**: GoPlus `token_security` + `approval_security` (spender risk) on chains 1/8453 (~0.3s) **+** DexScreener (liquidity/age) **+** Honeypot.is (simulation-backed taxes). Combine all three — GoPlus alone under-flags fresh spam (probed).
- **`simulate_transaction` — feasible free**: `eth_simulateV1` keyless on publicnode (eth+base), dRPC, base.org (0.16–0.35s) incl. `traceTransfers`; decode logs into asset changes. Alchemy/Tenderly are optional keyed upgrades. The in/out call stays with [Final tool surface and schemas](T07-final-tool-surface.md), now knowing cost is engineering time only.
- **Vendor keys are both dead today**: Moralis 401 "unpaid invoices" account-wide (its `/wallets/{addr}/approvals` exists in swagger and would collapse the pipeline to one call if billing were fixed); Codex 403 over monthly quota. MVP ships at zero spend regardless.
- **Data-quality trap**: Approval events are forgeable — 4/5 of vitalik's approval logs are one Apr-2026 spam wave. The live-allowance stage plus token-value weighting is mandatory, and ERC-721 approvals, `ApprovalForAll`, and Permit2 sub-allowances need explicit design handling → binds [Risk-scoring rubric](T09-risk-scoring-rubric.md) and the domain model in [Final tool surface and schemas](T07-final-tool-surface.md).
