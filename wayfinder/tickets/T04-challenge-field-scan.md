---
id: T04
title: Challenge field scan
type: research
status: closed
assignee: claude (research agent) — resolved 2026-08-26
blocked-by: []
---

## Question

What is the WebMCP Challenge field visibly building, and what does it imply for Steward's differentiation?

- Public signals from the last ~4 weeks: X/Twitter chatter about the challenge, new GitHub repos (topic/search "webmcp"), Devpost participant updates, sponsor demo repos (Vercel storefront, Cloudflare coffee shop).
- Any other crypto/wallet entries visible? Any agent-safety-themed entries?
- Which categories look saturated (commerce/storefronts?) and which look empty?
- Implications for the creativity-criterion positioning and the submission text's differentiation paragraph (incl. how to pre-empt "revoke.cash exists" from a judge who knows the space).

Findings → `wayfinder/assets/T04-findings.md`.

## Resolution (2026-08-26)

Full findings (incl. the draft differentiation paragraph and revoke.cash pre-empt) in [T04-findings.md](../assets/T04-findings.md). What binds the map:

- **Field visibility**: only ~170 of 1,485 registrants have public repos; Devpost gallery/forum effectively empty; entry burst Aug 25–26. So "empty lane" is a strong prior, not a certainty — the invisible 89% caveat stands.
- **Crypto/wallet lane: zero visible entries.** GitHub-wide, webmcp × {wallet, revoke, ethereum, solana, web3} ≈ 0 (one dormant April payments repo). Even crypto-native entrants built non-crypto projects. Concept choice validated.
- **Biggest overlap risk is the framing, not the domain**: ~30 entries lead with propose/approve/execute consent flows. Closest lookalike: `guyle/webmcp-sentinel` (prepare→review→approve→execute, SHA-256-bound approvals, DevOps scenarios); also `agentgate-webmcp`, `webmcp-observatory`. All enforce consent **inside their own page**.
- **Two sub-lanes empty even among safety entries** — Steward's spearpoint: (1) consent the page *cannot render or bypass* (the wallet popup is externally enforced; every competitor uses in-page modals), and (2) injection quarantine of untrusted *data* (webmcp-scanner lints schemas; nobody quarantines content like token names).
- **Positioning rule**: never lead with "human in the loop" (judges will be numb to it); lead with *live wallet + externally-enforced consent + adversarial data*, the claim no visible competitor can copy by Sep 3.
- **Saturated**: commerce/storefronts (~17 entries + ~20 sponsor demos — Chrome's 15-demo suite, Netlify's Kurio/Mabel's Table, Shopify built-ins; the "Vercel storefront" was a conflation), agent-readiness dev tooling (~25), co-op games/creative studios (~24, seeded by OpenAI's own inspiration list).
- **Hard requirement discovered**: judges may test in the ChatGPT desktop browser where wallet extensions may not install — **watch-only audit mode for any pasted address is mandatory**, and the wallet-popup signing moment must carry in the video. Binds [Final tool surface and schemas](T07-final-tool-surface.md) and [Demo arc and burner wallet plan](T08-demo-arc.md).
