---
id: T03
title: Approvals and token-risk data sources
type: research
status: open
assignee: claude (research agent, fired 2026-08-26)
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
