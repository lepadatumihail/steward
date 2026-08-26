---
id: T15
title: Probe tx-history and gas data endpoints
type: research
status: open
assignee:
blocked-by: []
---

## Question

[Lock the thesis and scope of Steward](T01-lock-the-thesis.md) brought two capabilities into must-ship scope whose data endpoints were never probed: **tx history / explain-this-tx** and the **gas advisor**. They ride on hosts already validated by [Approvals and token-risk data sources](T03-approvals-data-sources.md) (Blockscout, publicnode/drpc public RPCs), but on different endpoints — and this map's standing rule is that docs lag reality, so probe before committing:

- **Blockscout `module=account&action=txlist`** (and `tokentx`) on `eth.blockscout.com` and `base.blockscout.com`: keyless? paging shape, row schema, latency on a busy wallet, and whether the **Base throttle** found in the approvals probe (sticky ~5–15 min 429/500 on event-spammed wallets) bites here too.
- **Transaction-detail fetch** for explain-this-tx: which single call returns receipt + logs + decoded input most cheaply — Blockscout `action=gettxinfo`, `eth_getTransactionReceipt` on public RPC, or the already-proven `eth_simulateV1` path.
- **`eth_feeHistory` / `eth_gasPrice`** keyless on `ethereum-rpc.publicnode.com`, `eth.drpc.org`, `mainnet.base.org`, `base-rpc.publicnode.com`: latency, and whether base-fee percentile data is rich enough for a credible "is now a good time" answer, or whether the gas advisor degrades to a plain current-fee readout.
- **Contract-ABI lookup** for decoding history rows: does Blockscout `action=getabi` serve verified ABIs keyless on both chains?

Record findings in `wayfinder/assets/T15-findings.md`, redacting any keys. If an endpoint is dead, name the fallback and the degradation path — a "history truncated for this unusually noisy wallet" style degradation was already accepted as MVP-acceptable in the approvals probe.

Resolution feeds [Final tool surface and schemas](T07-final-tool-surface.md) (schemas for the history and gas tools) and may add work to [Harden the Base data lane](T14-harden-base-lane.md) if the Base throttle extends to these endpoints.
