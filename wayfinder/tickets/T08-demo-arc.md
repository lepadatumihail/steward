---
id: T08
title: Demo arc and burner wallet plan
type: grilling
status: open
assignee:
blocked-by: [T01]
---

## Question

Lock the 3-minute video beat sheet and the demo assets behind it:

- ~~Mainnet vs testnet lane~~ — **settled** by [Lock the thesis and scope of Steward](T01-lock-the-thesis.md): **Base mainnet burner, ~$5**, funded/held/signed by the human. Remaining question is only *which* approvals to stage on it (next bullet).
- Which stale/unlimited approvals to pre-stage on the burner, against which spenders (one unverified spender may need a tiny throwaway contract deploy, ~$0.50).
- Which public "messy" address anchors the read-only audit demo (spam airdrops, many approvals) — judges must be able to reproduce this with zero wallet.
- Where the injection-moment token comes from (real spam airdrop vs planted token with an instruction-shaped name).
- Beat sheet: problem (30s) → audit in ChatGPT's browser (60s) → stage-and-sign revokes (45s) → injection quarantine (20s) → why-only-WebMCP close (15s). Confirm or amend.

Resolution feeds the video-script fog patch and defines demo-mode requirements for the app.

### Settled by the locked thesis

- **Shooting target confirmed**: the human has ChatGPT Plus/Pro with the desktop app, so tool invocation is reliable on GPT-5.6 Sol/Terra — shoot the video in the **ChatGPT desktop browser**, with Chrome 149 + `#enable-webmcp-testing` as the backup lane and the wallet-extension path.
- **Beat sheet needs a re-check, not a rewrite**: the concept broadened to a wallet copilot with a safety core, and the video still **leads with safety**. Confirm the existing beats still fit — and decide whether any of the newly in-scope tools (explain-this-tx, staged transfers, gas) earn video seconds, or whether they exist only for the judge who opens the live URL. Screen time is the scarcest resource in a 3-minute cut; breadth is evidence of completeness, not a beat.
- **Never on camera**: seed phrases, private keys, funding flows. The human drives every signing moment.
