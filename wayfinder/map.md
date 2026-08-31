# Wayfinder Map — Steward `wayfinder:map`

## Destination

The WebMCP Challenge submission for Steward is filed on Devpost before **Sep 3, 2026, 1:00pm PDT**: a live wallet-safety web app exposing WebMCP tools (working in ChatGPT's browser and Chrome 149+ with the WebMCP flag), a public open-source repo, a sub-3-minute YouTube demo video, and the submission text.

## Notes

- **Deadline-bound effort: execution is in scope for this map** (explicit override of wayfinder's plan-only default). Task tickets may deliver parts of the destination directly, not only unblock decisions. Standing gate: feature-freeze around **Sep 1**, last two days for polish, video, submission.
- **Locked concept** (per [Lock the thesis and scope of Steward](tickets/T01-lock-the-thesis.md)): **wallet copilot with a safety core**. Read tools work for any pasted address, watch-only first-class. The only write paths are **staged actions** — agent stages, human signs in their wallet — with `stage_revoke` and `stage_transfer` sharing one `StagedAction` shape and one consent path. Must-ship: approvals + risk + staged revoke · portfolio + token assessment · calldata decode + explain-tx · staged transfers + gas advisor. On-chain metadata treated as attacker-controlled (injection quarantine). Name **Steward** (user-locked). Stack: Next.js App Router + TypeScript + wagmi/viem, Vercel deploy, MIT license.
- **Constraints** (same resolution): **solo** entry; **25–35h** across the 8 days; **no paid ChatGPT plan** (corrected 2026-09-01 — supersedes the answer given while charting), so the **ChatGPT lane is out** and **Chrome + `#enable-webmcp-testing` is the sole demo and shooting target**. This is a first-class judging environment, not a fallback: the rules say judges test in ChatGPT's in-app browser *or* Chrome 149+ with the flag. Native registration and invocation were verified there on 2026-09-01 (`scripts/verify-native-webmcp.ts`). The signing climax was only ever shootable in Chrome anyway, since ChatGPT's in-app browser has no wallet extension; **Base-mainnet burner ~$5 approved** — the human funds, holds, and signs everything, no assistant session touches keys or funds.
- **Build order is locked, because the must-ship set does not fit.** Estimated ~42h against 25–35h available; the human confirmed the set with that arithmetic in hand, having already cut swap staging. The **Sep 1 freeze cuts from the tail**, in this order: scaffold → deploy/live URL → approvals + risk → staged revoke + signing → injection quarantine → portfolio + token assessment → calldata decode + explain-tx → tx history → staged transfers → gas advisor → adversarial evals. Sep 1–3 is reserved for polish, video, and submission text — **never cut**.
- **Judging criteria to keep in view** (equal weights): WebMCP leverage · execution (real product, not PoC) · credible impact · creativity. Judges are mainstream web-infra people (Chrome, Shopify, Cloudflare, Vercel, OpenAI, Netlify, MCP-B's creator) — safety framing, not degen framing.
- **Positioning rule** (per [Challenge field scan](tickets/T04-challenge-field-scan.md)): never lead with generic "human-in-the-loop"; lead with *live wallet + consent the page cannot render or bypass + quarantined adversarial data*. Watch-only audit mode for any pasted address is a hard requirement. The submission and video **lead with safety**; copilot breadth is presented as depth (evidence of a complete product), never as the headline.
- **Tracker**: local markdown (no external tracker provided). Tickets live in `wayfinder/tickets/*.md` with frontmatter `id/title/type/status/assignee/blocked-by`. **Claim** = set `assignee`. **Frontier** = `status: open`, empty assignee, all `blocked-by` closed. (Unclaimed tickets carry a bare `assignee:` with an empty value — parse frontmatter line-anchored, or a `\s*` will swallow the newline and read the next field as the assignee.) Blocking is body-convention (no native support). Research findings land in `wayfinder/assets/` on main — branch ceremony deliberately skipped for an 8-day effort.
- **Skills**: `/prototype` is installed and serves prototype tickets. Grilling and domain-modeling skills are **not** installed — emulate them: structured live Q&A with the human (never answer for them), and name the domain nouns explicitly before schema decisions.
- **Secrets**: never in this repo, tickets, or assets. Moralis/Codex keys may be read from the unhosted project's local env for probes only; findings must redact them.
- Refer to tickets **by name** in all human-facing text; ids ride inside links.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [WebMCP platform facts](tickets/T02-webmcp-platform-facts.md) — API is `document.modelContext.registerTool` (+`AbortController` lifecycle); **Atlas is dead** → targets are ChatGPT desktop app's browser + Chrome 149 flag; hand-roll the hook; use `readOnlyHint`/`untrustedContentHint`; never rely on `requestUserInteraction`; outputs ≤1.5K chars; test with `webmcp-evals`.
- [Challenge field scan](tickets/T04-challenge-field-scan.md) — crypto/wallet lane: zero visible entries; generic human-in-the-loop framing saturated (~30 entries, closest: webmcp-sentinel) → lead with externally-enforced wallet consent + adversarial-data quarantine; **watch-only mode mandatory** (judges may lack wallet extensions in ChatGPT's browser); commerce/dev-tooling/games saturated.
- [Approvals and token-risk data sources](tickets/T03-approvals-data-sources.md) — keyless MVP stack: Blockscout logs → Multicall3 live `allowance()` (mainnet solid); GoPlus + DexScreener + Honeypot.is for `assess_token`; `eth_simulateV1` free for simulation. Base needs hardening → [Harden the Base data lane](tickets/T14-harden-base-lane.md). Moralis account 401 (unpaid invoices) and Codex over quota — both dead today. Approval events are forgeable: live-allowance verification is mandatory.
- [Lock the thesis and scope of Steward](tickets/T01-lock-the-thesis.md) — concept **amended** to a wallet copilot with a safety core (four must-ship blocks); why-WebMCP spine confirmed unamended; solo, 25–35h, ChatGPT Plus + desktop app, Base burner approved; **swap staging cut**; build order locked because must-ship (~42h) overruns the hours.

## Not yet specified

- Build-session breakdown for implementing the locked tool surface — graduates when [Final tool surface and schemas](tickets/T07-final-tool-surface.md) closes.
- Video script, shoot plan, and edit — hangs on a working product plus [Demo arc and burner wallet plan](tickets/T08-demo-arc.md).
- Submission text and the Stage-One compliance checklist (live URL, license, video, description) — hangs on most of the map.
- The actual cut call at the Sep 1 freeze — the *order* is now locked in Notes, so what remains fogged is which tail items have survived on the day, and how much polish the remainder can absorb.
- Whether the submission story leads with the standalone dashboard or the agent flow — sharpens after [Dashboard prototype](tickets/T11-dashboard-prototype.md). (That the story leads with *safety* is settled; this is the separate axis of which surface carries it.)

## Out of scope

- Chains beyond Ethereum mainnet + Base. (The Base Sepolia escape hatch is closed: the demo runs on a mainnet burner.)
- Swap execution or any trading/speculative features — reaffirmed and sharpened by [Lock the thesis and scope of Steward](tickets/T01-lock-the-thesis.md): **swap staging was explicitly considered as a fifth capability and cut** (~6–8h for DEX quotes, routing, slippage, approve-then-swap — roughly the whole polish-and-video budget). Staged transfers already prove the stage-and-sign pattern generalizes beyond revokes.
- Integration with unhosted.ai product or data pages (knowledge reuse is fine; product coupling is not).
- Post-hackathon productization: auth, billing, monitoring, multi-user.
