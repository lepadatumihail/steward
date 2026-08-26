---
id: T10
title: Injection-defense design
type: grilling
status: open
assignee:
blocked-by: [T01, T02]
---

## Question

On-chain metadata (token names, symbols) is attacker-controlled text that flows into the agent's context through tool results — a real prompt-injection vector and Steward's signature security feature. Design it:

- The quarantine convention inside tool outputs (wrapping/flagging format the consuming agent reliably treats as data, not instructions), aligned with whatever the official security guidance in [WebMCP platform facts](T02-webmcp-platform-facts.md) recommends.
- What the UI renders for quarantined strings (visible "untrusted" treatment).
- How it's demonstrated in 20 seconds of video and one paragraph of submission text.

Resolution defines an interface contract [Final tool surface and schemas](T07-final-tool-surface.md) must honor in every read tool.
