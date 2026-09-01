# Devpost submission text (draft)

Working copy for the submission form. The four required content points are
covered in order, verbatim headers from the rules.

---

**Elevator pitch (one line):**
Steward turns any in-browser agent into a wallet partner that audits risks,
vets tokens, and stages the fixes — while only your wallet can sign anything.

---

## Why your use case is a strong fit for WebMCP

Wallet security has a property no other agent use case has: **the key can
never leave the browser.** A server-side MCP can read chain data, but it can
never complete the job — the signature must happen where the wallet lives,
page-side. WebMCP is the only architecture where an agent can investigate,
stage a fix, and then hand off to a **cryptographic human-in-the-loop gate**
(the wallet's own signing popup) that neither the page nor the agent can
render, bypass, or automate. Steward is built around that gap: `stage_revoke`
returns `awaiting_user_confirmation`, and the distance between that string and
the wallet's confirm button is the entire product.

## How it creates a better user experience

Approval hygiene is tedious, high-stakes work people simply don't do: dig
through explorer logs, decode allowances, judge unknown spender contracts.
With Steward, "is my wallet safe?" becomes one conversation with an agent. The
agent calls `scan_approvals` (any address or ENS name, no wallet needed), walks
the worst risks with `explain_approval` — every score itemised, never a black
box — vets a suspect token with `assess_token` (three independent keyless
sources: contract security, market liquidity, sell-simulation), checks
`check_gas` for a cheap moment, and stages revocations, transfers, or full
KyberSwap-quoted swaps into a review queue — where a high-risk output token is
refused by the page itself until the user has been told why. The human reviews plain-language summaries plus exact
calldata, and signs only what they accept. Watch-only mode means a judge with
no wallet extension gets the full audit experience on any pasted address.

## What people and agents can do together that was difficult or impossible before

An agent can now *safely operate on a live wallet* — audit it, research a
token's exit safety across three data sources, and prepare the transactions —
with **zero delegated authority**. The industry's current answer to
agents-with-money is delegation: session keys, agent wallets, spending caps
(ERC-7715, agentic wallet platforms) — and trusting the policy to hold against
prompt injection, which security literature still treats as unsolved: within
its budget, a steered agent complies. Steward's split needs no delegation at
all: no keys, no session key, no policy to author, no server enclave. The split:
the agent does the research across thousands of on-chain events; the page
ground-truths every claim (live `allowance()` reads — approval events are
forgeable); the human spends their attention only on the final, cryptographic
yes/no. And it's adversarially robust: on-chain token names are
attacker-controlled text, so Steward quarantines every one behind unforgeable
fences before an agent reads it — the demo wallet includes a token whose name
is a prompt-injection attack, caught and neutralised live.

## Briefly explain how you implemented WebMCP

Seven tools registered with `document.modelContext.registerTool()` through a
hand-rolled React hook (`useStewardTool`, prior art: GoogleChromeLabs'
`use-webmcp-tool`). The hook centrally enforces what tools must not be able to
forget: the canonical MCP result envelope, the ~1.5K-char output budget
measured across the whole envelope, and an automatic quarantine notice on
every tool annotated `untrustedContentHint`. Read tools carry `readOnlyHint`;
the two write tools (`stage_revoke`, `stage_transfer`) deliberately don't, and
they can only *stage* into one shared review queue — execution requires the
user's wallet. Registration is AbortController-managed and
StrictMode-safe; browsers without WebMCP get an honest local fallback registry
that never claims an agent is present. Verified against native Chrome
(`--enable-features=WebMCPTesting`) with a committed CDP harness:
`scripts/verify-native-webmcp.ts`.

---

## Form fields

- **Try it out:** https://steward-zeta-ashen.vercel.app
- **Repo:** https://github.com/lepadatumihail/steward
- **Built with:** webmcp, nextjs, react, typescript, viem, wagmi, tailwindcss, vercel
- **Video:** (YouTube link, PUBLIC, <3:00 — add before submitting)

## Testing instructions (form field)

1. Chrome 149+: enable `chrome://flags/#enable-webmcp-testing`, restart.
2. Open https://steward-zeta-ashen.vercel.app — the status panel shows
   "WebMCP connected", and DevTools → Application → WebMCP lists all six
   tools (`scan_approvals`, `explain_approval`, `assess_token`, `check_gas`,
   `stage_revoke`, `stage_transfer`, `stage_swap`) with manual Run tool.
3. No wallet needed for the audit: try `vitalik.eth` (live on-chain scan,
   ~2,200 verified approvals) or keep the demo address — a deterministic
   fixture whose planted hostile token demonstrates the injection quarantine.
4. With any injected wallet, staged revokes gain a live "Sign in wallet"
   button (chain-guarded; the shown calldata is exactly what you sign).
5. `bun test` runs the 45-test suite; `scripts/verify-native-webmcp.ts`
   re-proves native registration end-to-end.
