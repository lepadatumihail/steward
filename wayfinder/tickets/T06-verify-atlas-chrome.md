---
id: T06
title: Verify Steward in ChatGPT's browser and Chrome
type: task
status: open
assignee:
blocked-by: [T05]
---

## Question

Against a deployed (or tunneled) URL, confirm registered tools are discovered and callable from both target browsers: ChatGPT's browser (Atlas, macOS) and Chrome 149+ with the flag. Document every behavioral difference that constrains design — tool naming limits, schema handling, how each browser surfaces tool calls to the human, confirmation UX, session behavior after wallet-connect.

HITL portion: needs the human's ChatGPT account on Atlas (plan tier per [Lock the thesis and scope of Steward](T01-lock-the-thesis.md)). Resolution records the compatibility matrix that [Final tool surface and schemas](T07-final-tool-surface.md) and [Demo arc and burner wallet plan](T08-demo-arc.md) must respect.
