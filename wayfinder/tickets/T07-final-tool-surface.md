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
- `simulate_transaction`: in or out — feasibility is settled (free keyless `eth_simulateV1` per [Approvals and token-risk data sources](T03-approvals-data-sources.md)), so the call is purely about build time vs demo value (`decode_calldata` covers most of it).
- How tool outputs mark untrusted on-chain strings (interface contract consumed by [Injection-defense design](T10-injection-defense.md)).
- Watch-only mode is **first-class**, not a fallback: every read tool works for any pasted address with no wallet, because judges may be unable to install wallet extensions in the ChatGPT desktop browser (per [Challenge field scan](T04-challenge-field-scan.md)).

### Surface fixed by the locked thesis

[Lock the thesis and scope of Steward](T01-lock-the-thesis.md) settled the concept as a **wallet copilot with a safety core**, so the surface must cover all four must-ship capability blocks — this is no longer open:

- Approvals + risk scores + **staged revoke**
- Portfolio + token assessment
- **Calldata decode + explain-this-tx**
- **`stage_transfer`** (settled **in** — was previously this ticket's call) + **gas advisor**

Swap staging is **out of scope** — do not schema it.

Two constraints carried in from that resolution:

- **Second write path is real**: `stage_revoke` and `stage_transfer` must share one `StagedAction` shape and one consent path, or the breadth costs more than the 2h it was budgeted at.
- **History and gas schemas are provisional** pending [Probe tx-history and gas data endpoints](T15-probe-history-gas-sources.md). That ticket is deliberately *not* blocking: those two tools sit at positions 8 and 10 in the locked build order (the tail that the Sep 1 freeze cuts first), so the rest of the surface must not wait on them. Lock the other schemas; leave these two as sketches until the probe lands.

Resolution graduates the build-session breakdown out of the map's fog.
