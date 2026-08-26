# T02 — WebMCP platform facts (researched 2026-08-26)

Scope: the actual WebMCP developer surface as of late August 2026, for Steward's WebMCP Challenge entry (deadline Sep 3, 2026, 1:00pm PDT). All claims sourced inline; conflicts flagged explicitly.

---

## Recommendations for Steward

1. **Code against `document.modelContext`, not `navigator.modelContext`.** The spec moved the getter from Navigator to Document on 2026-05-27; Chrome keeps `navigator.modelContext` as a deprecated alias (deprecation warning as of Chrome 150), and the challenge rules themselves specify `document.modelContext.registerTool()`. Feature-detect exactly the way OpenAI's docs do: `if (typeof document.modelContext?.registerTool === "function")`. A safe belt-and-suspenders accessor: `const mc = document.modelContext ?? navigator.modelContext`. Do NOT use `provideContext()` — removed from the spec 2026-03-05. Do NOT use `unregisterTool()` — removed 2026-04-23 in favor of `registerTool(tool, { signal })` + `AbortController`.
2. **Hook verdict: hand-roll a thin wrapper (~50–80 lines), don't depend on `use-webmcp-tool`.** The official-adjacent hook exists (`use-webmcp-tool`, GoogleChromeLabs, by Sarah Drasner, v0.2.0, 2026-07-30, ~6.9k downloads/month) and is good prior art, but it's a 0.x three-release package, and the #1 judging criterion is "WebMCP Leverage — does the code reflect genuine effort and a working, non-trivial implementation?" A hand-rolled `useStewardTool` hook mirroring its API (`{name, description, inputSchema, annotations, execute, enabled}` → `{supported, registered, error}`) lets Steward centrally inject its quarantine envelope + `untrustedContentHint` on every tool result — that IS the implementation-depth story. Credit `use-webmcp-tool` as prior art in the README.
3. **Naming/schema constraints that should shape Steward's tools** (from Chrome's security guide, hard limits from the official polyfill):
   - Tool name charset: alphanumeric + `_` `-` `.`, 1–128 chars (polyfill hard-validates); security guidance recommends ≤30 chars. Use verb-led names that distinguish executing from initiating (`check_approval` executes; `start_revoke_flow` opens UI).
   - Description ≤500 chars; each parameter description ≤150 chars; tool output ≤1.5K chars (guardrail budgets from Chrome's secure-tools doc). Steward's quarantined on-chain strings must fit inside 1.5K-char outputs — summarize/truncate quarantined payloads.
   - JSON Schema for `inputSchema`; "validate strictly in code, loosely in schema" (schema constraints are not guaranteed to be enforced by the agent); use natural-language enum values (`network="Ethereum"` not `chain_id=1`); accept raw user phrasing; return descriptive errors so the model can self-correct.
   - Unique names required (Angular throws on duplicates; polyfill dedupes) — namespace Steward tools, e.g. `steward.scan_approvals` or `scan_wallet_approvals`.
4. **Annotations are the security surface — use both:** `annotations: { readOnlyHint: true }` on every read tool (agents skip confirmation for read-only and *assume state mutation otherwise*), and `annotations: { untrustedContentHint: true }` on every tool whose output embeds attacker-controlled on-chain strings (token names, spender labels, memos). `untrustedContentHint` ships in Chrome since 149.0.7810.0 and Chrome's agent-security doc commits agents to "spotlighting" (delimiting/Base64) such outputs. This is a direct, citable standard-level endorsement of Steward's quarantine feature — lean on it in the write-up.
5. **Confirmation pattern:** don't build on `requestUserInteraction()` — it exists in the spec narrative (secure-tools doc mentions it; the original proposal showed `agent.requestUserInteraction(async () => …)`) but its implementation status in the Chrome 149 OT is undocumented and the spec issues (#165, #50) are still open. Instead: (a) never execute a write directly from a tool — have the write tool *stage* the action and surface Steward's own in-page confirmation UI, returning "Prepared X; user must confirm in page"; (b) mark reads `readOnlyHint: true` so agent-side confirmation policy does the rest (ChatGPT runs "a safety review before each tool invocation" and applies confirmation policies to consequential actions). This two-layer design is exactly what both security docs recommend.
6. **Dynamic registration on wallet connect is fully supported and idiomatic:** register connection-scoped tools with an `AbortController` signal, `controller.abort()` on disconnect; a `toolchange` event fires on the model context when the tool list changes. Chrome's best-practices doc: use `registerTool` to dynamically manage registration (default to static registration where possible).
7. **Test matrix for judging:** judges use (1) the **ChatGPT desktop app's built-in browser** (WebMCP on by default; models GPT-5.6 Sol or Terra — Luna has WebMCP disabled; macOS *and* Windows; not Enterprise/Edu workspaces) and (2) **Chrome 149+** with `chrome://flags/#enable-webmcp-testing`. Verify in both. Use Chrome DevTools → Application → WebMCP panel (manual "Run tool", invocation log, schema-violation surfacing) and the ChatGPT address-bar "Site tools" panel for the demo video. Run `webmcp-evals` (GoogleChromeLabs) suites and mention it in the submission — "test before you ship" is documented tooling the judges' own docs point to.
8. **Traps to avoid:** (a) `https://webmachinelearning.github.io/webmcp/docs/proposal.html` is a *stale Aug-2025 snapshot* still showing `navigator.modelContext.provideContext` — don't copy from it, and expect most pre-May-2026 blog posts to be wrong; (b) "Atlas" no longer exists — it shut down 2026-08-09 and its browser/agent moved into the ChatGPT desktop app; say "ChatGPT's in-app browser" in the submission; (c) `@mcp-b/react-webmcp` is a different, non-standard transport ecosystem — not the browser-native API; don't confuse the two in dependencies or docs.

---

## 1. The JS API surface (spec + what actually ships)

Primary sources: spec repo [github.com/webmachinelearning/webmcp](https://github.com/webmachinelearning/webmcp) (3.2k stars; spec in `index.bs`; maintained by Dominic Farolino, originally authored by Microsoft Edge + Google Chrome engineers, first published 2025-08-13), Chrome docs [developer.chrome.com/docs/ai/webmcp](https://developer.chrome.com/docs/ai/webmcp), official polyfill [`demos/shared/webmcp-polyfill.js`](https://github.com/GoogleChromeLabs/webmcp-tools/blob/main/demos/shared/webmcp-polyfill.js).

### API history (why examples on the web disagree)

| Date | Change |
|---|---|
| 2025-08 | Original explainer: `window.agent.provideContext({tools})` → early revisions: `navigator.modelContext` with `provideContext()` (bulk, replace-all) + `registerTool()` (incremental) |
| 2026-03-05 | `provideContext()` / `clearContext()` **removed** from spec (context now belongs in tool descriptions, which agents re-read each turn) |
| 2026-04-23 | `unregisterTool(name)` **removed**; unregistration = `AbortSignal` passed to `registerTool(tool, {signal})` |
| 2026-05-27 | Getter moved **Navigator → Document**: `document.modelContext` canonical; `navigator.modelContext` kept as deprecated alias (Chrome deprecation warning from 150.0.7861.0) |

Sources: [@mcp-b/webmcp-polyfill changelog notes](https://www.npmjs.com/package/@mcp-b/webmcp-polyfill), [angular/angular#68947 "move WebMCP from navigator to document API"](https://github.com/angular/angular/issues/68947), [webmachinelearning/webmcp#101](https://github.com/webmachinelearning/webmcp/issues/101), [docs.mcp-b.ai/changelog](https://docs.mcp-b.ai/changelog). The challenge rules ([webmcp.devpost.com/rules](https://webmcp.devpost.com/rules)) require registration "structured as `document.modelContext.registerTool()`".

### Current API (verbatim from the spec README, [github.com/webmachinelearning/webmcp](https://github.com/webmachinelearning/webmcp))

```js
await document.modelContext.registerTool({
  name: "add-todo",
  description: "Add a new item to the user's active todo list",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string",
              description: "The text content of the todo item" }
    },
    required: ["text"]
  },
  async execute({ text }) {
    await addTodoItemToCollection(text);
    return {
      content: [{
        type: "text",
        text: `Added todo item: "${text}" successfully.`
      }]
    };
  }
}, { signal: controller.signal });
```

Chrome's imperative-API doc ([developer.chrome.com/docs/ai/webmcp/imperative-api](https://developer.chrome.com/docs/ai/webmcp/imperative-api)) — note bare-string return and `enum` usage:

```js
await document.modelContext.registerTool({
  name: 'toggle_layer',
  description: 'Control pizza layers (sauce, cheese). Use "add", "remove", or "toggle".',
  inputSchema: {
    type: 'object',
    properties: {
      layer: { type: 'string', enum: ['sauce-layer', 'cheese-layer'] },
      action: { type: 'string', enum: ['add', 'remove', 'toggle'] },
    },
    required: ['layer'],
  },
  execute: async ({ layer, action }) => {
    await toggleLayer(layer, action);
    return `Performed ${action || 'toggle'} on layer: ${layer}`;
  },
});
```

**Tool descriptor fields:** `name` (required), `description` (required), `inputSchema` (JSON Schema object), `execute` (async callback; receives parsed args, plus an AbortSignal for cancellation), `annotations` (optional: `readOnlyHint`, `untrustedContentHint`). `outputSchema` appears in Google's demo code (react-flightsearch) and in open spec issues (#9, #92) but is **not** a documented Chrome descriptor field — treat as optional/likely-ignored; safe to include, don't rely on it.

**Other methods (spec + polyfill):**
- `getTools(options)` — discovery; alphabetical; `{ fromOrigins: [...] }` for cross-origin.
- `executeTool(tool, args, { signal })` — agent-side invocation (also usable page-side for self-testing).
- `document.modelContext.addEventListener("toolchange", cb)` — fires when the tool list changes.
- Cross-origin: register with `{ exposedTo: ["https://trusted-partner.example"] }`; iframes need `allow="tools"` Permissions Policy. Default policy: `self`. API only in origin-isolated documents (disabled if `document.domain` is set).

**Unregistration / dynamic lifecycle (verbatim pattern, Chrome docs):**

```js
const controller = new AbortController();
await document.modelContext.registerTool(walletTool, { signal: controller.signal });
// on wallet disconnect / route change:
controller.abort(); // unregisters without breaking in-flight executions
```

**Return value format — minor ambiguity, flagged:** the spec's canonical result is the MCP-style envelope `{ content: [{ type: "text", text }] }`; Chrome's own docs return a bare string; OpenAI's docs return a bare object (`execute: async () => ({ result: "data" })`). Implementations normalize (the React hook advertises "MCP result normalization"). **Safest:** always return the canonical `{content:[{type:"text",text}]}` envelope explicitly — it's what every surface accepts, and it gives Steward a single choke-point to wrap quarantined strings.

**Declarative API** (secondary, Chrome): `<form toolname="…" tooldescription="…">` with per-field `toolparamdescription` and optional `toolautosubmit`; browser derives the JSON Schema from form fields ([developer.chrome.com/docs/ai/webmcp/declarative-api](https://developer.chrome.com/docs/ai/webmcp/declarative-api)). Not recommended as Steward's primary mechanism (imperative gives structured results + annotations), but a cheap add for one form could demonstrate breadth.

---

## 2. Chrome support

- **Chrome 149+**: enable `chrome://flags/#enable-webmcp-testing` → restart ([developer.chrome.com/docs/ai/webmcp](https://developer.chrome.com/docs/ai/webmcp)). This is the judges' documented Chrome path.
- **Origin trial** (for end users without the flag): register at [developer.chrome.com/origintrials/#/register_trial/4163014905550602241](https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241); OT announced in the blog post [developer.chrome.com/blog/ai-webmcp-origin-trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial) (published 2026-06-09). Standard OT token mechanics (meta tag `<meta http-equiv="origin-trial" content="TOKEN">` or `Origin-Trial` header); the blog notes usage limits exist for OT features. Worth adding the token to Steward's deploy so flag-less Chrome users aren't dark, but the *judging* path is flag/ChatGPT, so it's optional polish.
- **Edge 150**: origin trial riding the same Chromium support. **Brave**: experimental via Leo AI. **Firefox** (standards-position #1412) and **Safari/WebKit** (#670): under consideration, no implementation ([implementation-status.md](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)).
- **Feature-gates**: origin-isolated documents only; `tools` Permissions Policy defaults to `self`.
- **DevTools** ([developer.chrome.com/docs/devtools/application/webmcp](https://developer.chrome.com/docs/devtools/application/webmcp)): **Application → WebMCP** panel shows Available Tools (name, description, invocation counter), a chronological Invoked Tools log (status Completed/Canceled/In Progress/Error, input params, output), filtering by name/status/declarative-vs-imperative, and **manual execution** ("Run tool" with editable params — bypasses the agent). It surfaces schema violations when params/returns don't match declared schemas. Ideal for the demo video and for deterministic testing.
- **Inspector extension** (pre-DevTools option): [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) from [GoogleChromeLabs/webmcp-tools](https://github.com/GoogleChromeLabs/webmcp-tools).
- **Polyfill**: `demos/shared/webmcp-polyfill.js` installs `document.modelContext` (guarded by `if (window.document.modelContext) return;`), validates names (alphanumeric/underscore/hyphen/period, 1–128 chars), supports declarative forms, `postMessage` bridging for iframes, `toolchange` dispatch. Vendoring it makes Steward's tools *visible* in non-flag browsers (registration succeeds; only an agent can call them) — cheap resilience.

---

## 3. ChatGPT side (Atlas is dead; long live the ChatGPT in-app browser)

- **Atlas shut down 2026-08-09.** Launched macOS-only 2025-10-21; discontinuation announced ~2026-07-09; browser + agentic capabilities consolidated into the **ChatGPT desktop app** (multi-tab browser, downloads, logins) and Codex ([9to5mac](https://9to5mac.com/2026/07/09/openai-is-discontinuing-chatgpt-atlas-its-standalone-desktop-browser/), [techedt](https://www.techedt.com/chatgpt-atlas-to-shut-down-on-9-august-as-openai-moves-browser-features-into-chatgpt), OpenAI help article "Evolving Atlas into ChatGPT for browser-based agentic work"). Any challenge material saying "ChatGPT's in-app browser" means the desktop app's built-in browser.
- **WebMCP support announced 2026-08-25** for the ChatGPT desktop app's built-in browser and ChatGPT Sites: "When you visit a compatible website, ChatGPT or Codex can automatically use it to complete your task" ([OpenAIDevs on X](https://x.com/OpenAIDevs/status/2092344959248761263), [community announcement](https://community.openai.com/t/build-agent-ready-websites-with-chatgpt/1392588)). One day before this research — very fresh.
- **How discovery/invocation works** ([learn.chatgpt.com/docs/webmcp](https://learn.chatgpt.com/docs/webmcp), a.k.a. "Site tools"): ChatGPT detects `document.modelContext` tools when the page loads in the built-in browser; the agent works against the *live, signed-in session on the current page* (their stated contrast with server-side MCP). "The browser verifies each request before execution"; "each tool invocation receives a safety review before it runs"; standard confirmation policies apply to consequential actions (sending, purchases, deletion, permission changes). Users inspect/disable via the address bar **Site tools** panel (Available site tools, tool definitions, Recently used under Sources) and Settings > Browser > Permissions.
- **Requirements**: latest ChatGPT desktop app; **macOS and Windows both supported**; models **GPT-5.6 Sol or GPT-5.6 Terra** ("GPT-5.6 Luna currently has WebMCP disabled"); **not available in Enterprise or Edu workspaces**. No explicit paid-tier gate is documented for site-tools usage in normal chat; historical Atlas *agent mode* was Plus/Pro-tier, so have a Plus account on hand for the demo video. (Ambiguity flagged: free-tier behavior undocumented — test empirically once, early.)
- **Documented differences vs Chrome**: none at the API level beyond OpenAI deferring to "Chrome's developer guide for API details"; same `document.modelContext.registerTool` shape, same annotations. Differences are environmental: no flag needed, model-gated, per-invocation safety review, Site tools UI instead of DevTools.
- OpenAI's guidance to tool authors, verbatim: "keep inputs narrow, describe side effects, and return enough information to verify the result"; keep the normal interface functional for non-WebMCP browsers; integrate with existing authn/authz.

---

## 4. React (and Angular) integrations

### `use-webmcp-tool` — the one the challenge resources link
- npm: [npmjs.com/package/use-webmcp-tool](https://www.npmjs.com/package/use-webmcp-tool); repo: [github.com/GoogleChromeLabs/use-webmcp-tool](https://github.com/GoogleChromeLabs/use-webmcp-tool); author Sarah Drasner; Apache-2.0.
- Versions: 0.0.1 (2026-07-19), 0.1.0 (2026-07-22), **0.2.0 (2026-07-30, latest)**. Downloads: **6,886/month** (2026-07-27→08-25, api.npmjs.org). Peer dep: react ≥18. TS types shipped.
- API (from the README):

```ts
const { supported, registered, error } = useWebMCP({
  name, description,          // required
  inputSchema,                // JSON Schema (optional)
  annotations,                // ToolAnnotations (optional)
  execute,                    // required; may return string | object | MCP envelope
  enabled = true,             // conditional registration
  formatOutput,               // (result, args) => any (optional)
  onError,                    // (error) => void (optional)
});
```

- Sells itself as "lifecycle-managed registration and MCP result normalization" — i.e., register on mount/`enabled`, abort-unregister on unmount, wrap bare returns into MCP content.

### Alternatives (for completeness)
- **`@mcp-b/react-webmcp` v5.0.1** (WebMCP-org / Alex Nahas, [npm](https://www.npmjs.com/package/@mcp-b/react-webmcp)): mature-looking but it's the **MCP-B transport ecosystem** (zod + `@modelcontextprotocol/sdk` + extension transports), *not* the browser-native `document.modelContext` standard. Wrong dependency for this challenge.
- **`agentcathq/webmcp-react`** ([GitHub](https://github.com/agentcathq/webmcp-react)): community, "W3C spec-aligned, SSR-safe, Strict Mode safe" — a reasonable reference for edge cases (StrictMode double-effects, SSR guards) if hand-rolling.
- Google's own React demo (react-flightsearch in webmcp-tools) doesn't use a hook at all — plain tool modules + custom events into React state, with `outputSchema` and `readOnlyHint` on tools.

### Verdict (argued)
**Hand-roll a thin `useStewardTool` wrapper; mirror `useWebMCP`'s option shape.** Rationale: (1) judging criterion #1 rewards non-trivial implementation — a 0.x npm hook is the opposite signal; (2) Steward needs a central place to enforce its quarantine envelope, `untrustedContentHint`, output truncation to ≤1.5K chars, and `document`/`navigator` fallback — trivial in your own 60-line hook, awkward around someone else's `formatOutput`; (3) 0.x churn risk during judging week. Handle in the wrapper: register in `useEffect` with `AbortController` cleanup (StrictMode-safe: abort in cleanup, re-register on re-run), `supported` feature flag, stable deps via refs for `execute`.

### Angular (context only — Steward is React)
Native **experimental** support in Angular v22 (`@angular/core`, `@angular/forms/signals`): `provideExperimentalWebMcpTools([...])`, `declareExperimentalWebMcpTool()`, `provideExperimentalWebMcpForms()` for Signal Forms, `withExperimentalAutoCleanupInjectors()` for route-scoped unregistration. Same descriptor shape (`name/description/inputSchema/execute` returning `{content:[{type:'text',...}]}`); duplicate names throw. So "Angular's native support" claim is TRUE but experimental. Source: [angular.dev/ai/webmcp](https://angular.dev/ai/webmcp); migration to document-API tracked in [angular/angular#68947](https://github.com/angular/angular/issues/68947).

---

## 5. Schema and annotation capabilities

- **JSON Schema**: `inputSchema` is standard JSON Schema (`type: "object"`, `properties`, `required`, `enum`, `additionalProperties: false` in OpenAI's example). No documented dialect restriction; keep to core keywords (types, enums, required, descriptions) since agents *read* schemas more than they *validate* against them. Chrome best practices: "Validate strictly in code, loosely in schema" — schema enforcement is not guaranteed; return descriptive execution errors for model self-correction ([best-practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)).
- **Annotations** (both shipped in Chrome 149.x):
  - `readOnlyHint: true` — non-state-changing; lets "the agent make better decisions about when to ask for user confirmations". Chrome's agent-security doc: read-only tools bypass confirmation; **everything else is presumed state-mutating and confirmation-worthy**.
  - `untrustedContentHint: true` — output may contain UGC/third-party data; agents are told to apply "spotlighting" (delimiting or Base64-encoding untrusted content so the LLM treats it as data, not instructions). Available since Chrome 149.0.7810.0 (also honored in Puppeteer's WebMCP support, [puppeteer#14901](https://github.com/puppeteer/puppeteer/commit/0314942d5a1997c34afb8bb8660f8263c4975921)).
- **Structured vs text results**: canonical result = MCP-style `content` array of typed parts (`{type:"text", text}`); multimodal parts (images etc.) are open spec issues (#41, #86, #81), so text-only today. Bare strings/objects are accepted and normalized by current surfaces. `structuredContent`/`outputSchema` validation: open issues (#9, #92) — not a contract yet.
- **Elicitation / human-in-the-loop**: `requestUserInteraction()` appears in the spec narrative — original proposal example (stale page, [proposal.html](https://webmachinelearning.github.io/webmcp/docs/proposal.html)): `const confirmed = await agent.requestUserInteraction(async () => { ...confirm(...)... })` — and Chrome's secure-tools doc says the spec "includes `requestUserInteraction()`" for input before/during execution. User-confirmation design is still active discussion (spec issues #165, #50). **No documentation confirms it works in the Chrome 149 OT — treat as not-yet-usable** and implement in-page confirmation (section: Recommendations #5).
- **Character budgets** (Chrome secure-tools guardrail guidance): description ≤500; param description ≤150; names ≤30 recommended (≤128 hard); output ≤1.5K chars.

---

## 6. Official security guidance (prompt injection & trust boundaries)

Two Chrome docs, both linked from challenge resources:

**Tool-author side — [developer.chrome.com/docs/ai/webmcp/secure-tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools):**
- Threat model: indirect prompt injection — "it's impossible to guarantee safety inside of a large language model"; "there have been repeatable prompt injection attacks against agentic systems that use state-of-the-art LLMs, and the prevalence of attacks on the web is increasing."
- Recommendations: only expose tools to trusted origins (`exposedTo`); stricter bar for read-write than read-only tools; label UGC/external data with `untrustedContentHint`; mark reads `readOnlyHint`; keep names/descriptions/outputs within the character budgets above; keep a human in the loop (`requestUserInteraction()` referenced).
- Notably thin on concrete input-validation/output-sanitization recipes — Steward's quarantine implementation goes *beyond* the official guidance, which is a good differentiation line.

**Agent side — [developer.chrome.com/docs/agents/security](https://developer.chrome.com/docs/agents/security):**
- Three-part trust model: malicious tool *manifests* (attack instructions hidden in names/descriptions/params), *contaminated outputs* (trusted site returns third-party/UGC data carrying injected instructions), vs *user intent* as the only authoritative directive.
- Defense-in-depth: deterministic guardrails (token limits, origin restrictions, mandatory confirmation for state-changing actions) + probabilistic guardrails ("spotlighting" — demarcating untrusted content via delimiters or Base64 so it's treated as data).
- Verbatim: "Agents in the browser can operate within a user's authenticated session, so it's critical that agent developers design protections against malicious input from untrusted content." And: "Assume WebMCP tools mutate state, unless the tool description or annotations (`readOnlyHint`) clearly state otherwise."
- **Steward alignment**: the agent-side spotlighting duty triggers off `untrustedContentHint`. Steward should do the page-side half — wrap attacker-controlled on-chain strings in explicit quarantine delimiters *inside* tool output text AND set the annotation — so protection holds even in agents that ignore the hint. Cite both docs in the submission.

---

## 7. Testing / eval tooling ("test before you ship")

- **`webmcp-evals`** ([GoogleChromeLabs/webmcp-tools/webmcp-evals](https://github.com/GoogleChromeLabs/webmcp-tools); docs at [developer.chrome.com/docs/ai/webmcp/evals](https://developer.chrome.com/docs/ai/webmcp/evals)): TypeScript framework + CLI testing LLM tool-calling against your tools. Modes: `npx webmcp-evals local -t schema.json -e evals.json` (static schemas), `browser -u https://… -e evals.json` (live page via Puppeteer), `smoke -u http://localhost:3000 -e evals.json` (deterministic, no LLM/key), `analyze report.json` (LLM root-cause on failures). Backends: Google Generative AI (default `gemini-3.5-flash`), Ollama, Vercel AI SDK; needs `.env` API keys. Eval format: `{name, messages:[{role:"user",…}], expectedCall:[{functionName, arguments}]}` with matchers `$pattern`, `$contains`, `$gt/$gte/$lt/$lte`, `$type`, `$any`. Reports: console/json/html into `.evals/`.
- Chrome's testing philosophy ([evals doc](https://developer.chrome.com/docs/ai/webmcp/evals)): deterministic tests for tool logic/UI updates; probabilistic evals for "does the model understand your tool's purpose from its description and schema", correct tool+params selection, multi-step journeys. Fix failures by improving descriptions/schemas, not by patching narrow model behaviors.
- **Manual**: DevTools Application → WebMCP "Run tool"; Model Context Tool Inspector extension; ChatGPT Site tools panel (Recently used calls). Also [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) ships a WebMCP skill for coding agents.
- Suggested Steward CI: smoke mode against localhost on PRs; a small evals.json (one per tool + 2 injection-shaped journeys — e.g. a token name containing "ignore previous instructions" must not derail the expectedCall sequence) run pre-submission. An *adversarial eval case* doubles as demo material.

---

## 8. Challenge logistics (verified)

- Deadline **Sep 3, 2026, 1:00pm PDT**; $35k pool; 10× $3,000 OpenAI cash winners + sponsor prizes ([webmcp.devpost.com](https://webmcp.devpost.com/)).
- Judging (equal weight, tie-break sequential): WebMCP Leverage; Execution ("complete, coherent product experience — not just a technical proof of concept"); Potential Impact ("credible, specific case for solving a real problem for a real audience"); Creativity & Ambition.
- Deliverables: live URL working in ChatGPT's in-app browser or flagged Chrome 149+; description covering use-case fit / UX benefit / implementation; public repo with visible OSS license (detectable in the repo About); <3-min public YouTube video with audio, no third-party trademarks/copyrighted material.
- Judges' environments: ChatGPT desktop app built-in browser (default-on) and Chrome 149+ with the flag ([rules](https://webmcp.devpost.com/rules)).
- Full resource list: [webmcp.devpost.com/resources](https://webmcp.devpost.com/resources) (includes Cloudflare `webmcp-react` Workers template, Vercel shop PR [vercel/shop#498](https://github.com/vercel/shop/pull/498), Shopify [shopify.dev/docs/api/web-mcp](https://shopify.dev/docs/api/web-mcp)).

## Open questions / residual ambiguities

1. `requestUserInteraction()` availability in Chrome 149 OT / ChatGPT browser: undocumented; assume absent (design accordingly).
2. Free-tier ChatGPT: site-tools docs gate by model (Sol/Terra) and workspace, not plan; empirically verify once on a free account; keep a Plus account for the video.
3. `outputSchema`: present in Google demo code, absent from Chrome's documented descriptor; include if useful, expect it to be advisory.
4. Return normalization of bare strings/objects is behavior observed in official examples, not spec text — emit the canonical `{content:[…]}` envelope to be immune.
5. The origin-trial blog omits token mechanics detail; standard OT meta-tag/header applies — verify on registration if OT is pursued.
