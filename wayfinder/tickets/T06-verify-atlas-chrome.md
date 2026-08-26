---
id: T06
title: Verify Steward in ChatGPT's browser and Chrome
type: task
status: open
assignee:
blocked-by: [T05]
---

## Question

Against a deployed (or tunneled) URL, confirm registered tools are discovered and callable from both target browsers — per [WebMCP platform facts](T02-webmcp-platform-facts.md) these are the **ChatGPT desktop app's built-in browser** (WebMCP default-on since Aug 25 2026; Atlas no longer exists) and **Chrome 149+** with `#enable-webmcp-testing` (or an origin-trial token on the deployed origin).

Verify and document everything that constrains design:

- ChatGPT side: which of the human's plan tiers/models can actually invoke tools (docs gate by model — GPT-5.6 Sol/Terra; free tier untested), the per-invocation safety review UX, what the "Site tools" address-bar inspector shows for Steward.
- Chrome side: DevTools Application → WebMCP panel listing + manual "Run tool", flag vs origin-trial behavior on the deployed origin.
- Differences that bind [Final tool surface and schemas](T07-final-tool-surface.md) and [Demo arc and burner wallet plan](T08-demo-arc.md): tool naming/schema handling, how each browser surfaces calls to the human, session behavior across wallet connect (`AbortController` re-registration).

HITL portion: needs the human's ChatGPT account in the desktop app (plan tier per [Lock the thesis and scope of Steward](T01-lock-the-thesis.md)). Resolution records the compatibility matrix.
