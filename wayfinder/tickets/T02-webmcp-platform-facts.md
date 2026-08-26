---
id: T02
title: WebMCP platform facts
type: research
status: open
assignee: claude (research agent, fired 2026-08-26)
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
