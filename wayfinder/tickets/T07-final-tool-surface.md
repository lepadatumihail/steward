---
id: T07
title: Final tool surface and schemas
type: grilling
status: open
assignee:
blocked-by: [T01, T02, T03]
---

## Question

Lock the domain model and the exact WebMCP tool surface. Emulate domain-modeling first: name the nouns (Wallet, TokenHolding, Approval, Spender, RiskAssessment, StagedAction, Quarantine…) and their relationships, then decide:

- Final tool list, names, and input/output schemas — validated against the real payloads from [Approvals and token-risk data sources](T03-approvals-data-sources.md).
- How the read/write trust boundary is expressed (write tools return `awaiting_user_confirmation`; can annotations from [WebMCP platform facts](T02-webmcp-platform-facts.md) encode read-only hints?).
- `simulate_transaction`: in or out (first cut candidate — `decode_calldata` covers most demo value).
- A second write path (`stage_transfer`): in or out — does breadth help or dilute the safety story?
- How tool outputs mark untrusted on-chain strings (interface contract consumed by [Injection-defense design](T10-injection-defense.md)).
- Watch-only mode is **first-class**, not a fallback: every read tool works for any pasted address with no wallet, because judges may be unable to install wallet extensions in the ChatGPT desktop browser (per [Challenge field scan](T04-challenge-field-scan.md)).

Resolution graduates the build-session breakdown out of the map's fog.
