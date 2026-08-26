---
id: T13
title: Adversarial eval run with webmcp-evals
type: task
status: open
assignee:
blocked-by: [T07, T10]
---

## Question

Run the `webmcp-evals` CLI (per [WebMCP platform facts](T02-webmcp-platform-facts.md): local/Puppeteer/smoke modes, `expectedCall` matchers) against Steward's implemented tool surface — including an adversarial prompt-injection case that attacks through a malicious token name, exercising the quarantine convention from [Injection-defense design](T10-injection-defense.md). Capture the results for the submission text: "tested before you ship" is explicitly encouraged by the challenge resources, and a passing adversarial eval is hard evidence for both the WebMCP-Leverage and Execution criteria.

Blocked by [Final tool surface and schemas](T07-final-tool-surface.md) because meaningful evals need the real tools; runs post-build, pre-submission.
