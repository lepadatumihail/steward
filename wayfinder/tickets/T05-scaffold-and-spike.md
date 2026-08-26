---
id: T05
title: Scaffold the app and prove one WebMCP tool end-to-end
type: task
status: open
assignee:
blocked-by: [T02]
---

## Question

Stand up the Next.js skeleton in this repo and prove the riskiest integration before any product build: one registered WebMCP tool (hello-world, then a stubbed `list_token_approvals`) visible and callable in Chrome 149+ with `#enable-webmcp-testing`, running locally.

Gate rationale: until a tool round-trips agent→page→result, no schema or UX decision downstream is trustworthy. Record in the resolution: chosen registration approach (community React hook vs hand-rolled wrapper per [WebMCP platform facts](T02-webmcp-platform-facts.md)), any surprises versus the documented API, and the dev-loop for testing tools.
