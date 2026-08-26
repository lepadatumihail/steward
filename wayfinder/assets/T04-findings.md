# T04 — Challenge field scan (what the other ~1,485 entrants are visibly building)

Scanned 2026-08-26. Challenge: The WebMCP Challenge, webmcp.devpost.com — run by OpenAI with Google Chrome, Cloudflare, Shopify, Vercel, Render, Netlify. 1,485 registered participants, $35k pool, top-10 winners, deadline Sep 3 1pm PT, winners Sep 23. The 10-day window opened ~Aug 24, which is why nearly every entry repo below was created Aug 25–26.

**Judging criterion we're positioning for (verbatim from webmcp.devpost.com):** *Creativity & Ambition — "How creative and novel is the concept and does the project differ from existing concepts?"* The other three: WebMCP Leverage, Execution ("a complete, coherent product experience — not just a technical proof of concept"), Potential Impact ("a real problem for a real audience").

## Method + coverage caveat

- GitHub is effectively the only visibility surface right now. Devpost's project gallery says "The hackathon managers haven't published this gallery yet" (checked live), the Updates tab is empty ("Stay tuned"), the Devpost forum has exactly 2 threads (both logistics: private-repo deps, submission limit), and the OpenAI community announcement thread (community.openai.com/t/the-webmcp-challenge-is-here/1392582) has zero replies describing projects. X/Reddit/HN indexed chatter about entries is near-nil — HN Algolia: 0 comments matching "webmcp challenge"; Reddit search surfaced nothing challenge-specific.
- GitHub API sweeps (unauthenticated, 2026-08-26): `webmcp created:>2026-08-01` → **170 repos**; `topic:webmcp` → 206 all-time; `"navigator.modelContext"` repo search → 15. So ~170 of 1,485 participants (~11%) are visible. Winners could come from the invisible 89% — treat every "empty lane" below as *empty among visible entries*.
- Keyword probes for the crypto question: `webmcp wallet`=1, `webmcp crypto`=1, `webmcp web3`=0, `webmcp defi`=1 (all three hits are the same repo), `webmcp revoke`=0, `webmcp ethereum`=0, `webmcp solana`=0, `webmcp blockchain`=0.

## Field summary

Categorized from the 170 challenge-window repos (created since Aug 1; the Aug 24–26 burst is the entry cohort). Counts are approximate — descriptions overlap categories.

| Category | ~Count | Representative entries (all github.com/...) |
|---|---|---|
| Commerce / storefront / booking / marketplace | ~17 | farhanmunshi-ops/webmcp-merchant-kit (Shopify B2B quote desk), Somnora/agentic-webmcp, vpesh/yurinox-webmcp-storefront, michielhdoteth/deal-floor (agent-vs-agent negotiation), raintree-technology/flightsweeper-webmcp (bounded flight purchasing), robertonevarez/schedulemcp, davidvkimball/webmcp-frontdesk (plumbing biz), 3× coffee/espresso stores |
| **HITL / approval / audit / consent as the headline framing** | **~30** | jianwang-ntu/sieve-webmcp ("may propose… may never enact"), lsh2546/proofboard-webmcp ("agents investigate, humans decide"), pakorn269/reviewline-webmcp, rookepoole/runbook-zero, 488315/frameguard, upgradedev/claimready ("Filing stays a human-only button"), Citability/autopilot (four-tier permission kernel), BruinGrowly/PSCS-SecureOps, markneville/trusted-webmcp-actions, guyle/webmcp-sentinel, run58669-maker/agentgate-webmcp, ArkaPrabhaChowdhury/webmcp-observatory, calgulbenkian/tallow (tool-call budget), AGENTROPOLIS-…/AGENTROPOLIS-WEBMCP-CHALLENGE |
| Dev tooling / "make your site agent-ready" infra | ~25 | alpic-ai/webmcp (10★), nekuda-ai/webmcp-kit, hatimshahera/Descuff, webmcpify ×2, webmcp-factory, ForkPoint/agent-lighthouse (16★), Citability/webmcp-lab ("Lighthouse for WebMCP"), zioladev suite (6 repos), framework bindings: svelte/vue/flutter/django/rails/go/rust/TYPO3/Joomla/WordPress ×3 |
| Creative studios & workbenches | ~14 | amit-00/agent-daw + opendaw-webmcp (music), arjunkshah12345-hash/slate (directing), aditya226-sharma/pixel-palette (design systems), jongan69/RoarCAD (PCB), Tactic-Systems/leafwright-paperdesk (self-fixing PDFs), Flexasaurusrex/match-cut (music-video archive), SebastianBoehler/webmcp-structural-evolution (WebGPU) |
| Games & co-op play | ~10 | morcoan/crosstalk (human sees bomb, agent holds manual), yaboijbigs/mcpencil (draw-and-guess), Doge-is-Dope/can-you-be-me (detective party game), LIghtJUNction/go.lmm.best, adamblumoff/agent-flight-sim, YesterdaysLemon/conspiracy (noir evidence board) |
| Personal / local productivity | ~8 | g1mliii/pantryos, JordanCoin/swtpa-agent-study, pathofleastresistor/polr-webmcp-workout, 2× astrology, hopesong.ai (spiritual companion) |
| Fintech-adjacent, **non-crypto** | ~6 | BuFi007/bufi-webmcp (invoices/reimbursements), SetiZ/e-nvoice (Factur-X invoices), upgradedev/claimready (insurance FNOL), US1929/switchai (energy tariffs), SnitterDK/prizepilot-webmcp (funding applications) |
| Ops / incident / SRE | ~6 | runbook-zero, reviewline, michalej/traceforge (debugging), hkaiser155/architecture-war-room |
| Education / civic / community | ~6 | asub927/inquiry-island (K-5), JEROME-PRAKASH-L/community-tool-library-webmcp, TechDev009/commonground-webmcp (neighborhood planning), coreyhiggins/accesspath |
| Security *meta*-tooling (audits WebMCP itself) | ~7 | ElonMusk2002/webmcp-scanner (flags IDOR/prompt-injection/missing consent in page tools), munzzyy/webmcp-lint + webmcp-devtools, SARTHAK2511/webmcp-guard (trust-layer proxy), realArcherL/WebMCP-Security-Testing, simoneonofri/threat-model-webmcp (W3C security lead's threat model — good citation for our own threat framing) |
| **Crypto / wallet / web3** | **0 entries** | see next section |

**Sponsor baseline ("already done, unimpressive"):** GoogleChromeLabs/webmcp-tools (498★) ships 15 polished demos — travel/flight search, restaurant reservations, pizza ordering, movie tickets, hotel booking, order tracking/returns, 3 e-commerce storefronts incl. "The Morning Ritual" coffee shop, real estate maps, smart home, maze game, plus Inspector extension/evals/polyfill. Cloudflare: React starter on Workers (webmcp-challenge.examples.workers.dev) + "Give any website a WebMCP interface" (blog.cloudflare.com/webmcp/). Netlify: 5 demos — Kurio marketplace, Tagboard guestbook, Mabel's Table reservations, The Archive mystery game, WebMCP Starter (netlify.com/blog/compete-openai-webmcp-challenge/). Shopify: WebMCP tools built into storefronts (entrants extend them). Vercel: AI SDK + credits; no dedicated WebMCP storefront repo found (the ticket's "Vercel storefront" appears to be a conflation — the storefront demos are Chrome's and Netlify's). OpenAI's own inspiration list (openai.com/webmcp-challenge/, via search snippets — page 403s to fetchers): build 3D models with your agent, shared writing doc with agent comments, personalized crossword, travel-notes → itinerary. **Anything resembling these or the sponsor demos starts the Creativity criterion at zero.**

## Saturated vs empty lanes

**Saturated:**
1. **Commerce/booking** — the most saturated *domain*: ~17 entries stacked on ~20 sponsor demos. A storefront cart is the "hello world" of WebMCP.
2. **Human-in-the-loop as a slogan** — the most saturated *framing*. ~30 visible entries lead with propose-don't-enact / approve-before-execute / evidence-first. By judging day, "the agent proposes, the human approves" will read as table stakes, **not** as differentiation. Steward must not pitch HITL as the novelty itself.
3. **Agent-readiness dev tooling** — third crowded lane; also lower-scoring on "complete product experience" per the Execution criterion, but numerous.
4. **Co-op games and creative studios** — OpenAI's own inspiration list points here; expect a pile of shared-canvas/crossword/itinerary entries from the invisible 89% too.

**Empty (among visible entries):**
1. **Crypto/wallets — completely empty** (see below). Zero entries, zero repos matching webmcp×{revoke, ethereum, solana, blockchain, web3}.
2. **Real irreversible financial stakes** — closest anyone gets is flightsweeper's "bounded autonomous purchasing" and sentinel's *seeded* deployment scenarios. Nobody demos on a surface where a wrong signature loses real money.
3. **Externally-enforced confirmation** — every visible HITL entry implements approval as an in-page modal or app-level token, i.e. the same page that registers the tools also renders the consent UI. None uses a consent surface the page *cannot* draw or bypass (a wallet popup is exactly that).
4. **Injection quarantine of third-party data** — webmcp-scanner lints *tool schemas* for injection risk; nobody visibly treats untrusted *content* flowing into the agent (token names, metadata, third-party text) as a quarantined data plane.

## Visible crypto entries

**None in the challenge.** The only crypto×WebMCP repo on all of GitHub is **Dev43/pliromi** (AI store/treasury, multi-chain wallets, x402 payments, Lulo DeFi) — created *and last pushed 2026-04-03*, dormant, pre-challenge, not an entry. Piquant detail: several visibly crypto-native entrants chose non-crypto projects — michielhdoteth (.eth) built a deal marketplace, Doge-is-Dope built a party game, jongan69 (Solana dev) built PCB CAD, BuFi007 (web3 payments org) built invoice workflows. Wallet hygiene / approval revoking: **zero matches**; nothing resembling revoke.cash-as-agent-surface exists in the field.

**Closest architectural neighbors to watch (not crypto, but same safety patterns):**
- **guyle/webmcp-sentinel** — server-enforced *prepare → human review → approve → execute* with SHA-256 binding between what was approved and what runs. Same staged-action skeleton as Steward, but a self-described "security reference implementation" on seeded DevOps scenarios, not a consumer product.
- **run58669-maker/agentgate-webmcp** — generic protocol layer: read/write/irreversible risk tiers, structured receipts, `request_human()` single-use tokens.
- **ArkaPrabhaChowdhury/webmcp-observatory** — inspect/audit/execute/replay WebMCP tools with explicit approval; a protocol lab, not a domain app.
- **markneville/trusted-webmcp-actions** — short-lived human "mandates" scoping consequential actions (traffic-shift demo, explicitly seeded).
- **ElonMusk2002/webmcp-scanner** — the only prompt-injection-aware entry; it lints tools, it doesn't quarantine data.

If a judge has seen these, the counter is: they all demonstrate the safety *pattern* on toy state inside their own page; Steward runs the pattern against a live wallet where the stakes, the audit data, and the final confirmation surface are all real and external.

## Draft differentiation paragraph (for the submission's Creativity & Ambition section)

> Most WebMCP demos hand an agent a shopping cart. Steward hands it something riskier — a live crypto wallet — and shows that the human-agent trust problem can be solved even there. Steward is not "revoke.cash with a chatbot": token-approval revoking has existed as a button for years, and the button was never the hard part. The hard part is that the people most exposed to approval drain-risk can't read an allowance table, and the agents that could read it for them can't be trusted to touch it. Steward is the collaboration layer between those two facts. The agent runs a conversational audit → explain → fix loop over the wallet's real approval surface — it finds the dangerous allowance, explains *why* it's dangerous in plain language, and stages the exact fix. But every state-changing action is a staged transaction that dead-ends at the wallet popup: the human confirms real calldata in a consent surface the web page cannot render, spoof, or bypass — a categorically stronger human-in-the-loop guarantee than the in-page approve/deny modals common in agent demos, because the enforcement lives outside the app entirely. And because wallet data is adversarial by design — scam tokens ship instructions in their own names — Steward quarantines all third-party content (token names, metadata, addresses) as untrusted data the agent can inspect but never obey. Existing tools give you a revoke button; existing agents give you autonomy without guarantees. Steward's contribution is the third thing: an agent that can *investigate* freely, *explain* everything, and *execute* nothing — on a surface where mistakes are irreversible and the confirmation boundary is enforced by the wallet, not by our own honor system.

*(Tuning note: if the submission form has a separate "what makes it different" field, lead with the wallet-popup-as-external-enforcement point — it is the one claim no visible competitor can copy by Sep 3, because it falls out of the domain choice, not the feature list.)*

## Risks & open questions

1. **Biggest overlap risk:** the HITL framing itself. ~30 entries pitch propose/approve/execute; judges will be numb to it. Sentinel's SHA-256-bound approvals are the strongest look-alike. Mitigation: never lead with "human in the loop"; lead with "live wallet, external enforcement, adversarial data."
2. **Judge-environment risk:** OpenAI is adding WebMCP support to the ChatGPT desktop browser and ChatGPT Sites (x.com/OpenAIDevs/status/2092344959248761263). If judges test there, a wallet *extension* may not be installable — Steward needs a demo path that still lands: watch-only audit mode for any address (audit → explain works with zero wallet), plus the recorded 3-min video showing the full staged-tx + popup flow in Chrome. The mandatory video (per official rules) is where the popup moment must live.
3. **Invisible 89%:** only ~170 of 1,485 registrants have public repos; the gallery unlocks after Sep 3. A stealth crypto entry can't be ruled out — but with `webmcp×{wallet,revoke,ethereum,solana}` at zero on all of GitHub, the prior is strongly in our favor.
4. Devpost forum/updates are dead channels; there is no visible place entrants coordinate. Nothing to monitor there before deadline except the gallery unlock.

## Sources

- Devpost overview, criteria, participant count, forum, updates, gallery: https://webmcp.devpost.com/ (+ /updates, /forum_topics, /project-gallery — checked live in browser 2026-08-26)
- OpenAI landing (example ideas; 403s to fetchers, content via indexed snippets): https://openai.com/webmcp-challenge/ ; announcement thread: https://community.openai.com/t/the-webmcp-challenge-is-here/1392582 ; @OpenAIDevs: https://x.com/OpenAIDevs/status/2092344873764704345 and https://x.com/OpenAIDevs/status/2092344959248761263
- GitHub API searches (unauth, 2026-08-26): `webmcp created:>2026-08-01` (170), `topic:webmcp` (206), `"navigator.modelContext"` (15), keyword probes as listed above; all repos cited inline as github.com/{owner}/{repo}
- Sponsor baselines: https://github.com/GoogleChromeLabs/webmcp-tools ; https://webmcp-challenge.examples.workers.dev/ ; https://blog.cloudflare.com/webmcp/ ; https://www.netlify.com/blog/compete-openai-webmcp-challenge/
- HN: Algolia API — "webmcp" stories (top: "WebMCP is available for early preview", 360 pts, 2026-03-01); "webmcp challenge" comments: 0 hits
