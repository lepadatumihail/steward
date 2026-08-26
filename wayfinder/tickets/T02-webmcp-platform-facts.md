---
id: T02
title: WebMCP platform facts
type: research
status: closed
assignee: claude (research agent) — resolved 2026-08-26
blocked-by: []
---

## Question

What is the actual WebMCP developer surface today (late Aug 2026)? Specifically:

- Exact JS API shape (`navigator.modelContext`, `registerTool` / `provideContext`, lifecycle, dynamic registration after wallet-connect).
- Chrome 149+ `#enable-webmcp-testing` flag behavior and origin-trial status; anything version-gated.
- ChatGPT browser (Atlas) support specifics: how tools are discovered/invoked, plan-tier requirements, macOS-only caveats.
- The React integration listed in the challenge resources (exact npm package name, maturity, API) — and whether hand-rolling a thin wrapper is safer/better for "implementation depth" scoring.
- Schema support and tool annotations (read-only hints? confirmation/elicitation patterns? structured results?).
- Official security guidance on prompt injection and trust boundaries (the challenge links one — what does it actually recommend?).
- Testing/eval tooling ("test your WebMCP tools before you ship") and DevTools inspection of registered tools.

Sources: `webmachinelearning/webmcp` (spec + explainers), developer.chrome.com/docs/ai/webmcp, the challenge Resources page (webmcp.devpost.com/resources), GoogleChromeLabs/webmcp-tools, Chrome origin-trial blog post.

Findings → `wayfinder/assets/T02-findings.md`.

## Resolution (2026-08-26)

Full findings in [T02-findings.md](../assets/T02-findings.md). The facts that bind downstream tickets:

- **API**: `document.modelContext` (moved off `navigator` May 27 2026). `provideContext()` and `unregisterTool()` are gone — register with `registerTool(tool, {signal})` + `AbortController` (ideal for wallet-connect-scoped tools); `toolchange` event fires on changes. The Devpost rules themselves require `document.modelContext.registerTool()`. Most pre-May sample code is stale — copy nothing from blogs.
- **Descriptor**: `{name, description, inputSchema, execute, annotations: {readOnlyHint, untrustedContentHint}}`; emit the MCP `{content:[{type:"text",...}]}` envelope explicitly.
- **Browsers**: Chrome 149+ behind the flag or origin trial; Edge 150 OT. Chrome DevTools has an Application → WebMCP panel with manual "Run tool" — demo-video gold. **Atlas was shut down Aug 9 2026**: "ChatGPT's in-app browser" now means the ChatGPT **desktop app's** built-in browser — WebMCP on by default since Aug 25, macOS + Windows, tool-invoking models are GPT-5.6 Sol/Terra only, Enterprise/Edu excluded; per-invocation safety review; "Site tools" address-bar inspector.
- **Hook verdict**: hand-roll a thin wrapper mirroring GoogleChromeLabs' `use-webmcp-tool` (v0.2.0) API — scores better on WebMCP Leverage and lets the wrapper centrally enforce Steward's quarantine envelope. Avoid `@mcp-b/react-webmcp` (non-standard transport ecosystem).
- **Security**: `untrustedContentHint: true` (shipped since 149.0.7810.0) is the standard's own mechanism for attacker-controlled strings; Chrome's agent-security doc mandates "spotlighting" — Steward sets the hint **and** self-delimits quarantined on-chain strings.
- **Do not build on `requestUserInteraction()`** — in the spec narrative but implementation status undocumented (issues #165/#50 open). Writes go behind Steward's own in-page confirm UI; reads carry `readOnlyHint` (agents assume mutation otherwise).
- **Schema limits**: tool name ≤30 chars recommended (128 hard, charset `[A-Za-z0-9_.-]`), description ≤500, param descriptions ≤150, tool output ≤1.5K chars — quarantined payloads must truncate/summarize.
- **Testing**: `webmcp-evals` CLI (local/Puppeteer/smoke modes, `expectedCall` matchers) — run an adversarial injection eval and cite it in the submission → spawned [Adversarial eval run with webmcp-evals](T13-adversarial-eval.md).
- No showstoppers. Risks: stale-API copy-paste, `requestUserInteraction` reliance, ChatGPT free-tier invocation untested (verify early in [Verify Steward in ChatGPT's browser and Chrome](T06-verify-atlas-chrome.md); keep a Plus account on hand for the video).
