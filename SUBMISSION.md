# Devpost submission — paste-ready copy

Field by field, in the order Devpost's form asks. Limits are Devpost's; the
counts below were checked with `wc -m` / `wc -w`. Judges may score on this
text and the repo alone without opening the app, so every claim here is one
the README and the live site back up.

---

## Step 2 · General info

**Project name** (≤ 60 chars)

    Steward

**Elevator pitch** (≤ 200 chars)

    Any agent in your browser can audit your token approvals, vet tokens, and stage revokes, transfers or swaps. Only your wallet can sign. No keys delegated, on-chain text quarantined.

---

## Step 3 · Project details

### Story ("About the project")

The field takes Markdown. Paste as is; the four `##` headers are the rules'
four content points, verbatim, and the extra sections answer Devpost's own
prompts (challenges, what we learned).

```markdown
## Why your use case is a strong fit for WebMCP

I built Steward because token approvals are how wallets get drained quietly. You approve a contract once, forget it, and years later it can still move your tokens. Auditing that is exactly the kind of tedious, high-stakes work people want to hand to an agent. But nobody should hand an agent their keys.

That constraint is what makes this a WebMCP problem rather than an MCP problem. A server-side tool can read the same public chain data. It can never finish the job, because the signature has to happen where the wallet lives: in the browser, on the page. With WebMCP the agent can scan, explain, and stage a fix, and then the wallet's own signing popup takes over. Neither the page nor the agent can draw that popup, click it, or skip it. `stage_revoke` returns `awaiting_user_confirmation`, and everything between that string and the confirm button in your wallet is the product.

[YOUR SENTENCE: one line in your own words on why you cared enough to spend the week on this.]

## How it creates a better user experience

Today, checking your approvals means digging through explorer logs, decoding allowances, and guessing whether an unknown spender contract is safe. Most people never do it. With Steward, "is my wallet safe?" is a conversation.

The agent calls `scan_approvals` on any address or ENS name, no wallet connected. It walks the worst results with `explain_approval`, where every point in the risk score is listed, so there is no black box. It can ask `discover_tokens` what is moving on Base, run `assess_token` on anything it finds (GoPlus contract checks, DexScreener liquidity, a Honeypot.is sell simulation, and it refuses to give a verdict on fewer than two sources), check `check_gas`, and then stage a revoke, a transfer, or a KyberSwap-quoted swap into one review queue. If the token it wants to buy is rated high-risk, the page refuses the swap until the agent has told you why and you have said yes.

You see a plain-language summary and the exact calldata, and you sign only what you accept. If you have no wallet extension at all, you still get the full audit on any pasted address. That was a deliberate choice for judges opening this in a browser without MetaMask.

## What people and agents can do together that was difficult or impossible before

An agent can now work on a live wallet, research a token's exit safety across three sources, and prepare real transactions, with zero delegated authority.

The current industry answer to agents with money is delegation: session keys, agent wallets, spending caps. Those bound the damage, but a prompt-injected agent still complies within its budget, and the security literature treats that as an open problem. Steward gives the agent nothing to delegate. No keys, no session key, no policy to write, no server enclave. The agent does the reading across thousands of on-chain events. The page checks every claim with a live `allowance()` read, because Approval events can be forged by any contract. You spend your attention on one cryptographic yes or no.

It also assumes the chain is hostile. Token names are attacker-controlled text, so every name and symbol is normalised, stripped of hidden characters, and wrapped in `⟦UNTRUSTED⟧` fences before an agent reads it. The demo wallet contains a token whose name is a prompt injection, with a zero-width space hiding the word "instructions" from keyword filters. Steward catches it, fences it, flags it, and scores the approval critical.

## Briefly explain how you implemented WebMCP

Eight tools are registered with `document.modelContext.registerTool()` through a small React hook I wrote, `useStewardTool` (GoogleChromeLabs' `use-webmcp-tool` was the prior art for its shape). The hook is where the rules live, so no tool can forget them: the standard MCP result envelope, a roughly 1.5K-character output budget measured across the whole envelope, and an automatic quarantine notice on every tool annotated `untrustedContentHint`. Read tools carry `readOnlyHint`. The three write tools (`stage_revoke`, `stage_transfer`, `stage_swap`) do not, and they can only stage into the review queue. Execution requires the user's wallet.

Registration is AbortController-managed and survives React StrictMode. Browsers without WebMCP get a local fallback registry that says plainly that no agent is present. I verified against native Chrome (`--enable-features=WebMCPTesting`, Chrome 151 and 152) with a CDP harness in the repo, `scripts/verify-native-webmcp.ts`, which checks that the real ModelContext holds all eight tools and can execute them. There are 51 tests around the quarantine, the swap gate, and the agent-facing formatting.

## Challenges I ran into

- Approval events are forgeable, so logs are only leads. Every candidate pair is checked with a live Multicall3 `allowance()` read, and only nonzero allowances survive. For vitalik.eth that is 2,293 candidate pairs from logs and 2,191 still live.
- Keyless data sources drift fast. Base's Blockscout went from usable to a ten-request budget during the week, so Base scanning moved to bounded `eth_getLogs` windows on the public RPC, and every failure shows as "live scan unavailable" instead of a blank page.
- I found a caching bug while staging the demo wallet: I set an allowance on-chain, confirmed it, and production kept serving the empty scan from before. Empty results were cached as long as full ones. They now expire in a minute.
- The first swap gate treated a missing risk verdict as clean. That is the wrong default for money. It now fails closed, and the gate is a pure function with its own tests.
- An adversarial review found two ways past the quarantine: fullwidth confusable characters that folded into a clean attack after normalisation, and keywords split by invisible characters. Detection now runs on the folded and stripped text as well as the raw bytes.

## What I learned

Prompt injection through on-chain metadata is one token deploy away, not hypothetical. Setting `untrustedContentHint` is necessary but not enough; the page has to fence the bytes itself so the protection holds in an agent that ignores hints. And the safest consent design is the one with nothing to delegate: when the only signing surface is the user's own wallet popup, there is no policy for a steered agent to comply within.

## Honesty notes

The demo address `0x1111…1111` is a fixture, hostile token included, and the UI labels it as demo data, so the headline demo survives any third-party outage. Every other address is scanned live. Claude Code helped me research, build, review, and write, and every commit it touched says so. The name, the thesis, the scope cuts, and every signature were mine. All code was written inside the submission period (first commit 2026-08-26). MIT licensed.```

### Built with (tags, ≤ 25)

    webmcp, nextjs, react, typescript, viem, wagmi, tailwindcss, vercel, bun,
    kyberswap, goplus, dexscreener, blockscout, multicall3

### "Try it out" links

- https://steward-zeta-ashen.vercel.app
- https://github.com/lepadatumihail/steward

### Video demo link

    (YouTube, PUBLIC, under 3:00 — paste before pressing Submit)

### Thumbnail / image gallery

Screenshot of the live app (3:2, 1500×1000) showing "WebMCP connected · 8/8
tools registered" and the quarantine banner. Optional second image: full
dashboard with all four demo approvals.

---

## Step 4 · Additional details (challenge questions)

**Public code repository URL**

    https://github.com/lepadatumihail/steward

**Testing instructions**

1. Chrome 149 or newer (verified on Chrome 152): open
   chrome://flags/#enable-webmcp-testing, set it to Enabled, relaunch.
2. Open https://steward-zeta-ashen.vercel.app. The status panel reads
   "WebMCP connected · 8/8 tools registered". DevTools → Application → WebMCP
   lists all eight tools (scan_approvals, explain_approval, discover_tokens,
   assess_token, check_gas, stage_revoke, stage_transfer, stage_swap), each
   with a manual "Run tool".
3. No wallet needed for the audit. Run scan_approvals with
   {"address":"vitalik.eth"} — a live on-chain scan, about 2,190 verified
   approvals, ~10 s cold. Or keep the demo address 0x1111…1111, a
   deterministic fixture with a planted hostile token: run explain_approval
   with {"approval_id":"ethereum:0xdead...:0x4444..."} to see the injection
   quarantine fire.
4. Trading loop, still no wallet: discover_tokens {"chain":"Base"} →
   assess_token {"token":"<address from the list>","chain":"Base"} →
   check_gas {"chain":"Base"}.
5. With any injected wallet (e.g. MetaMask), click "Connect wallet" (top
   right). stage_revoke, stage_transfer and stage_swap place actions in the
   review queue; "Sign in wallet" hands the exact calldata shown to your
   wallet. Steward never holds keys and never sends a transaction on its own.
6. Locally: `pnpm install && pnpm dev`. `bun test` runs the 51-test suite;
   `bun run scripts/verify-native-webmcp.ts` re-proves native registration
   end to end over CDP.

**Which agent(s) or client(s) did you test your WebMCP tools with?**

    Google Chrome 152 (and 151) with chrome://flags/#enable-webmcp-testing — the native document.modelContext, not a polyfill. Tested two ways:

    1. Manually, through DevTools → Application → WebMCP → "Run tool", which is also how the tools are invoked in the demo video.
    2. Programmatically, through a committed CDP harness (scripts/verify-native-webmcp.ts) that launches flagged Chrome headless, asserts the real ModelContext (not Steward's fallback shim) holds all eight tools with schemas and annotations intact, and calls executeTool end to end.

    Not tested in ChatGPT's in-app browser (no eligible plan on the team). The tools are registered imperatively in the top-level document, the path ChatGPT's WebMCP docs describe, so they should be discoverable there. Browsers without WebMCP get Steward's own local fallback registry, which is not an agent and says so in the UI.

**Which AI tools have you leveraged while working on this project?**

    Claude Code (Anthropic) throughout, as a coding agent and research partner. It ran the up-front research probes (WebMCP platform facts, keyless on-chain data sources, a scan of the challenge field), scaffolded the Next.js app, wrote the CDP verification harness, ran an adversarial security review that found and fixed eight confirmed issues (including two bypasses of the injection quarantine), and drafted the README and this submission text. Every commit it touched carries a Co-Authored-By line, and the decisions behind the build are recorded in the repo's wayfinder/ tickets. A human directed and reviewed all of it; the wallet, the keys, and every signature stayed with the human.

**Dropdowns** (options only visible in the form): pick the highest honest
level of learning, and "Yes" for AI value usable in your career.

**Login credentials**

    None — the app is public and watch-only mode needs no wallet.

---

## Step 5 · Submit

Press Submit and confirm the green "Submitted" tag on My Projects. A saved
Draft is not an entry. Edits stay open until Sep 3, 2026, 13:00 PDT (22:00
CEST); after that, touch nothing — not Devpost, not the repo, not the live
site — until winners are announced on Sep 23.
