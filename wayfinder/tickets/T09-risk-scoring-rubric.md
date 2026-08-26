---
id: T09
title: Risk-scoring rubric
type: grilling
status: open
assignee:
blocked-by: [T03]
---

## Question

Define the rubric Steward uses to score approvals and tokens, constrained to what [Approvals and token-risk data sources](T03-approvals-data-sources.md) can actually feed:

- Approval factors: allowance size (unlimited?), age/staleness, spender contract verification status, spender reputation signals.
- Token factors: liquidity depth, holder concentration, honeypot heuristics.
- Forgery handling (per [Approvals and token-risk data sources](T03-approvals-data-sources.md)): Approval events are spammable/forgeable — the rubric scores only live-verified allowances, weights by token value at risk, and states how ERC-721 approvals, `ApprovalForAll`, and Permit2 sub-allowances are treated (even if v1 punts on some with an honest "not covered" label).
- Scoring bands and honest labels — the agent must be able to explain *why* something is flagged, and the copy must avoid overclaiming ("risky/stale/unknown", never a blanket "safe") to keep the impact story credible rather than liability-shaped.

Resolution becomes the spec for the scoring module and the language the agent uses in the audit report.
