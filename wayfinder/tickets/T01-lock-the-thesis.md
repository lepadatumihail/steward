---
id: T01
title: Lock the thesis and scope of Steward
type: grilling
status: closed
assignee: claude (grilling session) — resolved 2026-08-26
blocked-by: []
---

## Question

Confirm or amend the product thesis before the concept-dependent tickets proceed:

- (a) Is **wallet-safety** (audit → explain → fix via staged revokes) the concept we submit — versus a broader wallet copilot, or a different crypto angle entirely?
- (b) Does the why-WebMCP argument hold up as the submission's spine: *keys can't leave the browser, so agent+wallet collaboration must happen page-side, and the wallet signing popup is a cryptographic human-in-the-loop gate no server-side MCP can replicate*?
- (c) Solo entry or team?
- (d) Realistic hours available across the 8 days (calibrates every scope decision)?
- (e) Which ChatGPT plan tier do you have, and can you run the **ChatGPT desktop app**? (Atlas was shut down Aug 9 2026 — the desktop app's built-in browser is now the target: WebMCP on by default since Aug 25, macOS + Windows, but only GPT-5.6 Sol/Terra can invoke tools and free-tier invocation is untested; a Plus account should be on hand for the video.)
- (f) OK to fund a ~$5 Base-mainnet burner wallet and pre-stage stale/unlimited approvals on it for the demo?

Resolution updates the map's Notes (locked concept + constraints) and unblocks [Final tool surface and schemas](T07-final-tool-surface.md), [Demo arc and burner wallet plan](T08-demo-arc.md), and [Injection-defense design](T10-injection-defense.md).

## Resolution

Resolved 2026-08-26 by live grilling with the human (solo dev, Mihail).

**(a) Concept — AMENDED.** Not the wallet-safety cockpit as charted, but a **wallet copilot with a safety core**. The safety lane stays the spine of the *pitch*; the broader tool surface is the evidence of "complete product, not PoC". Must-ship capability set, all four confirmed:

1. Approvals + risk scores + staged revoke (the safety core and the signing moment)
2. Portfolio + token assessment (watch-only completeness for wallet-less judges)
3. Calldata decode + explain-this-tx
4. Staged transfers + gas advisor (cheap breadth, reuses the staging mechanism)

**(b) Why-WebMCP spine — CONFIRMED unamended.** Keys cannot leave the browser, so agent+wallet collaboration must happen page-side, and the wallet signing popup is a cryptographic human-in-the-loop gate no server-side MCP can replicate. Submission and video **lead with safety**, with copilot breadth presented as depth rather than as the headline — this keeps Steward out of the saturated general-assistant lane found by [Challenge field scan](T04-challenge-field-scan.md) while still scoring "complete product".

**(c) Entry — solo.**

**(d) Hours — 25–35h across the 8 days** (solid part-time).

**(e) ChatGPT — Plus/Pro with the desktop app available.** Tool invocation is therefore reliable on GPT-5.6 Sol/Terra: the **ChatGPT desktop browser is a live demo target**, and the video can be shot there. Chrome 149+ with `#enable-webmcp-testing` remains the second target and the wallet-extension lane.

**(f) Burner — approved.** ~$5 Base-mainnet burner, with stale/unlimited approvals pre-staged for the demo. **The human funds, holds, and signs everything**; no assistant session touches keys, seed phrases, or funds. Details land in [Demo arc and burner wallet plan](T08-demo-arc.md).

**Swap staging — ruled OUT OF SCOPE.** Considered as a fifth capability and cut: ~6–8h (DEX quote API, routing, slippage, approve-then-swap sequencing), roughly the entire polish-and-video budget, and it would have redrawn the map's trading-features boundary. Staged transfers already prove the "agent stages, human signs" pattern generalizes beyond revokes at a fraction of the cost.

### Budget reality — recorded, not resolved

The must-ship set estimates at **~42h against 25–35h available**. The human was shown this arithmetic and confirmed the set anyway, having already cut swap staging (the single largest item). The gap is therefore real and the **Sep 1 feature freeze is the enforcement mechanism**.

To make the freeze cut from the tail rather than collapse the middle, build in this order (agent's judgment absent further input; [Final tool surface and schemas](T07-final-tool-surface.md) locks the surface itself):

1. Scaffold + one WebMCP tool end-to-end — [Scaffold the app and prove one WebMCP tool end-to-end](T05-scaffold-and-spike.md)
2. Deploy pipeline / live URL — [Deploy pipeline and repo-publication timing](T12-deploy-and-publication.md) (Stage-One compliance requirement; also enables browser verification)
3. Approvals + live-allowance verification + risk scoring, watch-only — *the audit beat*
4. Staged revoke + wallet signing — *the consent-gate beat, and the pitch's lead*
5. Injection quarantine — *the differentiator beat*
6. Portfolio + token assessment — dashboard completeness
7. Calldata decode + explain-this-tx
8. Tx history
9. Staged transfers
10. Gas advisor
11. Adversarial eval run — [Adversarial eval run with webmcp-evals](T13-adversarial-eval.md)

Items 8–11 are the tail that falls off first. **Reserved and never cut**: the Sep 1→3 window for polish, video, and submission text.

### Consequences for other tickets

- [Final tool surface and schemas](T07-final-tool-surface.md) — `stage_transfer` is settled **in** (no longer its call); surface broadened with tx-history/explain and gas tools. Amended.
- [Demo arc and burner wallet plan](T08-demo-arc.md) — mainnet-burner lane settled; ChatGPT desktop browser confirmed as the shooting target. Amended.
- [Probe tx-history and gas data endpoints](T15-probe-history-gas-sources.md) — **new**: the two newly in-scope capabilities ride on hosts already probed by [Approvals and token-risk data sources](T03-approvals-data-sources.md), but on endpoints (`txlist`, `eth_feeHistory`) that were never probed. This map's standing rule is that docs lag reality.
