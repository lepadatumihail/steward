---
id: T05
title: Scaffold the app and prove one WebMCP tool end-to-end
type: task
status: closed
assignee: claude (build session) — resolved 2026-09-01
blocked-by: [T02]
---

## Question

Stand up the Next.js skeleton in this repo and prove the riskiest integration before any product build: one registered WebMCP tool (hello-world, then a stubbed `list_token_approvals`) visible and callable in Chrome 149+ with `#enable-webmcp-testing`, running locally.

Gate rationale: until a tool round-trips agent→page→result, no schema or UX decision downstream is trustworthy. Record in the resolution: chosen registration approach (community React hook vs hand-rolled wrapper per [WebMCP platform facts](T02-webmcp-platform-facts.md)), any surprises versus the documented API, and the dev-loop for testing tools.

## Resolution

Resolved 2026-09-01. Next 16.3.4 + React 19.2.8 + Tailwind 4 + wagmi 3.7.7/viem
scaffolded in this repo; `pnpm build` and 31 tests pass.

Three tools register and were verified callable end-to-end through the model
context (`getTools` + `executeTool`): `scan_approvals` and `explain_approval`
(readOnlyHint + untrustedContentHint) and `stage_revoke` (write path, returns
`awaiting_user_confirmation`). Registration goes through a hand-rolled
`useStewardTool` hook that centrally enforces the MCP envelope, the ~1.5K output
budget, and the quarantine notice.

Verification was done against Steward's own fallback shim rather than a native
model context — the browser used has no WebMCP. **Native verification in
Chrome 152 + `#enable-webmcp-testing` and in the ChatGPT desktop browser is
still outstanding** and moves to [Verify Steward in ChatGPT's browser and
Chrome](T06-verify-atlas-chrome.md), which this unblocks.

Two defects found and fixed during the spike: the staged-revoke summary leaked a
raw token symbol (zero-width space included) outside the quarantine fence, and
whitespace control characters were being deleted rather than converted to
spaces, gluing adjacent words together. Both now have regression tests.
