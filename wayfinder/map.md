# Wayfinder Map — Steward `wayfinder:map`

## Destination

The WebMCP Challenge submission for Steward is filed on Devpost before **Sep 3, 2026, 1:00pm PDT**: a live wallet-safety web app exposing WebMCP tools (working in ChatGPT's browser and Chrome 149+ with the WebMCP flag), a public open-source repo, a sub-3-minute YouTube demo video, and the submission text.

## Notes

- **Deadline-bound effort: execution is in scope for this map** (explicit override of wayfinder's plan-only default). Task tickets may deliver parts of the destination directly, not only unblock decisions. Standing gate: feature-freeze around **Sep 1**, last two days for polish, video, submission.
- **Working concept** (provisional until [Lock the thesis and scope of Steward](tickets/T01-lock-the-thesis.md) closes): agent-assisted wallet-safety cockpit. Read tools work for any pasted address (approvals with risk scores, portfolio, token assessment, calldata decode, maybe simulation); the only write path is **staged revokes** — agent stages, human signs in their wallet. On-chain metadata treated as attacker-controlled (injection quarantine). Name **Steward** (user-locked). Stack preference: Next.js App Router + TypeScript + wagmi/viem, Vercel deploy, MIT license.
- **Judging criteria to keep in view** (equal weights): WebMCP leverage · execution (real product, not PoC) · credible impact · creativity. Judges are mainstream web-infra people (Chrome, Shopify, Cloudflare, Vercel, OpenAI, Netlify, MCP-B's creator) — safety framing, not degen framing.
- **Positioning rule** (per [Challenge field scan](tickets/T04-challenge-field-scan.md)): never lead with generic "human-in-the-loop"; lead with *live wallet + consent the page cannot render or bypass + quarantined adversarial data*. Watch-only audit mode for any pasted address is a hard requirement.
- **Tracker**: local markdown (no external tracker provided). Tickets live in `wayfinder/tickets/*.md` with frontmatter `id/title/type/status/assignee/blocked-by`. **Claim** = set `assignee`. **Frontier** = `status: open`, empty assignee, all `blocked-by` closed. Blocking is body-convention (no native support). Research findings land in `wayfinder/assets/` on main — branch ceremony deliberately skipped for an 8-day effort.
- **Skills**: `/prototype` is installed and serves prototype tickets. Grilling and domain-modeling skills are **not** installed — emulate them: structured live Q&A with the human (never answer for them), and name the domain nouns explicitly before schema decisions.
- **Secrets**: never in this repo, tickets, or assets. Moralis/Codex keys may be read from the unhosted project's local env for probes only; findings must redact them.
- Refer to tickets **by name** in all human-facing text; ids ride inside links.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [WebMCP platform facts](tickets/T02-webmcp-platform-facts.md) — API is `document.modelContext.registerTool` (+`AbortController` lifecycle); **Atlas is dead** → targets are ChatGPT desktop app's browser + Chrome 149 flag; hand-roll the hook; use `readOnlyHint`/`untrustedContentHint`; never rely on `requestUserInteraction`; outputs ≤1.5K chars; test with `webmcp-evals`.
- [Challenge field scan](tickets/T04-challenge-field-scan.md) — crypto/wallet lane: zero visible entries; generic human-in-the-loop framing saturated (~30 entries, closest: webmcp-sentinel) → lead with externally-enforced wallet consent + adversarial-data quarantine; **watch-only mode mandatory** (judges may lack wallet extensions in ChatGPT's browser); commerce/dev-tooling/games saturated.

## Not yet specified

- Build-session breakdown for implementing the locked tool surface — graduates when [Final tool surface and schemas](tickets/T07-final-tool-surface.md) closes.
- Video script, shoot plan, and edit — hangs on a working product plus [Demo arc and burner wallet plan](tickets/T08-demo-arc.md).
- Submission text and the Stage-One compliance checklist (live URL, license, video, description) — hangs on most of the map.
- Final polish scope and the cut-list at the Sep 1 freeze — depends on build progress.
- Whether the submission story leads with the standalone dashboard or the agent flow — sharpens after [Dashboard prototype](tickets/T11-dashboard-prototype.md).

## Out of scope

- Chains beyond Ethereum mainnet + Base (+ Base Sepolia if a testnet demo lane is chosen).
- Swap execution or any trading/speculative features.
- Integration with unhosted.ai product or data pages (knowledge reuse is fine; product coupling is not).
- Post-hackathon productization: auth, billing, monitoring, multi-user.
